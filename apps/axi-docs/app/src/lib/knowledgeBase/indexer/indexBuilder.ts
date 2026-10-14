/**
 * File walker + LocalSourceIndex builders.
 *
 * `collectLocalMarkdownFiles` walks a source root; `buildLocalSourceIndex`
 * groups the parsed docs by path/stem, computes backlinks via wikilinks and
 * aggregates tag counts; `getLocalSourceIndex` is the main entry point that
 * combines incremental re-indexing with the static-mode cache switch used by
 * `vite.config.plugin.ts` at build time.
 */

import fs from 'fs'
import path from 'path'
import { normalizeStringArray, runKnowledgeIntake } from '../../knowledgeIntake'
import type {
  DocSource,
  Frontmatter,
} from '../../../types'
import type {
  IndexedLocalFile,
  LocalFileEntry,
  LocalSourceIndex,
  ParsedDocument,
} from '../types'
import {
  extractInlineTags,
  isExcludedName,
  isSupportedFile,
  normalizeSlashes,
  parseMarkdownDocument,
} from '../utils'
import { getSource, listBlinkoNotes } from '../sources'
import { collectSkillDocuments } from '../skills'
import { collectWorkspaceDocuments } from './workspaceCollect'
import { parseLocalDocumentFromFile } from './parseDocument'
import { isLocalSourceIndexStaticMode, localSourceIndexCache } from './cache'

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------

export async function collectLocalMarkdownFiles(sourceRoot: string): Promise<LocalFileEntry[]> {
  const files: LocalFileEntry[] = []

  async function walk(dirPath: string, relativeDir = ''): Promise<void> {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (isExcludedName(entry.name)) continue
      const fullPath = path.join(dirPath, entry.name)
      const nextRelative = normalizeSlashes(relativeDir ? path.join(relativeDir, entry.name) : entry.name)

      if (entry.isDirectory()) {
        if (entry.name === '_assets' || entry.name === '_templates') continue
        await walk(fullPath, nextRelative)
        continue
      }

      if (!entry.isFile() || !isSupportedFile(entry.name)) continue
      const stat = await fs.promises.stat(fullPath)
      files.push({
        relativePath: nextRelative,
        fullPath,
        stat,
      })
    }
  }

  await walk(sourceRoot)
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'zh-CN'))
}

export function buildLocalSourceIndex(
  source: DocSource,
  rootPath: string,
  files: Map<string, IndexedLocalFile>,
  documents: ParsedDocument[],
  rejected: Array<{ path: string; issues: string[] }>,
): LocalSourceIndex {
  const byPath = new Map<string, ParsedDocument>()
  const byStem = new Map<string, ParsedDocument>()
  const tagCounts = new Map<string, number>()

  for (const document of documents) {
    byPath.set(document.path, document)
    for (const stem of [document.name, document.rawTitle || '', document.title, ...document.aliases]) {
      const normalizedStem = stem.trim().toLowerCase()
      if (normalizedStem) {
        byStem.set(normalizedStem, document)
      }
    }
    for (const tag of document.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    }
  }

  const tags = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN'))

  const backlinkPathsByPath = new Map<string, string[]>()
  for (const document of documents) {
    const seenTargets = new Set<string>()
    const wikilinkRegex = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g
    wikilinkRegex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = wikilinkRegex.exec(document.body)) !== null) {
      const target = byStem.get(match[1].trim().toLowerCase())
      if (!target || target.path === document.path || seenTargets.has(target.path)) continue
      seenTargets.add(target.path)
      const sources = backlinkPathsByPath.get(target.path)
      if (sources) {
        sources.push(document.path)
      } else {
        backlinkPathsByPath.set(target.path, [document.path])
      }
    }
  }

  return {
    sourceId: source.id,
    rootPath,
    builtAt: new Date().toISOString(),
    files,
    documents,
    rejected,
    tags,
    byPath,
    byStem,
    backlinkPathsByPath,
  }
}

export function buildVirtualSourceIndex(source: DocSource, rootPath: string, documents: ParsedDocument[]): LocalSourceIndex {
  const files = new Map<string, IndexedLocalFile>()
  const now = new Date().toISOString()

  for (const document of documents) {
    files.set(document.path, {
      relativePath: document.path,
      fullPath: path.join(rootPath, document.path),
      mtimeMs: Date.parse(document.updated || now) || Date.now(),
      document,
    })
  }

  return buildLocalSourceIndex(source, rootPath, files, documents, [])
}

export async function getSpecializedSourceIndex(source: DocSource): Promise<LocalSourceIndex | null> {
  const rootPath = path.normalize(source.path)
  const cachedIndex = localSourceIndexCache.get(source.id)

  if (source.adapter === 'skills') {
    if (cachedIndex?.rootPath === rootPath) return cachedIndex
    const index = buildVirtualSourceIndex(source, rootPath, await collectSkillDocuments(source))
    localSourceIndexCache.set(source.id, index)
    return index
  }

  if (source.adapter === 'workspace') {
    if (cachedIndex?.rootPath === rootPath) return cachedIndex
    const index = buildVirtualSourceIndex(source, rootPath, await collectWorkspaceDocuments(source))
    localSourceIndexCache.set(source.id, index)
    return index
  }

  return null
}

/**
 * Build-time cache switch for markdown-source indexes. Outside static mode,
 * `getLocalSourceIndex` re-walks the whole source tree on every call so
 * externally edited files are picked up immediately (dev-server freshness).
 * `vite.config.plugin.ts` enables static mode during `generateBundle`, which
 * requests one graph per document; re-walking a large root (e.g. the
 * workspace-root source spanning the whole workspace, ~7s per walk) once per
 * document multiplied into hours of build time. Static mode returns the
 * cached index as-is for the duration of the bundle step.
 */

export async function getLocalSourceIndex(source: DocSource): Promise<LocalSourceIndex> {
  const specializedIndex = await getSpecializedSourceIndex(source)
  if (specializedIndex) return specializedIndex

  const rootPath = path.normalize(source.path)
  const cachedIndex = localSourceIndexCache.get(source.id)
  if (isLocalSourceIndexStaticMode() && cachedIndex && cachedIndex.rootPath === rootPath) {
    return cachedIndex
  }
  const previousFiles = cachedIndex && cachedIndex.rootPath === rootPath
    ? cachedIndex.files
    : new Map<string, IndexedLocalFile>()

  const currentFiles = await collectLocalMarkdownFiles(rootPath)
  const nextFiles = new Map<string, IndexedLocalFile>()
  const documents: ParsedDocument[] = []
  const rejected: Array<{ path: string; issues: string[] }> = []

  for (const file of currentFiles) {
    const cachedFile = previousFiles.get(file.relativePath)
    let indexedFile = cachedFile

    if (!cachedFile || cachedFile.fullPath !== file.fullPath || cachedFile.mtimeMs !== file.stat.mtimeMs) {
      const raw = await fs.promises.readFile(file.fullPath, 'utf-8')
      const parsed = parseMarkdownDocument(raw)
      const frontmatter = parsed.data as Frontmatter
      const sourceTags = [...new Set([...normalizeStringArray(frontmatter.tags), ...extractInlineTags(raw)])]
      const intake = runKnowledgeIntake(
        { ...frontmatter, tags: sourceTags },
        { allowUnannotated: source.organizationHint === 'axi-rules' },
      )
      if (!intake.accepted) {
        rejected.push({
          path: file.relativePath,
          issues: intake.issues.map((issue) => issue.message),
        })
        continue
      }
      const document = await parseLocalDocumentFromFile(source, file.relativePath, file.fullPath, file.stat)
      if (!document) {
        rejected.push({
          path: file.relativePath,
          issues: ['IQC 未通过，文档未入库。'],
        })
        continue
      }
      indexedFile = {
        relativePath: file.relativePath,
        fullPath: file.fullPath,
        mtimeMs: file.stat.mtimeMs,
        document,
      }
    }

    if (!indexedFile) continue
    nextFiles.set(file.relativePath, indexedFile)
    documents.push(indexedFile.document)
  }

  documents.sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'))

  const index = buildLocalSourceIndex(source, rootPath, nextFiles, documents, rejected)
  localSourceIndexCache.set(source.id, index)
  return index
}

// ---------------------------------------------------------------------------
// getKnowledgeTags (api + local)
// ---------------------------------------------------------------------------

export async function getKnowledgeTags(
  sourceId: string,
): Promise<Array<{ name: string; count: number }>> {
  const source = getSource(sourceId)
  if (!source) return []

  if (source.type === 'api') {
    const notes = await listBlinkoNotes(source)
    const counts = new Map<string, number>()
    for (const note of notes) {
      for (const tag of note.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count)
  }

  const index = await getLocalSourceIndex(source)
  return index.tags
}