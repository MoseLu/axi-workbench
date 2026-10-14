/**
 * Skill document + asset builders and the file walker that produces the
 * `skill` source's `ParsedDocument[]`.
 *
 * `buildSkillDocument` parses a `SKILL.md` into a virtual doc; `collectSkill*`
 * walks the source root (filtered by `source.skillNames` / `source.includeSkillAssets`),
 * ingests asset markdown under each skill directory, and finally appends the
 * synthetic `SKILL_INDEX.md` entry.
 */

import fs from 'fs'
import path from 'path'
import type { DocSource, Frontmatter } from '../../../types'
import type { ParsedDocument } from '../types'
import {
  extractDescription,
  extractRawTitle,
  normalizeSlashes,
  parseMarkdownDocument,
  resolveLastUpdated,
  truncateText,
} from '../utils'
import { createVirtualParsedDocument } from '../indexer'
import { buildSkillIndexMarkdown } from './metadata'
import { DB_SKILL_FAMILIES } from './families'

export function buildSkillDocument(source: DocSource, relativePath: string, fullPath: string, stat: fs.Stats, raw: string): ParsedDocument {
  const parsed = parseMarkdownDocument(raw)
  const frontmatter = parsed.data as Frontmatter
  const updated = resolveLastUpdated(fullPath, stat, frontmatter)
  const skillDir = path.basename(path.dirname(relativePath))
  const skillName = typeof frontmatter.name === 'string' && frontmatter.name.trim()
    ? frontmatter.name.trim()
    : skillDir
  const displayTitle = typeof frontmatter.title === 'string' && frontmatter.title.trim()
    ? frontmatter.title.trim()
    : skillName
  const sourceDescription = truncateText(
    typeof frontmatter.description === 'string' && frontmatter.description.trim()
      ? frontmatter.description
      : extractDescription(frontmatter, parsed.content),
  ) || 'No frontmatter description'
  const description = `技能用途：${sourceDescription}`
  const family = source.organizationHint === 'dbskill'
    ? DB_SKILL_FAMILIES.find((item) => item.match.includes(skillName))
    : null
  const tags = ['技能', 'Agent', source.name, skillName, ...(family ? [family.title] : [])]
  const body = parsed.content || raw
  return createVirtualParsedDocument({
    sourceId: source.id,
    path: normalizeSlashes(relativePath),
    name: skillName,
    title: displayTitle,
    rawTitle: displayTitle,
    description,
    docType: 'skill',
    status: typeof frontmatter.status === 'string' ? frontmatter.status : 'active',
    tags,
    categories: ['standards', 'resources'],
    updated,
    raw,
    body,
    frontmatter: {
      ...frontmatter,
      id: `${source.id}:${skillName}`,
      title: displayTitle,
      type: 'skill',
      status: typeof frontmatter.status === 'string' ? frontmatter.status : 'active',
      tags,
      description,
      modified: updated,
      'graph-title': displayTitle,
      'graph-tags': ['技能', 'Agent'],
    },
    aliases: [skillDir, skillName, displayTitle],
    sourceTags: tags,
  })
}

export function buildSkillAssetDocument(source: DocSource, skillName: string, relativePath: string, fullPath: string, stat: fs.Stats, raw: string): ParsedDocument {
  const parsed = parseMarkdownDocument(raw)
  const frontmatter = parsed.data as Frontmatter
  const updated = resolveLastUpdated(fullPath, stat, frontmatter)
  const body = parsed.content || raw
  const fileName = path.basename(relativePath).replace(/\.(md|markdown)$/i, '')
  const rawTitle = extractRawTitle(frontmatter, body, fileName)
  const description = extractDescription(frontmatter, body) || `内容资产方法库附属文档：${relativePath}`
  const tags = ['内容资产', '技能资料', source.name, skillName]

  return createVirtualParsedDocument({
    sourceId: source.id,
    path: normalizeSlashes(relativePath),
    name: fileName,
    title: rawTitle,
    rawTitle,
    description,
    docType: typeof frontmatter.type === 'string' ? frontmatter.type : 'skill-asset',
    status: typeof frontmatter.status === 'string' ? frontmatter.status : 'active',
    tags,
    categories: ['resources', 'standards'],
    updated,
    raw,
    body,
    frontmatter: {
      ...frontmatter,
      id: `${source.id}:${skillName}:${normalizeSlashes(relativePath)}`,
      title: rawTitle,
      type: typeof frontmatter.type === 'string' ? frontmatter.type : 'skill-asset',
      status: typeof frontmatter.status === 'string' ? frontmatter.status : 'active',
      tags,
      description,
      modified: updated,
      'graph-title': rawTitle,
      'graph-tags': ['内容资产', '技能资料'],
    },
    aliases: [fileName, rawTitle, relativePath],
    sourceTags: tags,
  })
}

export async function collectSelectedSkillAssets(
  source: DocSource,
  skillRootPath: string,
  skillName: string,
  rootPath: string,
): Promise<ParsedDocument[]> {
  const documents: ParsedDocument[] = []

  async function walk(dirPath: string): Promise<void> {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (isExcludedNameLocal(entry.name)) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.isFile() || entry.name === 'SKILL.md' || !isSupportedFileLocal(entry.name)) continue
      const stat = await fs.promises.stat(fullPath)
      const raw = await fs.promises.readFile(fullPath, 'utf-8')
      const relativePath = normalizeSlashes(path.relative(rootPath, fullPath))
      documents.push(buildSkillAssetDocument(source, skillName, relativePath, fullPath, stat, raw))
    }
  }

  await walk(skillRootPath)
  return documents
}

export async function collectSkillSupportDocuments(source: DocSource, rootPath: string): Promise<ParsedDocument[]> {
  if (!source.includeSupportDocs) return []

  const supportRoots = ['README.md', 'docs', '知识库']
  const documents: ParsedDocument[] = []

  async function addFile(fullPath: string): Promise<void> {
    if (!isSupportedFileLocal(fullPath)) return
    const stat = await fs.promises.stat(fullPath)
    const raw = await fs.promises.readFile(fullPath, 'utf-8')
    const relativePath = normalizeSlashes(path.relative(rootPath, fullPath))
    documents.push(buildSkillAssetDocument(source, source.id, relativePath, fullPath, stat, raw))
  }

  async function walk(fullPath: string): Promise<void> {
    let stat: fs.Stats
    try {
      stat = await fs.promises.stat(fullPath)
    } catch {
      return
    }

    if (stat.isFile()) {
      await addFile(fullPath)
      return
    }
    if (!stat.isDirectory()) return

    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(fullPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (isExcludedNameLocal(entry.name)) continue
      await walk(path.join(fullPath, entry.name))
    }
  }

  for (const supportRoot of supportRoots) {
    await walk(path.join(rootPath, supportRoot))
  }

  return documents
}

export async function collectSkillDocuments(source: DocSource): Promise<ParsedDocument[]> {
  const rootPath = path.normalize(source.path)
  const skillRootSegment = (source.skillRoot && source.skillRoot.trim())
    ? source.skillRoot.trim().replace(/[\\/]+/gu, path.sep)
    : 'skills'
  const skillsRoot = path.join(rootPath, skillRootSegment)
  const documents: ParsedDocument[] = []
  const allowedSkillNames = new Set((source.skillNames || []).map((skillName) => skillName.toLowerCase()))

  async function walk(dirPath: string): Promise<void> {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (isExcludedNameLocal(entry.name)) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.isFile() || entry.name !== 'SKILL.md') continue
      const stat = await fs.promises.stat(fullPath)
      const raw = await fs.promises.readFile(fullPath, 'utf-8')
      const relativePath = normalizeSlashes(path.relative(rootPath, fullPath))
      const document = buildSkillDocument(source, relativePath, fullPath, stat, raw)
      if (allowedSkillNames.size === 0 || allowedSkillNames.has(document.name.toLowerCase())) {
        documents.push(document)
        if (allowedSkillNames.size > 0 || source.includeSkillAssets) {
          documents.push(...await collectSelectedSkillAssets(source, path.dirname(fullPath), document.name, rootPath))
        }
      }
    }
  }

  await walk(skillsRoot)
  documents.push(...await collectSkillSupportDocuments(source, rootPath))
  const indexPath = path.join(rootPath, 'docs', 'SKILL_INDEX.md')
  if (allowedSkillNames.size === 0 && fs.existsSync(indexPath)) {
    const stat = await fs.promises.stat(indexPath)
    const raw = await fs.promises.readFile(indexPath, 'utf-8')
    const updated = resolveLastUpdated(indexPath, stat)
    const indexRaw = buildSkillIndexMarkdown(source, documents.filter((document) => document.docType === 'skill'), raw)
    const body = parseMarkdownDocument(indexRaw).content
    documents.push(createVirtualParsedDocument({
      sourceId: source.id,
      path: 'docs/SKILL_INDEX.md',
      name: 'SKILL_INDEX',
      title: 'Axi Skills Index',
      rawTitle: 'Axi Skills Index',
      description: '用途：汇总 Axi skill 入口。范围：skills/**/SKILL.md。对象：agent 可调用技能索引',
      docType: 'index',
      status: 'active',
      tags: ['技能', '索引', 'Agent'],
      categories: ['indexes', 'standards'],
      updated,
      raw: indexRaw,
      body,
      frontmatter: {
        id: 'axi-skills-index',
        title: 'Axi Skills Index',
        type: 'index',
        status: 'active',
        tags: ['技能', '索引', 'Agent'],
        modified: updated,
        'graph-title': 'Axi Skills Index',
        'graph-tags': ['技能', '索引'],
      },
      aliases: ['skill index', 'skills index'],
      sourceTags: ['skills', 'index', 'agent'],
    }))
  }
  return documents.sort((left, right) => left.title.localeCompare(right.title, 'zh-CN') || left.path.localeCompare(right.path))
}

// ---------------------------------------------------------------------------
// Local helpers (mirror utils.ts; inlined so this module stays self-contained)
// ---------------------------------------------------------------------------

function isExcludedNameLocal(name: string): boolean {
  return name.startsWith('.')
}

function isSupportedFileLocal(filename: string): boolean {
  return filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.markdown')
}