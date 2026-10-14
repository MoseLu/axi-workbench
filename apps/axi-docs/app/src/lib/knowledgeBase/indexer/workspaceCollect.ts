/**
 * Workspace document collector.
 *
 * Combines the governance handoff snapshot with the legacy
 * `WORKSPACE_INDEX.md` table, the rendered project suite or per-project root
 * governance docs, the project-catalog index, the root workspace docs
 * (AGENTS/PRD/TDD/...) and the synthetic `axi-skills` project entry into a
 * single `ParsedDocument[]`.
 */

import fs from 'fs'
import path from 'path'
import type {
  DocSource,
  Frontmatter,
} from '../../../types'
import type {
  ParsedDocument,
  WorkspaceProjectInfo,
} from '../types'
import {
  extractDescription,
  extractRawTitle,
  getHandoffSnapshotPath,
  mapHandoffProjectToWorkspaceInfo,
  parseMarkdownDocument,
  resolveLastUpdated,
  splitMarkdownTableRow,
} from '../utils'
import { createVirtualParsedDocument } from './parseDocument'
import {
  buildWorkspaceProjectRootDocuments,
  buildWorkspaceProjectSuiteDefinitions,
  buildWorkspaceProjectDocuments,
  parseWorkspaceProjectRow,
} from './workspaceProject'
import { buildFrontmatter } from '../catalog'

// ---------------------------------------------------------------------------
// Handoff loaders (used by collectWorkspaceDocuments)
// ---------------------------------------------------------------------------

async function __loadHandoffProjects(workspaceRoot: string) {
  const handoffPath = getHandoffSnapshotPath(workspaceRoot)
  try {
    const raw = await fs.promises.readFile(handoffPath, 'utf-8')
    const snapshot = JSON.parse(raw) as { projects?: unknown[]; generatedAt?: string }
    if (!Array.isArray(snapshot.projects)) {
      return { source: 'none' as const, projects: [], generatedAt: null, handoffPath, error: new Error('snapshot missing projects[]') }
    }
    const generatedAt = typeof snapshot.generatedAt === 'string' ? snapshot.generatedAt : null
    const projects = snapshot.projects
      .map((entry) => mapHandoffProjectToWorkspaceInfo(entry as never, generatedAt))
      .filter((entry): entry is WorkspaceProjectInfo => entry !== null)
    if (projects.length === 0) {
      return { source: 'none' as const, projects: [], generatedAt, handoffPath, error: new Error('snapshot projects[] mapped to empty list') }
    }
    return { source: 'handoff' as const, projects, generatedAt, handoffPath, error: null as Error | null }
  } catch (error) {
    return {
      source: 'none' as const,
      projects: [],
      generatedAt: null,
      handoffPath,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Decide whether to render a workspace project from the project root's own
 * governance files (README/AGENTS/PRD/TDD/...) or fall back to the synthetic
 * four-piece suite. Local-only projects (lifecycle contains 'local') should
 * always use the suite path; their on-disk files are not part of the
 * canonical dossier surface.
 */
function __shouldUseSuiteDefinitionsForProject(
  project: WorkspaceProjectInfo,
  projectRootExists: boolean,
): boolean {
  if (!projectRootExists) return true
  // Local-only projects (e.g. axi-pet, axi-feishu-codex-bridge) keep their
  // root private; render the synthetic 4-piece suite.
  const projectPath = project.projectPath
  if (typeof projectPath !== 'string') return true
  // Best-effort signal: lifecycle is not stored in WorkspaceProjectInfo, but
  // the synthetic path also fires when the project name ends in '-local' or
  // the path contains '/local/' as a defensive marker.
  if (/\/local\//i.test(projectPath)) return true
  return false
}

/**
 * Exclude kinds that should never produce virtual workspace documents
 * (reference repos, cockpit dashboards, etc.).
 */
function __isExcludedWorkspaceKind(kind: string | undefined): boolean {
  if (!kind) return false
  const normalized = kind.trim().toLowerCase()
  return normalized === 'reference' || normalized === 'cockpit'
}

export function __loadHandoffProjectsForTests(workspaceRoot: string) {
  return __loadHandoffProjects(workspaceRoot)
}

export function __shouldUseSuiteDefinitionsForProjectForTests(
  project: WorkspaceProjectInfo,
  projectRootExists: boolean,
) {
  return __shouldUseSuiteDefinitionsForProject(project, projectRootExists)
}

export function __isExcludedWorkspaceKindForTests(kind: string | undefined) {
  return __isExcludedWorkspaceKind(kind)
}

export function __getHandoffPathForTests(workspaceRoot: string) {
  return getHandoffSnapshotPath(workspaceRoot)
}

// Local helper: buildFrontmatter lives in catalog.ts (presentation layer);
// we import it directly via top-level import — ES module late-binding
// resolves the cycle between this module and catalog.ts.
function buildFrontmatterLocal(meta: Record<string, unknown>): string {
  return buildFrontmatter(meta)
}

// ---------------------------------------------------------------------------
// collectWorkspaceDocuments
// ---------------------------------------------------------------------------

export async function collectWorkspaceDocuments(source: DocSource): Promise<ParsedDocument[]> {
  const workspaceRoot = path.resolve(source.path, '../..')
  const workspaceIndexPath = path.join(workspaceRoot, 'WORKSPACE_INDEX.md')
  const catalogPath = path.join(source.path, 'docs', 'project-catalog.md')
  const documents: ParsedDocument[] = []
  let workspaceIndexStat: fs.Stats | null = null
  let updated = new Date().toISOString()

  let indexText = ''
  try {
    workspaceIndexStat = await fs.promises.stat(workspaceIndexPath)
    indexText = await fs.promises.readFile(workspaceIndexPath, 'utf-8')
    updated = resolveLastUpdated(workspaceIndexPath, workspaceIndexStat)
  } catch {
    indexText = ''
  }

  // Handoff-first: try the governance snapshot before falling back to the
  // legacy markdown table. The handoff is the authoritative source for
  // readiness, commands, and current work.
  const handoffResult = await __loadHandoffProjects(workspaceRoot)
  const handoffKindById = new Map<string, string>()
  if (handoffResult.source === 'handoff' && handoffResult.handoffPath) {
    try {
      const snapshot = JSON.parse(await fs.promises.readFile(handoffResult.handoffPath, 'utf-8'))
      if (Array.isArray(snapshot.projects)) {
        for (const raw of snapshot.projects) {
          if (raw && typeof raw.id === 'string') {
            handoffKindById.set(raw.id, typeof raw.kind === 'string' ? raw.kind : '')
          }
        }
      }
    } catch {
      // If the snapshot cannot be re-read here, the kind filter degrades to
      // letting everything through — better to over-render than to drop
      // legitimate projects.
    }
  }

  const workspaceProjects = handoffResult.source === 'handoff'
    ? handoffResult.projects
    : indexText
      .split('\n')
      .filter((line) => line.startsWith('|') && !line.includes('| ---'))
      .map(splitMarkdownTableRow)
      .filter((row) => row.length >= 7)
      .map((row) => parseWorkspaceProjectRow(row, updated))
      .filter((project): project is WorkspaceProjectInfo => Boolean(project))

  for (const project of workspaceProjects) {
    // Reference / cockpit kinds are loaded into the list (so the build script
    // can still see them) but skipped during virtual document generation.
    const kind = handoffKindById.get(project.id)
    if (kind && __isExcludedWorkspaceKind(kind)) continue
    const projectRootDocuments = await buildWorkspaceProjectRootDocuments(source, project)
    const projectRootExists = projectRootDocuments.length > 0
    const useSuite = __shouldUseSuiteDefinitionsForProject(project, projectRootExists)
    documents.push(...(!useSuite
      ? projectRootDocuments
      : buildWorkspaceProjectSuiteDefinitions(project).map((definition) => {
        const documentPath = definition.suffix
          ? `projects/${project.id}/${definition.suffix}.md`
          : `projects/${project.id}.md`
        const raw = buildFrontmatterLocal({
          id: `workspace-${project.id}${definition.suffix ? `-${definition.suffix}` : ''}`,
          title: definition.title,
          type: definition.docType,
          status: project.status,
          tags: definition.tags,
          created: project.updated,
          modified: project.updated,
          'graph-title': definition.title,
          'graph-tags': definition.graphTags,
          stack: project.stack,
          verification: project.verification,
          description: definition.description,
        }) + definition.body

        return createVirtualParsedDocument({
          sourceId: source.id,
          path: documentPath,
          name: definition.name,
          title: definition.title,
          rawTitle: definition.title,
          description: definition.description,
          docType: definition.docType,
          status: project.status,
          tags: definition.tags,
          categories: definition.categories,
          updated: project.updated,
          raw,
          body: definition.body,
          frontmatter: parseMarkdownDocument(raw).data as Frontmatter,
          aliases: definition.aliases || [project.name],
          sourceTags: [
            ...definition.sourceTags,
            `project-id:${project.id}`,
            `project-name:${project.name}`,
            `workspace-doc-type:${definition.docType}`,
          ],
          techStack: project.stack ? project.stack.split(',').map((item) => item.trim()).filter(Boolean) : [],
          projectId: project.id,
          projectTitle: project.name,
          documentTypeKey: definition.docType,
        })
      })))
  }

  if (fs.existsSync(catalogPath)) {
    const stat = await fs.promises.stat(catalogPath)
    const raw = await fs.promises.readFile(catalogPath, 'utf-8')
    const catalogUpdated = resolveLastUpdated(catalogPath, stat)
    documents.push(createVirtualParsedDocument({
      sourceId: source.id,
      path: 'governance/project-catalog.md',
      name: 'project-catalog',
      title: 'Workspace Project Catalog',
      rawTitle: 'Workspace Project Catalog',
      description: '用途：工作区项目可读目录。范围：Axi workspace projects。对象：项目治理和入口导航',
      docType: 'index',
      status: 'active',
      tags: ['索引', '项目', '工作区'],
      categories: ['indexes'],
      updated: catalogUpdated,
      raw,
      body: parseMarkdownDocument(raw).content,
      frontmatter: {
        id: 'workspace-project-catalog',
        title: 'Workspace Project Catalog',
        type: 'index',
        status: 'active',
        tags: ['索引', '项目', '工作区'],
        modified: catalogUpdated,
        'graph-title': 'Workspace Project Catalog',
        'graph-tags': ['索引', '项目'],
      },
      aliases: ['project-catalog', 'workspace catalog'],
      sourceTags: ['index', 'project', 'workspace'],
    }))
  }

  if (fs.existsSync(workspaceIndexPath)) {
    const stat = workspaceIndexStat || await fs.promises.stat(workspaceIndexPath)
    const indexUpdated = resolveLastUpdated(workspaceIndexPath, stat)
    documents.push(createVirtualParsedDocument({
      sourceId: source.id,
      path: 'WORKSPACE_INDEX.md',
      name: 'WORKSPACE_INDEX',
      title: 'Axi Workspace Index',
      rawTitle: 'Axi Workspace Index',
      description: '用途：工作区级项目地图。范围：Codex 本地 workspace。对象：项目定位、路径解析和治理入口',
      docType: 'index',
      status: 'active',
      tags: ['索引', '项目', '工作区'],
      categories: ['indexes'],
      updated: indexUpdated,
      raw: indexText,
      body: parseMarkdownDocument(indexText).content,
      frontmatter: {
        id: 'axi-workspace-index',
        title: 'Axi Workspace Index',
        type: 'index',
        status: 'active',
        tags: ['索引', '项目', '工作区'],
        modified: indexUpdated,
        'graph-title': 'Axi Workspace Index',
        'graph-tags': ['索引', '项目'],
      },
      aliases: ['WORKSPACE_INDEX', 'workspace index'],
      sourceTags: ['index', 'project', 'workspace'],
    }))
  }

  const axiSkillsPath = path.resolve(workspaceRoot, 'shared', 'axi-skills')
  if (fs.existsSync(axiSkillsPath) && !documents.some((document) => document.projectId === 'axi-skills' || document.rawTitle === 'Axi Skills' || document.name.startsWith('axi-skills'))) {
    const axiSkillsProject = parseWorkspaceProjectRow([
      'Axi Skills',
      axiSkillsPath,
      'Axi 智能体共享技能树，用于沉淀可版本化、可复用的智能体技能入口。',
      'Markdown, Agent Skills',
      'active',
      'README.md, skills/**/SKILL.md, skills.zh/**/SKILL.md',
      'scripts/verify.py when editing skills; scripts/verify_i18n.py --all --json when editing localized mirrors',
      '工作区智能体与技能维护者使用的共享技能库。',
    ], updated)
    if (axiSkillsProject) {
      const axiSkillsRootDocuments = await buildWorkspaceProjectRootDocuments(source, axiSkillsProject)
      documents.push(...(axiSkillsRootDocuments.length > 0
        ? axiSkillsRootDocuments
        : buildWorkspaceProjectDocuments(source, [
          'Axi Skills',
          axiSkillsPath,
          'Axi 智能体共享技能树，用于沉淀可版本化、可复用的智能体技能入口。',
          'Markdown, Agent Skills',
          'active',
          'README.md, skills/**/SKILL.md, skills.zh/**/SKILL.md',
          'scripts/verify.py when editing skills; scripts/verify_i18n.py --all --json when editing localized mirrors',
          '工作区智能体与技能维护者使用的共享技能库。',
        ], updated)))
    }
  }

  // --- Root workspace-level documents (WRK-DOCS-001) ---
  // Ingest root AGENTS.md, docs/DEV_SERVICES.md, and selected docs/axi/* files
  // so they appear in the workspace bundle alongside project index pages.
  // A. bundlePath 冲突修复：根 /AGENTS.md 与 /docs/AGENTS.md 分离，避免 MCP 端 bundlePath 冲突
  await addRootWorkspaceDoc(workspaceRoot, 'AGENTS.md', 'docs/AGENTS-ROOT.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/DEV_SERVICES.md', 'docs/DEV_SERVICES.md', documents)

  // B. zh-CN 镜像与根级长期文档摄入（addRootWorkspaceDoc 在文件缺失时静默跳过）
  await addRootWorkspaceDoc(workspaceRoot, 'AGENTS.zh-CN.md', 'docs/AGENTS.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'WORKSPACE_INDEX.zh-CN.md', 'docs/WORKSPACE_INDEX.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'ONBOARDING.zh-CN.md', 'docs/ONBOARDING.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'ONBOARDING-REFERENCE.zh-CN.md', 'docs/ONBOARDING-REFERENCE.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'CHANGE.md', 'docs/CHANGE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'CHANGELOG.md', 'docs/CHANGELOG.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'README.md', 'docs/README.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'README.zh-CN.md', 'docs/README.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'INDEX.md', 'docs/INDEX.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/DEV_SERVICES.zh-CN.md', 'docs/DEV_SERVICES.zh-CN.md', documents)

  // C. docs/state/ 长期工作状态文档（README/PRD/TDD/TODO/MILESTONE/VERIFICATION/CLI-REFERENCE）
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/README.md', 'docs/state/README.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/PRD.md', 'docs/state/PRD.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/TDD.md', 'docs/state/TDD.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/TODO.md', 'docs/state/TODO.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/MILESTONE.md', 'docs/state/MILESTONE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/VERIFICATION.md', 'docs/state/VERIFICATION.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/CLI-REFERENCE.md', 'docs/state/CLI-REFERENCE.md', documents)

  // D. docs/audit/ + docs/architecture/ 摄入
  await addRootWorkspaceDoc(workspaceRoot, 'docs/audit/audit-results-2026-09-25.md', 'docs/audit/audit-results-2026-09-25.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/architecture/workspace-backend-architecture.md', 'docs/architecture/workspace-backend-architecture.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/architecture/axi-notify-architecture.md', 'docs/architecture/axi-notify-architecture.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/architecture/ai-resource-orchestration-architecture.md', 'docs/architecture/ai-resource-orchestration-architecture.md', documents)

  // E. docs/axi/ + docs/prd/ + docs/registry/ 摄入（含 P0 contracts、命名合约、PRD 与模板）
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/AXIOMATICWORLD_NAMING.md', 'docs/axi/AXIOMATICWORLD_NAMING.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/AXIOMATICWORLD_NAMING.zh-CN.md', 'docs/axi/AXIOMATICWORLD_NAMING.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md', 'docs/axi/contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/contracts/AI_CAPABILITY_CONTRACT.md', 'docs/axi/contracts/AI_CAPABILITY_CONTRACT.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/contracts/MINIMAX_TOKENPLAN_CONTRACT.md', 'docs/axi/contracts/MINIMAX_TOKENPLAN_CONTRACT.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/contracts/OLLAMA_LOCAL_CONTRACT.md', 'docs/axi/contracts/OLLAMA_LOCAL_CONTRACT.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/README.md', 'docs/prd/README.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/00-PRD-SYSTEM-GUIDE.md', 'docs/prd/00-PRD-SYSTEM-GUIDE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/01-AxiomaticWorld-Personal-OS-PRD.md', 'docs/prd/01-AxiomaticWorld-Personal-OS-PRD.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md', 'docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/templates/PROJECT-PRD-TEMPLATE.md', 'docs/prd/templates/PROJECT-PRD-TEMPLATE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/templates/SPRINT-PRD-TEMPLATE.md', 'docs/prd/templates/SPRINT-PRD-TEMPLATE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/registry/project-cross-references.md', 'docs/registry/project-cross-references.md', documents)

  // F. .claude/ + scripts/ + incubator/ 摄入（根级文件统一归并到 docs/ bundlePath 命名空间）
  await addRootWorkspaceDoc(workspaceRoot, '.claude/PARADIGM.md', 'docs/.claude/PARADIGM.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, '.claude/ARCHITECTURE.md', 'docs/.claude/ARCHITECTURE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'scripts/AGENTS.md', 'docs/scripts/AGENTS.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'scripts/AGENTS.zh-CN.md', 'docs/scripts/AGENTS.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'scripts/README.md', 'docs/scripts/README.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'incubator/AGENTS.md', 'docs/incubator/AGENTS.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'incubator/README.md', 'docs/incubator/README.md', documents)

  // Selected docs/axi/ files: AGENTS.md, naming contract, ADR index, and contracts
  const axiDocsRoot = path.join(workspaceRoot, 'docs', 'axi')
  const axiRootFiles = ['AGENTS.md', 'AXIOMATICWORLD_NAMING.md', 'CHANGE.md']
  for (const fileName of axiRootFiles) {
    await addRootWorkspaceDoc(axiDocsRoot, fileName, `docs/axi/${fileName}`, documents)
  }
  await addRootWorkspaceDoc(path.join(axiDocsRoot, 'adr'), 'README.md', 'docs/axi/adr/README.md', documents)
  const contractsDir = path.join(axiDocsRoot, 'contracts')
  const contractFiles = ['AXI_ACCOUNTS_SHARED_SCHEMA.md']
  for (const fileName of contractFiles) {
    await addRootWorkspaceDoc(contractsDir, fileName, `docs/axi/contracts/${fileName}`, documents)
  }

  return documents.sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
}

export async function addRootWorkspaceDoc(
  rootDir: string,
  fileName: string,
  bundlePath: string,
  documents: ParsedDocument[],
): Promise<void> {
  // Deduplicate by bundlePath: if the same bundlePath is already present, skip.
  // Root workspace docs may be declared by multiple call sites (e.g. both the
  // explicit `addRootWorkspaceDoc(...)` lines above and the `axiRootFiles` /
  // `contractFiles` loops below, or by future overrides). Skipping duplicates
  // here prevents `documents.length` from being inflated by repeated pushes.
  if (documents.some((d) => d.path === bundlePath)) {
    return
  }
  const fullPath = path.join(rootDir, fileName)
  if (!fs.existsSync(fullPath)) return
  const stat = await fs.promises.stat(fullPath)
  if (!stat.isFile()) return
  const raw = await fs.promises.readFile(fullPath, 'utf-8')
  const parsed = parseMarkdownDocument(raw)
  const frontmatter = parsed.data as Frontmatter
  const body = parsed.content
  const updated = resolveLastUpdated(fullPath, stat, frontmatter)
  const rawTitle = extractRawTitle(frontmatter, body, fileName.replace(/\.md$/i, ''))
  const description = extractDescription(frontmatter, body)
  documents.push(createVirtualParsedDocument({
    sourceId: 'workspace',
    path: bundlePath,
    name: bundlePath.replace(/^.*\//, '').replace(/\.md$/i, ''),
    title: rawTitle,
    rawTitle,
    description,
    docType: 'index',
    status: 'active',
    tags: ['工作区', '长期文档'],
    categories: ['indexes'],
    updated,
    raw,
    body,
    frontmatter: {
      ...frontmatter,
      id: typeof frontmatter.id === 'string' ? frontmatter.id : `workspace-${bundlePath.replace(/[\\/]+/g, '-')}`,
      title: rawTitle,
      type: 'index',
      status: 'active',
      tags: ['工作区', '长期文档'],
      modified: updated,
      'graph-title': rawTitle,
      'graph-tags': ['工作区'],
    },
    aliases: [rawTitle, bundlePath],
    sourceTags: ['workspace-root', 'operator-docs'],
  }))
}