import { Frontmatter } from '../types'

export type KnowledgeCategoryKey =
  | 'indexes'
  | 'projects'
  | 'architecture'
  | 'standards'
  | 'components'
  | 'functions'
  | 'frontend'
  | 'backend'
  | 'solutions'
  | 'resources'

type KnowledgeCategoryMatchRule = {
  pathIncludes?: string[]
  pathPatterns?: RegExp[]
  titleIncludes?: string[]
  descriptionIncludes?: string[]
  textIncludes?: string[]
  tags?: string[]
  techStack?: string[]
  docTypes?: string[]
}

type KnowledgeCategoryDefinition = {
  key: KnowledgeCategoryKey
  label: string
  title: string
  description: string
  queryHints: string[]
  aliases: string[]
  rules: KnowledgeCategoryMatchRule[]
}

type KnowledgeCategoryContext = {
  path: string
  title: string
  description?: string
  docType?: string
  tags: string[]
  techStack: string[]
  frontmatter?: Frontmatter
}

export const KNOWLEDGE_CATEGORY_ORDER: KnowledgeCategoryKey[] = [
  'indexes',
  'projects',
  'architecture',
  'standards',
  'components',
  'functions',
  'frontend',
  'backend',
  'solutions',
  'resources',
]

const KNOWLEDGE_CATEGORY_DEFINITIONS: Record<KnowledgeCategoryKey, KnowledgeCategoryDefinition> = {
  indexes: {
    key: 'indexes',
    label: '索引',
    title: '分类索引',
    description: '目录页、MOC、Glossary、上下文入口，适合先理解知识库结构。',
    queryHints: ['index', '目录', '索引', 'moc', 'glossary', 'context'],
    aliases: ['indexes', 'index', '索引', '目录', 'moc', 'glossary', 'context', 'overview'],
    rules: [
      {
        pathIncludes: ['/_agent/', '/_moc/'],
        tags: ['index', 'moc', 'glossary', 'context', '目录', '索引'],
        docTypes: ['index', 'moc', 'glossary', 'overview'],
      },
      {
        pathPatterns: [/(^|\/)(index|glossary|context|rag-scope|overview)(\.md)?$/i],
      },
    ],
  },
  projects: {
    key: 'projects',
    label: '项目',
    title: '项目知识',
    description: '项目总览、里程碑和经验沉淀，适合先判断是否有既往项目经验。',
    queryHints: ['project', '项目', 'overview', '里程碑'],
    aliases: ['projects', 'project', '项目', '项目经验', 'milestone', 'overview'],
    rules: [
      {
        pathIncludes: ['/20-projects/', '/projects/'],
        tags: ['project', '项目', 'milestone', 'roadmap'],
        docTypes: ['project', 'case-study'],
        textIncludes: ['项目', '里程碑', 'project overview'],
      },
    ],
  },
  architecture: {
    key: 'architecture',
    label: '架构',
    title: '架构决策',
    description: '架构说明、ADR、技术选型和模块边界，适合快速定位设计依据。',
    queryHints: ['architecture', 'adr', '架构', '技术选型', '设计'],
    aliases: ['architecture', 'architectures', '架构', 'adr', 'design', '设计', '技术选型'],
    rules: [
      {
        pathIncludes: ['/adr/', '/architecture/'],
        tags: ['architecture', '架构', 'adr', 'design', '设计', 'tech-choice', '技术选型'],
        docTypes: ['architecture', 'adr', 'decision'],
        textIncludes: ['architecture', '架构', 'adr', '技术选型', '模块边界'],
      },
    ],
  },
  standards: {
    key: 'standards',
    label: '规范',
    title: '编码规范',
    description: '规范、约定、最佳实践、流程文档，适合 Agent 快速对齐风格与约束。',
    queryHints: ['standard', '规范', '约定', 'best practice', '编码', 'lint'],
    aliases: ['standards', 'standard', '规范', '约定', 'best-practice', 'coding-standard', 'lint'],
    rules: [
      {
        pathIncludes: ['/standards/', '/standards-and-guides/', '/conventions/'],
        tags: ['standard', '规范', '约定', 'workflow', 'best-practice', 'lint'],
        docTypes: ['standard', 'spec', 'convention', 'guideline'],
        textIncludes: ['规范', 'standard', '约定', 'best practice', '编码', 'workflow'],
      },
    ],
  },
  components: {
    key: 'components',
    label: '组件',
    title: '组件经验',
    description: '组件库、UI 模式、页面模块和交互积累，适合复用前端经验。',
    queryHints: ['component', 'ui', '组件', 'design system', 'design-system'],
    aliases: ['components', 'component', '组件', 'ui', 'design-system', 'design system', 'pattern'],
    rules: [
      {
        pathIncludes: ['/components/', '/ui/', '/patterns/'],
        tags: ['component', '组件', 'ui', 'design-system', 'page-pattern'],
        docTypes: ['component', 'ui-pattern', 'page-pattern'],
        textIncludes: ['component', '组件', 'design system', 'ui', 'page pattern'],
      },
    ],
  },
  functions: {
    key: 'functions',
    label: '函数',
    title: '函数与工具',
    description: '工具函数、hooks、helper、SDK 封装，适合快速查找可复用能力。',
    queryHints: ['function', 'util', 'utils', 'helper', 'hook', 'sdk', '函数'],
    aliases: ['functions', 'function', '函数', 'utility', 'util', 'helper', 'hook', 'sdk', 'library'],
    rules: [
      {
        pathIncludes: ['/functions/', '/utils/', '/hooks/', '/lib/', '/sdk/'],
        tags: ['function', '函数', 'util', 'utils', 'helper', 'hook', 'sdk', 'library'],
        docTypes: ['function', 'utility', 'hook', 'sdk', 'library'],
        textIncludes: ['function', '函数', 'util', 'helper', 'hook', 'sdk', 'library'],
      },
    ],
  },
  frontend: {
    key: 'frontend',
    label: '前端',
    title: '前端技术',
    description: 'React / CSS / 构建链路 / 前端架构等经验笔记。',
    queryHints: ['frontend', '前端', 'react', 'vite', 'css', 'tailwind'],
    aliases: ['frontend', '前端', 'web', 'react', 'css', 'vite', 'tailwind'],
    rules: [
      {
        pathIncludes: ['/frontend/', '/web/'],
        tags: ['frontend', '前端', 'react', 'next', 'vite', 'tailwind', 'css', 'javascript', 'typescript'],
        techStack: ['react', 'next', 'vite', 'tailwind', 'typescript', 'javascript', 'css', 'vue'],
        docTypes: ['frontend', 'ui'],
        textIncludes: ['前端', 'frontend'],
      },
    ],
  },
  backend: {
    key: 'backend',
    label: '后端',
    title: '后端技术',
    description: 'Node / API / 数据层 / 基础设施等后端实现经验。',
    queryHints: ['backend', '后端', 'api', 'node', 'express', 'nestjs', 'database', 'redis'],
    aliases: ['backend', '后端', 'server', 'api', 'database', 'infra'],
    rules: [
      {
        pathIncludes: ['/backend/', '/server/', '/api/', '/infra/'],
        tags: ['backend', '后端', 'api', 'node', 'express', 'nestjs', 'database', 'redis', 'prisma'],
        techStack: ['node', 'express', 'nestjs', 'postgres', 'postgresql', 'redis', 'mysql', 'prisma', 'java', 'go', 'python'],
        docTypes: ['backend', 'api', 'service', 'infrastructure'],
        textIncludes: ['后端', 'backend'],
      },
    ],
  },
  solutions: {
    key: 'solutions',
    label: '方案',
    title: '问题解决方案',
    description: 'FAQ、排障、踩坑、修复记录和常见问题的解决方案。',
    queryHints: ['solution', 'faq', 'bug', 'issue', 'fix', 'troubleshoot', '问题', '解决', '排障'],
    aliases: ['solutions', 'solution', 'faq', 'bugfix', 'issue', '问题', '排障', 'troubleshoot', 'fix'],
    rules: [
      {
        pathIncludes: ['/faq/', '/issues/', '/troubleshooting/', '/solutions/'],
        tags: ['solution', 'faq', 'bug', 'issue', 'fix', 'troubleshoot', '问题', '解决', '排障', '踩坑'],
        docTypes: ['solution', 'faq', 'incident', 'troubleshooting'],
        textIncludes: ['faq', 'bug', 'issue', 'fix', 'solution', '问题', '解决', '排障', '踩坑'],
      },
    ],
  },
  resources: {
    key: 'resources',
    label: '资料',
    title: '参考资源',
    description: '资料整理、读书笔记和外部资源的提炼。',
    queryHints: ['resource', 'book', 'article', '资料', '书', '文章'],
    aliases: ['resources', 'resource', '资料', 'book', 'article', 'reading', 'reference'],
    rules: [
      {
        pathIncludes: ['/40-resources/', '/resources/', '/references/'],
        tags: ['resource', '资料', 'book', 'article', 'reference', 'reading'],
        docTypes: ['resource', 'reference', 'reading-note'],
        textIncludes: ['resource', '文章', 'book', '读书', '资料'],
      },
    ],
  },
}

const CATEGORY_ALIAS_MAP = new Map<string, KnowledgeCategoryKey>()

for (const key of KNOWLEDGE_CATEGORY_ORDER) {
  const definition = KNOWLEDGE_CATEGORY_DEFINITIONS[key]
  for (const alias of [key, definition.label, ...definition.aliases]) {
    CATEGORY_ALIAS_MAP.set(alias.toLowerCase(), key)
  }
}

function normalizeStringArray(value: unknown): string[] {
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

function includesAny(haystack: string, needles?: string[]): boolean {
  return (needles || []).some((needle) => haystack.includes(needle))
}

function intersects(values: string[], needles?: string[]): boolean {
  if (!needles || needles.length === 0) return false
  return needles.some((needle) => values.includes(needle))
}

function matchesRule(context: {
  pathLower: string
  titleLower: string
  descriptionLower: string
  docTypeLower: string
  tagsLower: string[]
  techLower: string[]
  haystack: string
}, rule: KnowledgeCategoryMatchRule): boolean {
  if (includesAny(context.pathLower, rule.pathIncludes?.map(value => value.toLowerCase()))) return true
  if ((rule.pathPatterns || []).some((pattern) => pattern.test(context.pathLower))) return true
  if (includesAny(context.titleLower, rule.titleIncludes?.map(value => value.toLowerCase()))) return true
  if (includesAny(context.descriptionLower, rule.descriptionIncludes?.map(value => value.toLowerCase()))) return true
  if (includesAny(context.haystack, rule.textIncludes?.map(value => value.toLowerCase()))) return true
  if (intersects(context.tagsLower, rule.tags?.map(value => value.toLowerCase()))) return true
  if (intersects(context.techLower, rule.techStack?.map(value => value.toLowerCase()))) return true
  if (intersects([context.docTypeLower], rule.docTypes?.map(value => value.toLowerCase()))) return true
  return false
}

export function normalizeKnowledgeCategoryKey(value: string): KnowledgeCategoryKey | null {
  return CATEGORY_ALIAS_MAP.get(value.trim().toLowerCase()) || null
}

export function getKnowledgeCategoryLabel(category: string): string {
  const normalized = normalizeKnowledgeCategoryKey(category)
  if (!normalized) return category
  return KNOWLEDGE_CATEGORY_DEFINITIONS[normalized].label
}

export function getKnowledgeCategoryMeta(key: KnowledgeCategoryKey) {
  const definition = KNOWLEDGE_CATEGORY_DEFINITIONS[key]
  return {
    key: definition.key,
    title: definition.title,
    description: definition.description,
  }
}

export function getKnowledgeCategoryQueryHints(category: string): string[] {
  const normalized = normalizeKnowledgeCategoryKey(category)
  if (!normalized) return []
  return KNOWLEDGE_CATEGORY_DEFINITIONS[normalized].queryHints
}

function getExplicitCategories(frontmatter?: Frontmatter): KnowledgeCategoryKey[] {
  if (!frontmatter) return []
  const values = [
    ...normalizeStringArray(frontmatter.category),
    ...normalizeStringArray(frontmatter.categories),
    ...normalizeStringArray(frontmatter.section),
    ...normalizeStringArray(frontmatter.sections),
    ...normalizeStringArray(frontmatter.knowledgeSection),
    ...normalizeStringArray(frontmatter.knowledgeSections),
    ...normalizeStringArray(frontmatter.domain),
  ]

  const categories = values
    .map(value => normalizeKnowledgeCategoryKey(value))
    .filter(Boolean) as KnowledgeCategoryKey[]

  return [...new Set(categories)]
}

export function classifyKnowledgeCategories(document: KnowledgeCategoryContext): KnowledgeCategoryKey[] {
  const explicitCategories = getExplicitCategories(document.frontmatter)
  if (explicitCategories.length > 0) {
    return explicitCategories
  }

  const pathLower = document.path.toLowerCase()
  const titleLower = document.title.toLowerCase()
  const descriptionLower = (document.description || '').toLowerCase()
  const docTypeLower = (document.docType || '').toLowerCase()
  const tagsLower = document.tags.map((tag) => tag.toLowerCase())
  const techLower = document.techStack.map((tech) => tech.toLowerCase())
  const haystack = `${pathLower} ${titleLower} ${descriptionLower} ${tagsLower.join(' ')} ${techLower.join(' ')} ${docTypeLower}`

  const categories = KNOWLEDGE_CATEGORY_ORDER.filter((key) => {
    const definition = KNOWLEDGE_CATEGORY_DEFINITIONS[key]
    return definition.rules.some((rule) => matchesRule({
      pathLower,
      titleLower,
      descriptionLower,
      docTypeLower,
      tagsLower,
      techLower,
      haystack,
    }, rule))
  })

  return categories.length > 0 ? categories : ['resources']
}
