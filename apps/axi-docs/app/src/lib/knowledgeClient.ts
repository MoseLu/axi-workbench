import { getKnowledgeCategoryQueryHints } from '../config/knowledgeRules'
import { encodeBase64Url } from './routes'
import type {
  DocSource,
  FileItem,
  KnowledgeCatalog,
  KnowledgeGraphSnapshot,
  SearchResult,
  SearchSuggestion,
  StaticKnowledgeDocument,
  StaticKnowledgeManifest,
  StaticKnowledgeSourceBundle,
} from '../types'

type LoadedSourceBundle = StaticKnowledgeSourceBundle & {
  documentMap: Map<string, StaticKnowledgeDocument>
}

const STATIC_KNOWLEDGE_ROOT = 'generated/knowledge'
const manifestCache = { promise: null as Promise<StaticKnowledgeManifest> | null }
const bundleCache = new Map<string, Promise<LoadedSourceBundle>>()

export function resolveStaticKnowledgeAssetUrl(relativePath: string, base = import.meta.env.BASE_URL || '/'): string {
  const normalizedPath = relativePath.replace(/^\/+/, '')
  if (!base || base === '.' || base === './') return `/${normalizedPath}`
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${normalizedPath}`
}

async function fetchJson<T>(relativePath: string): Promise<T> {
  const response = await fetch(resolveStaticKnowledgeAssetUrl(relativePath))
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${relativePath}`)
  }
  return response.json() as Promise<T>
}

async function loadManifest() {
  manifestCache.promise ??= fetchJson<StaticKnowledgeManifest>(`${STATIC_KNOWLEDGE_ROOT}/manifest.json`)
  return manifestCache.promise
}

async function loadSourceBundle(sourceId: string) {
  if (!bundleCache.has(sourceId)) {
    bundleCache.set(
      sourceId,
      fetchJson<StaticKnowledgeSourceBundle>(`${STATIC_KNOWLEDGE_ROOT}/sources/${sourceId}/bundle.json`)
        .then((bundle) => ({
          ...bundle,
          documentMap: new Map(bundle.documents.map((document) => [document.path, document])),
        })),
    )
  }
  return bundleCache.get(sourceId)!
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '')
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

function normalizeSearchTokens(query: string) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/^#+/, ''))
    .filter(Boolean)
    .slice(0, 8)
}

function matchesQuery(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase()
  return tokens.every((token) => lower.includes(token))
}

function buildDocumentSearchResult(document: StaticKnowledgeDocument, query: string, filterTag?: string | null): SearchResult | null {
  const queryTokens = normalizeSearchTokens(query)
  if (queryTokens.length === 0) return null
  if (filterTag && !document.tags.includes(filterTag)) return null

  const body = stripFrontmatter(document.content)
  const matchedBy: string[] = []
  let score = 0
  const pathLower = document.path.toLowerCase()
  const titleLower = document.title.toLowerCase()
  const rawTitleLower = (document.rawTitle || '').toLowerCase()
  const descriptionLower = (document.description || '').toLowerCase()
  const bodyLower = body.toLowerCase()
  const normalizedQuery = queryTokens.join(' ')
  const snippetToken = queryTokens[0] || normalizedQuery

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
  if ((document.sourceTags || []).some((tag) => matchesQuery(tag.toLowerCase(), queryTokens))) {
    matchedBy.push('raw-tags')
    score += 8
  }
  if (document.aliases.some((alias) => matchesQuery(alias.toLowerCase(), queryTokens))) {
    matchedBy.push('aliases')
    score += 8
  }
  if (document.categories.some((category) => (
    getKnowledgeCategoryQueryHints(category).some((hint) => normalizedQuery.includes(hint.toLowerCase()))
  ))) {
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

  if (matchedBy.length === 0) return null

  const contentFrequency = bodyLower.split(snippetToken).length - 1
  score += Math.min(contentFrequency, 8)

  return {
    sourceId: document.sourceId,
    path: document.path,
    name: document.name,
    title: document.title,
    rawTitle: document.rawTitle,
    description: document.description,
    type: 'file',
    snippet: createSnippet(body, snippetToken),
    matches: [],
    score,
    tags: document.tags,
    rawTags: document.sourceTags,
    docType: document.docType,
    categories: document.categories,
    matchedBy,
  }
}

async function loadEnabledBundles() {
  const manifest = await loadManifest()
  const enabledSources = manifest.sources.filter((source) => source.enabled)
  const bundles = await Promise.all(enabledSources.map(async (source) => {
    try {
      return await loadSourceBundle(source.id)
    } catch {
      return null
    }
  }))

  return bundles.filter((bundle): bundle is LoadedSourceBundle => Boolean(bundle))
}

function hasTagMatch(documents: StaticKnowledgeDocument[], directoryPath: string, tag: string): boolean {
  const normalizedDirectory = directoryPath.replace(/^\/+|\/+$/g, '')
  const prefix = normalizedDirectory ? `${normalizedDirectory}/` : ''
  return documents.some((document) => {
    if (!document.tags.includes(tag)) return false
    return normalizedDirectory ? document.path.startsWith(prefix) : true
  })
}

function filterDirectoryEntries(
  entries: FileItem[],
  documents: StaticKnowledgeDocument[],
  filterTag?: string | null,
) {
  if (!filterTag) return entries
  return entries.filter((entry) => {
    if (entry.type === 'directory') {
      return hasTagMatch(documents, entry.relativePath, filterTag)
    }
    return (entry.tags || []).includes(filterTag)
  })
}

export async function listKnowledgeSources(): Promise<DocSource[]> {
  const manifest = await loadManifest()
  return manifest.sources.filter((source) => source.enabled)
}

export async function getDefaultKnowledgeSourceId() {
  const manifest = await loadManifest()
  return manifest.defaultSourceId
}

export async function getKnowledgeCatalog(sourceId: string): Promise<KnowledgeCatalog | null> {
  try {
    const bundle = await loadSourceBundle(sourceId)
    return bundle.catalog
  } catch {
    return null
  }
}

export async function getKnowledgeTags(sourceId: string) {
  try {
    const bundle = await loadSourceBundle(sourceId)
    return bundle.tags
  } catch {
    return []
  }
}

export async function readKnowledgeFile(sourceId: string, filePath: string) {
  try {
    const bundle = await loadSourceBundle(sourceId)
    return bundle.documentMap.get(filePath)?.content || null
  } catch {
    return null
  }
}

export async function scanKnowledgeSource(sourceId: string, dirPath?: string, filterTag?: string | null) {
  try {
    const bundle = await loadSourceBundle(sourceId)
    const directoryKey = (dirPath || '').replace(/^\/+|\/+$/g, '')
    const entries = bundle.directoryIndex[directoryKey] || []
    return filterDirectoryEntries(entries, bundle.documents, filterTag)
  } catch {
    return []
  }
}

export async function searchKnowledge(sourceId: string, query: string, filterTag?: string | null): Promise<SearchResult[]> {
  const normalizedQuery = normalizeSearchTokens(query)
  if (normalizedQuery.length === 0) return []

  try {
    const bundle = await loadSourceBundle(sourceId)
    return bundle.documents
      .map((document) => buildDocumentSearchResult(document, query, filterTag))
      .filter((result): result is SearchResult => Boolean(result))
      .sort((left, right) => right.score - left.score)
      .slice(0, 30)
  } catch {
    return []
  }
}

export async function searchKnowledgeAll(query: string, filterTag?: string | null): Promise<SearchResult[]> {
  const normalizedQuery = normalizeSearchTokens(query)
  if (normalizedQuery.length === 0) return []

  const bundles = await loadEnabledBundles()
  return bundles
    .flatMap((bundle) => bundle.documents
      .map((document) => buildDocumentSearchResult(document, query, filterTag))
      .filter((result): result is SearchResult => Boolean(result)))
    .sort((left, right) => right.score - left.score)
    .slice(0, 60)
}

export async function getKnowledgeSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  const queryTokens = normalizeSearchTokens(query)
  if (queryTokens.length === 0) return []

  const normalizedQuery = queryTokens.join(' ')
  const bundles = await loadEnabledBundles()
  const tagSuggestions = new Map<string, SearchSuggestion & { score: number }>()
  const documentSuggestions: Array<SearchSuggestion & { score: number }> = []

  for (const bundle of bundles) {
    for (const tag of bundle.tags) {
      const lowerTag = tag.name.toLowerCase()
      if (!matchesQuery(lowerTag, queryTokens)) continue

      const score = lowerTag.startsWith(normalizedQuery) ? 240 : 180
      const key = tag.name.toLowerCase()
      const current = tagSuggestions.get(key)
      if (!current || score > current.score) {
        tagSuggestions.set(key, {
          kind: 'tag',
          label: `#${tag.name}`,
          query: `#${tag.name}`,
          meta: `${tag.count} 篇文档`,
          score,
        })
      }
    }

    for (const document of bundle.documents) {
      const titleLower = document.title.toLowerCase()
      const rawTitleLower = (document.rawTitle || '').toLowerCase()
      const pathLower = document.path.toLowerCase()
      const isTitleMatch = matchesQuery(titleLower, queryTokens) || (rawTitleLower && matchesQuery(rawTitleLower, queryTokens))
      const isPathMatch = matchesQuery(pathLower, queryTokens)

      if (!isTitleMatch && !isPathMatch) continue

      let score = isTitleMatch ? 220 : 150
      if (titleLower.startsWith(normalizedQuery) || rawTitleLower.startsWith(normalizedQuery)) {
        score += 40
      }

      documentSuggestions.push({
        kind: 'document',
        label: document.title,
        query: document.title,
        sourceId: document.sourceId,
        path: document.path,
        meta: document.description ? `${document.description} · ${document.path}` : document.path,
        score,
      })
    }
  }

  return [...documentSuggestions, ...tagSuggestions.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map(({ score: _score, ...suggestion }) => suggestion)
}

export async function getGlobalKnowledgeGraph(sourceId: string): Promise<KnowledgeGraphSnapshot> {
  const bundle = await loadSourceBundle(sourceId)
  return bundle.globalGraph
}

export async function getKnowledgeGraph(sourceId: string, filePath: string): Promise<KnowledgeGraphSnapshot> {
  return fetchJson<KnowledgeGraphSnapshot>(
    `${STATIC_KNOWLEDGE_ROOT}/sources/${sourceId}/graphs/${encodeBase64Url(filePath)}.json`,
  )
}

export function invalidateKnowledgeClientCache() {
  manifestCache.promise = null
  bundleCache.clear()
}
