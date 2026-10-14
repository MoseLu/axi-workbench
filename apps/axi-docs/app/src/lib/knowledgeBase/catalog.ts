/**
 * Catalog, directory-index, and presentation-layer helpers for the
 * knowledgeBase split.
 *
 * - `getKnowledgeCatalog` / `getKnowledgeDocuments` / `getKnowledgeDirectoryIndex`
 * - Workspace catalog section grouping
 * - Frontmatter serialisation (`buildFrontmatter`)
 * - `toKnowledgeCatalogItem` / `sortCatalogItems` helpers used by both
 *   `skills.ts` and `indexer.ts` via lazy require to avoid cycles.
 */

import path from 'path'
import {
  getKnowledgeCategoryMeta,
  KNOWLEDGE_CATEGORY_ORDER,
} from '../../config/knowledgeRules'
import type {
  DocSource,
  FileItem,
  Frontmatter,
  KnowledgeCatalog,
  KnowledgeCatalogItem,
  StaticKnowledgeDocument,
} from '../../types'
import type { ParsedDocument } from './types'
import { truncateText, WORKSPACE_DOCUMENT_TYPE_DEFINITIONS, WORKSPACE_DOCUMENT_TYPE_ORDER } from './utils'
import { getKnowledgeTags, getLocalSourceIndex } from './indexer'
import { getSource, listBlinkoNotes } from './sources'
import { buildSkillCatalogSections } from './skills'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function sortCatalogItems(items: KnowledgeCatalogItem[]): KnowledgeCatalogItem[] {
  return [...items].sort((left, right) => {
    const leftDate = Date.parse(left.updated || '')
    const rightDate = Date.parse(right.updated || '')
    if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate) && rightDate !== leftDate) {
      return rightDate - leftDate
    }
    return left.title.localeCompare(right.title, 'zh-CN')
  })
}

export function toKnowledgeCatalogItem(document: ParsedDocument): KnowledgeCatalogItem {
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

export function buildFrontmatter(meta: Record<string, unknown>): string {
  if (Object.keys(meta).length === 0) return ''
  const lines = ['---']
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((entry) => String(entry)).join(', ')}]`)
      continue
    }
    lines.push(`${key}: ${String(value)}`)
  }
  lines.push('---', '')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Static-document rendering helpers (skills-source specific)
// ---------------------------------------------------------------------------

export function sanitizeStaticFrontmatter(source: DocSource, document: ParsedDocument): Frontmatter {
  if (source.adapter !== 'skills') return document.frontmatter

  return {
    id: typeof document.frontmatter.id === 'string' ? document.frontmatter.id : `${source.id}:${document.name}`,
    title: document.title,
    type: document.docType || 'skill',
    status: document.status || 'active',
    tags: document.tags,
    modified: document.updated,
    description: truncateText(document.description),
    sourcePath: document.path,
    'graph-title': document.graphTitle || document.title,
    'graph-tags': ['技能', 'Agent'],
  }
}

export function buildFileItemFrontmatter(source: DocSource, document: ParsedDocument): Frontmatter {
  if (source.adapter === 'skills') return sanitizeStaticFrontmatter(source, document)
  return document.frontmatter
}

function createStaticDocumentContent(source: DocSource, document: ParsedDocument): string {
  if (source.adapter !== 'skills') return document.raw

  const body = document.body.trim() || document.description || 'No skill body available.'
  return buildFrontmatter({
    id: document.frontmatter.id || `${source.id}:${document.name}`,
    title: document.title,
    type: document.docType || 'skill',
    status: document.status || 'active',
    tags: document.tags,
    modified: document.updated,
    description: truncateText(document.description),
    sourcePath: document.path,
    'graph-title': document.graphTitle || document.title,
    'graph-tags': ['技能', 'Agent'],
  }) + body
}

// ---------------------------------------------------------------------------
// Workspace catalog section grouping
// ---------------------------------------------------------------------------

function compareWorkspaceProjectItems(left: KnowledgeCatalogItem, right: KnowledgeCatalogItem): number {
  const projectOrder = (left.projectTitle || left.title).localeCompare(right.projectTitle || right.title, 'zh-CN')
  if (projectOrder !== 0) return projectOrder
  const leftTypeOrder = WORKSPACE_DOCUMENT_TYPE_ORDER.indexOf(left.documentTypeKey || '')
  const rightTypeOrder = WORKSPACE_DOCUMENT_TYPE_ORDER.indexOf(right.documentTypeKey || '')
  if (leftTypeOrder !== -1 || rightTypeOrder !== -1) {
    if (leftTypeOrder === -1) return 1
    if (rightTypeOrder === -1) return -1
    return leftTypeOrder - rightTypeOrder
  }
  return left.title.localeCompare(right.title, 'zh-CN')
}

export function buildWorkspaceCatalogSubsections(items: KnowledgeCatalogItem[]): KnowledgeCatalog['sections'][number]['subsections'] {
  const grouped = new Map<string, { title: string, items: KnowledgeCatalogItem[] }>()

  for (const item of items) {
    const key = item.projectId || item.path.split('/')[1] || item.name
    const title = item.projectTitle || key
    if (!grouped.has(key)) {
      grouped.set(key, { title, items: [] })
    }
    grouped.get(key)!.items.push(item)
  }

  return [...grouped.entries()]
    .sort((left, right) => left[1].title.localeCompare(right[1].title, 'zh-CN'))
    .map(([key, group]) => ({
      key,
      title: group.title,
      description: `${group.title} 的项目文档。`,
      count: group.items.length,
      items: [...group.items].sort(compareWorkspaceProjectItems),
    }))
}

export function buildWorkspaceCatalogSections(documents: ParsedDocument[]): KnowledgeCatalog['sections'] {
  const items = documents.map(toKnowledgeCatalogItem)
  const sections = WORKSPACE_DOCUMENT_TYPE_DEFINITIONS
    .map((definition) => {
      const sectionItems = items
        .filter((item) => item.documentTypeKey === definition.key)
        .sort(compareWorkspaceProjectItems)
      if (sectionItems.length === 0) return null
      return {
        key: `workspace-${definition.key}`,
        title: definition.title,
        description: definition.description,
        count: sectionItems.length,
        items: sectionItems,
        subsections: buildWorkspaceCatalogSubsections(sectionItems),
      }
    })
    .filter(Boolean) as KnowledgeCatalog['sections']

  const workspaceIndexes = items
    .filter((item) => !item.documentTypeKey)
    .sort(compareWorkspaceProjectItems)
  if (workspaceIndexes.length > 0) {
    sections.push({
      key: 'workspace-source-indexes',
      title: '工作区索引',
      description: 'WORKSPACE_INDEX 和治理目录等工作区级入口。',
      count: workspaceIndexes.length,
      items: workspaceIndexes,
      subsections: undefined,
    })
  }

  return sections
}

// ---------------------------------------------------------------------------
// Public catalog API
// ---------------------------------------------------------------------------

export async function getKnowledgeCatalog(sourceId: string): Promise<KnowledgeCatalog> {
  const source = getSource(sourceId)
  if (!source) {
    return {
      sourceId,
      totalDocs: 0,
      totalTags: 0,
      generatedAt: new Date().toISOString(),
      topTags: [],
      recentDocs: [],
      sections: [],
    }
  }

  if (source.type === 'api') {
    const notes = await listBlinkoNotes(source)
    const items: KnowledgeCatalogItem[] = notes.map((note) => ({
      sourceId: source.id,
      path: String(note.id),
      name: `Blinko #${note.id}`,
      title: note.content.split('\n')[0].slice(0, 60) || `Blinko #${note.id}`,
      description: note.content.replace(/\s+/g, ' ').slice(0, 120),
      docType: note.type === 0 ? 'flash-note' : 'note',
      tags: note.tags || [],
      categories: ['resources'],
      techStack: [],
      updated: note.updatedAt || note.createdAt,
    }))
    return {
      sourceId: source.id,
      totalDocs: items.length,
      totalTags: new Set(items.flatMap((item) => item.tags)).size,
      generatedAt: new Date().toISOString(),
      topTags: await getKnowledgeTags(source.id),
      recentDocs: sortCatalogItems(items).slice(0, 8),
      sections: [
        {
          key: 'resources',
          title: 'Blinko 快速记录',
          description: '近期闪念和碎片内容，适合先做模糊回忆检索。',
          count: items.length,
          items: sortCatalogItems(items),
        },
      ],
    }
  }

  const index = await getLocalSourceIndex(source)
  const sections = source.kind === 'skill-library'
    ? buildSkillCatalogSections(source, index.documents)
    : source.kind === 'workspace-registry'
      ? buildWorkspaceCatalogSections(index.documents)
      : KNOWLEDGE_CATEGORY_ORDER
      .map((key) => {
        const items = sortCatalogItems(index.documents
          .filter((document) => document.categories.includes(key))
          .map(toKnowledgeCatalogItem))
        if (items.length === 0) return null
        const meta = getKnowledgeCategoryMeta(key)
        return {
          key,
          title: meta.title,
          description: meta.description,
          count: items.length,
          items,
        }
      })
      .filter(Boolean) as KnowledgeCatalog['sections']

  return {
    sourceId: source.id,
    totalDocs: index.documents.length,
    totalTags: index.tags.length,
    generatedAt: index.builtAt,
    topTags: index.tags.slice(0, 20),
    recentDocs: sortCatalogItems(index.documents.map(toKnowledgeCatalogItem)).slice(0, 8),
    sections,
  }
}

export async function getKnowledgeDocuments(sourceId: string): Promise<StaticKnowledgeDocument[]> {
  const source = getSource(sourceId)
  if (!source || source.type !== 'local') return []

  const index = await getLocalSourceIndex(source)
  return index.documents.map((document) => ({
    sourceId: document.sourceId,
    path: document.path,
    name: document.name,
    title: document.title,
    rawTitle: document.rawTitle,
    description: document.description,
    docType: document.docType,
    status: document.status,
    tags: [...document.tags],
    rawTags: [...document.sourceTags],
    categories: [...document.categories],
    techStack: [...document.techStack],
    updated: document.updated,
    graphTitle: document.graphTitle,
    content: createStaticDocumentContent(source, document),
    frontmatter: sanitizeStaticFrontmatter(source, document),
    aliases: [...document.aliases],
    sourceTags: [...document.sourceTags],
  }))
}

export async function getKnowledgeDirectoryIndex(sourceId: string): Promise<Record<string, FileItem[]>> {
  const source = getSource(sourceId)
  if (!source || source.type !== 'local') return {}

  const index = await getLocalSourceIndex(source)
  const directoryChildren = new Map<string, FileItem[]>()
  const knownDirectories = new Set<string>([''])

  const ensureDirectory = (directoryPath: string) => {
    if (!directoryChildren.has(directoryPath)) {
      directoryChildren.set(directoryPath, [])
    }
    knownDirectories.add(directoryPath)
  }

  ensureDirectory('')

  for (const document of index.documents) {
    const segments = document.path.split('/').filter(Boolean)
    let currentDirectory = ''

    for (const [segmentIndex, segment] of segments.slice(0, -1).entries()) {
      const nextDirectory = currentDirectory ? `${currentDirectory}/${segment}` : segment
      ensureDirectory(nextDirectory)

      const parentChildren = directoryChildren.get(currentDirectory) || []
      const directoryId = `${source.id}:${nextDirectory}`
      if (!parentChildren.some((item) => item.id === directoryId)) {
        parentChildren.push({
          id: directoryId,
          name: segment,
          path: nextDirectory,
          relativePath: nextDirectory,
          type: 'directory',
          extension: '',
          lastModified: document.updated || index.builtAt,
          sourceId: source.id,
        })
        directoryChildren.set(currentDirectory, parentChildren)
      }

      currentDirectory = nextDirectory
      if (segmentIndex === segments.length - 2) {
        ensureDirectory(currentDirectory)
      }
    }

    const parentDirectory = segments.slice(0, -1).join('/')
    const parentChildren = directoryChildren.get(parentDirectory) || []
    const fileId = `${source.id}:${document.path}`
    if (!parentChildren.some((item) => item.id === fileId)) {
      parentChildren.push({
        id: fileId,
        name: `${document.name}.md`,
        path: document.path,
        relativePath: document.path,
        type: 'file',
        extension: path.extname(document.path) || '.md',
        lastModified: document.updated || index.builtAt,
        sourceId: source.id,
        tags: [...document.tags],
        rawTags: [...document.sourceTags],
        graphTitle: document.graphTitle,
        frontmatter: buildFileItemFrontmatter(source, document),
      })
      directoryChildren.set(parentDirectory, parentChildren)
    }
  }

  for (const directoryPath of knownDirectories) {
    const sorted = (directoryChildren.get(directoryPath) || [])
      .slice()
      .sort((left, right) => {
        if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
        return left.name.localeCompare(right.name, 'zh-CN')
      })
    directoryChildren.set(directoryPath, sorted)
  }

  return Object.fromEntries(directoryChildren.entries())
}