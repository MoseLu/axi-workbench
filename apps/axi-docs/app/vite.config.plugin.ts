import type { Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import {
  getKnowledgeDirectoryIndex,
  getKnowledgeDocuments,
  getGlobalKnowledgeGraph,
  getKnowledgeCatalog,
  getKnowledgeGraph,
  getProjectHandoffCard,
  getKnowledgeTags,
  listKnowledgeSources,
  readKnowledgeFile,
  scanKnowledgeSource,
  searchKnowledge,
  setLocalSourceIndexStaticMode,
} from './src/lib/knowledgeBase'
import { encodeBase64Url } from './src/lib/routes'
import type { DocSource, StaticKnowledgeManifest, StaticKnowledgeSourceBundle } from './src/types'

const rawHostedBase = process.env.AXI_APP_BASE || process.env.VITE_AXI_APP_BASE || ''
const normalizedHostedBase = rawHostedBase && rawHostedBase !== '/'
  ? rawHostedBase.replace(/\/$/u, '')
  : ''
const API_PREFIXES = Array.from(new Set([
  '/api',
  normalizedHostedBase ? `${normalizedHostedBase}/api` : '/api',
]))
const STATIC_KNOWLEDGE_ROOT = 'generated/knowledge'
const STATIC_KNOWLEDGE_PREFIXES = Array.from(new Set([
  `/${STATIC_KNOWLEDGE_ROOT}`,
  normalizedHostedBase ? `${normalizedHostedBase}/${STATIC_KNOWLEDGE_ROOT}` : `/${STATIC_KNOWLEDGE_ROOT}`,
]))
const STATIC_BUNDLE_VERSION = 1

function matchesApiPath(pathname: string, suffix: string): boolean {
  return API_PREFIXES.some((prefix) => pathname === `${prefix}${suffix}`)
}

type MiddlewareRequest = NodeJS.ReadableStream & {
  method?: string
  on: (event: 'data' | 'end', listener: (...args: any[]) => void) => void
  url?: string
}

type MiddlewareResponse = NodeJS.WritableStream & {
  setHeader: (name: string, value: string) => void
  end: (content?: string) => void
  statusCode: number
}

type NextFunction = () => void
type GeneratedKnowledgeAsset = {
  content: string
  contentType: string
}

function sanitizeSource(source: DocSource): DocSource {
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    path: '',
    enabled: source.enabled,
    type: 'local',
    kind: source.kind,
    adapter: source.adapter,
    audience: source.audience,
    readOnly: source.readOnly,
    icon: source.icon,
    ...(source.skillRoot ? { skillRoot: source.skillRoot } : {}),
    ...(source.locale ? { locale: source.locale } : {}),
  }
}

function jsonAsset(payload: unknown): GeneratedKnowledgeAsset {
  return {
    content: JSON.stringify(payload),
    contentType: 'application/json; charset=utf-8',
  }
}

const MANIFEST_ASSET_KEY = `${STATIC_KNOWLEDGE_ROOT}/manifest.json`
const BUNDLE_ASSET_PATTERN = new RegExp(
  `^${STATIC_KNOWLEDGE_ROOT}/sources/([^/]+)/bundle\\.json$`,
)
const GRAPH_ASSET_PATTERN = new RegExp(
  `^${STATIC_KNOWLEDGE_ROOT}/sources/([^/]+)/graphs/(.+)$`,
)

function listEnabledLocalSources(): DocSource[] {
  return listKnowledgeSources()
    .filter((source) => source.enabled && source.type === 'local')
    .map(sanitizeSource)
}

export function buildManifestAsset(): GeneratedKnowledgeAsset {
  const localSources = listEnabledLocalSources()
  const manifest: StaticKnowledgeManifest = {
    version: STATIC_BUNDLE_VERSION,
    generatedAt: new Date().toISOString(),
    defaultSourceId: localSources[0]?.id || null,
    sources: localSources,
  }
  return jsonAsset(manifest)
}

export async function buildSourceBundleAsset(sourceId: string): Promise<GeneratedKnowledgeAsset | null> {
  const source = listKnowledgeSources()
    .find((item) => item.id === sourceId && item.enabled && item.type === 'local')
  if (!source) return null

  const [catalog, tags, documents, directoryIndex, globalGraph] = await Promise.all([
    getKnowledgeCatalog(source.id),
    getKnowledgeTags(source.id),
    getKnowledgeDocuments(source.id),
    getKnowledgeDirectoryIndex(source.id),
    getGlobalKnowledgeGraph(source.id),
  ])

  const bundle: StaticKnowledgeSourceBundle = {
    version: STATIC_BUNDLE_VERSION,
    generatedAt: new Date().toISOString(),
    source: sanitizeSource(source),
    catalog,
    tags,
    documents,
    directoryIndex,
    globalGraph,
  }
  return jsonAsset(bundle)
}

export async function buildDocumentGraphAsset(
  sourceId: string,
  documentPath: string,
): Promise<GeneratedKnowledgeAsset> {
  return jsonAsset(await getKnowledgeGraph(sourceId, documentPath))
}

export interface SuggestIndexEntry {
  sourceId: string
  path: string
  title: string
  rawTitle?: string
  description?: string
  tags: string[]
}

export interface SuggestIndex {
  generatedAt: string
  entries: SuggestIndexEntry[]
  tags: Array<{ name: string; count: number }>
}

/**
 * Compact cross-source index for the search typeahead. Loading every source
 * bundle for suggestions costs tens of megabytes; this trims each document to
 * its identity fields so the whole index stays well under a megabyte.
 */
export async function buildSuggestIndexAsset(): Promise<GeneratedKnowledgeAsset> {
  const entries: SuggestIndexEntry[] = []
  const tagCounts = new Map<string, number>()

  for (const source of listEnabledLocalSources()) {
    const documents = await getKnowledgeDocuments(source.id)
    for (const document of documents) {
      entries.push({
        sourceId: document.sourceId,
        path: document.path,
        title: document.title,
        rawTitle: document.rawTitle,
        description: document.description ? document.description.slice(0, 120) : undefined,
        tags: document.tags,
      })
      for (const tag of document.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }
  }

  const tags = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)

  const payload: SuggestIndex = {
    generatedAt: new Date().toISOString(),
    entries,
    tags,
  }
  return jsonAsset(payload)
}

export async function buildStaticKnowledgeAssets(sourceIds?: string[]) {
  const assets = new Map<string, GeneratedKnowledgeAsset>()
  assets.set(MANIFEST_ASSET_KEY, buildManifestAsset())

  for (const source of listEnabledLocalSources().filter((item) => !sourceIds || sourceIds.includes(item.id))) {
    const bundle = await buildSourceBundleAsset(source.id)
    if (bundle) {
      assets.set(`${STATIC_KNOWLEDGE_ROOT}/sources/${source.id}/bundle.json`, bundle)
    }
    if (sourceIds) continue
    for (const document of await getKnowledgeDocuments(source.id)) {
      assets.set(
        `${STATIC_KNOWLEDGE_ROOT}/sources/${source.id}/graphs/${encodeBase64Url(document.path)}.json`,
        await buildDocumentGraphAsset(source.id, document.path),
      )
    }
  }

  return assets
}

/**
 * Lazily builds and caches knowledge assets one at a time: the manifest is
 * computable instantly, each source bundle on first request for that source,
 * and each per-document graph on first request for that document. Failed
 * builds are not cached so the next request retries.
 */
export function createLazyKnowledgeAssets() {
  let manifestPromise: Promise<GeneratedKnowledgeAsset | null> | null = null
  let suggestPromise: Promise<GeneratedKnowledgeAsset | null> | null = null
  const bundlePromises = new Map<string, Promise<GeneratedKnowledgeAsset | null>>()
  const graphPromises = new Map<string, Promise<GeneratedKnowledgeAsset | null>>()

  const getManifest = () => {
    manifestPromise ??= Promise.resolve()
      .then(buildManifestAsset)
      .catch(() => {
        manifestPromise = null
        return null
      })
    return manifestPromise
  }

  const getSuggest = () => {
    suggestPromise ??= Promise.resolve()
      .then(buildSuggestIndexAsset)
      .catch(() => {
        suggestPromise = null
        return null
      })
    return suggestPromise
  }

  const getBundle = (sourceId: string) => {
    let promise = bundlePromises.get(sourceId)
    if (!promise) {
      promise = buildSourceBundleAsset(sourceId).catch(() => {
        bundlePromises.delete(sourceId)
        return null
      })
      bundlePromises.set(sourceId, promise)
    }
    return promise
  }

  const getGraph = (sourceId: string, documentPath: string) => {
    const key = `${sourceId}:${documentPath}`
    let promise = graphPromises.get(key)
    if (!promise) {
      promise = buildDocumentGraphAsset(sourceId, documentPath).catch(() => {
        graphPromises.delete(key)
        return null
      })
      graphPromises.set(key, promise)
    }
    return promise
  }

  const reset = () => {
    manifestPromise = null
    suggestPromise = null
    bundlePromises.clear()
    graphPromises.clear()
  }

  return { getManifest, getSuggest, getBundle, getGraph, reset }
}

function matchStaticKnowledgeAsset(pathname: string): string | null {
  const SUGGEST_ASSET_KEY = `${STATIC_KNOWLEDGE_ROOT}/suggest.json`
  for (const prefix of STATIC_KNOWLEDGE_PREFIXES) {
    if (pathname === prefix) return `${STATIC_KNOWLEDGE_ROOT}/manifest.json`
    if (pathname === `${prefix}/suggest.json`) return SUGGEST_ASSET_KEY
    if (pathname.startsWith(`${prefix}/`)) {
      return `${STATIC_KNOWLEDGE_ROOT}/${pathname.slice(prefix.length + 1)}`
    }
  }
  return null
}

function createStaticKnowledgeMiddleware(
  lazyAssets: ReturnType<typeof createLazyKnowledgeAssets>,
) {
  return (req: MiddlewareRequest, res: MiddlewareResponse, next: NextFunction) => {
    void (async () => {
      const url = new URL(req.url || '/', 'http://localhost')
      const assetKey = matchStaticKnowledgeAsset(url.pathname)
      if (!assetKey) {
        next()
        return
      }

      let asset: GeneratedKnowledgeAsset | null = null
      const bundleMatch = BUNDLE_ASSET_PATTERN.exec(assetKey)
      const graphMatch = GRAPH_ASSET_PATTERN.exec(assetKey)
      if (assetKey === MANIFEST_ASSET_KEY) {
        asset = await lazyAssets.getManifest()
      } else if (assetKey === `${STATIC_KNOWLEDGE_ROOT}/suggest.json`) {
        asset = await lazyAssets.getSuggest()
      } else if (bundleMatch) {
        asset = await lazyAssets.getBundle(bundleMatch[1])
      } else if (graphMatch) {
        const documentPath = Buffer.from(graphMatch[2], 'base64url').toString('utf8')
        asset = documentPath ? await lazyAssets.getGraph(graphMatch[1], documentPath) : null
      }

      if (!asset) {
        res.statusCode = 404
        res.end('Not found')
        return
      }

      res.setHeader('Content-Type', asset.contentType)
      res.setHeader('Cache-Control', 'no-store')
      res.end(asset.content)
    })().catch((error) => {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    })
  }
}

async function analyzeDocument(content: string, fileName: string) {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    })

    const truncated = content.slice(0, 8000)
    const response = await anthropic.messages.create({
      model: process.env.AI_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze this document and return JSON only, no prose.

Document: "${fileName}"

${truncated}

Return exactly:
{
  "summary": "2-3 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "concepts": [
    { "term": "concept name", "definition": "brief explanation" }
  ]
}`,
      }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    return JSON.parse(clean)
  } catch (error) {
    return {
      summary: '',
      keyPoints: [],
      concepts: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function sendJson(res: MiddlewareResponse, payload: unknown) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(payload))
}

async function buildFileInfo(sourceId: string, filePath: string) {
  const source = listKnowledgeSources().find((item) => item.id === sourceId && item.type === 'local')
  if (!source) return null
  const documents = await getKnowledgeDocuments(sourceId)
  const admittedDocument = documents.find((document) => document.path === filePath)
  if (!admittedDocument) return null
  const fullPath = path.join(source.path, filePath)
  if (!fs.existsSync(fullPath)) return null

  const stat = await fs.promises.stat(fullPath)
  return {
    id: `${sourceId}:${filePath}`,
    name: admittedDocument.name,
    path: fullPath,
    relativePath: filePath,
    type: 'file',
    extension: path.extname(filePath),
    lastModified: stat.mtime.toISOString(),
    sourceId,
    tags: admittedDocument.tags,
    frontmatter: admittedDocument.frontmatter,
  }
}

function createDocsApiMiddleware() {
  return (req: MiddlewareRequest, res: MiddlewareResponse, next: NextFunction) => {
    void (async () => {
      const url = new URL(req.url || '/', 'http://localhost')
      const pathname = url.pathname

      if (matchesApiPath(pathname, '/sources')) {
        sendJson(res, listKnowledgeSources().map((source) => ({
          id: source.id,
          name: source.name,
          description: source.description,
          type: source.type,
          kind: source.kind,
          adapter: source.adapter,
          audience: source.audience,
          readOnly: source.readOnly,
          enabled: source.enabled,
          icon: source.icon,
        })))
        return
      }

      if (matchesApiPath(pathname, '/scan')) {
        const sourceId = url.searchParams.get('source') || 'obsidian'
        const dirPath = url.searchParams.get('path') || undefined
        const filterTag = url.searchParams.get('tag')
        sendJson(res, await scanKnowledgeSource(sourceId, dirPath, filterTag))
        return
      }

      if (matchesApiPath(pathname, '/file')) {
        const sourceId = url.searchParams.get('source') || 'obsidian'
        const filePath = url.searchParams.get('path') || ''
        const content = await readKnowledgeFile(sourceId, filePath)
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (content === null) {
          res.statusCode = 404
          res.end('File not found')
          return
        }
        res.end(content)
        return
      }

      if (matchesApiPath(pathname, '/tags')) {
        const sourceId = url.searchParams.get('source') || 'obsidian'
        sendJson(res, await getKnowledgeTags(sourceId))
        return
      }

      if (matchesApiPath(pathname, '/search')) {
        const sourceId = url.searchParams.get('source') || 'obsidian'
        const query = url.searchParams.get('query') || url.searchParams.get('q') || ''
        const filterTag = url.searchParams.get('tag')
        if (!query.trim()) {
          sendJson(res, [])
          return
        }
        sendJson(res, await searchKnowledge(sourceId, query, filterTag))
        return
      }

      if (matchesApiPath(pathname, '/graph')) {
        const sourceId = url.searchParams.get('source') || 'obsidian'
        const filePath = url.searchParams.get('path') || ''
        if (!filePath) {
          res.statusCode = 400
          sendJson(res, { error: 'path required' })
          return
        }
        sendJson(res, await getKnowledgeGraph(sourceId, filePath))
        return
      }

      if (matchesApiPath(pathname, '/global-graph')) {
        const sourceId = url.searchParams.get('source') || 'obsidian'
        sendJson(res, await getGlobalKnowledgeGraph(sourceId))
        return
      }

      if (matchesApiPath(pathname, '/catalog')) {
        const sourceId = url.searchParams.get('source') || 'obsidian'
        sendJson(res, await getKnowledgeCatalog(sourceId))
        return
      }

      if (matchesApiPath(pathname, '/project-handoff')) {
        const projectId = url.searchParams.get('project') || ''
        sendJson(res, await getProjectHandoffCard(projectId))
        return
      }

      if (matchesApiPath(pathname, '/ai/analyze')) {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', async () => {
          try {
            const { content, fileName } = JSON.parse(body)
            res.end(JSON.stringify(await analyzeDocument(content || '', fileName || '')))
          } catch (error) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
          }
        })
        return
      }

      if (matchesApiPath(pathname, '/file-info')) {
        const sourceId = url.searchParams.get('source') || 'obsidian'
        const filePath = url.searchParams.get('path') || ''
        const info = await buildFileInfo(sourceId, filePath)
        if (!info) {
          res.statusCode = 404
          sendJson(res, { error: 'File not found' })
          return
        }
        sendJson(res, info)
        return
      }

      next()
    })().catch((error) => {
      res.statusCode = 500
      sendJson(res, { error: error instanceof Error ? error.message : String(error) })
    })
  }
}

export function localDocsPlugin(): Plugin {
  const docsApiMiddleware = createDocsApiMiddleware()
  const lazyAssets = createLazyKnowledgeAssets()

  const staticKnowledgeMiddleware = createStaticKnowledgeMiddleware(lazyAssets)

  return {
    name: 'vite-plugin-local-docs',
    configureServer(server) {
      lazyAssets.reset()
      // Warm the suggest index and the default source bundle in the background
      // so the first typeahead/document view does not pay the cold build.
      void lazyAssets.getSuggest()
      void lazyAssets.getManifest().then((manifest) => {
        if (!manifest) return
        const defaultSourceId = (JSON.parse(manifest.content) as { defaultSourceId: string | null }).defaultSourceId
        if (defaultSourceId) void lazyAssets.getBundle(defaultSourceId)
      })
      server.middlewares.use(staticKnowledgeMiddleware)
      server.middlewares.use(docsApiMiddleware)
    },
    configurePreviewServer(server) {
      lazyAssets.reset()
      void lazyAssets.getSuggest()
      server.middlewares.use(staticKnowledgeMiddleware)
      server.middlewares.use(docsApiMiddleware)
    },
    async generateBundle() {
      // One graph asset per document is emitted below; without the static
      // index cache each request re-walks its source tree, which for the
      // workspace-root source means a ~7s walk x every document.
      setLocalSourceIndexStaticMode(true)
      try {
        const assets = await buildStaticKnowledgeAssets()
        assets.set(`${STATIC_KNOWLEDGE_ROOT}/suggest.json`, await buildSuggestIndexAsset())
        for (const [fileName, asset] of assets.entries()) {
          this.emitFile({
            type: 'asset',
            fileName,
            source: asset.content,
          })
        }
      } finally {
        setLocalSourceIndexStaticMode(false)
      }
    },
  }
}
