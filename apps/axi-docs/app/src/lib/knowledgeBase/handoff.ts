/**
 * Handoff cards + workspace-status surface for the knowledgeBase split.
 *
 * - `getProjectHandoffCard` / `getHandoffSnapshotStatus` / `getProjectSummary` /
 *   `getWorkspaceStatus`
 * - Handoff test wrappers (`__loadHandoffProjectsForTests` etc.)
 *
 * The handoff-test helpers used by `collectWorkspaceDocuments` (in indexer.ts)
 * live in `indexer.ts` because they are private plumbing. This file owns the
 * public handoff API.
 */

import fs from 'fs'
import path from 'path'
import type { KnowledgeCatalogItem } from '../../types'
import type { HandoffProject, ProjectHandoffCard, ProjectSummary } from './types'
import { computeAgeDays, HANDOFF_STALE_DAYS, normalizeReadiness } from './utils'
import { getKnowledgeCatalog } from './catalog'

// Re-export the public handoff-related types so callers can keep the
// existing import surface (`from './knowledgeBase'`).
export type {
  ProjectHandoffCard,
  ProjectSummary,
  HandoffProject,
  HandoffReadiness,
} from './types'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getWorkspaceStatus(): Promise<{
  sourceId: 'workspace'
  totalProjects: number
  totalDocs: number
  generatedAt: string
  recentProjects: KnowledgeCatalogItem[]
  sections: Array<{ key: string; title: string; count: number }>
}> {
  const catalog = await getKnowledgeCatalog('workspace')
  return {
    sourceId: 'workspace',
    totalProjects: catalog.sections
      .flatMap((section) => section.items)
      .filter((item) => item.docType === 'project').length,
    totalDocs: catalog.totalDocs,
    generatedAt: catalog.generatedAt,
    recentProjects: catalog.recentDocs.filter((item) => item.docType === 'project').slice(0, 8),
    sections: catalog.sections.map((section) => ({
      key: section.key,
      title: section.title,
      count: section.count,
    })),
  }
}

export async function getProjectHandoffCard(
  projectId: string,
  options: { now?: Date; handoffPath?: string } = {},
): Promise<ProjectHandoffCard> {
  const now = options.now || new Date()
  // Default: read from the same path the build script reads. Tests can
  // override `handoffPath` to point at a temp fixture.
  const targetPath = options.handoffPath
    || path.join('/Volumes/code/workspace', '.workspace', 'project-handoff.json')
  const emptyCard: ProjectHandoffCard = {
    state: 'missing',
    readiness: 'unknown',
    score: 0,
    readOrder: [],
    entrypoints: [],
    smokeCommand: null,
    verifyCommand: null,
    currentWork: { active: [], knownFailures: [] },
    lastVerifiedAt: null,
    ageDays: null,
    handoffPath: null,
    manifestPath: null,
    handoffSource: 'none',
    handoffGeneratedAt: null,
  }
  let raw: string
  try {
    raw = await fs.promises.readFile(targetPath, 'utf-8')
  } catch {
    return emptyCard
  }
  let snapshot: { projects?: HandoffProject[]; generatedAt?: string }
  try {
    snapshot = JSON.parse(raw)
  } catch {
    return emptyCard
  }
  if (!Array.isArray(snapshot.projects)) return emptyCard
  const generatedAt = typeof snapshot.generatedAt === 'string' ? snapshot.generatedAt : null
  const normalized = projectId.trim().toLowerCase()
  const hit = snapshot.projects.find((p) => typeof p.id === 'string' && p.id.toLowerCase() === normalized)
  if (!hit) {
    return {
      ...emptyCard,
      handoffSource: 'handoff',
      handoffGeneratedAt: generatedAt,
      ageDays: computeAgeDays(generatedAt, now),
    }
  }
  const lastVerifiedAt = typeof hit.lastVerifiedAt === 'string' ? hit.lastVerifiedAt : null
  const ageDays = computeAgeDays(lastVerifiedAt || generatedAt, now)
  const staleThreshold = HANDOFF_STALE_DAYS
  const commands = (hit.commands || {}) as { verify?: string[]; smoke?: string[] }
  const currentWork = (hit.currentWork || {}) as { active?: string | string[]; knownFailures?: string[] }
  const activeList = Array.isArray(currentWork.active)
    ? currentWork.active
    : typeof currentWork.active === 'string'
      ? [currentWork.active]
      : []
  return {
    state: typeof ageDays === 'number' && ageDays > staleThreshold ? 'stale' : 'ok',
    readiness: normalizeReadiness(hit.readiness),
    score: typeof hit.score === 'number' ? hit.score : 0,
    readOrder: Array.isArray(hit.readOrder) ? hit.readOrder.filter((s): s is string => typeof s === 'string') : [],
    entrypoints: Array.isArray(hit.entrypoints)
      ? hit.entrypoints
          .filter((e) => e && typeof e === 'object')
          .map((e) => ({
            id: typeof e.id === 'string' ? e.id : '',
            path: typeof e.path === 'string' ? e.path : '',
            purpose: typeof e.purpose === 'string' ? e.purpose : '',
          }))
      : [],
    smokeCommand: Array.isArray(commands.smoke) && commands.smoke.length > 0
      ? commands.smoke[0]
      : null,
    verifyCommand: Array.isArray(commands.verify) && commands.verify.length > 0
      ? commands.verify[0]
      : null,
    currentWork: {
      active: activeList.filter((s): s is string => typeof s === 'string'),
      knownFailures: Array.isArray(currentWork.knownFailures)
        ? currentWork.knownFailures.filter((s): s is string => typeof s === 'string')
        : [],
    },
    lastVerifiedAt,
    ageDays,
    handoffPath: typeof hit.handoffPath === 'string' ? hit.handoffPath : null,
    manifestPath: typeof hit.manifestPath === 'string' ? hit.manifestPath : null,
    handoffSource: 'handoff',
    handoffGeneratedAt: generatedAt,
  }
}

export async function getHandoffSnapshotStatus(options: { now?: Date; handoffPath?: string } = {}): Promise<{
  source: 'handoff' | 'none'
  generatedAt: string | null
  ageDays: number | null
}> {
  const card = await getProjectHandoffCard('__status__', options)
  return {
    source: card.handoffSource,
    generatedAt: card.handoffGeneratedAt,
    ageDays: card.ageDays,
  }
}

export async function getProjectSummary(projectId: string): Promise<ProjectSummary | null> {
  const normalized = projectId.trim().toLowerCase()
  const catalog = await getKnowledgeCatalog('workspace')
  const items = catalog.sections.flatMap((section) => section.items)
  const catalogItem = items.find((item) => (
    item.docType === 'project'
    && (
      item.name.toLowerCase() === normalized
      || item.title.toLowerCase() === normalized
      || item.path.toLowerCase().includes(normalized)
      || item.description?.toLowerCase().includes(normalized)
    )
  )) || null
  // If the catalog hit is on a project's overview item, projectId for
  // handoff lookup is the catalog item's `projectId` if set, otherwise the
  // item's `name`. This keeps the join stable across handoff versions.
  const handoffLookupId = catalogItem?.projectId || catalogItem?.name || projectId
  const handoff = await getProjectHandoffCard(handoffLookupId)
  if (!catalogItem) {
    // The catalog may not have the project (e.g. hand-curated addenda),
    // but handoff might. Return a stub item so MCP can still surface the
    // handoff fields.
    if (handoff.state === 'missing' && handoff.handoffSource === 'none') {
      return null
    }
    return {
      sourceId: 'workspace',
      path: `projects/${handoffLookupId}/README.md`,
      name: handoffLookupId,
      title: handoffLookupId,
      tags: [],
      categories: ['projects'],
      techStack: [],
      handoff,
    } as ProjectSummary
  }
  return { ...catalogItem, handoff }
}