// Knowledge graph builders: local (per-note) and global (vault-wide).
// Indexes files via `lib/knowledgeBase` / filesystem walks; resolves
// wikilinks and tags; emits GraphNode/GraphEdge or GlobalGraphNode/GlobalGraphEdge.

import fs from 'fs'
const fsp = fs.promises
import path from 'path'
import { resolveSource } from './docSources'
import { isExcluded, isHiddenDir, isSupported, extractTagsFromContent } from './fileOps'
import type { GraphNode, GraphEdge, GlobalGraphNode, GlobalGraphEdge } from './types'

export type { GraphNode, GraphEdge, GlobalGraphNode, GlobalGraphEdge }

// ─── Local Knowledge Graph (single note, with backlinks) ─────────────────────

export async function buildGraphData(
  sourceId: string,
  currentRelativePath: string,
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
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

// ─── Global Knowledge Graph (full vault overview) ───────────────────────────

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

export async function buildGlobalGraph(
  sourceId: string,
): Promise<{ nodes: GlobalGraphNode[]; edges: GlobalGraphEdge[]; orphanNodes: GlobalGraphNode[] }> {
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
