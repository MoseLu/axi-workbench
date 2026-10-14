// Knowledge-base document source registry + skill library search helper.
// Backed by `lib/knowledgeBase` which is the canonical source of truth.

import * as knowledgeBase from '../lib/knowledgeBase'
import type { DocSource } from './types'

export type { DocSource }

export const docSources: DocSource[] = knowledgeBase.listKnowledgeSources()

export function sanitizeSource(source: DocSource) {
  return {
    id: source.id,
    name: source.name,
    path: source.path,
    enabled: source.enabled,
    description: source.description,
    type: source.type,
    kind: source.kind,
    adapter: source.adapter,
    audience: source.audience,
    readOnly: source.readOnly,
    organizationHint: source.organizationHint,
    apiUrl: source.apiUrl,
    icon: source.icon,
  }
}

export function resolveSource(sourceId: string): DocSource | null {
  return docSources.find((s) => s.id === sourceId && s.enabled) ?? null
}

export async function searchSkillLibraries(query: string) {
  const skillSourceIds = ['axi-skills', 'dbskill'].filter((sourceId) =>
    docSources.some((source) => source.id === sourceId && source.enabled),
  )
  const results = await Promise.all(
    skillSourceIds.map(async (sourceId) => knowledgeBase.searchKnowledge(sourceId, query)),
  )
  return results
    .flat()
    .sort((left, right) => right.score - left.score)
    .slice(0, 40)
}
