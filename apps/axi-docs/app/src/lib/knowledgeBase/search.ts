/**
 * Search, scan, read and graph operations on the local source index.
 *
 * Everything in this file is read-only and operates on the
 * `LocalSourceIndex` produced by `indexer.ts`. The handoff-card layer lives
 * in `handoff.ts`; catalog/directory-index shape lives in `catalog.ts`.
 */

import fs from 'fs'
import path from 'path'
import { getKnowledgeCategoryQueryHints } from '../../config/knowledgeRules'
import type {
  DocSource,
  FileItem,
  GraphData,
  SearchResult,
} from '../../types'
import type { ParsedDocument } from './types'
import {
  isSupportedFile as _isSupportedFile,
  normalizeSlashes,
  WIKILINK_REGEX,
} from './utils'
import { getLocalSourceIndex } from './indexer'
import {
  blinkoRequest,
  getSource,
  listBlinkoNotes,
  listKnowledgeSources,
  resolveLocalPath,
} from './sources'
import { getKnowledgeDirectoryIndex } from './catalog'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function matchesQuery(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase()
  return tokens.every((token) => lower.includes(token))
}

function createSnippet(body: string, query: string): string {
  if (!body.trim()) return ''
  const normalizedBody = body.replace(/\s+/g, ' ')
  const lowerBody = normalizedBody.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerBody.indexOf(lowerQuery)
  if (index === -1) return normalizedBody.slice(0, 160)
  const start = Math.max(0, index - 70)
  const end = Math.min(normalizedBody.length, index + query.length + 110)
  return `${start > 0 ? '…' : ''}${normalizedBody.slice(start, end)}${end < normalizedBody.length ? '…' : ''}`
}

// ---------------------------------------------------------------------------
// Public search API
// ---------------------------------------------------------------------------

export async function searchKnowledge(
  sourceId: string,
  query: string,
  filterTag?: string | null,
): Promise<SearchResult[]> {
  const source = getSource(sourceId)
  const normalizedQuery = query.trim().toLowerCase()
  if (!source || !normalizedQuery) return []

  if (source.type === 'api') {
    const notes = await listBlinkoNotes(source)
    return notes
      .filter((note) => note.content.toLowerCase().includes(normalizedQuery))
      .filter((note) => !filterTag || (note.tags || []).includes(filterTag))
      .slice(0, 30)
      .map((note) => ({
        sourceId: source.id,
        path: String(note.id),
        name: note.content.split('\n')[0].slice(0, 60) || `Blinko #${note.id}`,
        title: note.content.split('\n')[0].slice(0, 60) || `Blinko #${note.id}`,
        type: 'blinko',
        snippet: createSnippet(note.content, query),
        matches: [],
        score: 10,
        tags: note.tags || [],
        docType: note.type === 0 ? 'flash-note' : 'note',
        categories: ['resources'],
        matchedBy: ['content'],
      }))
  }

  const index = await getLocalSourceIndex(source)
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean).slice(0, 8)
  const results: SearchResult[] = []

  for (const document of index.documents) {
    if (filterTag && !document.tags.includes(filterTag)) continue

    const matchedBy: string[] = []
    let score = 0
    const pathLower = document.path.toLowerCase()
    const titleLower = document.title.toLowerCase()
    const rawTitleLower = (document.rawTitle || '').toLowerCase()
    const descriptionLower = (document.description || '').toLowerCase()
    const bodyLower = document.body.toLowerCase()

    if (matchesQuery(titleLower, queryTokens)) {
      matchedBy.push('title')
      score += 20
    }
    if (rawTitleLower && matchesQuery(rawTitleLower, queryTokens)) {
      matchedBy.push('raw-title')
      score += 10
    }
    if (matchesQuery(pathLower, queryTokens)) {
      matchedBy.push('path')
      score += 12
    }
    if (document.tags.some((tag) => matchesQuery(tag.toLowerCase(), queryTokens))) {
      matchedBy.push('tags')
      score += 10
    }
    if (document.sourceTags.some((tag) => matchesQuery(tag.toLowerCase(), queryTokens))) {
      matchedBy.push('raw-tags')
      score += 8
    }
    if (document.aliases.some((alias) => matchesQuery(alias.toLowerCase(), queryTokens))) {
      matchedBy.push('aliases')
      score += 8
    }
    if (document.categories.some((category) => getKnowledgeCategoryQueryHints(category).some((hint) => normalizedQuery.includes(hint.toLowerCase())))) {
      matchedBy.push('category')
      score += 9
    }
    if (matchesQuery(descriptionLower, queryTokens)) {
      matchedBy.push('description')
      score += 5
    }
    if (matchesQuery(bodyLower, queryTokens)) {
      matchedBy.push('content')
      score += 6
    }

    if (matchedBy.length === 0) continue

    const contentFrequency = bodyLower.split(normalizedQuery).length - 1
    score += Math.min(contentFrequency, 8)

    results.push({
      sourceId: source.id,
      path: document.path,
      name: document.name,
      title: document.title,
      rawTitle: document.rawTitle,
      description: document.description,
      type: 'file',
      snippet: createSnippet(document.body, query),
      matches: [],
      score,
      tags: document.tags,
      rawTags: document.sourceTags,
      docType: document.docType,
      categories: document.categories,
      matchedBy,
    })
  }

  return results.sort((left, right) => right.score - left.score).slice(0, 30)
}

export async function searchKnowledgeAll(query: string, filterTag?: string | null): Promise<SearchResult[]> {
  const sources = listKnowledgeSources()
  const results = await Promise.all(sources.map(async (source) => {
    try {
      return await searchKnowledge(source.id, query, filterTag)
    } catch {
      return []
    }
  }))
  return results
    .flat()
    .sort((left, right) => right.score - left.score)
    .slice(0, 60)
}

// ---------------------------------------------------------------------------
// scanKnowledgeSource / readKnowledgeFile
// ---------------------------------------------------------------------------

function isExcludedNameLocal(name: string): boolean {
  return name.startsWith('.')
}

export async function scanKnowledgeSource(
  sourceId: string,
  dirPath?: string,
  filterTag?: string | null,
): Promise<FileItem[]> {
  const source = getSource(sourceId)
  if (!source) return []

  if (source.type === 'api') {
    const notes = await listBlinkoNotes(source)
    return notes
      .filter((note) => !filterTag || (note.tags || []).includes(filterTag))
      .map((note) => ({
        id: `${source.id}:${note.id}`,
        name: note.content.split('\n')[0].slice(0, 60) || `Blinko #${note.id}`,
        path: String(note.id),
        relativePath: String(note.id),
        type: 'file' as const,
        extension: '.md',
        lastModified: note.updatedAt || note.createdAt,
        sourceId: source.id,
        tags: note.tags || [],
        blinkoData: note,
      }))
  }

  if (source.adapter === 'skills' || source.adapter === 'workspace') {
    const directoryIndex = await getKnowledgeDirectoryIndex(source.id)
    const directoryKey = (dirPath || '').replace(/^\/+|\/+$/g, '')
    const entries = directoryIndex[directoryKey] || []
    if (!filterTag) return entries
    return entries.filter((entry) => entry.type === 'directory' || entry.tags?.includes(filterTag))
  }

  const basePath = resolveLocalPath(source, dirPath || '')
  if (!basePath || !fs.existsSync(basePath)) return []

  const index = await getLocalSourceIndex(source)

  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(basePath, { withFileTypes: true })
  } catch {
    return []
  }

  const items = await Promise.all(entries.map(async (entry) => {
    if (isExcludedNameLocal(entry.name)) return null
    const fullPath = path.join(basePath, entry.name)
    const relativePath = normalizeSlashes(dirPath ? path.join(dirPath, entry.name) : entry.name)
    const stat = await fs.promises.stat(fullPath)

    if (entry.isDirectory()) {
      return {
        id: `${source.id}:${relativePath}`,
        name: entry.name,
        path: fullPath,
        relativePath,
        type: 'directory' as const,
        extension: '',
        lastModified: stat.mtime.toISOString(),
        sourceId: source.id,
      }
    }

    if (!entry.isFile() || !_isSupportedFile(entry.name)) return null
    const parsed = index.byPath.get(relativePath)
    if (!parsed) return null
    if (filterTag && !parsed.tags.includes(filterTag)) return null
    return {
      id: `${source.id}:${relativePath}`,
      name: entry.name,
      path: fullPath,
      relativePath,
      type: 'file' as const,
      extension: path.extname(entry.name),
      lastModified: parsed.updated || stat.mtime.toISOString(),
      sourceId: source.id,
      tags: parsed.tags,
      rawTags: parsed.rawTags,
      graphTitle: parsed.graphTitle,
      frontmatter: parsed.frontmatter,
    }
  }))

  return (items.filter(Boolean) as FileItem[]).sort((left, right) => {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
    return left.name.localeCompare(right.name, 'zh-CN')
  })
  return []
}

export async function readKnowledgeFile(sourceId: string, filePath: string): Promise<string | null> {
  const source = getSource(sourceId)
  if (!source) return null

  if (source.type === 'api') {
    if (!filePath) return null
    const detail = await blinkoRequest<{ content?: string; contentText?: string }>(
      source,
      '/api/v1/note/detail',
      'POST',
      { id: Number(filePath) },
    )
    return detail.content || detail.contentText || null
  }

  if (source.adapter === 'skills' || source.adapter === 'workspace') {
    const index = await getLocalSourceIndex(source)
    return index.byPath.get(normalizeSlashes(filePath))?.raw || null
  }

  const fullPath = resolveLocalPath(source, filePath)
  if (!fullPath || !fs.existsSync(fullPath) || !_isSupportedFile(fullPath)) return null
  try {
    const index = await getLocalSourceIndex(source)
    if (!index.byPath.has(normalizeSlashes(filePath))) return null
    return await fs.promises.readFile(fullPath, 'utf-8')
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Knowledge graphs (per-doc + global)
// ---------------------------------------------------------------------------

export async function getKnowledgeGraph(sourceId: string, currentRelativePath: string): Promise<GraphData> {
  const source = getSource(sourceId)
  if (!source || source.type !== 'local') return { nodes: [], edges: [] }
  const index = await getLocalSourceIndex(source)
  const current = index.byPath.get(normalizeSlashes(currentRelativePath))
  if (!current) return { nodes: [], edges: [] }

  const nodes = new Map<string, GraphData['nodes'][number]>()
  const edges: GraphData['edges'] = []

  const addNode = (id: string, label: string, kind: 'current' | 'note' | 'tag') => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, label, kind, x: 0, y: 0, vx: 0, vy: 0 })
    }
  }

  addNode(current.path, current.title, 'current')

  const outgoing = new Set<string>()
  let match: RegExpExecArray | null
  WIKILINK_REGEX.lastIndex = 0
  while ((match = WIKILINK_REGEX.exec(current.body)) !== null) {
    const target = index.byStem.get(match[1].trim().toLowerCase())
    if (!target || target.path === current.path) continue
    outgoing.add(target.path)
    addNode(target.path, target.title, 'note')
    edges.push({ source: current.path, target: target.path, kind: 'wikilink' })
  }

  for (const tag of current.tags) {
    const tagId = `#${tag}`
    addNode(tagId, tag, 'tag')
    edges.push({ source: current.path, target: tagId, kind: 'tag' })
  }

  // Backlinks come from the precomputed reverse-wikilink index instead of
  // rescanning every document body on each call; the iteration order matches
  // the previous `index.documents` scan so emitted graphs stay identical.
  for (const documentPath of index.backlinkPathsByPath.get(current.path) || []) {
    if (documentPath === current.path || outgoing.has(documentPath)) continue
    const document = index.byPath.get(documentPath)
    if (!document) continue
    addNode(document.path, document.title, 'note')
    edges.push({ source: document.path, target: current.path, kind: 'wikilink' })
  }

  return { nodes: [...nodes.values()], edges }
}

export async function getGlobalKnowledgeGraph(sourceId: string): Promise<{
  nodes: Array<{ id: string; label: string; kind: 'note' | 'tag'; path?: string; tags?: string[] }>
  edges: Array<{ source: string; target: string; kind: 'wikilink' | 'tag' }>
  orphanNodes: Array<{ id: string; label: string; kind: 'note'; path?: string; tags?: string[] }>
}> {
  const source = getSource(sourceId)
  if (!source || source.type !== 'local') return { nodes: [], edges: [], orphanNodes: [] }

  const index = await getLocalSourceIndex(source)
  const edges: Array<{ source: string; target: string; kind: 'wikilink' | 'tag' }> = []
  const connected = new Set<string>()
  const tagCounts = new Map<string, number>()

  for (const document of index.documents) {
    WIKILINK_REGEX.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = WIKILINK_REGEX.exec(document.body)) !== null) {
      const target = index.byStem.get(match[1].trim().toLowerCase())
      if (!target || target.path === document.path) continue
      edges.push({ source: document.path, target: target.path, kind: 'wikilink' })
      connected.add(document.path)
      connected.add(target.path)
    }

    for (const tag of document.tags) {
      const tagId = `#${tag}`
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      edges.push({ source: document.path, target: tagId, kind: 'tag' })
      connected.add(document.path)
    }
  }

  const nodes: Array<{ id: string; label: string; kind: 'note' | 'tag'; path?: string; tags?: string[] }> = index.documents
    .filter((document) => connected.has(document.path))
    .map((document) => ({
      id: document.path,
      label: document.title,
      kind: 'note' as const,
      path: document.path,
      tags: document.tags,
    }))

  const orphanNodes = index.documents
    .filter((document) => !connected.has(document.path))
    .map((document) => ({
      id: document.path,
      label: document.title,
      kind: 'note' as const,
      path: document.path,
      tags: document.tags,
    }))

  for (const [tag, count] of tagCounts.entries()) {
    if (count < 2) continue
    nodes.push({ id: `#${tag}`, label: tag, kind: 'tag', tags: [] })
  }

  return { nodes, edges, orphanNodes }
}

// Silence "unused" warning for type-only imports.
export type _Unused = ParsedDocument | DocSource