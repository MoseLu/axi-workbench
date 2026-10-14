/**
 * DocSource registry, source-map cache, write-side file I/O and the Blinko
 * API client. Read-side scan/parse live in `indexer.ts`. Search/catalog/
 * graph live in `search.ts` and `catalog.ts`.
 */

import fs from 'fs'
import path from 'path'
import {
  getDocumentSourceRegistry,
  validateDocumentSourceRegistry,
} from '../../config/documentSources'
import type { DocSource, FileItem, SearchResult } from '../../types'
import type { BlinkoNote } from './types'
import { DEFAULT_BLINKO_URL, isSupportedFile } from './utils'
import { invalidateLocalSourceIndex } from './indexer'

// ---------------------------------------------------------------------------
// Source registry
// ---------------------------------------------------------------------------

export function parseExtraSources(): DocSource[] {
  const raw = process.env.AXI_DOCS_EXTRA_SOURCES_JSON?.trim()
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []

        const source = entry as Record<string, unknown>
        const id = typeof source.id === 'string' ? source.id.trim() : ''
        const name = typeof source.name === 'string' ? source.name.trim() : ''
        const type = source.type === 'api' ? 'api' : source.type === 'local' ? 'local' : null
        if (!id || !name || !type) return []

        const adapter = source.adapter === 'skills' || source.adapter === 'workspace' || source.adapter === 'api'
          ? source.adapter
          : 'markdown'
        const normalized: DocSource = {
          id,
          name,
          description: typeof source.description === 'string' ? source.description : undefined,
          path: typeof source.path === 'string' ? source.path : '',
          enabled: source.enabled !== false,
          type,
          adapter,
          kind: adapter === 'skills'
            ? 'skill-library'
            : adapter === 'workspace'
              ? 'workspace-registry'
              : type === 'api'
                ? 'api-notes'
                : 'markdown-vault',
          audience: ['agent', 'human'],
          readOnly: source.readOnly === true,
          skillNames: Array.isArray(source.skillNames)
            ? source.skillNames.filter((skillName): skillName is string => typeof skillName === 'string' && skillName.trim().length > 0)
            : undefined,
          skillRoot: typeof source.skillRoot === 'string' && source.skillRoot.trim()
            ? source.skillRoot.trim().replace(/^\/+/u, '').replace(/\/+$/u, '')
            : undefined,
          locale: source.locale === 'zh' || source.locale === 'en'
            ? source.locale
            : undefined,
          includeSkillAssets: source.includeSkillAssets === true,
          includeSupportDocs: source.includeSupportDocs === true,
          organizationHint: source.organizationHint === 'dbskill' || source.organizationHint === 'skill-families' || source.organizationHint === 'axi-rules'
            ? source.organizationHint
            : undefined,
          apiUrl: typeof source.apiUrl === 'string' ? source.apiUrl : undefined,
          apiToken: typeof source.apiToken === 'string' ? source.apiToken : undefined,
          icon: source.icon === 'obsidian' || source.icon === 'blinko' || source.icon === 'folder'
            ? source.icon
            : 'folder',
        }

        if (normalized.type === 'local' && !normalized.path.trim()) return []
        if (normalized.type === 'api' && !normalized.apiUrl?.trim()) return []
        return [normalized]
      })
  } catch {
    return []
  }
}

export function createSourceMap(): Map<string, DocSource> {
  const sources: DocSource[] = [...getDocumentSourceRegistry(), ...parseExtraSources()]
  const registryErrors = validateDocumentSourceRegistry(sources)
  if (registryErrors.length > 0) {
    console.warn(`[axi-docs] source registry warnings: ${registryErrors.join('; ')}`)
  }
  const deduped = new Map<string, DocSource>()
  for (const source of sources) {
    if (!source.enabled) continue
    deduped.set(source.id, source)
  }
  return deduped
}

export function getDocumentSourceRegistrySummary(): DocSource[] {
  return listKnowledgeSources()
}

export function listKnowledgeSources(): DocSource[] {
  return [...createSourceMap().values()]
}

export function getSource(sourceId: string): DocSource | null {
  return createSourceMap().get(sourceId) ?? null
}

export function resolveLocalPath(source: DocSource, relativePath = ''): string | null {
  if (source.type !== 'local') return null
  if (relativePath.includes('..')) return null
  const sourceRoot = path.normalize(source.path)
  const fullPath = path.normalize(path.join(sourceRoot, relativePath))
  const rel = path.relative(sourceRoot, fullPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return fullPath
}

// ---------------------------------------------------------------------------
// Blinko API client
// ---------------------------------------------------------------------------

export async function blinkoRequest<T>(source: DocSource, urlPath: string, method: string, body?: unknown): Promise<T> {
  const baseUrl = source.apiUrl || DEFAULT_BLINKO_URL
  const url = new URL(urlPath, baseUrl)
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(source.apiToken ? { Authorization: `Bearer ${source.apiToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Invalid JSON from Blinko: ${text.slice(0, 160)}`)
  }
}

export async function listBlinkoNotes(source: DocSource): Promise<BlinkoNote[]> {
  const result = await blinkoRequest<BlinkoNote[] | { message?: string }>(
    source,
    '/api/v1/note/list',
    'POST',
    { page: 1, size: 200, orderBy: 'desc', type: -1, isRecycle: false },
  )
  return Array.isArray(result) ? result : []
}

// ---------------------------------------------------------------------------
// File-system write operation
// ---------------------------------------------------------------------------

export async function writeKnowledgeFile(
  sourceId: string,
  filePath: string,
  content: string,
): Promise<{ success: boolean; path: string; error?: string }> {
  const source = getSource(sourceId)
  if (!source) return { success: false, path: '', error: `未知文档源: ${sourceId}` }
  if (source.readOnly) return { success: false, path: filePath, error: '当前文档源是只读索引' }
  if (source.type !== 'local') return { success: false, path: '', error: '当前文档源不支持写入' }
  if (!isSupportedFile(filePath)) {
    return { success: false, path: filePath, error: '仅支持写入 Markdown 文件' }
  }

  const fullPath = resolveLocalPath(source, filePath)
  if (!fullPath) {
    return { success: false, path: filePath, error: '禁止路径穿越' }
  }

  try {
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.promises.writeFile(fullPath, content, 'utf-8')
    invalidateLocalSourceIndex(source.id, filePath)
    return { success: true, path: fullPath }
  } catch (error) {
    return {
      success: false,
      path: fullPath,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ---------------------------------------------------------------------------
// Public type re-exports
// ---------------------------------------------------------------------------

export type { FileItem, SearchResult }