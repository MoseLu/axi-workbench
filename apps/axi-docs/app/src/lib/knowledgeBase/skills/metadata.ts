/**
 * Skill catalog / index markdown builders.
 *
 * Builds:
 *   - `buildSkillIndexMarkdown` — the rendered skill index markdown body
 *   - `buildSkillCatalogSections` — the section list that powers the catalog
 *     UI (one section per skill family, plus the synthetic support-docs
 *     section).
 *
 * Both consumers accept an injected `toKnowledgeCatalogItem` mapper; the
 * local `_toKnowledgeCatalogItemLocal` is kept here so callers can opt out
 * of depending on `catalog.ts` directly.
 */

import type { DocSource, KnowledgeCatalog, KnowledgeCatalogItem } from '../../../types'
import type { ParsedDocument, SkillFamilyDefinition } from '../types'
import {
  AXI_SKILL_FAMILIES,
  DB_SKILL_FAMILIES,
  buildFallbackSkillFamily,
  getSkillFamily,
} from './families'
import { buildSkillCatalogSubsections, sortCatalogItems } from './subskills'

export function buildSkillIndexMarkdown(source: DocSource, skillDocs: ParsedDocument[], originalRaw: string): string {
  if (skillDocs.length === 0) return originalRaw

  const definitions = source.organizationHint === 'dbskill' ? DB_SKILL_FAMILIES : AXI_SKILL_FAMILIES
  const grouped = new Map<string, { definition: SkillFamilyDefinition, items: ParsedDocument[] }>()

  for (const document of skillDocs) {
    const definition = getSkillFamily(document, definitions) || buildFallbackSkillFamily(document, source)
    if (!grouped.has(definition.key)) {
      grouped.set(definition.key, { definition, items: [] })
    }
    grouped.get(definition.key)!.items.push(document)
  }

  const orderedKeys = definitions.map((definition) => definition.key)
  const groups = [...grouped.values()].sort((left, right) => {
    const leftOrder = orderedKeys.indexOf(left.definition.key)
    const rightOrder = orderedKeys.indexOf(right.definition.key)
    if (leftOrder !== -1 || rightOrder !== -1) {
      if (leftOrder === -1) return 1
      if (rightOrder === -1) return -1
      return leftOrder - rightOrder
    }
    if (right.items.length !== left.items.length) return right.items.length - left.items.length
    return left.definition.title.localeCompare(right.definition.title, 'zh-CN')
  })

  const lines = [
    `# ${source.name} 技能索引`,
    '',
    `当前索引 ${skillDocs.length} 个技能入口，按能力组组织；左侧侧栏只做快速入口，完整目录以本页分组为准。`,
    '',
    '## 能力分组',
    '',
    ...groups.map(({ definition, items }) => `- **${definition.title}**：${items.length} 个技能。${definition.description}`),
    '',
  ]

  for (const { definition, items } of groups) {
    lines.push(`## ${definition.title}`)
    lines.push('')
    lines.push(definition.description)
    lines.push('')
    lines.push('| Skill | Description | Path |')
    lines.push('|---|---|---|')
    for (const item of [...items].sort((left, right) => left.title.localeCompare(right.title, 'zh-CN') || left.path.localeCompare(right.path, 'zh-CN'))) {
      const description = (item.description || '').replace(/\s+/g, ' ').replace(/\|/g, '/')
      lines.push(`| \`${item.name}\` | ${description} | \`${item.path}\` |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// Local copy of toKnowledgeCatalogItem — kept here to avoid a top-level
// cycle with catalog.ts. Catalog.ts owns the canonical implementation; both
// stay identical so consumer code can pass `toKnowledgeCatalogItem` into this
// function (or rely on the inlined version below).
function _toKnowledgeCatalogItemLocal(document: ParsedDocument): KnowledgeCatalogItem {
  return {
    sourceId: document.sourceId,
    path: document.path,
    name: document.name,
    title: document.title,
    rawTitle: document.rawTitle,
    description: document.description,
    docType: document.docType,
    status: document.status,
    tags: [...document.tags],
    rawTags: [...(document.rawTags || [])],
    categories: [...document.categories],
    techStack: [...document.techStack],
    updated: document.updated,
    graphTitle: document.graphTitle,
    projectId: document.projectId,
    projectTitle: document.projectTitle,
    documentTypeKey: document.documentTypeKey,
  }
}

export function buildSkillCatalogSections(
  source: DocSource,
  documents: ParsedDocument[],
  toKnowledgeCatalogItem: (document: ParsedDocument) => KnowledgeCatalogItem = _toKnowledgeCatalogItemLocal,
): KnowledgeCatalog['sections'] {
  const skillDocs = documents.filter((document) => document.docType === 'skill')
  const supportDocs = documents.filter((document) => document.docType !== 'skill')
  const definitions = source.organizationHint === 'dbskill' ? DB_SKILL_FAMILIES : AXI_SKILL_FAMILIES
  const grouped = new Map<string, { definition: SkillFamilyDefinition, items: KnowledgeCatalogItem[] }>()

  for (const document of skillDocs) {
    const definition = getSkillFamily(document, definitions) || buildFallbackSkillFamily(document, source)
    if (!grouped.has(definition.key)) {
      grouped.set(definition.key, { definition, items: [] })
    }
    grouped.get(definition.key)!.items.push(toKnowledgeCatalogItem(document))
  }

  const orderedKeys = definitions.map((definition) => definition.key)
  const sections = [...grouped.values()]
    .sort((left, right) => {
      const leftOrder = orderedKeys.indexOf(left.definition.key)
      const rightOrder = orderedKeys.indexOf(right.definition.key)
      if (leftOrder !== -1 || rightOrder !== -1) {
        if (leftOrder === -1) return 1
        if (rightOrder === -1) return -1
        return leftOrder - rightOrder
      }
      if (right.items.length !== left.items.length) return right.items.length - left.items.length
      return left.definition.title.localeCompare(right.definition.title, 'zh-CN')
    })
    .map(({ definition, items }) => {
      const sortedItems = sortCatalogItems(items)
      return {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        count: items.length,
        items: sortedItems,
        subsections: source.organizationHint === 'skill-families'
          ? buildSkillCatalogSubsections(definition.key, sortedItems)
          : undefined,
      }
    })

  if (supportDocs.length > 0) {
    sections.unshift({
      key: 'skill-support-docs',
      title: source.organizationHint === 'dbskill' ? 'dbskill 知识包与模板' : '技能库附属文档',
      description: 'README、知识包、模板、脚手架和其他可复用支持文档。',
      count: supportDocs.length,
      items: sortCatalogItems(supportDocs.map(toKnowledgeCatalogItem)),
      subsections: undefined,
    })
  }

  return sections
}