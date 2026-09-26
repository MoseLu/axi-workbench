import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import fs from 'fs'
const fsp = fs.promises
import path from 'path'
import http from 'http'
import crypto from 'crypto'
import { URL } from 'url'
import { IncomingMessage, ServerResponse } from 'http'
import * as knowledgeBase from '../lib/knowledgeBase'

// ─── 加载环境变量 ────────────────────────────────────────────────────────────

const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=')
    const k = key?.trim()
    const v = valueParts?.join('=').trim().replace(/^["']|["']$/g, '')
    if (k && v && !k.startsWith('#') && !process.env[k]) {
      process.env[k] = v
    }
  })
}

// ─── Blinko API 代理 ───────────────────────────────────────────────────────────

interface BlinkoNote {
  id: number
  content: string
  type: 0 | 1
  tags?: string[]
  files?: unknown[]
  createdAt: string
  updatedAt: string
}

function blinkoRequest<T>(
  urlPath: string,
  method: string,
  body?: unknown,
  apiToken?: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const sourceUrl = docSources.find(s => s.id === 'blinko')?.apiUrl || process.env.BLINKO_URL || 'http://localhost:1111'
    const url = new URL(urlPath, sourceUrl)
    const postData = body ? JSON.stringify(body) : undefined
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || '1111',
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
    }

    const req = http.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid JSON: ' + data.slice(0, 100))) }
      })
    })
    req.on('error', reject)
    if (postData) req.write(postData)
    req.end()
  })
}

async function handleBlinkoApi(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const source = docSources.find(s => s.id === 'blinko')
  if (!source) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Blinko source is not configured' }))
    return
  }
  const apiPath = url.pathname.slice(5) // 去掉 /api/

  try {
    if (apiPath === 'scan') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(await knowledgeBase.scanKnowledgeSource('blinko')))
      return
    }

    if (apiPath === 'file') {
      const noteId = url.searchParams.get('path') || ''
      const content = await knowledgeBase.readKnowledgeFile('blinko', noteId)
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(content || '# 笔记内容为空')
      return
    }

    if (apiPath === 'tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(await knowledgeBase.getKnowledgeTags('blinko')))
      return
    }

    if (apiPath === 'search') {
      const query = url.searchParams.get('query') || url.searchParams.get('q') || ''
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(await knowledgeBase.searchKnowledge('blinko', query, url.searchParams.get('tag'))))
      return
    }

    if (apiPath === 'catalog') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(await knowledgeBase.getKnowledgeCatalog('blinko')))
      return
    }

    // 未知端点
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unknown Blinko API endpoint' }))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Blinko API error:', e)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: msg }))
  }
}

interface DocSource {
  id: string
  name: string
  path: string
  enabled: boolean
  description?: string
  type?: 'local' | 'api'
  kind?: string
  adapter?: string
  audience?: string[]
  readOnly?: boolean
  organizationHint?: string
  apiUrl?: string
  apiToken?: string
  icon?: string
}

const docSources: DocSource[] = knowledgeBase.listKnowledgeSources()

function sanitizeSource(source: DocSource) {
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

async function searchSkillLibraries(query: string) {
  const skillSourceIds = ['axi-skills', 'dbskill'].filter((sourceId) => docSources.some((source) => source.id === sourceId && source.enabled))
  const results = await Promise.all(skillSourceIds.map(async (sourceId) => knowledgeBase.searchKnowledge(sourceId, query)))
  return results
    .flat()
    .sort((left, right) => right.score - left.score)
    .slice(0, 40)
}

// ─── 安全限制 ─────────────────────────────────────────────────────────────────

const excludePatterns = ['.git', 'node_modules', '.obsidian', '.trash']
const supportedExtensions = ['.md', '.markdown']

function isExcluded(name: string): boolean {
  return excludePatterns.some((p) => name === p || name.startsWith('.'))
}

function isHiddenDir(name: string): boolean {
  return name.startsWith('_')
}

function isSupported(filename: string): boolean {
  const ext = filename.toLowerCase()
  return supportedExtensions.some((e) => ext.endsWith(e))
}

function resolveSource(sourceId: string): DocSource | null {
  return docSources.find((s) => s.id === sourceId && s.enabled) ?? null
}

// ─── 核心操作 ─────────────────────────────────────────────────────────────────

interface FileItem {
  id: string
  name: string
  path: string
  relativePath: string
  type: 'file' | 'directory'
  extension: string
  lastModified: string
  sourceId: string
}

async function scanDir(sourceId: string, dirPath?: string): Promise<FileItem[]> {
  const source = resolveSource(sourceId)
  if (!source) return []

  const basePath = dirPath ? path.join(source.path, dirPath) : source.path
  const items: FileItem[] = []
  try {
    const entries = await fsp.readdir(basePath, { withFileTypes: true })
    for (const entry of entries) {
      if (isExcluded(entry.name)) continue
      const fullPath = path.join(basePath, entry.name)
      const relativePath = dirPath ? path.join(dirPath, entry.name) : entry.name

      try {
        const stat = await fsp.stat(fullPath)
        if (entry.isDirectory()) {
          if (isHiddenDir(entry.name)) continue
          items.push({
            id: `${sourceId}:${relativePath}`,
            name: entry.name,
            path: fullPath,
            relativePath,
            type: 'directory',
            extension: '',
            lastModified: stat.mtime.toISOString(),
            sourceId,
          })
        } else if (entry.isFile() && isSupported(entry.name)) {
          items.push({
            id: `${sourceId}:${relativePath}`,
            name: entry.name,
            path: fullPath,
            relativePath,
            type: 'file',
            extension: path.extname(entry.name),
            lastModified: stat.mtime.toISOString(),
            sourceId,
          })
        }
      } catch { /* skip inaccessible entries */ }
    }
  } catch {
    /* directory unreadable or not found */
  }

  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

async function readFile(sourceId: string, filePath: string): Promise<string | null> {
  if (filePath.includes('..') || path.isAbsolute(filePath)) return null
  const source = resolveSource(sourceId)
  if (!source) return null
  const fullPath = path.join(source.path, filePath)
  const rel = path.relative(source.path, fullPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  // 仅允许 Markdown 文件
  const ext = path.extname(fullPath).toLowerCase()
  if (ext !== '.md' && ext !== '.markdown') return null
  try {
    return await fsp.readFile(fullPath, 'utf-8')
  } catch {
    return null
  }
}

async function writeFile(
  sourceId: string,
  filePath: string,
  content: string,
): Promise<{ success: boolean; path: string; error?: string }> {
  const source = resolveSource(sourceId)
  if (!source) return { success: false, path: '', error: `未知文档源: ${sourceId}` }

  const sourcePath = path.normalize(source.path)
  const fullPath = path.normalize(path.join(sourcePath, filePath))
  // path.relative returns e.g. "../../../etc/passwd" for traversal attempts
  const rel = path.relative(sourcePath, fullPath)
  if (rel.startsWith('..') || path.isAbsolute(rel) || filePath.includes('..')) {
    return { success: false, path: fullPath, error: '禁止路径穿越' }
  }

  if (!isSupported(filePath)) {
    return {
      success: false,
      path: fullPath,
      error: `不支持的文件类型，仅允许: ${supportedExtensions.join(', ')}`,
    }
  }

  try {
    const dir = path.dirname(fullPath)
    await fsp.mkdir(dir, { recursive: true })
    await fsp.writeFile(fullPath, content, 'utf-8')
    return { success: true, path: fullPath }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, path: fullPath, error: msg }
  }
}

// Filename-only search (shallow, fast)
async function searchFiles(
  sourceId: string,
  query: string,
  dirPath?: string,
): Promise<Array<Record<string, unknown>>> {
  const results = await knowledgeBase.searchKnowledge(sourceId, query)
  if (!dirPath) return results as unknown as Array<Record<string, unknown>>
  const normalizedDir = dirPath.replace(/\\/g, '/').replace(/\/$/, '')
  return results.filter((result) =>
    typeof result.path === 'string' && result.path.startsWith(`${normalizedDir}/`)
  ) as unknown as Array<Record<string, unknown>>
}

// 从 markdown 文件中提取所有标签（#tag-name 格式）
function extractTagsFromContent(content: string): string[] {
  const tagRegex = /#([\p{L}\p{N}_-]+)/gu
  const tags = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase())
  }

  return Array.from(tags)
}

interface TagInfo {
  name: string
  count: number
}

// 获取某个源下所有文件的标签
async function getAllTags(sourceId: string): Promise<TagInfo[]> {
  return knowledgeBase.getKnowledgeTags(sourceId)
}

// Full-text search across all files
async function searchFullText(
  sourceId: string,
  query: string,
): Promise<Array<{ path: string; name: string; snippet: string; score: number }>> {
  const results = await knowledgeBase.searchKnowledge(sourceId, query)
  return results.map((result) => ({
    path: result.path,
    name: result.title || result.name,
    snippet: result.snippet,
    score: result.score,
  }))
}

// Build markdown frontmatter
function buildFrontmatter(meta: Record<string, unknown>): string {
  if (Object.keys(meta).length === 0) return ''
  const lines = ['---']
  for (const [k, v] of Object.entries(meta)) {
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map(String).join(', ')}]`)
    } else {
      lines.push(`${k}: ${v}`)
    }
  }
  lines.push('---', '')
  return lines.join('\n')
}

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  label: string
  kind: 'current' | 'note' | 'tag'
  x: number
  y: number
  vx: number
  vy: number
}

interface GraphEdge {
  source: string
  target: string
  kind: 'wikilink' | 'tag'
}

async function buildGraphData(sourceId: string, currentRelativePath: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const source = resolveSource(sourceId)
  if (!source || source.type !== 'local') return { nodes: [], edges: [] }

  const nameToPath: Record<string, string> = {}
  async function indexFiles(dir: string) {
    let entries: fs.Dirent[]
    try { entries = await fsp.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (isExcluded(entry.name)) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await indexFiles(fullPath)
      } else if (entry.isFile() && isSupported(entry.name)) {
        const rel = path.relative(source!.path, fullPath).replace(/\\/g, '/')
        const stem = entry.name.replace(/\.(md|markdown)$/i, '')
        nameToPath[stem.toLowerCase()] = rel
      }
    }
  }
  await indexFiles(source.path)

  const nodesMap = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []

  const addNode = (id: string, label: string, kind: GraphNode['kind']) => {
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, label, kind, x: 0, y: 0, vx: 0, vy: 0 })
    }
  }

  const currentStem = path.basename(currentRelativePath).replace(/\.(md|markdown)$/i, '')
  addNode(currentRelativePath, currentStem, 'current')

  const currentFullPath = path.join(source.path, currentRelativePath)
  let currentContent: string
  try {
    currentContent = await fsp.readFile(currentFullPath, 'utf-8')
  } catch {
    return { nodes: [...nodesMap.values()], edges }
  }

  const wikilinkRegex = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g
  let match: RegExpExecArray | null
  while ((match = wikilinkRegex.exec(currentContent)) !== null) {
    const linkName = match[1].trim()
    const resolved = nameToPath[linkName.toLowerCase()]
    if (resolved && resolved !== currentRelativePath) {
      addNode(resolved, linkName, 'note')
      edges.push({ source: currentRelativePath, target: resolved, kind: 'wikilink' })
    }
  }

  const currentTags = extractTagsFromContent(currentContent)
  for (const tag of currentTags) {
    const tagId = '#' + tag
    addNode(tagId, tag, 'tag')
    edges.push({ source: currentRelativePath, target: tagId, kind: 'tag' })
  }

  async function findBacklinks(dir: string) {
    let entries: fs.Dirent[]
    try { entries = await fsp.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (isExcluded(entry.name)) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (isHiddenDir(entry.name)) continue
        await findBacklinks(fullPath)
      } else if (entry.isFile() && isSupported(entry.name)) {
        const rel = path.relative(source!.path, fullPath).replace(/\\/g, '/')
        if (rel === currentRelativePath) continue
        try {
          const content = await fsp.readFile(fullPath, 'utf-8')
          const re = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g
          let m: RegExpExecArray | null
          while ((m = re.exec(content)) !== null) {
            const resolved = nameToPath[m[1].trim().toLowerCase()]
            if (resolved === currentRelativePath) {
              const stem = entry.name.replace(/\.(md|markdown)$/i, '')
              addNode(rel, stem, 'note')
              edges.push({ source: rel, target: currentRelativePath, kind: 'wikilink' })
              break
            }
          }
        } catch { /* skip */ }
      }
    }
  }
  await findBacklinks(source.path)

  return { nodes: [...nodesMap.values()], edges }
}

// ─── Global Knowledge Graph (full vault overview) ───────────────────────────────

interface GlobalGraphNode {
  id: string
  label: string
  kind: 'note' | 'tag'
  path?: string
  tags?: string[]
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface GlobalGraphEdge {
  source: string | object
  target: string | object
  kind: 'wikilink' | 'tag'
}

// Extract display label from frontmatter or first heading
function extractLabel(content: string, fallbackName: string): string {
  // Try frontmatter title
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (fmMatch) {
    const fm = fmMatch[1]
    const titleMatch = fm.match(/^\s*title:\s*(.+)$/m)
    if (titleMatch) {
      return titleMatch[1].trim().replace(/^["']|["']$/g, '')
    }
    const aliasMatch = fm.match(/^\s*aliases?:\s*\[?\s*["']?(.+?)["']?\s*\]?$/m)
    if (aliasMatch) {
      return aliasMatch[1].split(',')[0].trim().replace(/^["']|["']$/g, '')
    }
  }
  // Try first markdown heading
  const headingMatch = content.match(/^#\s+(.+)$/m)
  if (headingMatch) {
    return headingMatch[1].trim().replace(/\*\*|__|\*|_|`/g, '').slice(0, 60)
  }
  return fallbackName
}

async function buildGlobalGraph(sourceId: string): Promise<{ nodes: GlobalGraphNode[]; edges: GlobalGraphEdge[]; orphanNodes: GlobalGraphNode[] }> {
  const source = resolveSource(sourceId)
  if (!source || source.type !== 'local') return { nodes: [], edges: [], orphanNodes: [] }

  // ── Step 1: Index all files (skip _-prefixed and empty files) ─────────────
  const nameToPath: Record<string, string> = {}
  // pathToMeta: rel -> { name, tags, content, label }
  const pathToMeta: Record<string, { name: string; tags: string[]; label: string }> = {}

  async function indexFiles(dir: string) {
    let entries: fs.Dirent[]
    try { entries = await fsp.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (isExcluded(entry.name) || entry.name.startsWith('_')) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await indexFiles(fullPath)
      } else if (entry.isFile() && isSupported(entry.name)) {
        try {
          const content = await fsp.readFile(fullPath, 'utf-8')
          // Skip empty or nearly-empty files
          const stripped = content.replace(/^---\n[\s\S]*?\n---\n*/, '').replace(/[#*`\]]|\[/g, '').trim()
          if (stripped.length < 10) continue

          const rel = path.relative(source!.path, fullPath).replace(/\\/g, '/')
          const stem = entry.name.replace(/\.(md|markdown)$/i, '')
          nameToPath[stem.toLowerCase()] = rel
          pathToMeta[rel] = {
            name: stem,
            tags: [],
            label: extractLabel(content, stem),
          }
        } catch { /* skip unreadable */ }
      }
    }
  }
  await indexFiles(source.path)

  // ── Step 2: Scan tags and wikilinks ───────────────────────────────────────
  const wikilinkRegex = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g
  const tagRegex = /#([\w\u4e00-\u9fa5-]+)/g

  const edges: GlobalGraphEdge[] = []
  const tagToFiles: Record<string, Set<string>> = {}

  for (const [rel, meta] of Object.entries(pathToMeta)) {
    try {
      const content = await fsp.readFile(path.join(source.path, rel), 'utf-8')
      const fileTags: string[] = []
      let m: RegExpExecArray | null

      while ((m = tagRegex.exec(content)) !== null) {
        const tag = m[1].trim()
        // Skip: code blocks (contains ```), markdown anchor links (contains .md), and empty
        if (!tag || tag.includes('```') || /^[a-z0-9]+(-[a-z0-9]+)*md$/.test(tag) || tag.includes('/')) continue
        fileTags.push(tag)
        if (!tagToFiles[tag]) tagToFiles[tag] = new Set()
        tagToFiles[tag].add(rel)
      }
      meta.tags = fileTags

      while ((m = wikilinkRegex.exec(content)) !== null) {
        const resolved = nameToPath[m[1].trim().toLowerCase()]
        if (resolved && resolved !== rel) {
          edges.push({ source: rel, target: resolved, kind: 'wikilink' })
        }
      }
    } catch { /* skip */ }
  }

  // ── Step 3: Build nodes ─────────────────────────────────────────────────────
  // Find all connected node IDs (has at least one edge)
  const connectedIds = new Set<string>()
  for (const e of edges) {
    const src = typeof e.source === 'string' ? e.source : (e.source as { id?: string }).id || ''
    const tgt = typeof e.target === 'string' ? e.target : (e.target as { id?: string }).id || ''
    if (src) connectedIds.add(src)
    if (tgt) connectedIds.add(tgt)
  }

  const nodes: GlobalGraphNode[] = []
  const orphanNodes: GlobalGraphNode[] = []

  for (const [rel, meta] of Object.entries(pathToMeta)) {
    if (connectedIds.has(rel)) {
      nodes.push({ id: rel, label: meta.label, kind: 'note', path: rel, tags: meta.tags })
    } else {
      orphanNodes.push({ id: rel, label: meta.label, kind: 'note', path: rel, tags: meta.tags })
    }
  }

  for (const [tag] of Object.entries(tagToFiles)) {
    // Skip markdown anchor links (lowercase hyphenated ending in md)
    if (/^[a-z0-9]+(-[a-z0-9]+)*md$/.test(tag)) continue
    nodes.push({ id: '#' + tag, label: tag, kind: 'tag' })
    for (const fileRel of tagToFiles[tag]) {
      edges.push({ source: fileRel, target: '#' + tag, kind: 'tag' })
    }
  }

  return { nodes, edges, orphanNodes }
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

// MiniMax Anthropic 兼容端点配置（直接硬编码，绕过环境变量和系统代理问题）
const MINIMAX_API_URL = 'https://api.minimaxi.com/anthropic/v1/messages'
const MINIMAX_API_KEY = process.env.MCP_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || ''
const AI_MODEL = process.env.AI_MODEL || 'claude-3-5-haiku-20241022'

async function analyzeDocumentContent(content: string, fileName: string): Promise<{
  summary: string
  keyPoints: string[]
  concepts: Array<{ term: string; definition: string }>
  error?: string
}> {
  try {
    const truncated = content.slice(0, 8000)

    // 直接使用 fetch 调用 MiniMax API（绕过 SDK 的环境变量和代理问题）
    const apiResponse = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MINIMAX_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
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
      }),
    })

    if (!apiResponse.ok) {
      const errText = await apiResponse.text()
      return { summary: '', keyPoints: [], concepts: [], error: `API error ${apiResponse.status}: ${errText.slice(0, 200)}` }
    }

    const data = await apiResponse.json() as {
      content?: Array<{ type: string; text?: string }>
    }

    // MiniMax 可能返回 thinking 块 + text 块，提取 text 块内容
    const textBlock = data.content?.find(c => c.type === 'text')
    const text = textBlock?.text || ''

    if (!text.trim()) {
      return { summary: '', keyPoints: [], concepts: [], error: 'AI 返回内容为空（可能被 MiniMax 内容策略拦截）' }
    }

    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    let parsed: unknown = JSON.parse(clean)
    // 二次解码确保 \uXXXX 完全展开
    parsed = JSON.parse(JSON.stringify(parsed))
    return parsed as { summary: string; keyPoints: string[]; concepts: Array<{ term: string; definition: string }> }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { summary: '', keyPoints: [], concepts: [], error: msg }
  }
}

// ─── 工具定义 ─────────────────────────────────────────────────────────────────

export type ToolAccessMode = 'read_only' | 'side_effect'
export type CallerIdentity = 'human' | 'bounded_agent'

export interface ToolCapability {
  access: ToolAccessMode
  agentAllowed: boolean
  description: string
}

const READ_ONLY_AGENT_TOOL: ToolCapability = {
  access: 'read_only',
  agentAllowed: true,
  description: '只读检索或固定摘要，可由受限 Agent 在有效工作流路由下使用。',
}

const READ_ONLY_HUMAN_TOOL: ToolCapability = {
  access: 'read_only',
  agentAllowed: false,
  description: '只读原文或开放输出；不向受限 Agent 暴露。',
}

const EFFECT_TOOL: ToolCapability = {
  access: 'side_effect',
  agentAllowed: false,
  description: '会写入、运行命令或触发外部副作用；受限 Agent 只能提出工作流审批提案。',
}

/** Machine-readable capability catalogue for task-execution-routing/v1 consumers. */
export const MCP_TOOL_CAPABILITIES: Record<string, ToolCapability> = {
  obsidian_scan: READ_ONLY_AGENT_TOOL,
  obsidian_read: READ_ONLY_HUMAN_TOOL,
  obsidian_write: EFFECT_TOOL,
  obsidian_list: READ_ONLY_AGENT_TOOL,
  obsidian_search: READ_ONLY_AGENT_TOOL,
  obsidian_fulltext_search: READ_ONLY_AGENT_TOOL,
  obsidian_write_note: EFFECT_TOOL,
  knowledge_catalog: READ_ONLY_AGENT_TOOL,
  knowledge_search: READ_ONLY_AGENT_TOOL,
  axi_docs_list_sources: READ_ONLY_AGENT_TOOL,
  axi_docs_search: READ_ONLY_AGENT_TOOL,
  axi_docs_read: READ_ONLY_HUMAN_TOOL,
  axi_docs_context_summary: READ_ONLY_AGENT_TOOL,
  axi_docs_skill_search: READ_ONLY_AGENT_TOOL,
  axi_docs_workspace_status: READ_ONLY_AGENT_TOOL,
  axi_docs_project_summary: READ_ONLY_AGENT_TOOL,
  axi_docs_project_onboard: READ_ONLY_AGENT_TOOL,
  axi_docs_handoff_check: EFFECT_TOOL,
  axi_docs_get_tool_capabilities: READ_ONLY_AGENT_TOOL,
  blinko_list_notes: READ_ONLY_AGENT_TOOL,
  blinko_read_note: READ_ONLY_HUMAN_TOOL,
  blinko_write_note: EFFECT_TOOL,
  blinko_search: READ_ONLY_AGENT_TOOL,
}

export function getToolCapability(name: string): ToolCapability {
  // Unknown tools are effects by default, so a future registration cannot
  // accidentally become available to an Agent without a policy review.
  return MCP_TOOL_CAPABILITIES[name] ?? EFFECT_TOOL
}

type ToolCallResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function resolveCallerIdentity(defaultIdentity: CallerIdentity, args: Record<string, unknown> | undefined): CallerIdentity {
  const execution = asRecord(args?.axiExecution)
  return defaultIdentity === 'bounded_agent' || execution?.actor === 'bounded_agent'
    ? 'bounded_agent'
    : 'human'
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function actionDigest(action: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(canonicalJson(action)).digest('hex')
}

function agentEffectProposal(name: string, args: Record<string, unknown>): ToolCallResult {
  const execution = asRecord(args.axiExecution)
  const traceId = typeof execution?.traceId === 'string' ? execution.traceId : ''
  const idempotencyKey = typeof execution?.idempotencyKey === 'string' ? execution.idempotencyKey : ''
  if (!traceId || !idempotencyKey) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ code: 'workflow_required', message: '受限 Agent 的副作用提案必须携带工作流 traceId 和 idempotencyKey。' }) }],
      isError: true,
    }
  }
  const actionArguments = { ...args }
  delete actionArguments.axiExecution
  const action = { kind: 'axi_docs_tool_effect', tool: name, arguments: actionArguments }
  const digest = actionDigest(action)
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        schemaVersion: 'task-execution-routing/v1',
        code: 'approval_required',
        proposal: {
          proposalId: `axi-docs-${digest.slice(0, 24)}`,
          traceId,
          idempotencyKey,
          summary: `Bounded Agent requested ${name}; no document or command was executed.`,
          action,
          actionDigest: digest,
        },
      }, null, 2),
    }],
    isError: true,
  }
}

function guardBoundedAgentTool(
  name: string,
  args: Record<string, unknown> | undefined,
  caller: CallerIdentity,
): ToolCallResult | null {
  if (resolveCallerIdentity(caller, args) !== 'bounded_agent') return null
  const capability = getToolCapability(name)
  if (capability.agentAllowed) return null
  if (capability.access === 'side_effect') return agentEffectProposal(name, args ?? {})
  return {
    content: [{ type: 'text', text: JSON.stringify({ code: 'agent_tool_not_allowed', message: `${name} is not available to a bounded Agent.` }) }],
    isError: true,
  }
}

async function fixedDocumentContextSummary(source: string, filePath: string) {
  const content = await knowledgeBase.readKnowledgeFile(source, filePath)
  if (content === null) return null
  const version = crypto.createHash('sha256').update(content).digest('hex')
  return {
    contextRef: {
      id: `axi-docs:${source}:${filePath}`,
      version,
      uri: `axi-docs://${encodeURIComponent(source)}/${filePath.split('/').map(encodeURIComponent).join('/')}`,
    },
    summary: {
      characterCount: content.length,
      lineCount: content.split('\n').length,
      excerpt: content.slice(0, 2000),
      truncated: content.length > 2000,
    },
  }
}

export function getToolSchemas() {
  const tools = [
    {
      name: 'obsidian_scan',
      description: '扫描 Obsidian 知识库的目录，返回文件/文件夹列表',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          path: {
            type: 'string',
            description: '子目录路径，不填则为根目录',
          },
        },
      },
    },
    {
      name: 'obsidian_read',
      description: '读取 Obsidian 知识库中的文件内容',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          path: {
            type: 'string',
            description: '文件相对路径（必填），如 notes/test.md',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'obsidian_write',
      description:
        '向 Obsidian 知识库写入（新建或覆盖）Markdown 文件，支持路径穿越检查',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          path: {
            type: 'string',
            description:
              '文件相对路径（必填），如 daily/2026-03-24.md，自动创建父目录',
          },
          content: {
            type: 'string',
            description: '文件内容（必填），Markdown 格式',
          },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'obsidian_list',
      description: '列出所有已配置的文档源',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'obsidian_search',
      description: '在 Obsidian 知识库中按文件名搜索文件（快速）',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          query: {
            type: 'string',
            description: '搜索关键词（必填）',
          },
          path: {
            type: 'string',
            description: '在指定子目录中搜索',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'obsidian_fulltext_search',
      description: '对 Obsidian 知识库进行全文搜索，返回包含关键词的文档片段（比 obsidian_search 慢但更准确）',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          query: {
            type: 'string',
            description: '搜索关键词（必填）',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'obsidian_write_note',
      description: '向知识库写入带有 frontmatter 元数据的 Markdown 笔记。如果文件已存在会覆盖。自动生成 YAML frontmatter（date/tags/title）。',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          path: {
            type: 'string',
            description: '文件相对路径（必填），如 daily/2026-03-24.md，会自动创建父目录',
          },
          content: {
            type: 'string',
            description: '笔记正文内容（Markdown，不含 frontmatter，必填）',
          },
          title: {
            type: 'string',
            description: '笔记标题（可选，写入 frontmatter）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表（可选，写入 frontmatter）',
          },
          date: {
            type: 'string',
            description: '创建日期（可选，默认今天，格式 YYYY-MM-DD）',
          },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'knowledge_catalog',
      description: '返回知识库的分类索引摘要，适合快速判断是否已有项目经验、架构决策、编码规范、组件/函数库和问题解决方案。',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
        },
      },
    },
    {
      name: 'knowledge_search',
      description: '面向经验复用的统一搜索，优先返回组件库、函数库、规范、架构、技术选型和 FAQ 等高价值文档。',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          query: {
            type: 'string',
            description: '搜索关键词（必填）',
          },
          tag: {
            type: 'string',
            description: '按标签过滤（可选）',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'axi_docs_list_sources',
      description: '列出 Axi Docs 已接入的文档项目/source，适合 agent 先判断可用知识库。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'axi_docs_search',
      description: '跨 Axi Docs 全部文档库搜索，返回摘要化结果和 source/path。',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词（必填）' },
          source: { type: 'string', description: '可选 source id；不填则跨库搜索' },
          tag: { type: 'string', description: '按标签过滤（可选）' },
        },
        required: ['query'],
      },
    },
    {
      name: 'axi_docs_read',
      description: '读取 Axi Docs 中指定 source/path 的文档原文。',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'source id（必填）' },
          path: { type: 'string', description: '文档相对路径（必填）' },
        },
        required: ['source', 'path'],
      },
    },
    {
      name: 'axi_docs_skill_search',
      description: '专门搜索 Axi Skills 和 dbskill 技能库，返回匹配技能的 name/description/path。',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '技能名、触发词或描述关键词（必填）' },
        },
        required: ['query'],
      },
    },
    {
      name: 'axi_docs_workspace_status',
      description: '返回 Axi 工作区项目概览、文档数量和最近项目入口。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'axi_docs_project_summary',
      description: '按项目名或 id 返回 workspace 项目摘要，包含路径、状态和验证入口。',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: '项目名、slug 或路径片段（必填）' },
        },
        required: ['project'],
      },
    },
    {
      // Zero-context handoff governance: Agent 想要在 Axi Docs 内完成
      // 「定位项目 → 读 handoff → 检查 readiness」闭环，调用本工具即可。
      // 不执行任何破坏性命令，不直接运行测试或 git，只读 handoff snapshot。
      name: 'axi_docs_project_onboard',
      description: '按项目 id 返回零上下文接手摘要（read order、entrypoints、smoke、current work、known failures）。与 workspace-project onboard <id> --json 同源。',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: '项目 id（必填）' },
        },
        required: ['project'],
      },
    },
    {
      // Default 不运行 smoke；smoke=true 时才执行 manifest.commands.smoke
      // 列表中的第一条命令。需要显式 opt-in，避免误触发长跑任务。
      name: 'axi_docs_handoff_check',
      description: '校验 handoff snapshot 是否对给定项目就绪：返回 readiness、score、ageDays、stale 标记。可选 smoke=true 触发 manifest 中的冒烟命令。',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: '项目 id（必填）' },
          smoke: { type: 'boolean', description: '显式启用时运行 manifest.commands.smoke[0]', default: false },
        },
        required: ['project'],
      },
    },
    {
      name: 'axi_docs_context_summary',
      description: '为受限 Agent 返回指定文档的固定长度只读上下文摘要，以及可追溯的 contextRef（id/version/uri）。',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'source id（必填）' },
          path: { type: 'string', description: '文档相对路径（必填）' },
        },
        required: ['source', 'path'],
      },
    },
    {
      name: 'axi_docs_get_tool_capabilities',
      description: '返回每个 Axi Docs MCP 工具的只读/副作用能力标注及受限 Agent 可用性。',
      inputSchema: { type: 'object', properties: {} },
    },
    // ── Blinko 工具 ──────────────────────────────────────────────────────────────
    {
      name: 'blinko_list_notes',
      description: '列出 Blinko 闪念笔记（最近的笔记列表）',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: '返回数量上限（默认 50，最大 200）',
            default: 50,
          },
        },
      },
    },
    {
      name: 'blinko_read_note',
      description: '读取 Blinko 笔记内容（通过笔记 ID）',
      inputSchema: {
        type: 'object',
        properties: {
          noteId: {
            type: 'number',
            description: '笔记 ID（必填）',
          },
        },
        required: ['noteId'],
      },
    },
    {
      name: 'blinko_write_note',
      description: '向 Blinko 创建或更新笔记内容',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: '笔记内容（必填），支持 Markdown',
          },
          noteId: {
            type: 'number',
            description: '笔记 ID（可选，不填则创建新笔记）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表（可选，自动识别 #标签 格式）',
          },
        },
        required: ['content'],
      },
    },
    {
      name: 'blinko_search',
      description: '在 Blinko 笔记中全文搜索',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词（必填）',
          },
        },
        required: ['query'],
      },
    },
  ]

  return tools.map((tool) => {
    const capability = getToolCapability(tool.name)
    return {
      ...tool,
      annotations: {
        readOnlyHint: capability.access === 'read_only',
        destructiveHint: capability.access === 'side_effect',
        idempotentHint: capability.access === 'read_only',
      },
      xAxiCapability: {
        access: capability.access,
        agentAllowed: capability.agentAllowed,
      },
    }
  })
}

// ─── Server 工厂 ────────────────────────────────────────────────────────────────

export function createServer(
  defaultCaller: CallerIdentity = process.env.AXI_DOCS_CALLER === 'bounded_agent' ? 'bounded_agent' : 'human',
) {
  const server = new Server(
    { name: 'axi-docs-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: getToolSchemas(),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    try {
      const guarded = guardBoundedAgentTool(name, args, defaultCaller)
      if (guarded) return guarded
      switch (name) {
        case 'obsidian_scan': {
          const source = (args?.source as string) || 'obsidian'
          const dirPath = args?.path as string | undefined
          return {
            content: [{ type: 'text', text: JSON.stringify(await scanDir(source, dirPath), null, 2) }],
          }
        }

        case 'obsidian_read': {
          const source = (args?.source as string) || 'obsidian'
          const filePath = args?.path as string
          if (!filePath) {
            return { content: [{ type: 'text', text: '错误: path 参数必填' }], isError: true }
          }
          const content = await readFile(source, filePath)
          if (content === null) {
            return { content: [{ type: 'text', text: `文件不存在: ${filePath}` }], isError: true }
          }
          return { content: [{ type: 'text', text: content }] }
        }

        case 'obsidian_write': {
          const source = (args?.source as string) || 'obsidian'
          const filePath = args?.path as string
          const content = args?.content as string
          if (!filePath || content === undefined) {
            return {
              content: [{ type: 'text', text: '错误: path 和 content 参数必填' }],
              isError: true,
            }
          }
          const result = await writeFile(source, filePath, content)
          if (result.success) {
            return {
              content: [{ type: 'text', text: `✓ 文件已保存: ${result.path}` }],
            }
          }
          return { content: [{ type: 'text', text: `✗ 保存失败: ${result.error}` }], isError: true }
        }

        case 'obsidian_list': {
          return {
            content: [
              { type: 'text', text: JSON.stringify(docSources.filter((s) => s.enabled).map(sanitizeSource), null, 2) },
            ],
          }
        }

        case 'obsidian_search': {
          const source = (args?.source as string) || 'obsidian'
          const query = args?.query as string
          const dirPath = args?.path as string | undefined
          if (!query) {
            return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(await searchFiles(source, query, dirPath), null, 2) }],
          }
        }

        case 'obsidian_fulltext_search': {
          const source = (args?.source as string) || 'obsidian'
          const query = args?.query as string
          if (!query) {
            return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
          }
          const results = await searchFullText(source, query)
          return {
            content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
          }
        }

        case 'obsidian_write_note': {
          const source = (args?.source as string) || 'obsidian'
          const filePath = args?.path as string
          const body = args?.content as string
          if (!filePath || body === undefined) {
            return { content: [{ type: 'text', text: '错误: path 和 content 参数必填' }], isError: true }
          }
          const meta: Record<string, unknown> = {
            date: (args?.date as string) || new Date().toISOString().slice(0, 10),
          }
          if (args?.title) meta.title = args.title as string
          if (args?.tags && Array.isArray(args.tags)) meta.tags = args.tags
          const fullContent = buildFrontmatter(meta) + body
          const result = await writeFile(source, filePath, fullContent)
          if (result.success) {
            return { content: [{ type: 'text', text: `✓ 笔记已保存: ${result.path}` }] }
          }
          return { content: [{ type: 'text', text: `✗ 保存失败: ${result.error}` }], isError: true }
        }

        case 'knowledge_catalog': {
          const source = (args?.source as string) || 'obsidian'
          const catalog = await knowledgeBase.getKnowledgeCatalog(source)
          return {
            content: [{ type: 'text', text: JSON.stringify(catalog, null, 2) }],
          }
        }

        case 'knowledge_search': {
          const source = (args?.source as string) || 'obsidian'
          const query = args?.query as string
          const tag = args?.tag as string | undefined
          if (!query) {
            return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
          }
          const results = await knowledgeBase.searchKnowledge(source, query, tag)
          return {
            content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
          }
        }

        case 'axi_docs_list_sources': {
          return {
            content: [{ type: 'text', text: JSON.stringify(knowledgeBase.getDocumentSourceRegistrySummary().map(sanitizeSource), null, 2) }],
          }
        }

        case 'axi_docs_search': {
          const query = args?.query as string
          const source = args?.source as string | undefined
          const tag = args?.tag as string | undefined
          if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
          const results = source
            ? await knowledgeBase.searchKnowledge(source, query, tag)
            : await knowledgeBase.searchKnowledgeAll(query, tag)
          return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
        }

        case 'axi_docs_read': {
          const source = args?.source as string
          const filePath = args?.path as string
          if (!source || !filePath) return { content: [{ type: 'text', text: '错误: source 和 path 参数必填' }], isError: true }
          const content = await knowledgeBase.readKnowledgeFile(source, filePath)
          if (content === null) return { content: [{ type: 'text', text: `文件不存在: ${source}:${filePath}` }], isError: true }
          return { content: [{ type: 'text', text: content }] }
        }

        case 'axi_docs_context_summary': {
          const source = args?.source as string
          const filePath = args?.path as string
          if (!source || !filePath) return { content: [{ type: 'text', text: '错误: source 和 path 参数必填' }], isError: true }
          const summary = await fixedDocumentContextSummary(source, filePath)
          if (summary === null) return { content: [{ type: 'text', text: `文件不存在: ${source}:${filePath}` }], isError: true }
          return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
        }

        case 'axi_docs_get_tool_capabilities': {
          return { content: [{ type: 'text', text: JSON.stringify(MCP_TOOL_CAPABILITIES, null, 2) }] }
        }

        case 'axi_docs_skill_search': {
          const query = args?.query as string
          if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
          return { content: [{ type: 'text', text: JSON.stringify(await searchSkillLibraries(query), null, 2) }] }
        }

        case 'axi_docs_workspace_status': {
          return { content: [{ type: 'text', text: JSON.stringify(await knowledgeBase.getWorkspaceStatus(), null, 2) }] }
        }

        case 'axi_docs_project_summary': {
          const project = args?.project as string
          if (!project) return { content: [{ type: 'text', text: '错误: project 参数必填' }], isError: true }
          const summary = await knowledgeBase.getProjectSummary(project)
          if (!summary) return { content: [{ type: 'text', text: `未找到项目: ${project}` }], isError: true }
          return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
        }

        case 'axi_docs_project_onboard': {
          const project = args?.project as string
          if (!project) return { content: [{ type: 'text', text: '错误: project 参数必填' }], isError: true }
          const card = await knowledgeBase.getProjectHandoffCard(project)
          const summary = await knowledgeBase.getProjectSummary(project)
          const manifestPath = card.manifestPath
            || (summary && 'path' in summary ? `projects/${project}/docs/project-docs.manifest.json` : null)
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                project: {
                  id: project,
                  name: summary?.title || project,
                  manifestPath,
                  handoffPath: card.handoffPath,
                },
                readiness: card.readiness,
                score: card.score,
                readOrder: card.readOrder,
                entrypoints: card.entrypoints,
                smokeCommand: card.smokeCommand,
                verifyCommand: card.verifyCommand,
                currentWork: card.currentWork,
                lastVerifiedAt: card.lastVerifiedAt,
                ageDays: card.ageDays,
                state: card.state,
              }, null, 2),
            }],
          }
        }

        case 'axi_docs_handoff_check': {
          const project = args?.project as string
          const smoke = args?.smoke === true
          if (!project) return { content: [{ type: 'text', text: '错误: project 参数必填' }], isError: true }
          const card = await knowledgeBase.getProjectHandoffCard(project)
          const snapshotStatus = await knowledgeBase.getHandoffSnapshotStatus()
          const result: Record<string, unknown> = {
            project,
            snapshot: {
              source: snapshotStatus.source,
              generatedAt: snapshotStatus.generatedAt,
              ageDays: snapshotStatus.ageDays,
            },
            handoff: {
              state: card.state,
              readiness: card.readiness,
              score: card.score,
              ageDays: card.ageDays,
              lastVerifiedAt: card.lastVerifiedAt,
              manifestPath: card.manifestPath,
              handoffPath: card.handoffPath,
            },
            smoke: {
              enabled: smoke,
              ran: false,
              command: card.smokeCommand,
              exitCode: null as number | null,
              output: null as string | null,
            },
          }
          if (smoke) {
            if (!card.smokeCommand) {
              result.smoke = {
                ...(result.smoke as Record<string, unknown>),
                ran: false,
                output: 'no smoke command declared in manifest.commands.smoke[]',
              }
            } else {
              const { execFileSync } = await import('node:child_process')
              try {
                const cwd = card.manifestPath
                  ? card.manifestPath.replace(/\/docs\/project-docs\.manifest\.json$/, '')
                  : process.cwd()
                const output = execFileSync('sh', ['-c', card.smokeCommand], {
                  cwd,
                  encoding: 'utf8',
                  timeout: 30_000,
                  stdio: ['ignore', 'pipe', 'pipe'],
                })
                result.smoke = {
                  ...(result.smoke as Record<string, unknown>),
                  ran: true,
                  exitCode: 0,
                  output: output.slice(0, 4000),
                }
              } catch (error) {
                const err = error as { status?: number; stdout?: string; stderr?: string; message: string }
                result.smoke = {
                  ...(result.smoke as Record<string, unknown>),
                  ran: true,
                  exitCode: typeof err.status === 'number' ? err.status : 1,
                  output: ((err.stdout || '') + (err.stderr || '')).slice(0, 4000) || err.message,
                }
              }
            }
          }
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }

        default:
          return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { content: [{ type: 'text', text: `错误: ${msg}` }], isError: true }
    }
  })

  return server
}

// ─── HTTP/SSE 传输（远程访问）────────────────────────────────────────────────

// ─── Token 管理 ──────────────────────────────────────────────────────────────

const TOKEN_FILE = path.resolve(process.cwd(), '.axi-docs-token')

function loadOrCreateToken(): string {
  // 1. 优先使用环境变量
  if (process.env.MCP_AUTH_TOKEN) return process.env.MCP_AUTH_TOKEN

  // 2. 从持久化文件读取
  if (fs.existsSync(TOKEN_FILE)) {
    const saved = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    if (saved.length >= 32) return saved
  }

  // 3. 首次运行：生成强随机 token 并持久化
  const newToken = crypto.randomBytes(32).toString('hex')
  fs.writeFileSync(TOKEN_FILE, newToken, { mode: 0o600 }) // 仅 owner 可读
  console.error('[axi-docs-mcp] 首次运行，已生成访问 token 并保存至:', TOKEN_FILE)
  return newToken
}

const AUTH_TOKEN = loadOrCreateToken()
// Agent Platform receives a separate credential. It must never reuse the
// human/UI token, so the caller identity can be enforced at the MCP boundary.
const BOUNDED_AGENT_TOKEN = process.env.AXI_DOCS_BOUNDED_AGENT_TOKEN || ''

// ─── 请求安全常量 ──────────────────────────────────────────────────────────

const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10 MB

const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim())
  : []

function getAllowedOrigin(requestOrigin: string | undefined): string {
  if (!requestOrigin) return ALLOWED_ORIGINS[0] || ''
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin
  // 开发模式：若未配置允许域名则允许所有（便于本地调试）
  if (ALLOWED_ORIGINS.length === 0) return requestOrigin
  return ALLOWED_ORIGINS[0] || ''
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  let body = ''
  let size = 0
  for await (const chunk of req) {
    const bytes = chunk as { length: number }
    size += bytes.length
    if (size > MAX_BODY_SIZE) {
      throw Object.assign(new Error('Payload Too Large'), { statusCode: 413 })
    }
    body += chunk
  }
  return body
}

// ─── 暴力破解保护（速率限制）────────────────────────────────────────────────

const authFailures = new Map<string, { count: number; until: number }>()
const MAX_FAILURES = 10        // 10 次失败
const LOCKOUT_MS = 5 * 60_000 // 锁定 5 分钟

function getClientIp(req: http.IncomingMessage): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
    || req.socket.remoteAddress
    || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const rec = authFailures.get(ip)
  if (!rec) return false
  if (Date.now() < rec.until) return true
  authFailures.delete(ip)
  return false
}

function recordAuthFailure(ip: string): void {
  const rec = authFailures.get(ip) || { count: 0, until: 0 }
  rec.count++
  if (rec.count >= MAX_FAILURES) {
    rec.until = Date.now() + LOCKOUT_MS
    console.error(`[axi-docs-mcp] IP ${ip} 认证失败 ${rec.count} 次，锁定 5 分钟`)
  }
  authFailures.set(ip, rec)
}

function recordAuthSuccess(ip: string): void {
  authFailures.delete(ip)
}

// ─── 认证中间件 ───────────────────────────────────────────────────────────────

function requestToken(req: http.IncomingMessage): string {
  const authHeader = req.headers.authorization
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  return authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : url.searchParams.get('token') ?? ''
}

function tokenEquals(token: string, expected: string): boolean {
  if (!expected) return false
  const actualDigest = crypto.createHash('sha256').update(token).digest()
  const expectedDigest = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(actualDigest, expectedDigest) && token.length === expected.length
}

function getHttpCallerIdentity(req: http.IncomingMessage): CallerIdentity | null {
  const token = requestToken(req)
  if (tokenEquals(token, BOUNDED_AGENT_TOKEN)) return 'bounded_agent'
  if (tokenEquals(token, AUTH_TOKEN)) return 'human'
  return null
}

function authMiddleware(req: http.IncomingMessage): boolean {
  const ip = getClientIp(req)
  if (isRateLimited(ip)) return false

  const ok = getHttpCallerIdentity(req) !== null

  if (ok) { recordAuthSuccess(ip) } else { recordAuthFailure(ip) }
  return ok
}

async function startHttpServer(port: number) {
  createServer()

  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  }

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname

    // ── MCP 协议端点 ────────────────────────────────────────────────────────

    if (pathname === '/mcp' || pathname === '/mcp/') {
      // 认证检查
      if (!authMiddleware(req)) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="axi-docs-mcp"',
        })
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null }))
        return
      }

      const body = await readBody(req)

      const origin = getAllowedOrigin(req.headers.origin)
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      })

      try {
        const request = JSON.parse(body)
        const id = request.id

        if (request.method === 'initialize') {
          const response = {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'axi-docs-mcp', version: '1.0.0' },
            },
          }
          res.end(JSON.stringify(response))
        } else if (request.method === 'tools/list') {
          const tools = getToolSchemas()
          const response = { jsonrpc: '2.0', id, result: { tools } }
          res.end(JSON.stringify(response))
        } else if (request.method === 'tools/call') {
          // 手动处理 tools/call，因为 MCP SDK 的 HTTP 传输需要额外依赖
          const { name, arguments: args } = request.params
          const result = await handleToolCall(name, args || {}, getHttpCallerIdentity(req) ?? 'human')
          const response = { jsonrpc: '2.0', id, result }
          res.end(JSON.stringify(response))
        } else {
          res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }))
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: `Internal error: ${msg}` } }))
      }
      return
    }

    // ── CORS 预检 ──────────────────────────────────────────────────────────

    if (req.method === 'OPTIONS') {
      const origin = getAllowedOrigin(req.headers.origin)
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      })
      res.end()
      return
    }

    // ── 健康检查 + 工具列表（无需认证，方便检测服务状态）─────────────────────

    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', tools: getToolSchemas().map((t) => t.name) }))
      return
    }

    // ── API 代理（便捷 HTTP API，无需 JSON-RPC，远程访问友好）────────────────

    if (pathname.startsWith('/api/')) {
      // Blinko API 代理
      if (url.searchParams.get('source') === 'blinko') {
        if (!authMiddleware(req)) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized' }))
          return
        }
        handleBlinkoApi(req, res, url)
        return
      }

      // 本地源 API - 无需认证（内部服务，通过 Nginx/IP 白名单保护）

      const apiPath = pathname.slice(5) // 去掉 /api/（pathname 以 / 开头）
      const source = url.searchParams.get('source') || 'obsidian'
      const filePath = url.searchParams.get('path') || ''

      try {
        let result: string | null = null
        let statusCode = 200

        switch (apiPath) {
          case 'file': // 别名：read
          case 'read': {
            if (!filePath) throw new Error('path 参数必填')
            result = await readFile(source, filePath)
            if (result === null) {
              statusCode = 404
              result = `文件不存在：${filePath}`
            }
            break
          }
          case 'scan': {
            const items = await scanDir(source, filePath || undefined)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(items))
            return
          }
          case 'write': {
            if (!filePath) throw new Error('path 参数必填')
            const payload = JSON.parse(await readBody(req))
            const guarded = guardBoundedAgentTool(
              'obsidian_write',
              { source, path: filePath, content: payload.content || '', axiExecution: payload.axiExecution },
              getHttpCallerIdentity(req) ?? 'human',
            )
            if (guarded) {
              statusCode = 409
              result = guarded.content[0].text
              break
            }
            const writeResult = await writeFile(source, filePath, payload.content || '')
            if (!writeResult.success) {
              statusCode = 400
              result = writeResult.error || '写入失败'
            } else {
              result = JSON.stringify({ success: true, path: writeResult.path })
            }
            break
          }
          case 'sources': {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(docSources.filter((s) => s.enabled).map(sanitizeSource)))
            return
          }
          case 'search': {
            const query = url.searchParams.get('query') || url.searchParams.get('q')
            if (!query) throw new Error('query 参数必填')
            const items = await searchFiles(source, query, filePath || undefined)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(items))
            return
          }
          case 'fulltext_search': {
            const query = url.searchParams.get('query')
            if (!query) throw new Error('query 参数必填')
            const items = await searchFullText(source, query)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(items))
            return
          }
          case 'tags': {
            const tags = await getAllTags(source)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(tags))
            return
          }
          case 'graph': {
            if (!filePath) throw new Error('path 参数必填')
            const graphData = await buildGraphData(source, filePath)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(graphData))
            return
          }
          case 'global-graph': {
            const { nodes, edges, orphanNodes } = await buildGlobalGraph(source)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ nodes, edges, orphanNodes }))
            return
          }
          case 'catalog': {
            const catalog = await knowledgeBase.getKnowledgeCatalog(source)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(catalog))
            return
          }
          case 'ai/analyze': {
            const payload = JSON.parse(await readBody(req))
            const aiResult = await analyzeDocumentContent(payload.content || '', payload.fileName || '')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(aiResult))
            return
          }
          default:
            statusCode = 404
            result = `未知端点: ${apiPath}`
        }

        const origin = getAllowedOrigin(req.headers.origin)
        res.writeHead(statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Max-Age': '86400',
        })
        res.end(JSON.stringify(result))
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        const code = (e as { statusCode?: number }).statusCode ?? 400
        res.writeHead(code, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: msg }))
      }
      return
    }

    // ── 静态首页 / SPA 部署 ──────────────────────────────────────────────────

    const distDir = path.join(process.cwd(), 'dist')
    const distIndex = path.join(distDir, 'index.html')
    const hasBuiltApp = fs.existsSync(distIndex)

    const spaRoutes = [
      pathname === '/' || pathname === '/index.html',
      pathname.startsWith('/zh/guide/'),
      pathname.startsWith('/en/guide/'),
      pathname.startsWith('/nodes/'),
      pathname.startsWith('/docs/'),
    ]

    if (spaRoutes.some(Boolean)) {
      if (hasBuiltApp) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(await fsp.readFile(distIndex, 'utf-8'))
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(HOME_PAGE)
      }
      return
    }

    const staticRelativePath = pathname.slice(1)
    const ext = path.extname(staticRelativePath)
    if (ext && mimeTypes[ext]) {
      const staticPath = hasBuiltApp
        ? path.join(distDir, staticRelativePath)
        : path.join(process.cwd(), pathname)
      try {
        const staticContent = await fsp.readFile(staticPath)
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] })
        res.end(staticContent)
        return
      } catch {
        // file not found, fall through to 404
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  })

  // BIND_ADDRESS 可绑定到指定网卡，例如 Tailscale IP (100.x.x.x) 或仅本机 (127.0.0.1)
  const bindAddress = process.env.BIND_ADDRESS || '0.0.0.0'
  httpServer.listen(port, bindAddress, () => {
    console.error(`[axi-docs-mcp] HTTP 服务已启动: http://${bindAddress}:${port}`)
    console.error(`[axi-docs-mcp] 健康检查: http://${bindAddress}:${port}/health`)
    console.error('[axi-docs-mcp] 访问 token 已配置（值已脱敏，不写入日志）')
    console.error(`[axi-docs-mcp] MCP JSON-RPC: http://${bindAddress}:${port}/mcp`)
    console.error(`[axi-docs-mcp] REST API:     http://${bindAddress}:${port}/api/scan`)
  })

  return httpServer
}

// 手动处理工具调用（HTTP 模式下绕过 MCP SDK 的 transport）
async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  defaultCaller: CallerIdentity = 'human',
) {
  const guarded = guardBoundedAgentTool(name, args, defaultCaller)
  if (guarded) return guarded
  switch (name) {
    case 'obsidian_scan': {
      const source = (args.source as string) || 'obsidian'
      const dirPath = args.path as string | undefined
      return { content: [{ type: 'text', text: JSON.stringify(await scanDir(source, dirPath), null, 2) }] }
    }
    case 'obsidian_read': {
      const source = (args.source as string) || 'obsidian'
      const filePath = args.path as string
      if (!filePath) return { content: [{ type: 'text', text: '错误: path 参数必填' }], isError: true }
      const content = await readFile(source, filePath)
      if (content === null) return { content: [{ type: 'text', text: `文件不存在: ${filePath}` }], isError: true }
      return { content: [{ type: 'text', text: content }] }
    }
    case 'obsidian_write': {
      const source = (args.source as string) || 'obsidian'
      const filePath = args.path as string
      const content = args.content as string
      if (!filePath || content === undefined) return { content: [{ type: 'text', text: '错误: path 和 content 参数必填' }], isError: true }
      const result = await writeFile(source, filePath, content)
      if (result.success) return { content: [{ type: 'text', text: `✓ 文件已保存: ${result.path}` }] }
      return { content: [{ type: 'text', text: `✗ 保存失败: ${result.error}` }], isError: true }
    }
    case 'obsidian_list': {
      return { content: [{ type: 'text', text: JSON.stringify(docSources.filter((s) => s.enabled).map(sanitizeSource), null, 2) }] }
    }
    case 'obsidian_search': {
      const source = (args.source as string) || 'obsidian'
      const query = args.query as string
      const dirPath = args.path as string | undefined
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(await searchFiles(source, query, dirPath), null, 2) }] }
    }
    case 'obsidian_fulltext_search': {
      const source = (args.source as string) || 'obsidian'
      const query = args.query as string
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(await searchFullText(source, query), null, 2) }] }
    }
    case 'obsidian_write_note': {
      const source = (args.source as string) || 'obsidian'
      const filePath = args.path as string
      const body = args.content as string
      if (!filePath || body === undefined) return { content: [{ type: 'text', text: '错误: path 和 content 参数必填' }], isError: true }
      const meta: Record<string, unknown> = { date: (args.date as string) || new Date().toISOString().slice(0, 10) }
      if (args.title) meta.title = args.title as string
      if (args.tags && Array.isArray(args.tags)) meta.tags = args.tags
      const fullContent = buildFrontmatter(meta) + body
      const result = await writeFile(source, filePath, fullContent)
      if (result.success) return { content: [{ type: 'text', text: `✓ 笔记已保存: ${result.path}` }] }
      return { content: [{ type: 'text', text: `✗ 保存失败: ${result.error}` }], isError: true }
    }
    case 'knowledge_catalog': {
      const source = (args.source as string) || 'obsidian'
      return { content: [{ type: 'text', text: JSON.stringify(await knowledgeBase.getKnowledgeCatalog(source), null, 2) }] }
    }
    case 'knowledge_search': {
      const source = (args.source as string) || 'obsidian'
      const query = args.query as string
      const tag = args.tag as string | undefined
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(await knowledgeBase.searchKnowledge(source, query, tag), null, 2) }] }
    }
    case 'axi_docs_list_sources': {
      return { content: [{ type: 'text', text: JSON.stringify(knowledgeBase.getDocumentSourceRegistrySummary().map(sanitizeSource), null, 2) }] }
    }
    case 'axi_docs_search': {
      const query = args.query as string
      const source = args.source as string | undefined
      const tag = args.tag as string | undefined
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      const results = source
        ? await knowledgeBase.searchKnowledge(source, query, tag)
        : await knowledgeBase.searchKnowledgeAll(query, tag)
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
    }
    case 'axi_docs_read': {
      const source = args.source as string
      const filePath = args.path as string
      if (!source || !filePath) return { content: [{ type: 'text', text: '错误: source 和 path 参数必填' }], isError: true }
      const content = await knowledgeBase.readKnowledgeFile(source, filePath)
      if (content === null) return { content: [{ type: 'text', text: `文件不存在: ${source}:${filePath}` }], isError: true }
      return { content: [{ type: 'text', text: content }] }
    }
    case 'axi_docs_context_summary': {
      const source = args.source as string
      const filePath = args.path as string
      if (!source || !filePath) return { content: [{ type: 'text', text: '错误: source 和 path 参数必填' }], isError: true }
      const summary = await fixedDocumentContextSummary(source, filePath)
      if (summary === null) return { content: [{ type: 'text', text: `文件不存在: ${source}:${filePath}` }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
    }
    case 'axi_docs_get_tool_capabilities': {
      return { content: [{ type: 'text', text: JSON.stringify(MCP_TOOL_CAPABILITIES, null, 2) }] }
    }
    case 'axi_docs_skill_search': {
      const query = args.query as string
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(await searchSkillLibraries(query), null, 2) }] }
    }
    case 'axi_docs_workspace_status': {
      return { content: [{ type: 'text', text: JSON.stringify(await knowledgeBase.getWorkspaceStatus(), null, 2) }] }
    }
    case 'axi_docs_project_summary': {
      const project = args.project as string
      if (!project) return { content: [{ type: 'text', text: '错误: project 参数必填' }], isError: true }
      const summary = await knowledgeBase.getProjectSummary(project)
      if (!summary) return { content: [{ type: 'text', text: `未找到项目: ${project}` }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
    }
    case 'axi_docs_project_onboard': {
      const project = args.project as string
      if (!project) return { content: [{ type: 'text', text: '错误: project 参数必填' }], isError: true }
      const card = await knowledgeBase.getProjectHandoffCard(project)
      const summary = await knowledgeBase.getProjectSummary(project)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            project: {
              id: project,
              name: summary?.title || project,
              manifestPath: card.manifestPath,
              handoffPath: card.handoffPath,
            },
            readiness: card.readiness,
            score: card.score,
            readOrder: card.readOrder,
            entrypoints: card.entrypoints,
            smokeCommand: card.smokeCommand,
            verifyCommand: card.verifyCommand,
            currentWork: card.currentWork,
            lastVerifiedAt: card.lastVerifiedAt,
            ageDays: card.ageDays,
            state: card.state,
          }, null, 2),
        }],
      }
    }
    case 'axi_docs_handoff_check': {
      const project = args.project as string
      const smoke = args.smoke === true
      if (!project) return { content: [{ type: 'text', text: '错误: project 参数必填' }], isError: true }
      const card = await knowledgeBase.getProjectHandoffCard(project)
      const snapshotStatus = await knowledgeBase.getHandoffSnapshotStatus()
      const result: Record<string, unknown> = {
        project,
        snapshot: {
          source: snapshotStatus.source,
          generatedAt: snapshotStatus.generatedAt,
          ageDays: snapshotStatus.ageDays,
        },
        handoff: {
          state: card.state,
          readiness: card.readiness,
          score: card.score,
          ageDays: card.ageDays,
          lastVerifiedAt: card.lastVerifiedAt,
          manifestPath: card.manifestPath,
          handoffPath: card.handoffPath,
        },
        smoke: {
          enabled: smoke,
          ran: false,
          command: card.smokeCommand,
          exitCode: null,
          output: null,
        },
      }
      if (smoke) {
        if (!card.smokeCommand) {
          result.smoke = { ...(result.smoke as Record<string, unknown>), ran: false, output: 'no smoke command declared in manifest.commands.smoke[]' }
        } else {
          const { execFileSync } = await import('node:child_process')
          try {
            const cwd = card.manifestPath
              ? card.manifestPath.replace(/\/docs\/project-docs\.manifest\.json$/, '')
              : process.cwd()
            const output = execFileSync('sh', ['-c', card.smokeCommand], {
              cwd,
              encoding: 'utf8',
              timeout: 30_000,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            result.smoke = { ...(result.smoke as Record<string, unknown>), ran: true, exitCode: 0, output: output.slice(0, 4000) }
          } catch (error) {
            const err = error as { status?: number; stdout?: string; stderr?: string; message: string }
            result.smoke = {
              ...(result.smoke as Record<string, unknown>),
              ran: true,
              exitCode: typeof err.status === 'number' ? err.status : 1,
              output: ((err.stdout || '') + (err.stderr || '')).slice(0, 4000) || err.message,
            }
          }
        }
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
    // ── Blinko 工具 ───────────────────────────────────────────────────────────
    case 'blinko_list_notes': {
      const limit = Math.min(Number(args.limit) || 50, 200)
      const apiToken = process.env.BLINKO_TOKEN || docSources.find(s => s.id === 'blinko')?.apiToken || ''
      if (!apiToken) {
        return { content: [{ type: 'text', text: '错误: 未配置 BLINKO_TOKEN，请在 .env 中配置' }], isError: true }
      }
      const notes = await blinkoRequest<BlinkoNote[]>(
        '/api/v1/note/list',
        'POST',
        { page: 1, size: limit, orderBy: 'desc', type: -1, isRecycle: false },
        apiToken
      )
      if (!Array.isArray(notes)) {
        return { content: [{ type: 'text', text: `Blinko API 错误: ${JSON.stringify(notes)}` }], isError: true }
      }
      const preview = notes.map(n => ({
        id: n.id,
        content: n.content?.slice(0, 100) || '(empty)',
        tags: n.tags,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      }))
      return { content: [{ type: 'text', text: JSON.stringify(preview, null, 2) }] }
    }
    case 'blinko_read_note': {
      const noteId = Number(args.noteId)
      if (!noteId) return { content: [{ type: 'text', text: '错误: noteId 参数必填' }], isError: true }
      const apiToken = process.env.BLINKO_TOKEN || docSources.find(s => s.id === 'blinko')?.apiToken || ''
      if (!apiToken) {
        return { content: [{ type: 'text', text: '错误: 未配置 BLINKO_TOKEN，请在 .env 中配置' }], isError: true }
      }
      const detail = await blinkoRequest<{ content?: string; contentText?: string }>(
        '/api/v1/note/detail',
        'POST',
        { id: noteId },
        apiToken
      )
      const content = detail?.content || detail?.contentText || ''
      if (!content) return { content: [{ type: 'text', text: `笔记 ${noteId} 为空或不存在` }], isError: true }
      return { content: [{ type: 'text', text: content }] }
    }
    case 'blinko_write_note': {
      const content = args.content as string
      const noteId = args.noteId !== undefined ? Number(args.noteId) : undefined
      const apiToken = process.env.BLINKO_TOKEN || docSources.find(s => s.id === 'blinko')?.apiToken || ''
      if (!apiToken) {
        return { content: [{ type: 'text', text: '错误: 未配置 BLINKO_TOKEN，请在 .env 中配置' }], isError: true }
      }
      if (!content) return { content: [{ type: 'text', text: '错误: content 参数必填' }], isError: true }
      const result = await blinkoRequest<{ id?: number; error?: string }>(
        '/api/v1/note/upsert',
        'POST',
        { content, ...(noteId ? { id: noteId } : {}), type: -1 },
        apiToken
      )
      if (result.error || !result.id) {
        return { content: [{ type: 'text', text: `写入失败: ${result.error || JSON.stringify(result)}` }], isError: true }
      }
      return { content: [{ type: 'text', text: `✓ 笔记已保存，ID: ${result.id}` }] }
    }
    case 'blinko_search': {
      const query = args.query as string
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      const apiToken = process.env.BLINKO_TOKEN || docSources.find(s => s.id === 'blinko')?.apiToken || ''
      if (!apiToken) {
        return { content: [{ type: 'text', text: '错误: 未配置 BLINKO_TOKEN，请在 .env 中配置' }], isError: true }
      }
      // 先获取所有笔记，再在本地过滤（Blinko API 没有独立的搜索端点）
      const allNotes = await blinkoRequest<BlinkoNote[]>(
        '/api/v1/note/list',
        'POST',
        { page: 1, size: 200, orderBy: 'desc', type: -1, isRecycle: false },
        apiToken
      )
      if (!Array.isArray(allNotes)) {
        return { content: [{ type: 'text', text: `Blinko API 错误: ${JSON.stringify(allNotes)}` }], isError: true }
      }
      const q = query.toLowerCase()
      const matches = allNotes.filter(n => n.content?.toLowerCase().includes(q))
      const preview = matches.slice(0, 20).map(n => ({
        id: n.id,
        content: n.content?.slice(0, 150) || '(empty)',
        tags: n.tags,
      }))
      return { content: [{ type: 'text', text: JSON.stringify({ count: matches.length, results: preview }, null, 2) }] }
    }
    default:
      return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true }
  }
}

// ─── 启动入口 ─────────────────────────────────────────────────────────────────

const HOME_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Axi Docs MCP</title>
<style>
  body { font-family: system-ui; max-width: 720px; margin: 60px auto; padding: 0 20px; background: #fafafa; }
  h1 { color: #333; }
  h2 { color: #666; margin-top: 2em; }
  code { background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  pre { background: #222; color: #eee; padding: 20px; border-radius: 8px; overflow-x: auto; }
  .tag { display: inline-block; background: #0070f3; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; margin-left: 8px; }
  .method { color: #79b8ff; }
  .path { color: #9ecbff; }
  .note { background: #fffbea; border: 1px solid #f0db4f; padding: 12px 16px; border-radius: 6px; margin: 20px 0; }
</style>
</head>
<body>
<h1>Axi Docs MCP Server <span class="tag">HTTP</span></h1>
<p>Obsidian 知识库 MCP 服务（HTTP 传输模式），支持 MCP JSON-RPC 和 REST API 两种调用方式。</p>

<div class="note">
  <strong>认证方式：</strong>所有需要认证的请求需带 <code>Authorization: Bearer &lt;token&gt;</code> 请求头或 <code>?token=...</code> 查询参数。Token 在服务启动日志中显示，或查看 <code>.axi-docs-token</code> 文件。
</div>

<h2>可用工具 / REST 端点</h2>
<table style="width:100%;border-collapse:collapse;text-align:left;">
<tr style="border-bottom:1px solid #ddd;"><th style="padding:8px;">方法</th><th style="padding:8px;">路径</th><th style="padding:8px;">说明</th></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">GET</span></td><td style="padding:8px;"><code>/api/scan?source=obsidian&path=&amp;token=...</code></td><td style="padding:8px;">扫描目录</td></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">GET</span></td><td style="padding:8px;"><code>/api/read?source=obsidian&amp;path=&amp;token=...</code></td><td style="padding:8px;">读取文件</td></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">POST</span></td><td style="padding:8px;"><code>/api/write?source=obsidian&amp;path=&amp;token=...</code></td><td style="padding:8px;">写入文件（body: {"content":"..."})</td></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">GET</span></td><td style="padding:8px;"><code>/api/sources?token=...</code></td><td style="padding:8px;">列出文档源</td></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">GET</span></td><td style="padding:8px;"><code>/api/search?source=obsidian&amp;query=&amp;path=&amp;token=...</code></td><td style="padding:8px;">搜索文件</td></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">GET</span></td><td style="padding:8px;"><code>/health</code></td><td style="padding:8px;">健康检查（无需认证）</td></tr>
</table>

<h2>使用示例</h2>
<pre>TOKEN=$(cat .axi-docs-token)

curl -H "Authorization: Bearer $TOKEN" "http://localhost:3010/api/scan"

curl -H "Authorization: Bearer $TOKEN" \\
  "http://localhost:3010/api/read?source=obsidian&path=inbox/test.md"

curl -X POST -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"content":"# Hello\\n\\nworld"}' \\
  "http://localhost:3010/api/write?source=obsidian&path=inbox/test.md"</pre>

<h2>Claude Code 远程配置</h2>
<p>在 <code>~/.claude/settings.json</code> 中添加：</p>
<pre>{
  "allowedMcpServers": [{
    "serverName": "axi-docs-remote",
    "serverUrl": "http://你的服务器地址:3010/mcp"
  }]
}</pre>
<p>环境变量 <code>MCP_AUTH_TOKEN</code> 设置访问令牌。</p>
</body>
</html>`

async function main() {
  const mode = process.argv[2]

  if (mode === 'http') {
    const port = parseInt(process.env.MCP_HTTP_PORT || '3010', 10)
    await startHttpServer(port)
  } else {
    // 默认 stdio 模式（本地 Claude Code 使用）
    const transport = new StdioServerTransport()
    const server = createServer()
    await server.connect(transport)
  console.error('[axi-docs-mcp] 已启动，stdio 模式')
  }
}

main().catch((e) => {
  console.error('[axi-docs-mcp] 启动失败:', e)
  process.exit(1)
})
