import { KnowledgeCategoryKey, normalizeKnowledgeCategoryKey } from '../config/knowledgeRules'
import { SelectedFile } from '../types'

type GuideRouteLocale = 'zh' | 'en'

function hasBrowserBase64Api() {
  return typeof btoa === 'function' && typeof atob === 'function'
}

function toUtf8Binary(value: string): string {
  return encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
}

function fromUtf8Binary(value: string): string {
  const encoded = Array.from(value)
    .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
    .join('')
  return decodeURIComponent(encoded)
}

export function encodeBase64Url(value: string): string {
  if (hasBrowserBase64Api()) {
    return btoa(toUtf8Binary(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64url')
  }

  throw new Error('No base64 encoder available in this environment')
}

export function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')

  if (hasBrowserBase64Api()) {
    return fromUtf8Binary(atob(padded))
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8')
  }

  throw new Error('No base64 decoder available in this environment')
}

export function encodeDocumentId(file: SelectedFile): string {
  return encodeBase64Url(JSON.stringify(file))
}

export function decodeDocumentId(documentId: string): SelectedFile | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(documentId)) as Partial<SelectedFile>
    if (typeof parsed?.sourceId !== 'string' || typeof parsed?.path !== 'string') {
      return null
    }
    return {
      sourceId: parsed.sourceId,
      path: parsed.path,
    }
  } catch {
    return null
  }
}

function encodeRoutePath(pathname: string): string {
  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function decodeRoutePath(pathname: string): string | null {
  try {
    const decoded = pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join('/')
    return decoded || null
  } catch {
    return null
  }
}

function stripMarkdownExtension(pathname: string): string {
  return pathname.replace(/\.md$/u, '')
}

function ensureMarkdownExtension(pathname: string): string {
  return /\.md$/u.test(pathname) ? pathname : `${pathname}.md`
}

export function buildDocumentRoute(file: SelectedFile): string {
  const sourceId = encodeURIComponent(file.sourceId)
  const documentPath = encodeRoutePath(stripMarkdownExtension(file.path))
  return `/docs/${sourceId}/${documentPath}`
}

export function decodeDocumentRoute(sourceId: string | undefined, documentPath: string | undefined): SelectedFile | null {
  if (!sourceId || !documentPath) return null

  try {
    const decodedSourceId = decodeURIComponent(sourceId)
    const decodedPath = decodeRoutePath(documentPath)
    if (!decodedSourceId || !decodedPath) return null

    return {
      sourceId: decodedSourceId,
      path: ensureMarkdownExtension(decodedPath),
    }
  } catch {
    return null
  }
}

export function buildSearchRoute(keyword: string, sourceId?: string | null, locale: GuideRouteLocale = 'zh'): string {
  const params = new URLSearchParams()
  const normalizedKeyword = keyword.trim()

  if (normalizedKeyword) {
    params.set('q', normalizedKeyword)
  }

  if (sourceId) {
    params.set('source', sourceId)
  }

  const search = params.toString()
  return search ? `/${locale}/guide/search?${search}` : `/${locale}/guide/search`
}

export function normalizeCategoryRoute(categoryId?: string | null, subId?: string | null): KnowledgeCategoryKey | null {
  const nested = subId ? normalizeKnowledgeCategoryKey(subId) : null
  if (nested) return nested
  return normalizeKnowledgeCategoryKey(categoryId || '')
}

export function buildCategoryRoute(categoryId: string, subId?: string | null): string {
  if (subId) return `/nodes/${categoryId}/sub/${subId}`
  return `/nodes/${categoryId}`
}

export function normalizeRouterBasename(base: string | undefined): string | undefined {
  const normalized = (base || '').trim()
  if (!normalized || normalized === '/' || normalized === './') return undefined

  try {
    const url = new URL(normalized)
    const pathname = url.pathname.replace(/\/$/u, '')
    return pathname && pathname !== '/' ? pathname : undefined
  } catch {
    const pathname = normalized.startsWith('/') ? normalized : `/${normalized}`
    const withoutTrailingSlash = pathname.replace(/\/$/u, '')
    return withoutTrailingSlash && withoutTrailingSlash !== '/' ? withoutTrailingSlash : undefined
  }
}
