/**
 * Pure helpers + constants + git cache used across the knowledgeBase split.
 * No business state, no I/O orchestration; only side effects limited to the
 * module-level git caches that existed in the original knowledgeBase.ts.
 */

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import matter from 'gray-matter'
import { normalizeStringArray } from '../knowledgeIntake'
import type { DocSource, Frontmatter } from '../../types'
import type {
  HandoffProject,
  ParsedDocument,
  SkillFamilyDefinition,
  SkillSubsectionDefinition,
  WorkspaceDocumentTypeDefinition,
  WorkspaceProjectInfo,
} from './types'
import { AXI_SKILL_FAMILIES, AXI_SKILL_SUBSECTIONS, DB_SKILL_FAMILIES } from './skills'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SUPPORTED_EXTENSIONS = new Set(['.md', '.markdown'])
export const EXCLUDED_NAMES = new Set(['.git', 'node_modules', '.obsidian', '.trash', '.DS_Store'])
export const DEFAULT_BLINKO_URL = 'http://localhost:1111'
export const INLINE_TAG_REGEX = /(^|\s)#([\p{L}\p{N}_/-]+)/gu
export const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g

export const SKILL_SUBSECTION_THRESHOLD = 10
export const HANDOFF_STALE_DAYS = 14

// ---------------------------------------------------------------------------
// Git metadata cache (module-level; preserves original behavior)
// ---------------------------------------------------------------------------

export const gitRootCache = new Map<string, string | null>()
export const gitUpdatedCache = new Map<string, string | null>()
export const gitPrefilledRoots = new Set<string>()

export function getGitRoot(fullPath: string): string | null {
  const startDir = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()
    ? fullPath
    : path.dirname(fullPath)
  if (gitRootCache.has(startDir)) return gitRootCache.get(startDir) || null

  let probeDir = startDir
  let hasGitMetadata = false
  while (probeDir && probeDir !== path.dirname(probeDir)) {
    if (fs.existsSync(path.join(probeDir, '.git'))) {
      hasGitMetadata = true
      break
    }
    probeDir = path.dirname(probeDir)
  }
  if (!hasGitMetadata) {
    gitRootCache.set(startDir, null)
    return null
  }

  // Key the cache by the directory that owns .git so every file under the
  // same repository reuses one lookup instead of spawning per directory.
  let root: string | null = null
  if (gitRootCache.has(probeDir)) {
    root = gitRootCache.get(probeDir) || null
  } else {
    try {
      root = execFileSync('git', ['-C', probeDir, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || null
    } catch {
      root = null
    }
    gitRootCache.set(probeDir, root)
  }
  gitRootCache.set(startDir, root)
  return root
}

/**
 * Load "last updated" dates for a whole git repository in ONE `git log` pass.
 * Triggered lazily on the first cache miss for a repository, so per-file
 * getGitLastUpdated lookups become cache hits afterwards. Untracked files are
 * marked null in bulk (`git ls-files --others`) because they can never appear
 * in history.
 */
export function prefillGitUpdatedCacheForRoot(root: string): void {
  if (gitPrefilledRoots.has(root)) return
  gitPrefilledRoots.add(root)

  const toAbsolute = new Map<string, string>()
  const registerRelative = (relativePath: string): string | null => {
    const normalizedRelative = normalizeSlashes(relativePath)
    if (!normalizedRelative || normalizedRelative.startsWith('..')) return null
    let absolute = toAbsolute.get(normalizedRelative)
    if (!absolute) {
      absolute = path.normalize(path.join(root, normalizedRelative))
      toAbsolute.set(normalizedRelative, absolute)
    }
    return absolute
  }

  try {
    const logOutput = execFileSync(
      'git',
      ['-C', root, 'log', '--format=%x01%cI', '--name-only'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 },
    )
    let currentDate: string | null = null
    for (const line of logOutput.split('\n')) {
      if (line.startsWith('\u0001')) {
        currentDate = line.slice(1).trim() || null
        continue
      }
      const trimmed = line.trim()
      if (!currentDate || !trimmed) continue
      const absolute = registerRelative(trimmed)
      if (absolute && !gitUpdatedCache.has(absolute)) {
        gitUpdatedCache.set(absolute, currentDate)
      }
    }
  } catch {
    return
  }

  try {
    const untrackedOutput = execFileSync(
      'git',
      ['-C', root, 'ls-files', '--others', '--exclude-standard'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
    )
    for (const line of untrackedOutput.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const absolute = registerRelative(trimmed)
      if (absolute && !gitUpdatedCache.has(absolute)) {
        gitUpdatedCache.set(absolute, null)
      }
    }
  } catch {
    /* files absent from both passes fall back to frontmatter/mtime */
  }
}

export function getGitLastUpdated(fullPath: string): string | null {
  const normalizedPath = path.normalize(fullPath)
  if (gitUpdatedCache.has(normalizedPath)) return gitUpdatedCache.get(normalizedPath) || null

  const root = getGitRoot(normalizedPath)
  if (!root) {
    gitUpdatedCache.set(normalizedPath, null)
    return null
  }

  const relativePath = normalizeSlashes(path.relative(root, normalizedPath))
  for (const pathspec of [relativePath, normalizedPath]) {
    try {
      const updated = execFileSync('git', ['-C', root, 'log', '-1', '--format=%cI', '--', pathspec], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
      if (updated) {
        gitUpdatedCache.set(normalizedPath, updated)
        return updated
      }
    } catch {
      // Try the next pathspec form before falling back to frontmatter/mtime.
    }
  }

  gitUpdatedCache.set(normalizedPath, null)
  return null
}

export function resolveLastUpdated(fullPath: string, stat: fs.Stats, frontmatter?: Frontmatter): string {
  const normalizedPath = path.normalize(fullPath)
  if (!gitUpdatedCache.has(normalizedPath)) {
    const root = getGitRoot(fullPath)
    if (root) {
      prefillGitUpdatedCacheForRoot(root)
    } else {
      gitUpdatedCache.set(normalizedPath, null)
    }
  }
  return getGitLastUpdated(fullPath)
    || normalizeDate(frontmatter?.modified)
    || normalizeDate(frontmatter?.updated)
    || stat.mtime.toISOString()
}

// ---------------------------------------------------------------------------
// File / path helpers
// ---------------------------------------------------------------------------

export function isSupportedFile(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

export function isExcludedName(name: string): boolean {
  return EXCLUDED_NAMES.has(name) || name.startsWith('.')
}

export function normalizeSlashes(inputPath: string): string {
  return inputPath.replace(/\\/g, '/')
}

export function normalizeMarkdownInput(raw: string): string {
  return raw.replace(/\r\n?/g, '\n')
}

export function normalizeDate(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return undefined
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

export function parseLooseFrontmatter(raw: string): { data: Frontmatter; content: string } {
  const normalized = normalizeMarkdownInput(raw)

  if (!normalized.startsWith('---')) {
    return { data: {}, content: normalized }
  }

  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!frontmatterMatch) {
    return { data: {}, content: normalized }
  }

  const yaml = frontmatterMatch[1]
  const content = normalized.slice(frontmatterMatch[0].length).trimStart()
  const data: Frontmatter = {}

  for (const line of yaml.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.slice(0, colonIndex).trim()
    const value = trimmed.slice(colonIndex + 1).trim()

    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((entry) => entry.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
      continue
    }

    data[key] = value.replace(/^["']|["']$/g, '')
  }

  return { data, content }
}

export function parseMarkdownDocument(raw: string): { data: Frontmatter; content: string } {
  const normalized = normalizeMarkdownInput(raw)

  try {
    const parsed = matter(normalized)
    if (normalized.startsWith('---') && Object.keys(parsed.data || {}).length === 0) {
      const looseParsed = parseLooseFrontmatter(normalized)
      if (Object.keys(looseParsed.data).length > 0) return looseParsed
    }
    return parsed
  } catch {
    return parseLooseFrontmatter(normalized)
  }
}

// ---------------------------------------------------------------------------
// Body / frontmatter extractors
// ---------------------------------------------------------------------------

export function extractInlineTags(markdown: string): string[] {
  const normalized = normalizeMarkdownInput(markdown)
  const body = normalized.startsWith('---')
    ? normalized.replace(/^---\n[\s\S]*?\n---\n?/, '')
    : normalized
  const tags = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = INLINE_TAG_REGEX.exec(body)) !== null) {
    const tag = match[2].trim().toLowerCase()
    if (tag && !tag.endsWith('.md')) {
      tags.add(tag)
    }
  }

  return [...tags]
}

export function extractRawTitle(frontmatter: Frontmatter, body: string, fallbackName: string): string {
  if (typeof frontmatter.title === 'string' && frontmatter.title.trim()) {
    return frontmatter.title.trim()
  }
  const firstAlias = normalizeStringArray(frontmatter.aliases)[0]
  if (firstAlias) return firstAlias
  const headingMatch = body.match(/^#\s+(.+)$/m)
  if (headingMatch?.[1]) {
    return headingMatch[1].trim().replace(/\*\*|__|\*|_|`/g, '')
  }
  return fallbackName
}

export function extractDescription(frontmatter: Frontmatter, body: string): string | undefined {
  if (typeof frontmatter.description === 'string' && frontmatter.description.trim()) {
    return truncateText(frontmatter.description.trim())
  }
  const withoutTables = body
    .replace(/^\s*\|.*$/gm, ' ')
  // Leading metadata blocks ("> 文档编号：PRD-06 …" callouts and key-value
  // headers, before or after the title heading) are document control info,
  // not prose — scan past headings, blanks, and key-value lines until real
  // prose starts, then describe from there.
  const bodyLines = withoutTables.split('\n')
  let startIndex = 0
  while (startIndex < bodyLines.length && startIndex < 40) {
    const rawLine = bodyLines[startIndex]?.trim() || ''
    if (!rawLine) {
      startIndex += 1
      continue
    }
    if (/^#{1,6}\s/u.test(rawLine)) {
      startIndex += 1
      continue
    }
    const unquoted = rawLine.replace(/^>\s*/u, '')
    if (/^[\w\u4e00-\u9fff][\w\u4e00-\u9fff _()/－-]{0,24}[：:]\s*\S/u.test(unquoted)) {
      startIndex += 1
      continue
    }
    break
  }
  const plain = bodyLines
    .slice(startIndex)
    .join('\n')
    .replace(/^#.+$/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '$2$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return undefined
  return truncateText(plain, 140)
}

export function truncateText(value: string | undefined, maxLength = 480): string | undefined {
  if (!value) return undefined
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

export function extractTechStack(frontmatter: Frontmatter, tags: string[]): string[] {
  const techValues = [
    ...normalizeStringArray(frontmatter.tech),
    ...normalizeStringArray(frontmatter['tech-stack']),
  ]
  return [...new Set([...techValues, ...tags.filter((tag) => /^(react|vue|next|node|express|nestjs|postgresql|postgres|mysql|redis|vite|tailwind|typescript|javascript|go|java|python|prisma)$/i.test(tag))])]
}

// ---------------------------------------------------------------------------
// Markdown table helpers (used by workspace index parsing)
// ---------------------------------------------------------------------------

export function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim().replace(/^`|`$/g, '').replace(/\\\|/g, '|'))
}

export function stripMarkdownLinks(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

export const WORKSPACE_PURPOSE_OVERRIDES = new Map<string, string>([
  ['Axi Docs', 'Axi 文档中心，用于浏览多源文档、查看知识图谱、同步文档并通过 MCP 提供文档访问。'],
  ['Axi Image Preview', 'Axi 图片与壁纸预览应用，用于视觉参考、悬停详情和图库交互实验。'],
  ['Axi Local Registry', '本地 Verdaccio 注册表，用于发布和安装 @axi/* 运行时包。'],
  ['Axi Notify / Mobile', 'Axi 通知与移动端工作区，用于 relay、Android 客户端、事件收件箱和移动工作台。'],
  ['Axi Proxy Companion', 'macOS 代理伴侣工具，用于控制和检查本地代理后端。'],
  ['Axi Skills', 'Axi 智能体共享技能树，用于沉淀可版本化、可复用的智能体技能入口。'],
  ['Axi Tauri Starter', 'Tauri 2 桌面壳模板，用于复用桌面 shell 形态和缓存启动流程。'],
  ['Axi UI', 'Axi 共享 UI 包，用于品牌 token、核心组件、仪表盘壳、设置页和插件运行时。'],
  ['Axi Video Downloader', '本地视频下载工具，用于视频抓取、任务管理和下载链路验证。'],
  ['Axi Workspace Governance', 'Axi 工作区治理索引，用于项目目录、拓扑、所有权和 ADR 入口管理。'],
  ['Axi Agent Platform', 'Axi agent 平台工作区，用于 agent 运行、任务编排和平台能力沉淀。'],
  ['Workspace DevServices', '工作区本地服务清单，用于 PM2 服务配置、仪表盘路由、飞书告警和 NATAPP 入口。'],
  ['Workspace Relationship Graph', '工作区项目关系图，用于记录 provider、consumer、contract 和 shared-resource 关系。'],
])

export const WORKSPACE_TITLE_OVERRIDES = new Map<string, string>([
  ['Axi Skills', 'Axi 技能库'],
])

export function resolveWorkspacePurpose(cleanName: string, fallbackPurpose: string, fallbackNotes: string): string {
  return WORKSPACE_PURPOSE_OVERRIDES.get(cleanName) || fallbackPurpose || fallbackNotes
}

export function resolveWorkspaceTitle(cleanName: string): string {
  return WORKSPACE_TITLE_OVERRIDES.get(cleanName) || cleanName
}

export function joinChineseFacts(facts: Array<[string, string | undefined]>): string {
  return facts
    .map(([label, value]) => {
      const cleaned = stripMarkdownLinks(value || '').replace(/[。.!！?？]+$/u, '')
      return cleaned ? `${label}：${cleaned}` : ''
    })
    .filter(Boolean)
    .join('。')
}

export const WORKSPACE_DOCUMENT_TYPE_DEFINITIONS: WorkspaceDocumentTypeDefinition[] = [
  {
    key: 'overview',
    fileNames: ['README.md'],
    title: '项目入口',
    description: '各项目的 README 入口、范围说明和快速验证起点。',
    itemTitleSuffix: '',
    docType: 'project',
    categories: ['projects'],
    graphTags: ['项目', '入口'],
    sourceTags: ['overview', 'readme', 'project', 'workspace'],
  },
  {
    key: 'requirements',
    fileNames: ['PRD.md'],
    title: '需求文档',
    description: '项目需求、用户、非目标和验收标准。',
    itemTitleSuffix: '需求文档',
    docType: 'prd',
    categories: ['standards'],
    graphTags: ['PRD', '需求'],
    sourceTags: ['prd', 'requirements', 'project', 'workspace'],
  },
  {
    key: 'technical-design',
    fileNames: ['TDD.md'],
    title: '技术设计',
    description: '技术设计、架构假设、验证命令和风险用例。',
    itemTitleSuffix: '技术设计',
    docType: 'tdd',
    categories: ['architecture'],
    graphTags: ['TDD', '架构'],
    sourceTags: ['tdd', 'technical-design', 'architecture', 'project', 'workspace'],
  },
  {
    key: 'agent-guides',
    fileNames: ['AGENTS.md'],
    title: '智能体指南',
    description: '项目级智能体规则、边界和安全约束。',
    itemTitleSuffix: '智能体指南',
    docType: 'agent-guide',
    categories: ['standards'],
    graphTags: ['Agent', '规范'],
    sourceTags: ['agents', 'agent-guide', 'standards', 'project', 'workspace'],
  },
  {
    key: 'todos',
    fileNames: ['TODO.md'],
    title: '任务清单',
    description: '项目待办、优先级和需求到任务的映射。',
    itemTitleSuffix: '任务清单',
    docType: 'todo',
    categories: ['projects'],
    graphTags: ['TODO', '任务'],
    sourceTags: ['todo', 'tasks', 'project', 'workspace'],
  },
  {
    key: 'milestone',
    fileNames: ['MILESTONE.md'],
    title: '里程碑',
    description: '项目阶段、交付证据和退出标准。',
    itemTitleSuffix: '里程碑',
    docType: 'milestone',
    categories: ['projects'],
    graphTags: ['里程碑', '项目'],
    sourceTags: ['milestone', 'roadmap', 'project', 'workspace'],
  },
  {
    key: 'changelog',
    fileNames: ['CHANGELOG.md'],
    title: '变更记录',
    description: '项目可见变更、发布历史和结构调整记录。',
    itemTitleSuffix: '变更记录',
    docType: 'changelog',
    categories: ['projects'],
    graphTags: ['变更记录', '发布'],
    sourceTags: ['changelog', 'release-notes', 'project', 'workspace'],
  },
  {
    key: 'indexes',
    fileNames: ['INDEX.md'],
    title: '文档索引',
    description: '项目文档地图、阅读顺序和权威来源。',
    itemTitleSuffix: '文档索引',
    docType: 'index',
    categories: ['indexes'],
    graphTags: ['索引', '目录'],
    sourceTags: ['index', 'catalog', 'project', 'workspace'],
  },
  {
    key: 'security',
    fileNames: ['SECURITY.md'],
    title: '安全策略',
    description: '项目安全边界、凭证处理和漏洞响应规则。',
    itemTitleSuffix: '安全策略',
    docType: 'security',
    categories: ['standards'],
    graphTags: ['安全', '策略'],
    sourceTags: ['security', 'policy', 'project', 'workspace'],
  },
]

export const WORKSPACE_DOCUMENT_TYPE_ORDER = WORKSPACE_DOCUMENT_TYPE_DEFINITIONS.map((definition) => definition.key)

export function formatWorkspaceValue(value: string, fallback = '未标注'): string {
  return value.trim() || fallback
}

export function formatWorkspaceCommand(value: string): string {
  return value.trim() ? `\`${value.trim()}\`` : '未标注'
}

// ---------------------------------------------------------------------------
// Skill keying helpers
// ---------------------------------------------------------------------------

export function normalizeSkillToken(value: string): string {
  return value.trim().toLowerCase()
}

export function tokenizeSkillKey(value: string): string[] {
  return normalizeSkillToken(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean)
}

export function getSkillKey(document: Pick<ParsedDocument, 'name' | 'path' | 'aliases'>): string {
  return normalizeSkillToken(document.name || document.aliases[0] || path.basename(path.dirname(document.path)))
}

export function getSkillFamilyDefinitions(source: DocSource): SkillFamilyDefinition[] {
  // The taxonomy data (DB_SKILL_FAMILIES / AXI_SKILL_FAMILIES) lives in
  // skills.ts to keep this file free of large static data. ES module
  // late-binding handles the cycle: utils.ts is imported by skills.ts for
  // pure helpers, and skills.ts is imported here for the family arrays.
  // The arrays are populated before this function is ever called.
  return source.organizationHint === 'dbskill' ? DB_SKILL_FAMILIES : AXI_SKILL_FAMILIES
}

export function getSkillSubsectionDefinitions(sectionKey: string): SkillSubsectionDefinition[] {
  return AXI_SKILL_SUBSECTIONS[sectionKey] || []
}

// ---------------------------------------------------------------------------
// Handoff mapping helpers
// ---------------------------------------------------------------------------

/**
 * Zero-context handoff governance: prefer the governance-published snapshot
 * over the human-authored `WORKSPACE_INDEX.md` table. Returns an empty list
 * with `source: 'none'` when the snapshot is unavailable; the caller is then
 * expected to fall back to the markdown path.
 */
export function getHandoffSnapshotPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.workspace', 'project-handoff.json')
}

export function normalizeReadiness(value: unknown): 'verified' | 'documented' | 'stale' | 'unready' | 'unknown' {
  if (typeof value !== 'string') return 'unknown'
  const v = value.trim().toLowerCase()
  if (v === 'verified' || v === 'documented' || v === 'stale' || v === 'unready') {
    return v
  }
  return 'unknown'
}

export function computeAgeDays(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return Math.max(0, (now.getTime() - parsed) / (1000 * 60 * 60 * 24))
}

export function mapHandoffProjectToWorkspaceInfo(
  raw: HandoffProject,
  generatedAt: string | null,
): WorkspaceProjectInfo | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.id !== 'string' || !raw.id) return null
  if (typeof raw.name !== 'string' || !raw.name) return null
  if (typeof raw.path !== 'string' || !raw.path) return null
  if (typeof raw.summary !== 'string') return null
  if (!raw.commands || !Array.isArray(raw.commands.verify)) return null
  const status = typeof raw.readiness === 'string' ? raw.readiness : 'unready'
  const verification = raw.commands.verify.join('; ')
  const updated = raw.lastVerifiedAt || generatedAt || new Date().toISOString()
  const purpose = resolveWorkspacePurpose(raw.name, raw.summary, raw.notes || '')
  const docs = raw.manifestPath || raw.handoffPath || ''
  const description = joinChineseFacts([
    ['用途', purpose],
    ['状态', status],
    ['类型', raw.kind || ''],
    ['生命周期', raw.lifecycle || ''],
    ['验证', verification],
    ['文档', docs],
  ])
  return {
    id: raw.id,
    name: resolveWorkspaceTitle(raw.name),
    projectPath: raw.path,
    purpose,
    stack: '',
    status,
    docs,
    verification,
    notes: raw.notes || '',
    description,
    updated,
  }
}