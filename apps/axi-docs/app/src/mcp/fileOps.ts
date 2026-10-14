// Core local-source file operations: scan, read, write, search, tags, frontmatter.
// Path-traversal protection lives here — every entry point must resolve through
// `resolveSource` and check the resulting `path.relative` against `..`.

import fs from 'fs'
const fsp = fs.promises
import path from 'path'
import * as knowledgeBase from '../lib/knowledgeBase'
import { resolveSource } from './docSources'
import type { FileItem, TagInfo } from './types'

export type { FileItem, TagInfo }

// ─── 安全限制 ─────────────────────────────────────────────────────────────────

const excludePatterns = ['.git', 'node_modules', '.obsidian', '.trash']
const supportedExtensions = ['.md', '.markdown']

export function isExcluded(name: string): boolean {
  return excludePatterns.some((p) => name === p || name.startsWith('.'))
}

export function isHiddenDir(name: string): boolean {
  return name.startsWith('_')
}

export function isSupported(filename: string): boolean {
  const ext = filename.toLowerCase()
  return supportedExtensions.some((e) => ext.endsWith(e))
}

// ─── 核心操作 ─────────────────────────────────────────────────────────────────

export async function scanDir(sourceId: string, dirPath?: string): Promise<FileItem[]> {
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

export async function readFile(sourceId: string, filePath: string): Promise<string | null> {
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

export async function writeFile(
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
export async function searchFiles(
  sourceId: string,
  query: string,
  dirPath?: string,
): Promise<Array<Record<string, unknown>>> {
  const results = await knowledgeBase.searchKnowledge(sourceId, query)
  if (!dirPath) return results as unknown as Array<Record<string, unknown>>
  const normalizedDir = dirPath.replace(/\\/g, '/').replace(/\/$/, '')
  return results.filter((result) =>
    typeof result.path === 'string' && result.path.startsWith(`${normalizedDir}/`),
  ) as unknown as Array<Record<string, unknown>>
}

// 从 markdown 文件中提取所有标签（#tag-name 格式）
export function extractTagsFromContent(content: string): string[] {
  const tagRegex = /#([\p{L}\p{N}_-]+)/gu
  const tags = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase())
  }

  return Array.from(tags)
}

// 获取某个源下所有文件的标签
export async function getAllTags(sourceId: string): Promise<TagInfo[]> {
  return knowledgeBase.getKnowledgeTags(sourceId)
}

// Full-text search across all files
export async function searchFullText(
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
export function buildFrontmatter(meta: Record<string, unknown>): string {
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
