const MARKDOWN_EXTENSION_REGEX = /\.(md|markdown)$/i
const DATE_TITLE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/
const MAX_DESCRIPTION_LENGTH = 160
const BRANCH_LABELS = new Map([
  ['10-Concepts', '概念'],
  ['20-Projects', '项目'],
  ['30-Areas', '领域'],
  ['40-Resources', '资源'],
  ['_agent', '智能体入口'],
  ['_daily', '每日记录'],
  ['_moc', '主题地图'],
  ['software', '软件'],
  ['personal', '个人'],
  ['workflow', '工作流'],
  ['tools', '工具'],
  ['ADR', '架构决策'],
  ['axi-docs', '文档中心'],
  ['ielts-vocab', '雅思词汇'],
])
const TITLE_OVERRIDES = new Map([
  ['axi docs', 'Axi 文档站'],
  ['axi agent platform', 'Axi 智能体平台'],
  ['axi image preview', 'Axi 图片预览'],
  ['axi local registry', 'Axi 本地注册表'],
  ['axi notify mobile', 'Axi 移动通知'],
  ['axi proxy companion', 'Axi 代理助手'],
  ['axi skills', 'Axi 技能库'],
  ['axi skills index', 'Axi 技能索引'],
  ['axi tauri starter', 'Axi Tauri 启动模板'],
  ['axi ui', 'Axi 界面组件'],
  ['axi video downloader', 'Axi 视频下载器'],
  ['axi workspace index', 'Axi 工作区索引'],
  ['axi workspace', 'Axi 工作区'],
  ['workspace project catalog', '工作区项目目录'],
  ['workspace dev services', '工作区开发服务'],
  ['workspace relationship graph', '工作区关系图谱'],
  ['current context', '当前上下文'],
  ['vault index for agent', '智能体知识库索引'],
  ['deep init pro', '深度初始化专业技能'],
  ['cli anything ollama', 'Ollama CLI 自动化'],
  ['make plan', '制定计划'],
  ['openclaw make plan', 'OpenClaw 制定计划'],
])
const TOKEN_LABELS = new Map([
  ['ai', 'AI'],
  ['agent', '智能体'],
  ['agents', '智能体'],
  ['anything', 'Anything'],
  ['architecture', '架构'],
  ['active', '活跃'],
  ['browser', '浏览器'],
  ['catalog', '目录'],
  ['center', '中心'],
  ['cli', 'CLI'],
  ['code', '代码'],
  ['component', '组件'],
  ['components', '组件'],
  ['concept', '概念'],
  ['context', '上下文'],
  ['current', '当前'],
  ['daily', '每日'],
  ['deep', '深度'],
  ['design', '设计'],
  ['dev', '开发'],
  ['docs', '文档站'],
  ['document', '文档'],
  ['download', '下载'],
  ['downloader', '下载器'],
  ['flow', '流程'],
  ['frontend', '前端'],
  ['generation', '生成'],
  ['graph', '图谱'],
  ['governance', '治理'],
  ['guide', '指南'],
  ['image', '图片'],
  ['index', '索引'],
  ['init', '初始化'],
  ['knowledge', '知识'],
  ['library', '库'],
  ['local', '本地'],
  ['map', '地图'],
  ['make', '制定'],
  ['mobile', '移动端'],
  ['model', '模型'],
  ['native', 'Native'],
  ['notify', '通知'],
  ['ollama', 'Ollama'],
  ['open', 'Open'],
  ['openclaw', 'OpenClaw'],
  ['overview', '总览'],
  ['persistence', '持久化'],
  ['plan', '计划'],
  ['platform', '平台'],
  ['preview', '预览'],
  ['pro', '专业版'],
  ['project', '项目'],
  ['projects', '项目'],
  ['proxy', '代理'],
  ['qa', 'QA'],
  ['react', 'React'],
  ['registry', '注册表'],
  ['review', '审查'],
  ['sdk', 'SDK'],
  ['service', '服务'],
  ['services', '服务'],
  ['skill', '技能'],
  ['skills', '技能'],
  ['starter', '启动模板'],
  ['status', '状态'],
  ['switcher', '切换器'],
  ['system', '系统'],
  ['tauri', 'Tauri'],
  ['ui', '界面'],
  ['vercel', 'Vercel'],
  ['video', '视频'],
  ['workspace', '工作区'],
  ['relationship', '关系'],
])
const DOC_TYPE_LABELS = new Map([
  ['component', '组件文档'],
  ['concept', '概念文档'],
  ['index', '索引文档'],
  ['note', '知识笔记'],
  ['project', '项目文档'],
  ['skill', '技能文档'],
  ['troubleshooting', '排障文档'],
])

function stripMarkdownExtension(value: string): string {
  return value.replace(MARKDOWN_EXTENSION_REGEX, '').trim()
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function hasChinese(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value)
}

function formatDateTitle(value: string): string | null {
  const match = stripMarkdownExtension(value).match(DATE_TITLE_REGEX)
  if (!match) return null
  const [, year, month, day] = match
  return `${year}年${Number(month)}月${Number(day)}日`
}

function truncateText(value: string, maxLength = MAX_DESCRIPTION_LENGTH): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function titleKey(value: string): string {
  return stripMarkdownExtension(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function tokenizeTitle(value: string): string[] {
  return stripMarkdownExtension(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_/-]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function formatToken(token: string): string {
  const normalized = token.toLowerCase()
  if (TOKEN_LABELS.has(normalized)) return TOKEN_LABELS.get(normalized) || token
  if (/^axi$/i.test(token)) return 'Axi'
  if (/^[A-Z]{2,}$/.test(token)) return token
  if (/^\d+$/.test(token)) return token
  return token
}

function titleCandidateFromPath(pathValue?: string | null): string {
  const normalizedPath = normalizeText(pathValue)
  if (!normalizedPath) return ''
  const basename = normalizedPath.split('/').filter(Boolean).pop() || normalizedPath
  return stripMarkdownExtension(basename)
}

function isSkillDocumentPath(pathValue?: string | null): boolean {
  const normalizedPath = normalizeText(pathValue)
  return /(^|\/)skills(?:\.zh)?\/.+\/SKILL\.md$/i.test(normalizedPath)
}

function skillTitleCandidateFromPath(pathValue?: string | null): string {
  const normalizedPath = normalizeText(pathValue)
  if (!isSkillDocumentPath(normalizedPath)) return ''
  const segments = normalizedPath.split('/').filter(Boolean)
  let skillIndex = -1
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (segments[index].toLowerCase() === 'skill.md') {
      skillIndex = index
      break
    }
  }
  if (skillIndex <= 0) return ''
  if (segments[skillIndex - 1].toLowerCase() === 'skill' && skillIndex > 1) {
    return segments[skillIndex - 2]
  }
  if (segments[skillIndex - 2]?.toLowerCase() === 'skills' && skillIndex > 2) {
    return `${segments[skillIndex - 3]}-${segments[skillIndex - 1]}`
  }
  return segments[skillIndex - 1]
}

function isGenericSkillTitle(value: string): boolean {
  return [
    'skill',
    'skill.md',
    '中文用途摘要',
    '中文用途说明',
    '英文原始运行说明',
    '原始运行说明',
  ].includes(stripMarkdownExtension(value).trim().toLowerCase())
}

function isLatinish(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9 .:+-]*$/.test(value)
}

function joinFormattedTitleTokens(tokens: string[]): string {
  return tokens.reduce((title, token) => {
    if (!title) return token
    const previous = title.split(/\s+/).pop() || title
    return isLatinish(previous) || isLatinish(token) ? `${title} ${token}` : `${title}${token}`
  }, '')
}

function formatSkillTitleCandidate(value: string): string {
  const normalized = stripMarkdownExtension(value)
  if (!normalized) return ''
  if (hasChinese(normalized) && !isGenericSkillTitle(normalized)) return normalized
  const override = TITLE_OVERRIDES.get(titleKey(normalized))
  if (override) return override
  const tokens = tokenizeTitle(normalized).map(formatToken)
  return (joinFormattedTitleTokens(tokens) || normalized).replace(/技能$/u, '指南')
}

function formatChineseTitleCandidate(value: string): string {
  const normalized = stripMarkdownExtension(value)
  if (!normalized) return ''

  const datedTitle = formatDateTitle(normalized)
  if (datedTitle) return datedTitle

  const override = TITLE_OVERRIDES.get(titleKey(normalized))
  if (override) return override

  if (hasChinese(normalized)) return normalized

  const tokens = tokenizeTitle(normalized)
  const formatted = tokens.map(formatToken)
  if (formatted.some((token) => hasChinese(token))) return formatted.join('')

  return `${normalized} 文档`
}

export function formatKnowledgeDocumentTitle(
  titleOrName: string,
  path?: string | null,
  graphTitle?: string | null,
): string {
  const skillPathTitle = skillTitleCandidateFromPath(path)
  const formatCandidate = (candidate: string): string => {
    if (skillPathTitle && (!candidate || isGenericSkillTitle(candidate) || !hasChinese(candidate))) {
      return formatSkillTitleCandidate(skillPathTitle)
    }
    return formatChineseTitleCandidate(candidate)
  }

  const explicitGraphTitle = normalizeText(graphTitle)
  if (explicitGraphTitle) {
    return formatCandidate(explicitGraphTitle)
  }

  const normalizedTitle = normalizeText(titleOrName)
  if (normalizedTitle) {
    return formatCandidate(normalizedTitle)
  }

  if (skillPathTitle) {
    return formatSkillTitleCandidate(skillPathTitle)
  }

  const pathTitle = titleCandidateFromPath(path)
  if (pathTitle) return formatChineseTitleCandidate(pathTitle)

  return ''
}

export function formatKnowledgeDocumentDescription(item: {
  title?: string | null
  name?: string | null
  path?: string | null
  rawTitle?: string | null
  description?: string | null
  docType?: string | null
  sourceId?: string | null
}): string {
  const description = normalizeText(item.description)
  if (description && hasChinese(description)) return truncateText(description)

  const title = formatKnowledgeDocumentTitle(
    item.title || item.rawTitle || item.name || '',
    item.path,
    item.title || undefined,
  ) || formatKnowledgeDocumentTitle(item.rawTitle || item.name || '', item.path)
  const docType = normalizeText(item.docType)
  const docTypeLabel = DOC_TYPE_LABELS.get(docType.toLowerCase()) || '知识文档'
  const sourceLabel = item.sourceId === 'workspace'
    ? '工作区'
    : item.sourceId === 'axi-skills'
      ? '技能库'
      : '知识库'
  if (description) {
    return truncateText(`${sourceLabel}${docTypeLabel}摘要：${description}`)
  }

  return truncateText([
    `${sourceLabel}中的${docTypeLabel}，用于说明「${title || '未命名文档'}」的背景、用途与关联上下文。`,
  ].filter(Boolean).join(' '))
}

export function formatKnowledgeItemTitle(item: {
  title?: string | null
  name?: string | null
  path?: string | null
  graphTitle?: string | null
}): string {
  return formatKnowledgeDocumentTitle(item.title || item.name || '', item.path, item.graphTitle)
}

export function formatKnowledgeTagLabel(tag: string): string {
  const normalized = normalizeText(tag).replace(/^#/, '')
  if (!normalized) return ''
  if (hasChinese(normalized)) return normalized

  const override = TITLE_OVERRIDES.get(titleKey(normalized))
  if (override) return override

  const tokens = tokenizeTitle(normalized).map(formatToken)
  return tokens.some((token) => hasChinese(token))
    ? joinFormattedTitleTokens(tokens)
    : normalized
}

export function formatKnowledgeBranchLabel(segment: string): string {
  const normalized = stripMarkdownExtension(segment)
  if (/^\d{4}$/.test(normalized)) return `${normalized}年`
  if (BRANCH_LABELS.has(normalized)) return BRANCH_LABELS.get(normalized) || normalized
  return normalized
}

export function formatKnowledgeBranchPath(pathValue: string): string {
  return pathValue
    .split('/')
    .filter(Boolean)
    .map((segment) => formatKnowledgeBranchLabel(segment))
    .join(' / ')
}

export function formatKnowledgeNodeLabel(node: {
  id?: string
  label: string
  kind?: 'current' | 'note' | 'tag' | 'branch'
  path?: string
  graphTitle?: string
}): string {
  if (node.kind === 'tag') {
    return formatKnowledgeTagLabel(node.label || node.id || '')
  }

  if (node.kind === 'branch') {
    return formatKnowledgeBranchLabel(node.label || node.path || node.id || '')
  }

  return formatKnowledgeDocumentTitle(node.label || node.id || '', node.path || node.id || '', node.graphTitle)
}

export function isChineseKnowledgeLabel(value: string): boolean {
  return hasChinese(value)
}
