import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import matter from 'gray-matter'
import {
  blinkoRequest,
  buildConfig,
  buildNoteSnapshot,
  computeSyncHash,
  fetchNotes,
} from '../sync-blinko.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

async function listMirrorFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name === '_assets') continue
    const fullPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listMirrorFiles(fullPath))
      continue
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function coerceNoteId(filePath, frontmatter) {
  const frontmatterId = Number(frontmatter?.blinko_id)
  if (Number.isFinite(frontmatterId) && frontmatterId > 0) {
    return frontmatterId
  }

  const basename = path.basename(filePath, '.md')
  const filenameId = Number(basename)
  return Number.isFinite(filenameId) && filenameId > 0 ? filenameId : null
}

async function readMirrorDocument(filePath, config) {
  const raw = await fs.readFile(filePath, 'utf-8')
  const parsed = matter(raw)
  const frontmatter = parsed.data || {}
  const noteId = coerceNoteId(filePath, frontmatter)
  const snapshot = {
    id: noteId,
    content: parsed.content.trimEnd(),
    type: Number.isFinite(Number(frontmatter.blinko_type)) ? Number(frontmatter.blinko_type) : -1,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(tag => String(tag).trim()).filter(Boolean) : [],
    isArchived: Boolean(frontmatter.isArchived),
    isTop: Boolean(frontmatter.isTop),
    isShare: Boolean(frontmatter.isShare),
    attachments: [],
  }
  const fileHash = computeSyncHash(snapshot)
  const stat = await fs.stat(filePath)

  return {
    filePath,
    noteId,
    frontmatter,
    snapshot,
    fileHash,
    syncHash: typeof frontmatter.sync_hash === 'string' ? frontmatter.sync_hash.trim() : '',
    localModifiedAt: new Date(stat.mtimeMs).toISOString(),
    relativePath: path.relative(projectRoot, filePath),
    attachmentDir: path.join(config.syncDir, '_assets', String(noteId ?? 'new')),
  }
}

async function buildRemoteMap(config) {
  const notes = await fetchNotes(config)
  return new Map(notes.map(note => [note.id, note]))
}

function buildRemoteHash(remoteNote, config) {
  return computeSyncHash(buildNoteSnapshot(remoteNote, config))
}

function shouldPushLocal(doc, remoteNote, config) {
  if (!remoteNote) {
    return doc.fileHash !== doc.syncHash
  }

  const remoteHash = buildRemoteHash(remoteNote, config)
  if (doc.fileHash === doc.syncHash) {
    return false
  }
  if (remoteHash === doc.syncHash) {
    return true
  }

  const localTimestamp = Date.parse(doc.localModifiedAt) || 0
  const remoteTimestamp = Date.parse(remoteNote.updatedAt || doc.frontmatter.blinko_updated_at || '') || 0
  return localTimestamp >= remoteTimestamp
}

function buildSkippedReason(doc, remoteNote, config) {
  if (!remoteNote && doc.fileHash === doc.syncHash) {
    return 'remote-missing-but-local-unchanged'
  }
  if (remoteNote && doc.fileHash === doc.syncHash) {
    return 'local-unchanged'
  }
  if (remoteNote) {
    const remoteHash = buildRemoteHash(remoteNote, config)
    if (remoteHash !== doc.syncHash && !shouldPushLocal(doc, remoteNote, config)) {
      return 'remote-newer'
    }
  }
  return 'skipped'
}

function uploadAttachmentWithHook(filePath, noteId, config) {
  if (!config.ossUploadCommand) {
    return null
  }

  const result = spawnSync(config.ossUploadCommand, {
    shell: true,
    encoding: 'utf-8',
    env: {
      ...process.env,
      BLINKO_ATTACHMENT_FILE: filePath,
      BLINKO_ATTACHMENT_NOTE_ID: String(noteId ?? ''),
      BLINKO_ATTACHMENT_MAX_BYTES: String(config.attachmentMaxBytes),
    },
  })

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || 'unknown hook failure'
    throw new Error(`OSS 上传钩子失败: ${stderr}`)
  }

  const stdout = result.stdout?.trim()
  if (!stdout) {
    throw new Error('OSS 上传钩子未返回附件元数据')
  }

  const metadata = JSON.parse(stdout)
  return {
    name: String(metadata.name || path.basename(filePath)),
    path: String(metadata.path || metadata.url || ''),
    size: metadata.size ?? 0,
    type: String(metadata.type || ''),
  }
}

async function collectAttachments(doc, config) {
  if (!existsSync(doc.attachmentDir)) {
    return { attachments: [], warnings: [] }
  }

  const entries = await fs.readdir(doc.attachmentDir, { withFileTypes: true })
  const attachments = []
  const warnings = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const filePath = path.join(doc.attachmentDir, entry.name)
    const stat = await fs.stat(filePath)

    if (stat.size > config.attachmentMaxBytes) {
      warnings.push(`[attachment] ${entry.name} 超过 ${config.attachmentMaxBytes} 字节，按 local-only 跳过上传`)
      continue
    }

    if (!config.ossUploadCommand) {
      warnings.push(`[attachment] ${entry.name} 检测到可上传附件，但未配置 BLINKO_OSS_UPLOAD_COMMAND`)
      continue
    }

    attachments.push(uploadAttachmentWithHook(filePath, doc.noteId, config))
  }

  return { attachments, warnings }
}

async function upsertMirrorDocument(doc, remoteNote, config) {
  const { attachments, warnings } = await collectAttachments(doc, config)
  const payload = {
    content: doc.snapshot.content,
    type: doc.snapshot.type,
    attachments,
    isArchived: doc.snapshot.isArchived,
    isTop: doc.snapshot.isTop,
    isShare: doc.snapshot.isShare,
  }

  if (remoteNote?.id || doc.noteId) {
    payload.id = remoteNote?.id ?? doc.noteId
  }

  const result = await blinkoRequest(config, '/note/upsert', { body: payload })
  return { result, warnings }
}

async function maybeNormalizeFilename(filePath, noteId) {
  if (!noteId) return filePath
  const normalizedPath = path.join(path.dirname(filePath), `${noteId}.md`)
  if (normalizedPath === filePath) {
    return filePath
  }
  if (existsSync(normalizedPath)) {
    return filePath
  }

  await fs.rename(filePath, normalizedPath)
  return normalizedPath
}

async function importMirror(config = buildConfig()) {
  const mirrorDir = path.resolve(config.syncDir)
  if (!existsSync(mirrorDir)) {
    console.log(`[info] 镜像目录不存在，跳过导入：${mirrorDir}`)
    return { scanned: 0, updated: 0, created: 0, skipped: 0, conflicts: 0, warnings: [] }
  }

  const docs = await listMirrorFiles(mirrorDir)
  const remoteMap = await buildRemoteMap(config)
  const summary = {
    scanned: docs.length,
    updated: 0,
    created: 0,
    skipped: 0,
    conflicts: 0,
    warnings: [],
  }

  for (const filePath of docs) {
    const doc = await readMirrorDocument(filePath, config)
    const remoteNote = doc.noteId ? remoteMap.get(doc.noteId) : null

    if (!shouldPushLocal(doc, remoteNote, config)) {
      const reason = buildSkippedReason(doc, remoteNote, config)
      if (reason === 'remote-newer') {
        summary.conflicts += 1
      } else {
        summary.skipped += 1
      }
      console.log(`[import:skip] ${doc.relativePath} (${reason})`)
      continue
    }

    const { result, warnings } = await upsertMirrorDocument(doc, remoteNote, config)
    const noteId = Number(result?.id ?? remoteNote?.id ?? doc.noteId)
    const nextPath = await maybeNormalizeFilename(doc.filePath, noteId)

    if (remoteNote) {
      summary.updated += 1
      console.log(`[import:update] ${path.basename(nextPath)} -> note ${noteId}`)
    } else {
      summary.created += 1
      console.log(`[import:create] ${path.basename(nextPath)} -> note ${noteId}`)
    }

    for (const warning of warnings) {
      summary.warnings.push(`${path.basename(nextPath)}: ${warning}`)
      console.warn(warning)
    }
  }

  console.log(
    `[info] 导入完成：扫描 ${summary.scanned}，更新 ${summary.updated}，新建 ${summary.created}，跳过 ${summary.skipped}，冲突 ${summary.conflicts}`,
  )
  return summary
}

export { importMirror }

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === __filename

if (isDirectExecution) {
  void importMirror().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[fatal] 导入失败:', message)
    process.exitCode = 1
  })
}
