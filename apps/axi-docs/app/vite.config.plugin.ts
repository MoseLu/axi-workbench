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
  getKnowledgeTags,
  listKnowledgeSources,
  readKnowledgeFile,
  scanKnowledgeSource,
  searchKnowledge,
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

function registerJsonAsset(
  assets: Map<string, GeneratedKnowledgeAsset>,
  fileName: string,
  payload: unknown,
) {
  assets.set(fileName, {
    content: JSON.stringify(payload),
    contentType: 'application/json; charset=utf-8',
  })
}

async function buildStaticKnowledgeAssets() {
  const assets = new Map<string, GeneratedKnowledgeAsset>()
  const generatedAt = new Date().toISOString()
  const localSources = listKnowledgeSources()
    .filter((source) => source.enabled && source.type === 'local')
    .map(sanitizeSource)

  const manifest: StaticKnowledgeManifest = {
    version: STATIC_BUNDLE_VERSION,
    generatedAt,
    defaultSourceId: localSources[0]?.id || null,
    sources: localSources,
  }

  registerJsonAsset(assets, `${STATIC_KNOWLEDGE_ROOT}/manifest.json`, manifest)

  for (const source of localSources) {
    const [catalog, tags, documents, directoryIndex, globalGraph] = await Promise.all([
      getKnowledgeCatalog(source.id),
      getKnowledgeTags(source.id),
      getKnowledgeDocuments(source.id),
      getKnowledgeDirectoryIndex(source.id),
      getGlobalKnowledgeGraph(source.id),
    ])

    const bundle: StaticKnowledgeSourceBundle = {
      version: STATIC_BUNDLE_VERSION,
      generatedAt,
      source,
      catalog,
      tags,
      documents,
      directoryIndex,
      globalGraph,
    }

    registerJsonAsset(assets, `${STATIC_KNOWLEDGE_ROOT}/sources/${source.id}/bundle.json`, bundle)

    for (const document of documents) {
      const graph = await getKnowledgeGraph(source.id, document.path)
      registerJsonAsset(
        assets,
        `${STATIC_KNOWLEDGE_ROOT}/sources/${source.id}/graphs/${encodeBase64Url(document.path)}.json`,
        graph,
      )
    }
  }

  return assets
}

function matchStaticKnowledgeAsset(pathname: string): string | null {
  for (const prefix of STATIC_KNOWLEDGE_PREFIXES) {
    if (pathname === prefix) return `${STATIC_KNOWLEDGE_ROOT}/manifest.json`
    if (pathname.startsWith(`${prefix}/`)) {
      return `${STATIC_KNOWLEDGE_ROOT}/${pathname.slice(prefix.length + 1)}`
    }
  }
  return null
}

function createStaticKnowledgeMiddleware(
  ensureAssets: () => Promise<Map<string, GeneratedKnowledgeAsset>>,
) {
  return (req: MiddlewareRequest, res: MiddlewareResponse, next: NextFunction) => {
    void (async () => {
      const url = new URL(req.url || '/', 'http://localhost')
      const assetKey = matchStaticKnowledgeAsset(url.pathname)
      if (!assetKey) {
        next()
        return
      }

      const assets = await ensureAssets()
      const asset = assets.get(assetKey)
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
  let staticAssetsPromise: Promise<Map<string, GeneratedKnowledgeAsset>> | null = null

  const ensureStaticAssets = () => {
    staticAssetsPromise ??= buildStaticKnowledgeAssets()
    return staticAssetsPromise
  }

  const resetStaticAssets = () => {
    staticAssetsPromise = null
  }

  const staticKnowledgeMiddleware = createStaticKnowledgeMiddleware(ensureStaticAssets)

  return {
    name: 'vite-plugin-local-docs',
    async buildStart() {
      resetStaticAssets()
      await ensureStaticAssets()
    },
    configureServer(server) {
      resetStaticAssets()
      server.middlewares.use(staticKnowledgeMiddleware)
      server.middlewares.use(docsApiMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(staticKnowledgeMiddleware)
      server.middlewares.use(docsApiMiddleware)
    },
    async generateBundle() {
      const assets = await ensureStaticAssets()
      for (const [fileName, asset] of assets.entries()) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: asset.content,
        })
      }
    },
  }
}
