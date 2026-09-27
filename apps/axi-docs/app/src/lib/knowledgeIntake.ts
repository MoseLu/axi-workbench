import type { Frontmatter } from '../types'

const CHINESE_REGEX = /[\u4e00-\u9fff]/
const ENGLISH_REGEX = /[A-Za-z]/
const REQUIRED_FRONTMATTER_FIELDS = ['id', 'title', 'type', 'status', 'tags', 'created', 'modified'] as const

export interface KnowledgeIntakeIssue {
  code:
    | 'missing-frontmatter'
    | 'missing-fields'
    | 'missing-graph-title'
    | 'missing-graph-tags'
    | 'non-chinese-graph-title'
    | 'non-chinese-graph-tags'
  message: string
}

export interface KnowledgeIntakeResult {
  accepted: boolean
  graphTitle: string | null
  graphTags: string[]
  issues: KnowledgeIntakeIssue[]
}

export interface KnowledgeIntakeOptions {
  /**
   * When `true`, missing `frontmatter` and required-fields issues are
   * downgraded to warnings instead of blocking acceptance. Used for
   * read-only source repos (e.g. `axi-rules`) whose canonical documents
   * predate the Axi Docs frontmatter contract and cannot be edited.
   */
  allowUnannotated?: boolean
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    if (value.startsWith('[') && value.endsWith(']')) {
      return value
        .slice(1, -1)
        .split(',')
        .map((entry) => entry.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    }

    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  return ''
}

function hasChinese(value: string): boolean {
  return CHINESE_REGEX.test(value)
}

function hasEnglish(value: string): boolean {
  return ENGLISH_REGEX.test(value)
}

function resolveGraphTitle(frontmatter: Frontmatter): string {
  return normalizeText(frontmatter['graph-title'])
    || normalizeText(frontmatter.graphTitle)
    || normalizeText(frontmatter.title)
}

function resolveGraphTags(frontmatter: Frontmatter): string[] {
  const explicitGraphTags = [
    ...normalizeStringArray(frontmatter['graph-tags']),
    ...normalizeStringArray(frontmatter.graphTags),
  ]

  return [...new Set(explicitGraphTags)]
}

function resolveSourceTags(frontmatter: Frontmatter): string[] {
  return [...new Set(normalizeStringArray(frontmatter.tags))]
}

export function runKnowledgeIntake(frontmatter: Frontmatter, options: KnowledgeIntakeOptions = {}): KnowledgeIntakeResult {
  const issues: KnowledgeIntakeIssue[] = []
  const hasAnyFrontmatter = Object.keys(frontmatter).length > 0

  if (!hasAnyFrontmatter) {
    issues.push({
      code: 'missing-frontmatter',
      message: '缺少 frontmatter，无法为前端提供稳定元数据。',
    })
  }

  const missingFields = REQUIRED_FRONTMATTER_FIELDS.filter((field) => {
    const value = frontmatter[field]
    if (field === 'tags') return normalizeStringArray(value).length === 0
    return normalizeText(value).length === 0
  })

  if (missingFields.length > 0) {
    issues.push({
      code: 'missing-fields',
      message: `缺少必填元数据: ${missingFields.join(', ')}`,
    })
  }

  const graphTitle = resolveGraphTitle(frontmatter)
  const hasExplicitGraphTitle = Boolean(
    normalizeText(frontmatter['graph-title']) || normalizeText(frontmatter.graphTitle),
  )
  if (!graphTitle) {
    issues.push({
      code: 'missing-graph-title',
      message: '缺少图谱显示标题，前端无法拿到中文节点名。',
    })
  } else if (!hasExplicitGraphTitle) {
    issues.push({
      code: 'missing-graph-title',
      message: '缺少显式 graph-title，已回退到 title 作为图谱节点名。',
    })
  }
  if (graphTitle && (!hasChinese(graphTitle) || hasEnglish(graphTitle))) {
    issues.push({
      code: 'non-chinese-graph-title',
      message: '图谱显示标题不是纯中文，将由前端格式化层兜底显示。',
    })
  }

  const explicitGraphTags = resolveGraphTags({
    ...frontmatter,
    tags: [],
  })
  const sourceTags = resolveSourceTags(frontmatter)
  const graphTags = explicitGraphTags.length > 0 ? explicitGraphTags : sourceTags
  if (graphTags.length === 0) {
    issues.push({
      code: 'missing-graph-tags',
      message: '缺少图谱显示标签，前端无法稳定拿到中文标签节点。',
    })
  } else if (explicitGraphTags.length === 0) {
    issues.push({
      code: 'missing-graph-tags',
      message: '缺少显式 graph-tags，已回退到 tags 作为图谱标签。',
    })
  }
  if (graphTags.some((tag) => !hasChinese(tag) || hasEnglish(tag))) {
    issues.push({
      code: 'non-chinese-graph-tags',
      message: '图谱显示标签不是纯中文，将由前端格式化层兜底显示。',
    })
  }

  const hasBlockingIssues = issues.some((issue) => (
    issue.code === 'missing-frontmatter'
    || issue.code === 'missing-fields'
    || (issue.code === 'missing-graph-title' && !graphTitle)
    || (issue.code === 'missing-graph-tags' && graphTags.length === 0)
  )) && !options.allowUnannotated

  return {
    accepted: !hasBlockingIssues,
    graphTitle: graphTitle || null,
    graphTags,
    issues,
  }
}
