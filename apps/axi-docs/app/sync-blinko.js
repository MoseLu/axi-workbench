/**
 * Blinko -> Markdown mirror exporter.
 *
 * This script is intentionally server-friendly:
 * - mirror filenames are stable (`<blinko_id>.md`)
 * - exported frontmatter carries sync metadata for round-trip import
 * - the mirror directory is configurable via env
 */

import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_PAGE_SIZE = 200
const DEFAULT_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024

function toPositiveNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function buildConfig(overrides = {}) {
  const attachmentMaxBytes = toPositiveNumber(
    overrides.attachmentMaxBytes ?? process.env.BLINKO_ATTACHMENT_MAX_BYTES,
    DEFAULT_ATTACHMENT_MAX_BYTES,
  )

  return {
    apiUrl: String(overrides.apiUrl ?? process.env.BLINKO_API_URL ?? 'http://localhost:1111/api/v1').replace(/\/$/, ''),
    syncDir: overrides.syncDir ?? process.env.BLINKO_SYNC_DIR ?? path.join(__dirname, 'blinko-notes'),
    token: overrides.token ?? process.env.BLINKO_TOKEN ?? '',
    pageSize: toPositiveNumber(overrides.pageSize ?? process.env.BLINKO_PAGE_SIZE, DEFAULT_PAGE_SIZE),
    attachmentMaxBytes,
    attachmentPolicy: `oss<=${Math.floor(attachmentMaxBytes / (1024 * 1024))}MB; local-only>${Math.floor(attachmentMaxBytes / (1024 * 1024))}MB`,
    ossUploadCommand: String(overrides.ossUploadCommand ?? process.env.BLINKO_OSS_UPLOAD_COMMAND ?? '').trim(),
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`[info] 创建同步目录：${dirPath}`)
  }
}

function buildHeaders(config) {
  const headers = { 'Content-Type': 'application/json' }
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`
  }
  return headers
}

async function blinkoRequest(config, endpoint, { method = 'POST', body } = {}) {
  const response = await fetch(`${config.apiUrl}${endpoint}`, {
    method,
    headers: buildHeaders(config),
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Blinko API ${endpoint} 返回 ${response.status}: ${message.slice(0, 200)}`)
  }

  return response.json()
}

function normalizeTagName(tag) {
  if (!tag) return ''
  if (typeof tag === 'string') return tag.trim()
  if (tag.tag) return normalizeTagName(tag.tag)
  if (typeof tag.name === 'string') return tag.name.trim()
  return ''
}

function normalizeTags(note) {
  return [...new Set((note.tags || []).map(normalizeTagName).filter(Boolean))]
}

function normalizeAttachments(note, config) {
  return (note.attachments || []).map((attachment) => {
    const size = Number(attachment?.size ?? 0)
    return {
      name: String(attachment?.name || ''),
      path: String(attachment?.path || attachment?.url || ''),
      type: String(attachment?.type || ''),
      size: Number.isFinite(size) ? size : 0,
      localOnly: Number.isFinite(size) && size > config.attachmentMaxBytes,
    }
  })
}

function extractTitle(note) {
  const candidate = typeof note.title === 'string' && note.title.trim()
    ? note.title.trim()
    : String(note.contentText || note.content || '')
      .split(/\r?\n/)
      .map(line => line.replace(/^#+\s*/, '').trim())
      .find(Boolean)

  return (candidate || `Blinko-${note.id || 'untitled'}`).slice(0, 120)
}

function buildNoteSnapshot(note, config = buildConfig()) {
  return {
    id: note.id ?? null,
    content: String(note.contentText || note.content || '').trimEnd(),
    type: Number.isFinite(Number(note.type)) ? Number(note.type) : -1,
    tags: normalizeTags(note),
    isArchived: Boolean(note.isArchived),
    isTop: Boolean(note.isTop),
    isShare: Boolean(note.isShare),
    attachments: normalizeAttachments(note, config).map(attachment => ({
      name: attachment.name,
      path: attachment.path,
      type: attachment.type,
      size: attachment.size,
      localOnly: attachment.localOnly,
    })),
  }
}

function computeSyncHash(snapshot) {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

function yamlString(value) {
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function yamlStringArray(name, values) {
  if (!values.length) return `${name}: []`
  return `${name}:\n${values.map(value => `  - ${yamlString(value)}`).join('\n')}`
}

function noteToMarkdown(note, config = buildConfig()) {
  const snapshot = buildNoteSnapshot(note, config)
  const syncHash = computeSyncHash(snapshot)
  const title = extractTitle(note)
  const attachments = snapshot.attachments
  const attachmentNames = attachments.map(attachment => attachment.name).filter(Boolean)
  const localOnlyAttachments = attachments
    .filter(attachment => attachment.localOnly)
    .map(attachment => attachment.name)
    .filter(Boolean)
  const lines = [
    '---',
    `title: ${yamlString(title)}`,
    `blinko_id: ${note.id ?? ''}`,
    `blinko_type: ${snapshot.type}`,
    `blinko_created_at: ${yamlString(note.createdAt || '')}`,
    `blinko_updated_at: ${yamlString(note.updatedAt || '')}`,
    `mirror_updated_at: ${yamlString(note.updatedAt || '')}`,
    `sync_hash: ${yamlString(syncHash)}`,
    `attachment_policy: ${yamlString(config.attachmentPolicy)}`,
    `attachment_count: ${attachments.length}`,
    yamlStringArray('tags', snapshot.tags),
    yamlStringArray('attachment_names', attachmentNames),
    yamlStringArray('local_only_attachments', localOnlyAttachments),
    `source: ${yamlString('Blinko')}`,
    '---',
    '',
  ]

  const body = snapshot.content || `# ${title}`
  return {
    filename: `${note.id ?? Date.now()}.md`,
    markdown: `${lines.join('\n')}${body.trimEnd()}\n`,
    snapshot,
    syncHash,
  }
}

async function fetchNotes(config = buildConfig()) {
  const notes = []
  let page = 1

  while (true) {
    const data = await blinkoRequest(config, '/note/list', {
      body: {
        page,
        size: config.pageSize,
        orderBy: 'desc',
        type: -1,
        isRecycle: false,
      },
    })

    const batch = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : []

    notes.push(...batch)

    if (batch.length < config.pageSize) {
      break
    }
    page += 1
  }

  console.log(`[info] 获取到 ${notes.length} 条笔记`)
  return notes
}

async function syncNotes(config = buildConfig()) {
  ensureDir(config.syncDir)
  console.log('[info] 开始导出 Blinko 笔记镜像...')

  const notes = await fetchNotes(config)
  if (notes.length === 0) {
    console.log('[info] 没有需要导出的笔记')
    return { scanned: 0, written: 0, skipped: 0 }
  }

  let written = 0
  let skipped = 0

  for (const note of notes) {
    try {
      const { filename, markdown } = noteToMarkdown(note, config)
      const filePath = path.join(config.syncDir, filename)
      const existingContent = fs.existsSync(filePath)
        ? fs.readFileSync(filePath, 'utf-8')
        : null

      if (existingContent === markdown) {
        skipped += 1
        continue
      }

      fs.writeFileSync(filePath, markdown, 'utf-8')
      written += 1
      console.log(`[export] ${filename} <- ${extractTitle(note)}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[error] 导出笔记 "${extractTitle(note)}" 失败: ${message}`)
    }
  }

  console.log(`[info] 导出完成：写入 ${written} 条，跳过 ${skipped} 条`)
  return { scanned: notes.length, written, skipped }
}

export {
  buildConfig,
  blinkoRequest,
  buildNoteSnapshot,
  computeSyncHash,
  extractTitle,
  fetchNotes,
  normalizeTagName,
  noteToMarkdown,
  syncNotes,
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename

async function main() {
  try {
    await syncNotes()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[fatal] 导出失败:', message)
    process.exitCode = 1
  }
}

if (isDirectExecution) {
  void main()
}
