import type { Frontmatter } from '../../types'

// Decode JSON-encoded content strings
export function preprocessContent(raw: string): string {
  if (!raw) return raw
  const s = raw.trim()
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      const decoded = JSON.parse(s)
      if (typeof decoded === 'string') return decoded
    } catch {
      return s.slice(1, -1)
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\')
    }
  }
  return raw
}

// Parse YAML frontmatter
export function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  if (!content.startsWith('---')) return { frontmatter: {}, body: content }
  const end = content.indexOf('\n---', 3)
  if (end === -1) return { frontmatter: {}, body: content }
  const yaml = content.slice(4, end)
  const body = content.slice(end + 4).trimStart()
  const frontmatter: Frontmatter = {}
  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const raw = line.slice(colonIdx + 1).trim()
    if (raw.startsWith('[') && raw.endsWith(']')) {
      frontmatter[key] = raw.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
    } else {
      frontmatter[key] = raw.replace(/^["']|["']$/g, '')
    }
  }
  return { frontmatter, body }
}

export function headingId(children: React.ReactNode): string {
  const text = String(children)
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fa5\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

export function isGuidePath(path: string, guideId: string): boolean {
  // guideId may arrive as `guide/search` or `guide/search.md`; we accept both.
  const normalized = path.replace(/\.md$/i, '')
  return normalized === `guide/${guideId}` || normalized.endsWith(`/guide/${guideId}`)
}

// Extract raw text from React children
export function extractText(root: React.ReactNode): string {
  const parts: string[] = []
  const stack: React.ReactNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()
    if (typeof node === 'string') parts.push(node)
    else if (typeof node === 'number') parts.push(String(node))
    else if (Array.isArray(node)) { for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]) }
    else if (node && typeof node === 'object' && 'props' in (node as object)) {
      stack.push((node as React.ReactElement).props.children)
    }
  }
  return parts.join('')
}