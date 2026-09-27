import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import matter from 'gray-matter'
import {
  getDocumentSourceRegistry,
  validateDocumentSourceRegistry,
} from '../config/documentSources'
import {
  classifyKnowledgeCategories,
  getKnowledgeCategoryMeta,
  getKnowledgeCategoryQueryHints,
  KNOWLEDGE_CATEGORY_ORDER,
} from '../config/knowledgeRules'
import { normalizeStringArray, runKnowledgeIntake } from './knowledgeIntake'
import {
  formatKnowledgeDocumentDescription,
  formatKnowledgeDocumentTitle,
} from './knowledgeFormatter'
import {
  DocSource,
  FileItem,
  Frontmatter,
  GraphData,
  KnowledgeCatalog,
  KnowledgeCatalogItem,
  NormalizedDocument,
  SearchResult,
  StaticKnowledgeDocument,
} from '../types'

const SUPPORTED_EXTENSIONS = new Set(['.md', '.markdown'])
const EXCLUDED_NAMES = new Set(['.git', 'node_modules', '.obsidian', '.trash', '.DS_Store'])
const DEFAULT_BLINKO_URL = 'http://localhost:1111'
const INLINE_TAG_REGEX = /(^|\s)#([\p{L}\p{N}_/-]+)/gu
const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g

type SourceMap = Map<string, DocSource>

type ParsedDocument = KnowledgeCatalogItem & {
  raw: string
  body: string
  frontmatter: Frontmatter
  aliases: string[]
  sourceTags: string[]
  intakeIssues: string[]
}

type WorkspaceDocumentTypeDefinition = {
  key: string
  fileNames: string[]
  title: string
  description: string
  itemTitleSuffix: string
  docType: string
  categories: string[]
  graphTags: string[]
  sourceTags: string[]
}

type IndexedLocalFile = {
  relativePath: string
  fullPath: string
  mtimeMs: number
  document: ParsedDocument
}

type LocalSourceIndex = {
  sourceId: string
  rootPath: string
  builtAt: string
  files: Map<string, IndexedLocalFile>
  documents: ParsedDocument[]
  rejected: Array<{ path: string; issues: string[] }>
  tags: Array<{ name: string; count: number }>
  byPath: Map<string, ParsedDocument>
  byStem: Map<string, ParsedDocument>
}

type LocalFileEntry = {
  relativePath: string
  fullPath: string
  stat: fs.Stats
}

const localSourceIndexCache = new Map<string, LocalSourceIndex>()
const gitRootCache = new Map<string, string | null>()
const gitUpdatedCache = new Map<string, string | null>()

function getGitRoot(fullPath: string): string | null {
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

  try {
    const root = execFileSync('git', ['-C', startDir, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    gitRootCache.set(startDir, root || null)
    return root || null
  } catch {
    gitRootCache.set(startDir, null)
    return null
  }
}

function getGitLastUpdated(fullPath: string): string | null {
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

function resolveLastUpdated(fullPath: string, stat: fs.Stats, frontmatter?: Frontmatter): string {
  return getGitLastUpdated(fullPath)
    || normalizeDate(frontmatter?.modified)
    || normalizeDate(frontmatter?.updated)
    || stat.mtime.toISOString()
}

function parseExtraSources(): DocSource[] {
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

function isSupportedFile(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filename).toLowerCase())
}

function isExcludedName(name: string): boolean {
  return EXCLUDED_NAMES.has(name) || name.startsWith('.')
}

function normalizeSlashes(inputPath: string): string {
  return inputPath.replace(/\\/g, '/')
}

function normalizeMarkdownInput(raw: string): string {
  return raw.replace(/\r\n?/g, '\n')
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return undefined
}

function parseLooseFrontmatter(raw: string): { data: Frontmatter; content: string } {
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

function parseMarkdownDocument(raw: string): { data: Frontmatter; content: string } {
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

function extractInlineTags(markdown: string): string[] {
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

function extractRawTitle(frontmatter: Frontmatter, body: string, fallbackName: string): string {
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

function extractDescription(frontmatter: Frontmatter, body: string): string | undefined {
  if (typeof frontmatter.description === 'string' && frontmatter.description.trim()) {
    return truncateText(frontmatter.description.trim())
  }
  const plain = body
    .replace(/^#.+$/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, '$2$1')
    .replace(/[#>*`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return undefined
  return truncateText(plain, 140)
}

function truncateText(value: string | undefined, maxLength = 480): string | undefined {
  if (!value) return undefined
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function extractTechStack(frontmatter: Frontmatter, tags: string[]): string[] {
  const techValues = [
    ...normalizeStringArray(frontmatter.tech),
    ...normalizeStringArray(frontmatter['tech-stack']),
  ]
  return [...new Set([...techValues, ...tags.filter((tag) => /^(react|vue|next|node|express|nestjs|postgresql|postgres|mysql|redis|vite|tailwind|typescript|javascript|go|java|python|prisma)$/i.test(tag))])]
}

function createSourceMap(): SourceMap {
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

function getSource(sourceId: string): DocSource | null {
  return createSourceMap().get(sourceId) ?? null
}

function resolveLocalPath(source: DocSource, relativePath = ''): string | null {
  if (source.type !== 'local') return null
  if (relativePath.includes('..')) return null
  const sourceRoot = path.normalize(source.path)
  const fullPath = path.normalize(path.join(sourceRoot, relativePath))
  const rel = path.relative(sourceRoot, fullPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return fullPath
}

async function parseLocalDocumentFromFile(
  source: DocSource,
  relativePath: string,
  fullPath: string,
  stat: fs.Stats,
): Promise<ParsedDocument | null> {
  if (!fs.existsSync(fullPath)) return null

  const raw = await fs.promises.readFile(fullPath, 'utf-8')
  const parsed = parseMarkdownDocument(raw)
  const frontmatter = parsed.data as Frontmatter
  const body = parsed.content
  const fileName = path.basename(relativePath).replace(/\.(md|markdown)$/i, '')
  const sourceTags = [...new Set([...normalizeStringArray(frontmatter.tags), ...extractInlineTags(raw)])]
  const aliases = normalizeStringArray(frontmatter.aliases)
  const rawTitle = extractRawTitle(frontmatter, body, fileName)
  const intake = runKnowledgeIntake(
    { ...frontmatter, tags: sourceTags },
    { allowUnannotated: source.organizationHint === 'axi-rules' },
  )
  // For sources that bypass frontmatter (axi-rules and similar), fall back
  // to the file's raw title so we still get a usable graphTitle. This keeps
  // search, catalog, and graph paths functional for legacy docs.
  const graphTitle = intake.graphTitle || rawTitle
  if (!intake.accepted || !graphTitle) {
    return null
  }
  const techStack = extractTechStack(frontmatter, sourceTags)
  const title = formatKnowledgeDocumentTitle(rawTitle, relativePath, graphTitle)
  const description = formatKnowledgeDocumentDescription({
    title,
    rawTitle,
    path: relativePath,
    description: extractDescription(frontmatter, body),
    docType: typeof frontmatter.type === 'string' ? frontmatter.type : undefined,
    sourceId: source.id,
  })
  const item: ParsedDocument = {
    sourceId: source.id,
    path: normalizeSlashes(relativePath),
    name: fileName,
    title,
    rawTitle,
    description,
    docType: typeof frontmatter.type === 'string' ? frontmatter.type : undefined,
    status: typeof frontmatter.status === 'string' ? frontmatter.status : undefined,
    tags: intake.graphTags,
    rawTags: sourceTags,
    categories: [],
    techStack,
    updated: resolveLastUpdated(fullPath, stat, frontmatter),
    graphTitle: title,
    raw,
    body,
    frontmatter,
    aliases: [...new Set([rawTitle, graphTitle, title, ...aliases].filter(Boolean))],
    sourceTags,
    intakeIssues: intake.issues.map((issue) => issue.message),
  }
  item.categories = classifyKnowledgeCategories({
    ...item,
    title: rawTitle,
    tags: sourceTags,
  })
  return item
}

function createVirtualParsedDocument(input: NormalizedDocument & {
  name?: string
  rawTitle?: string
  status?: string
  graphTitle?: string
  aliases?: string[]
  sourceTags?: string[]
  techStack?: string[]
  projectId?: string
  projectTitle?: string
  documentTypeKey?: string
}): ParsedDocument {
  const fileName = input.name || path.basename(input.path).replace(/\.(md|markdown)$/i, '')
  const rawTitle = input.rawTitle || input.title
  const sourceTags = [...new Set(input.sourceTags || input.tags)]
  const title = formatKnowledgeDocumentTitle(input.title || rawTitle, input.path, input.graphTitle)
  const description = formatKnowledgeDocumentDescription({
    title,
    rawTitle,
    name: fileName,
    path: input.path,
    description: input.description,
    docType: input.docType,
    sourceId: input.sourceId,
  })
  const graphTitle = title
  const frontmatter = {
    ...input.frontmatter,
    title,
    description,
    'graph-title': graphTitle,
  }
  return {
    sourceId: input.sourceId,
    path: normalizeSlashes(input.path),
    name: fileName,
    title,
    rawTitle,
    description,
    docType: input.docType,
    status: input.status,
    tags: input.tags,
    rawTags: sourceTags,
    categories: input.categories,
    techStack: input.techStack || extractTechStack(input.frontmatter, sourceTags),
    updated: input.updated,
    graphTitle,
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    documentTypeKey: input.documentTypeKey,
    raw: input.raw,
    body: input.body,
    frontmatter,
    aliases: [...new Set([rawTitle, input.title, graphTitle, ...(input.aliases || [])].filter(Boolean))],
    sourceTags,
    intakeIssues: [],
  }
}

type SkillFamilyDefinition = {
  key: string
  title: string
  description: string
  match: string[]
}

type SkillSubsectionDefinition = {
  key: string
  title: string
  description: string
  match: string[]
}

const DB_SKILL_FAMILIES: SkillFamilyDefinition[] = [
  {
    key: 'dbskill-content-engineering',
    title: '内容工程与发布',
    description: '内容结构化、标题、开头、内容资产系统和发布前检查。',
    match: ['dbs-content-system', 'dbs-content', 'dbs-hook', 'dbs-xhs-title', 'dbs-ai-check'],
  },
  {
    key: 'dbskill-diagnosis',
    title: 'dbs 诊断与判断',
    description: '商业诊断、对标、内容诊断、目标澄清和概念拆解工具。',
    match: ['dbs-diagnosis', 'dbs-benchmark', 'dbs-slowisfast', 'dbs-action', 'dbs-deconstruct', 'dbs-goal'],
  },
  {
    key: 'dbskill-decision-state',
    title: '决策与状态管理',
    description: '决策系统、存档、恢复和多次诊断报告。',
    match: ['dbs-decision', 'dbs-save', 'dbs-restore', 'dbs-report'],
  },
  {
    key: 'dbskill-learning-dialogue',
    title: '学习与多角色对话',
    description: '交互式学习、好问题生成和聊天室式多视角讨论。',
    match: ['dbs-learning', 'dbs-good-question', 'dbs-chatroom', 'dbs-chatroom-austrian'],
  },
  {
    key: 'dbskill-agent-infra',
    title: 'Agent 工作台',
    description: 'Agent 工作台迁移和跨宿主一致性整理。',
    match: ['dbs-agent-migration'],
  },
]

const AXI_SKILL_FAMILIES: SkillFamilyDefinition[] = [
  {
    key: 'agent-planning',
    title: 'Agent 规划与需求',
    description: '需求澄清、计划、PRD、任务拆分、路线图与执行前判断。',
    match: ['ask', 'plan', 'planning', 'planner', 'prd', 'blueprint', 'deep-interview', 'deepinit', 'deep-init', 'to-prd', 'make-plan', 'prometheus', 'interview', 'requirements'],
  },
  {
    key: 'agent-orchestration',
    title: 'Agent 编排与协作',
    description: '多 Agent、团队模式、并行执行、工作流编排与跨角色协作。',
    match: ['agent', 'agents', 'agentic', 'autopilot', 'autonomous', 'continuous', 'dispatching', 'loop', 'pipeline', 'ralph', 'ralplan', 'swarm', 'team', 'worker', 'workflow', 'workflows', 'orchestration', 'subagent', 'parallel'],
  },
  {
    key: 'agent-memory-context',
    title: '记忆与上下文管理',
    description: '记忆、检索、上下文预算、会话历史、知识召回与长期状态。',
    match: ['agentmemory', 'context', 'forget', 'memory', 'recall', 'remember', 'session-history', 'summary', 'summarize', 'knowledge', 'retrieval'],
  },
  {
    key: 'agent-browser-qa',
    title: '浏览器自动化与 QA',
    description: '浏览器控制、Playwright、视觉验证、截图、网页 QA 与交互审计。',
    match: ['browser', 'chrome', 'playwright', 'qa', 'screenshot', 'visual', 'click-path', 'web-qa', 'browser-qa'],
  },
  {
    key: 'agent-evaluation',
    title: '评测与验证闭环',
    description: '评测、基准、验收、回归检测、测试判定与完成前验证。',
    match: ['benchmark', 'eval', 'evaluate', 'evaluation', 'harness', 'regression', 'verify', 'verification', 'verifier', 'finish', 'finishing', 'critic'],
  },
  {
    key: 'skill-authoring',
    title: '技能创作与治理',
    description: '创建、改进、安装、迁移、评估和治理 Agent Skills。',
    match: ['create-skill', 'skill-creator', 'skill-development', 'skill-installer', 'skillify', 'write-a-skill', 'writing-skills', 'improve-skill', 'encode-skill', 'migrate-to-skills', 'skill-comply', 'skill-stocktake', 'minimal-skill'],
  },
  {
    key: 'codex-claude-runtime',
    title: 'Codex 与 Claude 运行时',
    description: 'Codex、Claude Code、OpenCode、OMX、运行时配置与代理宿主。',
    match: ['codex', 'claude', 'opencode', 'opencodex', 'omc', 'omx', 'ralphinho', 'statusline', 'trace', 'runtime', 'doctor', 'cancel'],
  },
  {
    key: 'prompting-control',
    title: '提示词与响应控制',
    description: '提示词、回答深度、结构化输出、意图预测与模型交互策略。',
    match: ['prompt', 'prompting', 'intent', 'prediction', 'structured', 'json', 'depth', 'control', 'karpathy', 'gpt-5'],
  },
  {
    key: 'ai-sdk-apps',
    title: 'AI SDK 与应用开发',
    description: 'OpenAI、Agents SDK、AI SDK、Chat SDK、ChatGPT Apps 与 AI 应用框架。',
    match: ['ai-sdk', 'agents-sdk', 'chat-sdk', 'chatgpt', 'openai', 'apps', 'ai-elements', 'ai-gateway', 'sandbox-sdk', 'sdk'],
  },
  {
    key: 'model-gateway-local',
    title: '模型网关与本地模型',
    description: '模型切换、网关、本地模型、Ollama、Transformers、on-device 模型。',
    match: ['foundation', 'gateway', 'local-model', 'model', 'model-switcher', 'ollama', 'on-device', 'transformers', 'minimax'],
  },
  {
    key: 'huggingface-mlops',
    title: 'Hugging Face 与模型运维',
    description: 'HF Hub、datasets、Spaces、Gradio、训练、评测和模型发布。',
    match: ['hf', 'hugging-face', 'huggingface', 'gradio', 'datasets', 'trackio', 'trainer', 'vision-trainer', 'paper-publisher'],
  },
  {
    key: 'generative-media',
    title: '生成式媒体',
    description: '图像、视频、音频、TTS、fal、Remotion、Sora 与媒体生成链路。',
    match: ['fal', 'generation', 'imagegen', 'media', 'remotion', 'sora', 'tts', 'video', 'audio', 'genai', 'image-preview'],
  },
  {
    key: 'frontend-ui',
    title: '前端界面与组件',
    description: '前端 UI、组件、样式、设计系统、Tailwind、shadcn 与网页交互。',
    match: ['frontend', 'ui', 'ux', 'css', 'tailwind', 'shadcn', 'component', 'design-system', 'liquid-glass', 'web-perf', 'website'],
  },
  {
    key: 'react-next-vercel',
    title: 'React、Next 与 Vercel',
    description: 'React、Next.js、Vercel、Turbopack、React Native 与相关最佳实践。',
    match: ['react', 'next', 'nextjs', 'vercel', 'turbopack', 'react-native', 'rn', 'swr'],
  },
  {
    key: 'mobile-native',
    title: '移动端与原生应用',
    description: 'iOS、Android、Expo、Flutter、Swift、Kotlin 与原生集成。',
    match: ['android', 'appkit', 'compose', 'dart', 'expo', 'flutter', 'ios', 'jetpack', 'kotlin', 'native', 'swift', 'swiftui', 'swiftpm'],
  },
  {
    key: 'backend-api',
    title: '后端、API 与服务',
    description: 'API、后端框架、服务端、认证、数据库、FastAPI、Django、Laravel 等。',
    match: ['api', 'aspnet', 'auth', 'backend', 'database', 'django', 'fastapi', 'laravel', 'nestjs', 'postgres', 'server', 'springboot', 'supabase'],
  },
  {
    key: 'language-patterns',
    title: '语言与框架模式',
    description: 'Go、Rust、Java、C#、C++、.NET、Kotlin 等语言模式与测试。',
    match: ['bun', 'cpp', 'csharp', 'dotnet', 'golang', 'java', 'jpa', 'kotlin', 'python', 'rust', 'typescript', 'testing', 'patterns'],
  },
  {
    key: 'architecture-engineering',
    title: '工程架构与重构',
    description: '架构、模块边界、编码规范、重构、技术债和工程质量。',
    match: ['architecture', 'architectural', 'coding-standards', 'codebase', 'clean', 'hexagonal', 'refactor', 'simplify', 'slop', 'standards'],
  },
  {
    key: 'testing-debugging',
    title: '测试、调试与排障',
    description: '测试策略、调试、诊断、日志、故障定位和运行时问题处理。',
    match: ['debug', 'debugger', 'diagnose', 'diagnosis', 'log', 'qa', 'render-debug', 'test', 'tdd', 'troubleshoot'],
  },
  {
    key: 'security-auth',
    title: '安全、权限与合规',
    description: '安全审查、威胁建模、认证、权限、凭证、隐私与合规控制。',
    match: ['access', 'auth', 'credentials', 'compliance', 'guard', 'load-credentials', 'security', 'threat', 'privacy', 'phi'],
  },
  {
    key: 'cloud-deployment',
    title: '云服务与部署',
    description: 'Cloudflare、Render、Netlify、Supabase、容器、部署和云平台配置。',
    match: ['cloudflare', 'deploy', 'deployment', 'docker', 'durable', 'netlify', 'render', 'workers', 'wrangler', 'neon'],
  },
  {
    key: 'cicd-release',
    title: 'CI/CD 与发布治理',
    description: 'CI、GitHub Actions、CircleCI、release、版本、分支和提交治理。',
    match: ['branch', 'canary', 'ci', 'circleci', 'commit', 'git', 'github', 'release', 'version', 'packaging'],
  },
  {
    key: 'devtools-cli-mcp',
    title: 'CLI、MCP 与开发工具',
    description: '命令行、MCP、插件、connector、shell、脚手架和本地工具自动化。',
    match: ['bootstrap', 'cli', 'command', 'connector', 'figma-code-connect', 'mcp', 'mcpb', 'plugin', 'scaffold', 'shell', 'tool'],
  },
  {
    key: 'workspace-ops',
    title: '工作区与系统运维',
    description: '工作区治理、本机环境、缓存、通知、定时任务、系统连接与运行维护。',
    match: ['cache', 'configure', 'cron', 'env', 'local', 'notification', 'observability', 'runtime-cache', 'setup', 'telemetry', 'windows', 'workspace'],
  },
  {
    key: 'google-workspace',
    title: 'Google 工作区',
    description: 'Gmail、Calendar、Docs、Drive、Sheets、Slides 与 Google Workspace 自动化。',
    match: ['gmail', 'google', 'calendar', 'docs', 'drive', 'sheets', 'slides', 'workspace-ops'],
  },
  {
    key: 'office-documents',
    title: 'Office 与文档处理',
    description: 'Word、Excel、PPT、PDF、SharePoint、Canva 与办公文档自动化。',
    match: ['box', 'canva', 'docx', 'documents', 'excel', 'pdf', 'ppt', 'pptx', 'presentation', 'sharepoint', 'spreadsheet', 'word', 'xlsx'],
  },
  {
    key: 'comms-collaboration',
    title: '沟通与协作平台',
    description: 'Slack、Teams、Discord、飞书、Outlook、Zoom、会议和消息流。',
    match: ['discord', 'email', 'feishu', 'meeting', 'mubu', 'outlook', 'slack', 'teams', 'zoom', 'gmail-inbox'],
  },
  {
    key: 'design-content',
    title: '设计、内容与写作',
    description: '品牌、写作、文章、内容工程、设计稿、演示文稿和文档生产。',
    match: ['article', 'brand', 'canvas', 'ck', 'content', 'crosspost', 'design', 'doc', 'documentation', 'draw', 'figma', 'geist', 'gif', 'haowallpaper', 'liquid', 'satori', 'slides', 'svg', 'wallpaper', 'wechat', 'writer', 'writing'],
  },
  {
    key: 'knowledge-search',
    title: '知识检索与研究',
    description: '搜索、研究路由、资料整理、NotebookLM、知识库和外部上下文。',
    match: ['autoresearch', 'deep-research', 'external-context', 'iterative-retrieval', 'knowledge', 'notebooklm', 'research', 'search', 'scraper'],
  },
  {
    key: 'data-analytics',
    title: '数据、抓取与分析',
    description: '数据抓取、数据集、表格分析、ClickHouse、指标和分析管线。',
    match: ['clickhouse', 'data', 'dataset', 'metric', 'analytics', 'scraper', 'spreadsheets', 'chart', 'formula'],
  },
  {
    key: 'bio-health-research',
    title: '生物医学与科研数据库',
    description: '基因、蛋白、GWAS、临床、药物、生物数据库和医疗研究。',
    match: ['alphafold', 'bgee', 'bindingdb', 'bio', 'biobank', 'biorxiv', 'biostudies', 'cbioportal', 'cellxgene', 'chebi', 'chembl', 'civic', 'clinical', 'clinvar', 'efo', 'ensembl', 'epigraphdb', 'eqtl', 'eva', 'finngen', 'gene', 'genebass', 'gnomad', 'gtex', 'gwas', 'healthcare', 'hmdb', 'human-protein', 'locus', 'phewas', 'protein', 'rcsb', 'reactome', 'rhea', 'rnacentral', 'uniprot'],
  },
  {
    key: 'business-ops',
    title: '业务运营与项目管理',
    description: '客户、市场、销售、库存、供应链、生产排程、项目看板和运营流程。',
    match: ['business', 'carrier', 'connections', 'customer', 'customs', 'energy', 'governance', 'inventory', 'lead', 'logistics', 'management', 'market', 'ops', 'procurement', 'product', 'production', 'project', 'quality', 'sales', 'scheduling', 'trade'],
  },
  {
    key: 'finance-payments',
    title: '支付、财务与商业材料',
    description: 'Stripe、x402、账单、投资人材料、财务、采购和商业交易。',
    match: ['billing', 'finance', 'investor', 'payment', 'payments', 'stripe', 'x402'],
  },
  {
    key: 'games-3d-creative',
    title: '游戏、3D 与创意编码',
    description: '游戏开发、Three.js、WebGL、3D 资产、算法艺术和创意编程。',
    match: ['3d', 'algorithmic-art', 'game', 'phaser', 'shader', 'three', 'three-fiber', 'webgl'],
  },
  {
    key: 'specialized-domains',
    title: '垂直领域工具',
    description: '法律、教育、数学、科研之外的特殊行业或小众专业工具。',
    match: ['education', 'ielts', 'math', 'olympiad', 'santa', 'specialized'],
  },
  {
    key: 'misc-utilities',
    title: '通用辅助工具',
    description: '难以归入以上能力组的通用、示例、测试夹具或轻量工具。',
    match: ['alpha', 'beta', 'example', 'fixture', 'micro', 'misc', 'utility', 'yeet'],
  },
]

const SKILL_SUBSECTION_THRESHOLD = 10

const AXI_SKILL_SUBSECTIONS: Record<string, SkillSubsectionDefinition[]> = {
  'agent-planning': [
    { key: 'requirements-prd', title: '需求与 PRD', description: '需求澄清、PRD、Issue 转换和产品判断。', match: ['prd', 'issue', 'product', 'requirements', 'jira', 'to-prd', 'to-issues'] },
    { key: 'planning-workflows', title: '计划工作流', description: '计划制定、执行计划、目标拆解和蓝图。', match: ['plan', 'planning', 'blueprint', 'goal', 'make-plan', 'ralplan', 'omc-plan'] },
    { key: 'interview-critique', title: '访谈与推敲', description: '深度访谈、追问、对抗式澄清和头脑风暴。', match: ['interview', 'grill', 'brainstorming', 'prometheus', 'openclaw'] },
    { key: 'team-product-ops', title: '团队产品协作', description: '团队 PM、产品视角和 Agent 工程规划。', match: ['software-team', 'pm', 'agentic', 'engineering', 'superpowers'] },
  ],
  'agent-memory-context': [
    { key: 'memory-recall', title: '记忆召回', description: '记忆保存、召回、遗忘和检索。', match: ['memory', 'remember', 'recall', 'forget', 'mem-search'] },
    { key: 'session-compaction', title: '会话压缩', description: '摘要、战略压缩、会话历史和上下文预算。', match: ['summary', 'summarize', 'compact', 'session', 'context'] },
    { key: 'proactive-learning', title: '主动学习', description: '自我改进、主动代理、意图预测和迭代检索。', match: ['self', 'proactive', 'intent', 'iterative', 'retrieval'] },
    { key: 'timeline-knowledge', title: '时间线与知识', description: '时间线报告、OpenClaw、深度初始化和知识入口。', match: ['timeline', 'openclaw', 'deepinit', 'ck'] },
  ],
  'agent-browser-qa': [
    { key: 'web-performance-tests', title: 'Web 性能与测试', description: 'Web 性能、WebApp 测试、E2E 和网页 QA。', match: ['web-perf', 'webapp', 'e2e', 'web-qa', 'browser-qa'] },
    { key: 'visual-screenshot', title: '视觉与截图验证', description: '视觉判定、截图、UI 演示和视觉验证。', match: ['visual', 'screenshot', 'ui-demo', 'verdict', 'verify'] },
    { key: 'playwright-automation', title: 'Playwright 自动化', description: 'Playwright 脚本、交互调试和浏览器脚本。', match: ['playwright'] },
    { key: 'browser-control', title: '浏览器控制', description: '浏览器、Chrome、浏览器 harness 和 CLI 控制。', match: ['browser', 'chrome', 'cli-anything-browser', 'harness'] },
    { key: 'game-mobile-qa', title: '游戏与移动 QA', description: '游戏实测、Web 游戏和 Android 模拟器 QA。', match: ['game', 'android', 'emulator'] },
  ],
  'backend-api': [
    { key: 'api-backend-patterns', title: 'API 与后端模式', description: 'API 设计、后端模式、全栈和服务端团队。', match: ['api', 'backend', 'fullstack', 'software-team'] },
    { key: 'python-django-fastapi', title: 'Python 服务', description: 'Django、FastAPI 和相关迁移。', match: ['django', 'fastapi', 'database-migrations'] },
    { key: 'node-java-dotnet', title: 'Node、Java 与 .NET', description: 'NestJS、Spring Boot、Ktor、ASP.NET 和微服务。', match: ['nestjs', 'springboot', 'ktor', 'aspnet', 'micro'] },
    { key: 'postgres-data', title: 'Postgres 数据层', description: 'Postgres、Supabase 和 Neon 数据服务。', match: ['postgres', 'supabase', 'neon'] },
    { key: 'serverless-email', title: 'Serverless 与邮件', description: 'Vercel 队列、Netlify 函数和邮件服务。', match: ['vercel', 'netlify', 'email'] },
  ],
  'language-patterns': [
    { key: 'swift-dart-mobile', title: 'Swift 与 Dart', description: 'Swift、SwiftPM、并发和 Dart/Flutter 模式。', match: ['swift', 'swiftpm', 'dart', 'flutter'] },
    { key: 'kotlin-java', title: 'Kotlin 与 Java', description: 'Kotlin、Coroutines、Exposed、JPA 和 Java 规范。', match: ['kotlin', 'coroutines', 'exposed', 'jpa', 'java'] },
    { key: 'python-ml', title: 'Python 与 ML', description: 'Python、PyTorch 和机器学习模式。', match: ['python', 'pytorch'] },
    { key: 'systems-languages', title: '系统语言', description: 'Rust、Go、C++、Perl 和 .NET 语言模式。', match: ['rust', 'golang', 'go', 'cpp', 'perl', 'dotnet'] },
    { key: 'conventions', title: '通用约定', description: 'Claude Code 等跨语言工程约定。', match: ['conventions', 'coding-standards'] },
  ],
  'security-auth': [
    { key: 'auth-identity', title: '认证与身份', description: 'Auth、登录、Netlify Identity 和 Vercel 登录。', match: ['auth', 'identity', 'sign-in'] },
    { key: 'security-review', title: '安全审查', description: '安全审查、威胁建模、扫描和所有权地图。', match: ['security-review', 'threat', 'scan', 'ownership', 'best-practices'] },
    { key: 'framework-security', title: '框架安全', description: 'Django、Laravel、Spring Boot、Perl 等框架安全。', match: ['django', 'laravel', 'springboot', 'perl'] },
    { key: 'credentials-secrets', title: '凭证与密钥', description: '本地凭证、加载凭证和安全边界。', match: ['credentials', 'local-credentials', 'load-credentials'] },
    { key: 'compliance-safety', title: '合规与安全护栏', description: 'PHI、合规、Firewall 和安全护栏。', match: ['compliance', 'phi', 'healthcare', 'firewall', 'safety'] },
  ],
  'workspace-ops': [
    { key: 'workspace-audit', title: '工作区盘点', description: '递归盘点、表面审计和路由。', match: ['workspace', 'inventory', 'audit', 'routing'] },
    { key: 'sessions-worktrees', title: '会话与工作树', description: 'Git worktree、项目会话和摘要。', match: ['worktree', 'session', 'summarize'] },
    { key: 'runtime-automation', title: '运行与自动化', description: '循环、调度、通知和企业 Agent 运维。', match: ['loop', 'schedule', 'notification', 'enterprise', 'peon'] },
    { key: 'local-system', title: '本地系统工具', description: 'Bun、快捷方式、Clash 稳定和本地运行时。', match: ['bun', 'shortcut', 'clash', 'stabilize'] },
  ],
  'google-workspace': [
    { key: 'google-slides', title: 'Slides 演示', description: 'Google Slides、模板迁移、导入和视觉迭代。', match: ['slides'] },
    { key: 'google-sheets', title: 'Sheets 表格', description: 'Google Sheets、图表和表格处理。', match: ['sheets'] },
    { key: 'google-calendar', title: 'Calendar 日历', description: '日历、会议准备、日程协调和空闲时间。', match: ['calendar'] },
    { key: 'google-docs-drive', title: 'Docs 与 Drive', description: 'Google Docs、Drive、评论和工作区运维。', match: ['docs', 'drive', 'workspace'] },
    { key: 'gmail', title: 'Gmail 邮件', description: 'Gmail 和收件箱分诊。', match: ['gmail', 'gog'] },
  ],
  'knowledge-search': [
    { key: 'research-docs', title: '研究与文档', description: '深度研究、最佳实践研究和文档查找。', match: ['research', 'documentation', 'best-practice', 'deep-research'] },
    { key: 'search-sources', title: '搜索源接入', description: 'Exa、外部上下文、NotebookLM 和公司知识搜索。', match: ['exa', 'external', 'notebooklm', 'search'] },
    { key: 'knowledge-capture', title: '知识采集', description: 'Notion、Obsidian、Wiki 和知识捕获。', match: ['notion', 'obsidian', 'wiki', 'capture'] },
    { key: 'doc-agent', title: '文档 Agent', description: '软件团队文档 Agent 和本地搜索优先策略。', match: ['doc-agent', 'software-team', 'search-first'] },
  ],
  'business-ops': [
    { key: 'project-backlog', title: '项目与 Backlog', description: 'Backlog、看板、项目流和规格落地。', match: ['backlog', 'kanban', 'project', 'spec', 'linear', 'notion'] },
    { key: 'operations-supply', title: '供应链与运营', description: '库存、物流、生产排期、逆向物流和能源采购。', match: ['inventory', 'logistics', 'production', 'returns', 'energy', 'carrier'] },
    { key: 'customer-growth', title: '客户与增长', description: '客户账单、线索情报、社交图谱和增长压力测试。', match: ['customer', 'lead', 'social', 'startup'] },
    { key: 'reporting-hotfix', title: '报告与热修', description: '状态报告、会议任务捕获和生产热修。', match: ['report', 'meeting', 'hotfix', 'ielts'] },
  ],
  'games-3d-creative': [
    { key: 'game-frameworks', title: '游戏框架', description: 'Web 游戏、Phaser、Three.js 和 React Three Fiber。', match: ['game', 'phaser', 'three', 'react-three'] },
    { key: 'assets-rendering', title: '资产与渲染', description: '3D 资产、Sprite、Shader、Blender 和 WebGL。', match: ['asset', 'sprite', 'shader', 'blender', 'webgl'] },
    { key: 'creative-coding', title: '创意编码', description: '算法艺术、宠物孵化和游戏 UI。', match: ['algorithmic', 'art', 'hatch', 'ui'] },
  ],
  'misc-utilities': [
    { key: 'examples-minimal', title: '示例与最小模板', description: '示例命令、最小技能和最小插件。', match: ['example', 'minimal', 'template'] },
    { key: 'general-tools', title: '通用工具', description: '天气、Jupyter、签证翻译等通用工具。', match: ['weather', 'jupyter', 'visa'] },
    { key: 'openclaw-utils', title: 'OpenClaw 工具', description: 'OpenClaw 执行和计划工具。', match: ['openclaw', 'make-plan'] },
    { key: 'sandbox-labels', title: '实验标签', description: 'Alpha、Beta 等实验占位能力。', match: ['alpha', 'beta'] },
  ],
  'agent-orchestration': [
    { key: 'runtime-modes', title: '运行时模式', description: 'Ralph、tmux、OMX、Autopilot 等执行模式。', match: ['ralph', 'tmux', 'omx', 'omc', 'ultrawork', 'autopilot', 'workflow', 'pipeline', 'loop', 'dmux'] },
    { key: 'team-orchestration', title: '团队调度', description: '多智能体团队、控制面和协作编排。', match: ['team-builder', 'software-team', 'omo', 'ccg', 'control-plane', 'team'] },
    { key: 'parallel-subagents', title: '并行子代理', description: '子代理、并行分派、DevFleet 和 worker 调度。', match: ['subagent', 'parallel', 'dispatching', 'devfleet', 'worker'] },
    { key: 'task-routing', title: '计划与分流', description: '计划执行、Issue 分流、任务委派与请求路由。', match: ['writing-plans', 'executing-plans', 'triage', 'issue', 'request', 'github', 'do', 'task', 'delegate'] },
    { key: 'feedback-loops', title: '评审研究循环', description: '评审、研究、对抗验证与自我改进循环。', match: ['review', 'research', 'harness', 'santa', 'math', 'gan', 'trace', 'self', 'deep', 'automate'] },
  ],
  'agent-evaluation': [
    { key: 'completion-verification', title: '完成前验证', description: '完成前检查、验证循环与金丝雀监控。', match: ['verification', 'verify', 'canary', 'finish', 'finishing'] },
    { key: 'tests-quality-gates', title: '测试与质量门', description: '测试策略、QA、TDD 与质量门。', match: ['test', 'qa', 'tdd', 'django', 'quality'] },
    { key: 'evals-benchmarks', title: '评测与基准', description: '评测、基准、指标与回归测试。', match: ['eval', 'benchmark', 'metric', 'regression', 'harness'] },
    { key: 'review-compliance', title: '审查与合规', description: '插件评估、合规测量与领域安全验证。', match: ['plugin', 'skill', 'comply', 'arsenal', 'healthcare', 'review'] },
  ],
  'skill-authoring': [
    { key: 'authoring-templates', title: '创作与模板', description: '指令包、插件模板、脚手架与示例。', match: ['create', 'creator', 'template', 'example', 'minimal', 'clean-room', 'agent-development', 'scaffold'] },
    { key: 'install-migrate', title: '安装与迁移', description: '安装、迁移、配置与发现。', match: ['install', 'installer', 'migrate', 'configure', 'setup', 'find'] },
    { key: 'governance-review', title: '治理与审查', description: '安全审查、质量审查、规则与合规。', match: ['vetter', 'stocktake', 'comply', 'pr-review', 'review', 'rule', 'quality'] },
    { key: 'learning-refinement', title: '沉淀与改进', description: '会话沉淀、持续学习、经验提炼与文档写作。', match: ['skillify', 'learner', 'continuous', 'improve', 'writing', 'write', 'grill'] },
  ],
  'codex-claude-runtime': [
    { key: 'codex-claude', title: 'Codex 与 Claude', description: 'Codex、Claude Code、结果呈现与代码代理。', match: ['codex', 'claude', 'codeagent'] },
    { key: 'omx-omc', title: 'OMX 与 OMC', description: 'OMX/OMC 设置、状态栏、医生与目标模式。', match: ['omx', 'omc', 'doctor', 'statusline', 'cancel', 'performance'] },
    { key: 'hooks-plugins', title: 'Hook 与插件', description: 'Hook、插件结构、Hookify 规则与本地配置。', match: ['hook', 'plugin', 'hookify', 'structure', 'settings'] },
    { key: 'local-runtime', title: '本地运行环境', description: '本地循环、代理诊断、通知、定时任务与质量检查。', match: ['local', 'loop', 'proxy', 'notification', 'peon', 'plankton', 'runtime'] },
  ],
  'generative-media': [
    { key: 'video-animation', title: '视频与动画', description: '视频生成、理解、剪辑、Remotion、Sora 与 Manim。', match: ['video', 'remotion', 'sora', 'manim', 'shotcut', 'kdenlive', 'videodb'] },
    { key: 'audio-speech', title: '音频与语音', description: '音频编辑、语音生成和转写。', match: ['audio', 'speech', 'transcribe', 'tts', 'audacity'] },
    { key: 'image-generation', title: '图像生成', description: '图像生成、壁纸、人像、GIF 与 fal 媒体。', match: ['image', 'imagegen', 'wallpaper', 'portrait', 'gif', 'fal', 'media'] },
    { key: 'creative-workflows', title: '创意工作流', description: 'ComfyUI、Canvas、提示词精修与媒体链路。', match: ['comfyui', 'canvas', 'prompt', 'tokenplan', 'minimax'] },
  ],
  'frontend-ui': [
    { key: 'visual-ux', title: '视觉与交互', description: 'UI/UX、视觉层级、设计准则与灵感参考。', match: ['ui-ux', 'frontend-design', 'frontend-skill', 'web-design', 'website-ui', 'haowallpaper', 'liquid-glass', 'geist'] },
    { key: 'design-systems', title: '设计系统', description: '设计系统、Token、品牌化样式和共享 UI 迁移。', match: ['design-system', 'ckm:design-system', 'ckm:ui-styling', 'axi-shared-ui', 'token', 'style'] },
    { key: 'components-styling', title: '组件与样式', description: 'shadcn、Tailwind、组件库、AI Elements 与 MCP Widget。', match: ['component', 'components', 'shadcn', 'tailwind', 'ai-elements', 'build-mcp-app'] },
    { key: 'figma-assets', title: 'Figma 与素材', description: 'Figma 设计转译、组件映射与 SVG/Canvas。', match: ['figma', 'svg', 'canvas', 'draw-svg'] },
    { key: 'frontend-architecture', title: '前端页面架构', description: '前端页面、模式、性能、Nuxt 和 Web Artifact。', match: ['frontend-dev', 'frontend-patterns', 'software-team-frontend', 'nuxt', 'web-artifacts', 'performance', 'artifact', 'cms'] },
  ],
  'react-next-vercel': [
    { key: 'next-react', title: 'Next 与 React', description: 'Next.js、React、SWR、Turbopack 与组合模式。', match: ['next', 'nextjs', 'react', 'swr', 'turbopack', 'composition'] },
    { key: 'vercel-platform', title: 'Vercel 平台', description: 'Vercel 函数、路由、环境变量、市场和可观测性。', match: ['vercel', 'runtime', 'routing', 'env', 'marketplace', 'observability', 'cron'] },
    { key: 'templates-tools', title: '模板与工具', description: 'Next Forge、v0、Geistdocs、Satori 和启动模板。', match: ['forge', 'v0', 'geistdocs', 'satori', 'bootstrap'] },
  ],
  'mobile-native': [
    { key: 'ios-swift', title: 'iOS 与 Swift', description: 'iOS、SwiftUI、AppKit、SwiftPM 与并发。', match: ['ios', 'swift', 'swiftui', 'appkit', 'swiftpm'] },
    { key: 'expo-react-native', title: 'Expo 与 React Native', description: 'Expo、React Native、EAS 和原生模块。', match: ['expo', 'react-native', 'eas', 'native'] },
    { key: 'android-kotlin', title: 'Android 与 Kotlin', description: 'Android、Kotlin、Compose 和 Jetpack。', match: ['android', 'kotlin', 'compose', 'jetpack'] },
    { key: 'flutter-desktop', title: 'Flutter 与桌面', description: 'Flutter、WinUI、窗口管理与桌面端集成。', match: ['flutter', 'dart', 'winui', 'window', 'desktop'] },
  ],
  'architecture-engineering': [
    { key: 'architecture-design', title: '架构设计', description: '架构选型、六边形架构、模块边界和 ADR。', match: ['arch', 'architecture', 'hexagonal', 'module', 'adr', 'decision'] },
    { key: 'code-quality', title: '代码质量', description: '编码规范、审查、清理、简化和技术债治理。', match: ['coding', 'standard', 'review', 'quality', 'clean', 'simplify', 'slop'] },
    { key: 'repo-analysis', title: '仓库分析', description: '仓库扫描、代码库上手、能力清单与全景图。', match: ['repo', 'codebase', 'scan', 'inventory', 'onboarding', 'zoom'] },
    { key: 'project-guidance', title: '项目规范', description: '项目规范、前端约定、领域规范与上下文文档。', match: ['project', 'guidelines', 'conventions', 'context', 'deep-init'] },
  ],
  'testing-debugging': [
    { key: 'debug-diagnosis', title: '调试诊断', description: '调试、诊断、根因分析和故障排查。', match: ['debug', 'diagnose', 'diagnosis', 'sentry', 'investigation', 'triage'] },
    { key: 'tdd-testing', title: 'TDD 与测试', description: 'TDD、单元测试、框架测试和质量验证。', match: ['test', 'tdd', 'testing', 'pytest', 'googletest'] },
    { key: 'runtime-verification', title: '运行时验证', description: '部署前验证、遥测、点击路径和模拟器检查。', match: ['verification', 'telemetry', 'click', 'build-run', 'emulator'] },
    { key: 'language-tests', title: '语言专项测试', description: 'Swift、Rust、Go、C#、C++、Kotlin 等语言测试。', match: ['swift', 'rust', 'go', 'c#', 'cpp', 'csharp', 'kotlin', 'perl'] },
  ],
  'cloud-deployment': [
    { key: 'cloudflare-workers', title: 'Cloudflare 与 Workers', description: 'Cloudflare、Workers、Wrangler、Durable Objects。', match: ['cloudflare', 'worker', 'wrangler', 'durable'] },
    { key: 'netlify', title: 'Netlify', description: 'Netlify 部署、函数、表单、缓存与图片 CDN。', match: ['netlify'] },
    { key: 'render', title: 'Render', description: 'Render 部署、迁移、调试、监控和工作流。', match: ['render'] },
    { key: 'vercel-cloud', title: 'Vercel 与云资源', description: 'Vercel 部署、API、存储、多服务和沙箱。', match: ['vercel'] },
    { key: 'containers-postgres', title: '容器与 Postgres', description: 'Docker、Neon、Supabase 和 Postgres 云服务。', match: ['docker', 'neon', 'postgres', 'supabase'] },
  ],
  'cicd-release': [
    { key: 'git-pr', title: 'Git 与 PR', description: 'Git 分支、提交、PR、合并和清理。', match: ['git', 'pr', 'branch', 'commit', 'github', 'yeet'] },
    { key: 'ci-systems', title: 'CI 系统', description: 'CircleCI、CI 配置、失败修复和质量检查。', match: ['ci', 'circleci'] },
    { key: 'release-deploy', title: '发布与部署', description: 'Release、版本、部署流水线和打包公证。', match: ['release', 'deploy', 'deployment', 'packaging', 'version'] },
    { key: 'build-orchestration', title: '构建编排', description: 'Turborepo、Chunk、EAS、NCC 和任务编排。', match: ['turborepo', 'chunk', 'expo', 'eas', 'ncc'] },
  ],
  'devtools-cli-mcp': [
    { key: 'mcp-tools', title: 'MCP 与插件', description: 'MCP 服务器、插件、Connector 和本地服务器打包。', match: ['mcp', 'mcpb', 'plugin', 'connector'] },
    { key: 'cli-anything', title: 'CLI Anything', description: 'GUI 应用命令行接入和专项 CLI 套件。', match: ['cli-anything', 'cli'] },
    { key: 'cursor-local', title: 'Cursor 与本地工具', description: 'Cursor SDK、设置、Hook、Shell 与本地工具。', match: ['cursor', 'hook', 'shell', 'sdk', 'local'] },
    { key: 'figma-design-tools', title: '设计与媒体 CLI', description: 'Figma、Drawio、GIMP、Krita、Mermaid 等工具。', match: ['figma', 'drawio', 'gimp', 'krita', 'mermaid', 'mubu'] },
    { key: 'repo-automation', title: '仓库自动化', description: '外部顾问、脚手架、审计、启动和状态栏工具。', match: ['ask', 'arsenal', 'scaffold', 'setup', 'statusline', 'audit'] },
  ],
  'office-documents': [
    { key: 'spreadsheets', title: '表格与公式', description: 'XLSX、Sheets、公式、图表和电子表格。', match: ['xlsx', 'spreadsheet', 'sheets', 'formula', 'chart'] },
    { key: 'presentations', title: '演示文稿', description: 'PPT、PPTX、Slides、模板和演示设计。', match: ['ppt', 'pptx', 'slide', 'presentation'] },
    { key: 'documents-pdf', title: '文档与 PDF', description: 'DOCX、Word、PDF、Nutrient 和文档处理。', match: ['docx', 'word', 'pdf', 'document', 'nutrient'] },
    { key: 'sharepoint-box', title: 'SharePoint 与 Box', description: 'SharePoint、Box、站点发现和共享文档维护。', match: ['sharepoint', 'box'] },
    { key: 'canva-publishing', title: 'Canva 与发布', description: 'Canva、微信公众号和多平台尺寸处理。', match: ['canva', 'wechat'] },
  ],
  'comms-collaboration': [
    { key: 'teams-slack', title: 'Teams 与 Slack', description: 'Teams、Slack、频道、回复、通知和摘要。', match: ['teams', 'slack'] },
    { key: 'outlook-email-calendar', title: 'Outlook 邮件日历', description: 'Outlook 邮件、日历、会议、共享邮箱和订阅清理。', match: ['outlook'] },
    { key: 'feishu-google-comms', title: '飞书与协作', description: '飞书任务、Bitable、文档和协作消息。', match: ['feishu'] },
    { key: 'discord-zoom', title: 'Discord 与 Zoom', description: 'Discord 访问、频道设置和 Zoom 命令行。', match: ['discord', 'zoom', 'access', 'configure'] },
    { key: 'outreach', title: '邮件与人脉', description: 'Email、Gmail、X API、人脉触达和暖介绍。', match: ['email', 'gmail', 'connections', 'x-api'] },
  ],
  'design-content': [
    { key: 'brand-visual', title: '品牌与视觉', description: '品牌规范、视觉物料、配色、字体和横幅。', match: ['brand', 'ckm', 'color', 'font', 'banner', 'theme'] },
    { key: 'figma-design', title: 'Figma 与设计系统', description: 'Figma、设计系统、Code Connect 和素材生成。', match: ['figma', 'design-system'] },
    { key: 'writing-content', title: '写作与内容', description: '文章、写作记忆、内部沟通、内容改编和协作写作。', match: ['article', 'writer', 'writing', 'content', 'comms', 'coauthoring', 'crosspost'] },
    { key: 'graphics-docs', title: '图形与文档', description: 'SVG、Inkscape、Canvas、文档与演示内容。', match: ['svg', 'inkscape', 'canvas', 'doc', 'slides'] },
  ],
  'bio-health-research': [
    { key: 'variants-genetics', title: '变异与遗传关联', description: 'GWAS、PheWAS、ClinVar、eQTL 和变异关联。', match: ['gwas', 'phewas', 'clinvar', 'eqtl', 'variant', 'finngen', 'biobank', 'gtex', 'gnomad', 'genebass', 'tpmi', 'ukb'] },
    { key: 'proteins-pathways', title: '蛋白与通路', description: '蛋白结构、互作、通路和反应数据库。', match: ['protein', 'alphafold', 'uniprot', 'string', 'reactome', 'rcsb', 'rhea', 'quickgo', 'human-protein'] },
    { key: 'chem-pharma', title: '化合物与药物', description: 'ChEMBL、ChEBI、BindingDB、PubChem、PharmGKB。', match: ['chem', 'chebi', 'chembl', 'bindingdb', 'pubchem', 'pharmgkb'] },
    { key: 'clinical-health', title: '临床与医疗', description: '临床试验、CDSS、医疗合规和临床表格。', match: ['clinical', 'healthcare', 'cdss'] },
    { key: 'omics-expression', title: '组学与表达', description: '表达、组学、RNA、ENCODE、EVA、MGnify 等数据。', match: ['expression', 'bgee', 'cellxgene', 'encode', 'eva', 'rnacentral', 'mgnify', 'metabolights', 'pride', 'proteomexchange', 'bio'] },
    { key: 'literature-portals', title: '文献与门户', description: 'NCBI、PMC、Open Targets、BioStudies、biorxiv 等查询。', match: ['ncbi', 'pmc', 'opentargets', 'biostudies', 'biorxiv', 'ensembl', 'efo', 'epigraphdb', 'civic', 'cbioportal'] },
  ],
}

function normalizeSkillToken(value: string): string {
  return value.trim().toLowerCase()
}

function tokenizeSkillKey(value: string): string[] {
  return normalizeSkillToken(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean)
}

function getSkillKey(document: Pick<ParsedDocument, 'name' | 'path' | 'aliases'>): string {
  return normalizeSkillToken(document.name || document.aliases[0] || path.basename(path.dirname(document.path)))
}

function getSkillFamily(document: ParsedDocument, definitions: SkillFamilyDefinition[]): SkillFamilyDefinition | null {
  const explicitFamily = typeof document.frontmatter.skillFamily === 'string'
    ? document.frontmatter.skillFamily.trim()
    : ''
  if (explicitFamily) {
    const explicitDefinition = definitions.find((definition) => definition.key === explicitFamily)
    if (explicitDefinition) return explicitDefinition
  }

  const skillKey = getSkillKey(document)
  const pathTokens = tokenizeSkillKey(document.path.replace(/\/?SKILL\.md$/i, ''))
  const aliasTokens = (document.aliases || []).flatMap(tokenizeSkillKey)
  const keyTokens = tokenizeSkillKey(skillKey)
  const exactTokens = new Set([...pathTokens, ...aliasTokens, ...keyTokens])

  return definitions.find((family) => family.match.some((token) => {
    const normalizedToken = normalizeSkillToken(token)
    const tokenParts = tokenizeSkillKey(normalizedToken)
    return skillKey === normalizedToken
      || skillKey.startsWith(`${normalizedToken}-`)
      || skillKey.startsWith(`${normalizedToken}:`)
      || skillKey.includes(`-${normalizedToken}-`)
      || skillKey.endsWith(`-${normalizedToken}`)
      || exactTokens.has(normalizedToken)
      || (normalizedToken.length >= 4 && [...exactTokens].some((exactToken) => exactToken.startsWith(normalizedToken)))
      || (tokenParts.length > 1 && tokenParts.every((part) => exactTokens.has(part)))
  })) || null
}

function getSkillFamilyDefinitions(source: DocSource): SkillFamilyDefinition[] {
  return source.organizationHint === 'dbskill' ? DB_SKILL_FAMILIES : AXI_SKILL_FAMILIES
}

function getSkillSubsectionDefinitions(sectionKey: string): SkillSubsectionDefinition[] {
  return AXI_SKILL_SUBSECTIONS[sectionKey] || []
}

function skillItemMatchesSubsection(item: KnowledgeCatalogItem, definition: SkillSubsectionDefinition): boolean {
  const haystack = normalizeSkillToken([
    item.name,
    item.title,
    item.rawTitle,
    item.description,
    item.path,
    ...item.tags,
    ...(item.rawTags || []),
  ].filter(Boolean).join(' '))
  const pathTokens = new Set(tokenizeSkillKey(item.path.replace(/\/?SKILL\.md$/i, '')))
  const nameTokens = new Set(tokenizeSkillKey(item.name))
  const titleTokens = new Set(tokenizeSkillKey(item.title))
  const exactTokens = new Set([...pathTokens, ...nameTokens, ...titleTokens])

  return definition.match.some((token) => {
    const normalizedToken = normalizeSkillToken(token)
    const tokenParts = tokenizeSkillKey(normalizedToken)
    return haystack.includes(normalizedToken)
      || exactTokens.has(normalizedToken)
      || (normalizedToken.length >= 4 && [...exactTokens].some((exactToken) => exactToken.startsWith(normalizedToken)))
      || (tokenParts.length > 1 && tokenParts.every((part) => exactTokens.has(part)))
  })
}

function buildSkillCatalogSubsections(sectionKey: string, items: KnowledgeCatalogItem[]): KnowledgeCatalog['sections'][number]['subsections'] {
  if (items.length <= SKILL_SUBSECTION_THRESHOLD) return undefined

  const definitions = getSkillSubsectionDefinitions(sectionKey)
  if (definitions.length === 0) return undefined

  const grouped = new Map<string, { definition: SkillSubsectionDefinition, items: KnowledgeCatalogItem[] }>()
  for (const definition of definitions) {
    grouped.set(definition.key, { definition, items: [] })
  }

  const fallback: SkillSubsectionDefinition = {
    key: 'other',
    title: '其他条目',
    description: '未命中二级规则但仍属于本能力组的技能。',
    match: [],
  }
  grouped.set(fallback.key, { definition: fallback, items: [] })

  for (const item of items) {
    const definition = definitions.find((candidate) => skillItemMatchesSubsection(item, candidate)) || fallback
    grouped.get(definition.key)!.items.push(item)
  }

  return [...grouped.values()]
    .filter((group) => group.items.length > 0)
    .map(({ definition, items: subsectionItems }) => ({
      key: definition.key,
      title: definition.title,
      description: definition.description,
      count: subsectionItems.length,
      items: sortCatalogItems(subsectionItems),
    }))
}

function buildSkillIndexMarkdown(source: DocSource, skillDocs: ParsedDocument[], originalRaw: string): string {
  if (skillDocs.length === 0) return originalRaw

  const definitions = getSkillFamilyDefinitions(source)
  const grouped = new Map<string, { definition: SkillFamilyDefinition, items: ParsedDocument[] }>()

  for (const document of skillDocs) {
    const definition = getSkillFamily(document, definitions) || buildFallbackSkillFamily(document, source)
    if (!grouped.has(definition.key)) {
      grouped.set(definition.key, { definition, items: [] })
    }
    grouped.get(definition.key)!.items.push(document)
  }

  const orderedKeys = definitions.map((definition) => definition.key)
  const groups = [...grouped.values()].sort((left, right) => {
    const leftOrder = orderedKeys.indexOf(left.definition.key)
    const rightOrder = orderedKeys.indexOf(right.definition.key)
    if (leftOrder !== -1 || rightOrder !== -1) {
      if (leftOrder === -1) return 1
      if (rightOrder === -1) return -1
      return leftOrder - rightOrder
    }
    if (right.items.length !== left.items.length) return right.items.length - left.items.length
    return left.definition.title.localeCompare(right.definition.title, 'zh-CN')
  })

  const lines = [
    `# ${source.name} 技能索引`,
    '',
    `当前索引 ${skillDocs.length} 个技能入口，按能力组组织；左侧侧栏只做快速入口，完整目录以本页分组为准。`,
    '',
    '## 能力分组',
    '',
    ...groups.map(({ definition, items }) => `- **${definition.title}**：${items.length} 个技能。${definition.description}`),
    '',
  ]

  for (const { definition, items } of groups) {
    lines.push(`## ${definition.title}`)
    lines.push('')
    lines.push(definition.description)
    lines.push('')
    lines.push('| Skill | Description | Path |')
    lines.push('|---|---|---|')
    for (const item of [...items].sort((left, right) => left.title.localeCompare(right.title, 'zh-CN') || left.path.localeCompare(right.path, 'zh-CN'))) {
      const description = (item.description || '').replace(/\s+/g, ' ').replace(/\|/g, '/')
      lines.push(`| \`${item.name}\` | ${description} | \`${item.path}\` |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function buildSkillDocument(source: DocSource, relativePath: string, fullPath: string, stat: fs.Stats, raw: string): ParsedDocument {
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

function buildSkillAssetDocument(source: DocSource, skillName: string, relativePath: string, fullPath: string, stat: fs.Stats, raw: string): ParsedDocument {
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

async function collectSelectedSkillAssets(
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
      if (isExcludedName(entry.name)) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.isFile() || entry.name === 'SKILL.md' || !isSupportedFile(entry.name)) continue
      const stat = await fs.promises.stat(fullPath)
      const raw = await fs.promises.readFile(fullPath, 'utf-8')
      const relativePath = normalizeSlashes(path.relative(rootPath, fullPath))
      documents.push(buildSkillAssetDocument(source, skillName, relativePath, fullPath, stat, raw))
    }
  }

  await walk(skillRootPath)
  return documents
}

async function collectSkillSupportDocuments(source: DocSource, rootPath: string): Promise<ParsedDocument[]> {
  if (!source.includeSupportDocs) return []

  const supportRoots = ['README.md', 'docs', '知识库']
  const documents: ParsedDocument[] = []

  async function addFile(fullPath: string): Promise<void> {
    if (!isSupportedFile(fullPath)) return
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
      if (isExcludedName(entry.name)) continue
      await walk(path.join(fullPath, entry.name))
    }
  }

  for (const supportRoot of supportRoots) {
    await walk(path.join(rootPath, supportRoot))
  }

  return documents
}

async function collectSkillDocuments(source: DocSource): Promise<ParsedDocument[]> {
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
      if (isExcludedName(entry.name)) continue
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

function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim().replace(/^`|`$/g, '').replace(/\\\|/g, '|'))
}

function stripMarkdownLinks(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

const WORKSPACE_PURPOSE_OVERRIDES = new Map([
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

const WORKSPACE_TITLE_OVERRIDES = new Map([
  ['Axi Skills', 'Axi 技能库'],
])

function resolveWorkspacePurpose(cleanName: string, fallbackPurpose: string, fallbackNotes: string): string {
  return WORKSPACE_PURPOSE_OVERRIDES.get(cleanName) || fallbackPurpose || fallbackNotes
}

function resolveWorkspaceTitle(cleanName: string): string {
  return WORKSPACE_TITLE_OVERRIDES.get(cleanName) || cleanName
}

function joinChineseFacts(facts: Array<[string, string | undefined]>): string {
  return facts
    .map(([label, value]) => {
      const cleaned = stripMarkdownLinks(value || '').replace(/[。.!！?？]+$/u, '')
      return cleaned ? `${label}：${cleaned}` : ''
    })
    .filter(Boolean)
    .join('。')
}

type WorkspaceProjectInfo = {
  id: string
  name: string
  projectPath: string
  purpose: string
  stack: string
  status: string
  docs: string
  verification: string
  notes: string
  description: string
  updated: string
}

type HandoffProject = {
  id: string
  name: string
  path: string
  kind: string
  lifecycle: string
  owner: string
  readiness: string
  summary: string
  score?: number
  readOrder?: string[]
  entrypoints?: Array<{ id?: string; path?: string; purpose?: string }>
  commands: { verify?: string[]; smoke?: string[]; setup?: string[]; start?: string[]; health?: string[] }
  currentWork?: { active?: string | string[]; knownFailures?: string[]; todo?: string; milestone?: string }
  manifestPath?: string
  handoffPath?: string
  lastVerifiedAt?: string
  notes?: string
}

type HandoffLoadResult = {
  source: 'handoff' | 'none'
  projects: WorkspaceProjectInfo[]
  generatedAt: string | null
  handoffPath: string | null
  error: Error | null
}

type WorkspaceProjectSuiteDoc = {
  suffix?: string
  name: string
  title: string
  docType: string
  categories: string[]
  tags: string[]
  sourceTags: string[]
  description: string
  body: string
  graphTags: string[]
  aliases?: string[]
}

const WORKSPACE_DOCUMENT_TYPE_DEFINITIONS: WorkspaceDocumentTypeDefinition[] = [
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

const WORKSPACE_DOCUMENT_TYPE_ORDER = WORKSPACE_DOCUMENT_TYPE_DEFINITIONS.map((definition) => definition.key)

function parseWorkspaceProjectRow(row: string[], updated: string): WorkspaceProjectInfo | null {
  const [name, projectPath, purpose, stack, status, docs, verification, notes] = row
  if (!name || !projectPath || name === 'Project' || /^-+$/.test(name)) return null
  const cleanName = stripMarkdownLinks(name)
  const cleanPath = stripMarkdownLinks(projectPath)
  const cleanStatus = stripMarkdownLinks(status || 'active')
  const cleanStack = stripMarkdownLinks(stack || '')
  const cleanDocs = stripMarkdownLinks(docs || '')
  const cleanVerification = stripMarkdownLinks(verification || '')
  const cleanPurpose = stripMarkdownLinks(purpose || '')
  const cleanNotes = stripMarkdownLinks(notes || '')
  const purposeSummary = resolveWorkspacePurpose(cleanName, cleanPurpose, cleanNotes)
  const id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || cleanPath.replace(/[^a-z0-9]+/gi, '-')
  const description = joinChineseFacts([
    ['用途', purposeSummary],
    ['状态', cleanStatus],
    ['技术栈', cleanStack],
    ['验证', cleanVerification],
    ['文档', cleanDocs],
  ])

  return {
    id,
    name: resolveWorkspaceTitle(cleanName),
    projectPath: cleanPath,
    purpose: purposeSummary,
    stack: cleanStack,
    status: cleanStatus,
    docs: cleanDocs,
    verification: cleanVerification,
    notes: cleanNotes,
    description,
    updated,
  }
}

/**
 * Zero-context handoff governance: prefer the governance-published snapshot
 * over the human-authored `WORKSPACE_INDEX.md` table. Returns an empty list
 * with `source: 'none'` when the snapshot is unavailable; the caller is then
 * expected to fall back to the markdown path.
 */
function getHandoffSnapshotPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.workspace', 'project-handoff.json')
}

function mapHandoffProjectToWorkspaceInfo(
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

async function __loadHandoffProjects(workspaceRoot: string): Promise<HandoffLoadResult> {
  const handoffPath = getHandoffSnapshotPath(workspaceRoot)
  try {
    const raw = await fs.promises.readFile(handoffPath, 'utf-8')
    const snapshot = JSON.parse(raw) as { projects?: HandoffProject[]; generatedAt?: string }
    if (!Array.isArray(snapshot.projects)) {
      return { source: 'none', projects: [], generatedAt: null, handoffPath, error: new Error('snapshot missing projects[]') }
    }
    const generatedAt = typeof snapshot.generatedAt === 'string' ? snapshot.generatedAt : null
    const projects = snapshot.projects
      .map((entry) => mapHandoffProjectToWorkspaceInfo(entry, generatedAt))
      .filter((entry): entry is WorkspaceProjectInfo => entry !== null)
    if (projects.length === 0) {
      return { source: 'none', projects: [], generatedAt, handoffPath, error: new Error('snapshot projects[] mapped to empty list') }
    }
    return { source: 'handoff', projects, generatedAt, handoffPath, error: null }
  } catch (error) {
    return {
      source: 'none',
      projects: [],
      generatedAt: null,
      handoffPath,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Decide whether to render a workspace project from the project root's own
 * governance files (README/AGENTS/PRD/TDD/...) or fall back to the synthetic
 * four-piece suite. Local-only projects (lifecycle contains 'local') should
 * always use the suite path; their on-disk files are not part of the
 * canonical dossier surface.
 */
function __shouldUseSuiteDefinitionsForProject(
  project: WorkspaceProjectInfo,
  projectRootExists: boolean,
): boolean {
  if (!projectRootExists) return true
  // Local-only projects (e.g. axi-pet, axi-feishu-codex-bridge) keep their
  // root private; render the synthetic 4-piece suite.
  const path = project.projectPath
  if (typeof path !== 'string') return true
  // Best-effort signal: lifecycle is not stored in WorkspaceProjectInfo, but
  // the synthetic path also fires when the project name ends in '-local' or
  // the path contains '/local/' as a defensive marker.
  if (/\/local\//i.test(path)) return true
  return false
}

/**
 * Exclude kinds that should never produce virtual workspace documents
 * (reference repos, cockpit dashboards, etc.).
 */
function __isExcludedWorkspaceKind(kind: string | undefined): boolean {
  if (!kind) return false
  const normalized = kind.trim().toLowerCase()
  return normalized === 'reference' || normalized === 'cockpit'
}

export function __loadHandoffProjectsForTests(workspaceRoot: string) {
  return __loadHandoffProjects(workspaceRoot)
}

export function __shouldUseSuiteDefinitionsForProjectForTests(
  project: WorkspaceProjectInfo,
  projectRootExists: boolean,
) {
  return __shouldUseSuiteDefinitionsForProject(project, projectRootExists)
}

export function __isExcludedWorkspaceKindForTests(kind: string | undefined) {
  return __isExcludedWorkspaceKind(kind)
}

export function __getHandoffPathForTests(workspaceRoot: string) {
  return getHandoffSnapshotPath(workspaceRoot)
}

function formatWorkspaceValue(value: string, fallback = '未标注'): string {
  return value.trim() || fallback
}

function formatWorkspaceCommand(value: string): string {
  return value.trim() ? `\`${value.trim()}\`` : '未标注'
}

async function buildWorkspaceProjectRootDocuments(
  source: DocSource,
  project: WorkspaceProjectInfo,
): Promise<ParsedDocument[]> {
  const projectRoot = path.isAbsolute(project.projectPath)
    ? project.projectPath
    : path.resolve(project.projectPath)
  if (!projectRoot || !fs.existsSync(projectRoot)) return []

  const documents: ParsedDocument[] = []
  for (const definition of WORKSPACE_DOCUMENT_TYPE_DEFINITIONS) {
    const fileName = definition.fileNames.find((candidate) => fs.existsSync(path.join(projectRoot, candidate)))
    if (!fileName) continue

    const fullPath = path.join(projectRoot, fileName)
    const stat = await fs.promises.stat(fullPath)
    if (!stat.isFile()) continue

    const raw = await fs.promises.readFile(fullPath, 'utf-8')
    const parsed = parseMarkdownDocument(raw)
    const frontmatter = parsed.data as Frontmatter
    const body = parsed.content
    const updated = normalizeDate(frontmatter.modified)
      || normalizeDate(frontmatter.updated)
      || stat.mtime.toISOString()
    const rawTitle = extractRawTitle(frontmatter, body, fileName.replace(/\.md$/i, ''))
    const title = definition.itemTitleSuffix
      ? `${project.name} ${definition.itemTitleSuffix}`
      : project.name
    const sourceTags = [
      ...definition.sourceTags,
      ...normalizeStringArray(frontmatter.tags),
      ...extractInlineTags(raw),
      `project-id:${project.id}`,
      `project-name:${project.name}`,
      `workspace-doc-type:${definition.key}`,
      fileName.toLowerCase(),
    ]

    documents.push(createVirtualParsedDocument({
      sourceId: source.id,
      path: `project-docs/${project.id}/${fileName}`,
      name: `${project.id}-${definition.key}`,
      title,
      rawTitle,
      description: extractDescription(frontmatter, body) || `${project.name} 的${definition.title}。${project.description}`,
      docType: definition.docType,
      status: project.status,
      tags: [...new Set([...definition.graphTags, project.status])],
      categories: definition.categories,
      updated,
      raw,
      body,
      frontmatter: {
        ...frontmatter,
        id: typeof frontmatter.id === 'string' ? frontmatter.id : `workspace-${project.id}-${definition.key}`,
        title,
        type: definition.docType,
        status: project.status,
        tags: [...new Set([...definition.graphTags, project.status])],
        modified: updated,
        'graph-title': title,
        'graph-tags': definition.graphTags,
      },
      aliases: [project.name, rawTitle, project.projectPath, fullPath, fileName],
      sourceTags,
      techStack: project.stack ? project.stack.split(',').map((item) => item.trim()).filter(Boolean) : [],
      projectId: project.id,
      projectTitle: project.name,
      documentTypeKey: definition.key,
    }))
  }

  return documents
}

function buildWorkspaceProjectSuiteDefinitions(project: WorkspaceProjectInfo): WorkspaceProjectSuiteDoc[] {
  const overviewBody = [
    `# ${project.name}`,
    '',
    `- 状态：${project.status}`,
    `- 技术栈：${formatWorkspaceValue(project.stack)}`,
    `- 权威文档：${formatWorkspaceValue(project.docs)}`,
    `- 常用验证：${formatWorkspaceCommand(project.verification)}`,
    '',
    '## 用途',
    '',
    project.purpose,
    '',
    '## 文档套件',
    '',
    `- [架构说明](./${project.id}/architecture.md)`,
    `- [运维与验证](./${project.id}/operations.md)`,
    `- [协作规范](./${project.id}/standards.md)`,
    '',
    project.notes ? '## 备注' : '',
    project.notes || '',
  ].filter(Boolean).join('\n')

  const architectureBody = [
    `# ${project.name} 架构`,
    '',
    '## 项目边界',
    '',
    project.purpose,
    '',
    '## 技术栈',
    '',
    formatWorkspaceValue(project.stack),
    '',
    '## 上游契约',
    '',
    `- 工作区路径：由 WORKSPACE_INDEX 记录为 \`${project.projectPath}\`。`,
    `- 关系与依赖：通过 \`/Volumes/code/workspace/workspace.graph.json\` 与 \`workspace-project\` 查询。`,
    `- 权威入口：${formatWorkspaceValue(project.docs)}。`,
  ].join('\n')

  const operationsBody = [
    `# ${project.name} 运维与验证`,
    '',
    '## 当前状态',
    '',
    project.status,
    '',
    '## 常用验证',
    '',
    formatWorkspaceCommand(project.verification),
    '',
    '## 执行准则',
    '',
    '- 从项目本地 AGENTS/README/包清单读取具体命令。',
    '- 涉及跨项目消费关系时先查询 workspace graph。',
    '- 验证结果必须来自当前命令输出，不能只依赖索引描述。',
  ].join('\n')

  const standardsBody = [
    `# ${project.name} 协作规范`,
    '',
    '## 文档入口',
    '',
    formatWorkspaceValue(project.docs),
    '',
    '## Agent 规则',
    '',
    '- 进入项目后先读取最近的 AGENTS.md、CLAUDE.md 或 README.md。',
    '- 保持修改半径在项目边界内；跨项目契约变更先查 consumers/providers。',
    '- 不提交运行态、缓存、构建产物或凭证。',
    '',
    '## 补齐标准',
    '',
    '- 项目至少应有入口说明、架构边界、任务/TODO、里程碑和验证命令。',
    '- P0/P1 任务需要绑定需求、测试或明确的验证缺口。',
  ].join('\n')

  return [
    {
      name: project.id,
      title: project.name,
      docType: 'project',
      categories: ['projects'],
      tags: ['项目', '工作区', project.status],
      sourceTags: ['project', 'workspace', project.status],
      description: project.description,
      body: overviewBody,
      graphTags: ['项目', '工作区'],
      aliases: [project.projectPath, project.name],
    },
    {
      suffix: 'architecture',
      name: `${project.id}-architecture`,
      title: `${project.name} 架构`,
      docType: 'architecture',
      categories: ['architecture'],
      tags: ['架构', '工作区', project.status],
      sourceTags: ['architecture', 'project', 'workspace', project.status],
      description: joinChineseFacts([
        ['架构边界', project.purpose],
        ['技术栈', project.stack],
        ['契约', 'workspace.graph.json'],
      ]),
      body: architectureBody,
      graphTags: ['架构', '项目'],
      aliases: [project.name, `${project.name} architecture`, project.projectPath],
    },
    {
      suffix: 'operations',
      name: `${project.id}-operations`,
      title: `${project.name} 运维与验证`,
      docType: 'runbook',
      categories: ['solutions'],
      tags: ['运维', '验证', '工作区', project.status],
      sourceTags: ['operations', 'verification', 'project', 'workspace', project.status],
      description: joinChineseFacts([
        ['状态', project.status],
        ['验证', project.verification],
        ['对象', project.name],
      ]),
      body: operationsBody,
      graphTags: ['运维', '验证'],
      aliases: [project.name, `${project.name} verify`, `${project.name} operations`],
    },
    {
      suffix: 'standards',
      name: `${project.id}-standards`,
      title: `${project.name} 协作规范`,
      docType: 'standard',
      categories: ['standards'],
      tags: ['规范', '协作', '工作区', project.status],
      sourceTags: ['standards', 'project', 'workspace', project.status],
      description: joinChineseFacts([
        ['文档入口', project.docs],
        ['协作边界', '项目本地规则优先'],
        ['对象', project.name],
      ]),
      body: standardsBody,
      graphTags: ['规范', '项目'],
      aliases: [project.name, `${project.name} standards`, project.docs],
    },
  ]
}

function buildWorkspaceProjectDocuments(source: DocSource, row: string[], updated: string): ParsedDocument[] {
  const project = parseWorkspaceProjectRow(row, updated)
  if (!project) return []

  return buildWorkspaceProjectSuiteDefinitions(project).map((definition) => {
    const documentPath = definition.suffix
      ? `projects/${project.id}/${definition.suffix}.md`
      : `projects/${project.id}.md`
    const raw = buildFrontmatter({
      id: `workspace-${project.id}${definition.suffix ? `-${definition.suffix}` : ''}`,
      title: definition.title,
      type: definition.docType,
      status: project.status,
      tags: definition.tags,
      created: project.updated,
      modified: project.updated,
      'graph-title': definition.title,
      'graph-tags': definition.graphTags,
      stack: project.stack,
      verification: project.verification,
      description: definition.description,
    }) + definition.body

    return createVirtualParsedDocument({
      sourceId: source.id,
      path: documentPath,
      name: definition.name,
      title: definition.title,
      rawTitle: definition.title,
      description: definition.description,
      docType: definition.docType,
      status: project.status,
      tags: definition.tags,
      categories: definition.categories,
      updated: project.updated,
      raw,
      body: definition.body,
      frontmatter: parseMarkdownDocument(raw).data as Frontmatter,
      aliases: definition.aliases || [project.name],
      sourceTags: definition.sourceTags,
      techStack: project.stack ? project.stack.split(',').map((item) => item.trim()).filter(Boolean) : [],
    })
  })
}

async function collectWorkspaceDocuments(source: DocSource): Promise<ParsedDocument[]> {
  const workspaceRoot = path.resolve(source.path, '../..')
  const workspaceIndexPath = path.join(workspaceRoot, 'WORKSPACE_INDEX.md')
  const catalogPath = path.join(source.path, 'docs', 'project-catalog.md')
  const documents: ParsedDocument[] = []
  let workspaceIndexStat: fs.Stats | null = null
  let updated = new Date().toISOString()

  let indexText = ''
  try {
    workspaceIndexStat = await fs.promises.stat(workspaceIndexPath)
    indexText = await fs.promises.readFile(workspaceIndexPath, 'utf-8')
    updated = resolveLastUpdated(workspaceIndexPath, workspaceIndexStat)
  } catch {
    indexText = ''
  }

  // Handoff-first: try the governance snapshot before falling back to the
  // legacy markdown table. The handoff is the authoritative source for
  // readiness, commands, and current work.
  const handoffResult = await __loadHandoffProjects(workspaceRoot)
  const handoffKindById = new Map<string, string>()
  if (handoffResult.source === 'handoff' && handoffResult.handoffPath) {
    try {
      const snapshot = JSON.parse(await fs.promises.readFile(handoffResult.handoffPath, 'utf-8'))
      if (Array.isArray(snapshot.projects)) {
        for (const raw of snapshot.projects) {
          if (raw && typeof raw.id === 'string') {
            handoffKindById.set(raw.id, typeof raw.kind === 'string' ? raw.kind : '')
          }
        }
      }
    } catch {
      // If the snapshot cannot be re-read here, the kind filter degrades to
      // letting everything through — better to over-render than to drop
      // legitimate projects.
    }
  }

  const workspaceProjects = handoffResult.source === 'handoff'
    ? handoffResult.projects
    : indexText
      .split('\n')
      .filter((line) => line.startsWith('|') && !line.includes('| ---'))
      .map(splitMarkdownTableRow)
      .filter((row) => row.length >= 7)
      .map((row) => parseWorkspaceProjectRow(row, updated))
      .filter((project): project is WorkspaceProjectInfo => Boolean(project))

  for (const project of workspaceProjects) {
    // Reference / cockpit kinds are loaded into the list (so the build script
    // can still see them) but skipped during virtual document generation.
    const kind = handoffKindById.get(project.id)
    if (kind && __isExcludedWorkspaceKind(kind)) continue
    const projectRootDocuments = await buildWorkspaceProjectRootDocuments(source, project)
    const projectRootExists = projectRootDocuments.length > 0
    const useSuite = __shouldUseSuiteDefinitionsForProject(project, projectRootExists)
    documents.push(...(!useSuite
      ? projectRootDocuments
      : buildWorkspaceProjectSuiteDefinitions(project).map((definition) => {
        const documentPath = definition.suffix
          ? `projects/${project.id}/${definition.suffix}.md`
          : `projects/${project.id}.md`
        const raw = buildFrontmatter({
          id: `workspace-${project.id}${definition.suffix ? `-${definition.suffix}` : ''}`,
          title: definition.title,
          type: definition.docType,
          status: project.status,
          tags: definition.tags,
          created: project.updated,
          modified: project.updated,
          'graph-title': definition.title,
          'graph-tags': definition.graphTags,
          stack: project.stack,
          verification: project.verification,
          description: definition.description,
        }) + definition.body

        return createVirtualParsedDocument({
          sourceId: source.id,
          path: documentPath,
          name: definition.name,
          title: definition.title,
          rawTitle: definition.title,
          description: definition.description,
          docType: definition.docType,
          status: project.status,
          tags: definition.tags,
          categories: definition.categories,
          updated: project.updated,
          raw,
          body: definition.body,
          frontmatter: parseMarkdownDocument(raw).data as Frontmatter,
          aliases: definition.aliases || [project.name],
          sourceTags: [
            ...definition.sourceTags,
            `project-id:${project.id}`,
            `project-name:${project.name}`,
            `workspace-doc-type:${definition.docType}`,
          ],
          techStack: project.stack ? project.stack.split(',').map((item) => item.trim()).filter(Boolean) : [],
          projectId: project.id,
          projectTitle: project.name,
          documentTypeKey: definition.docType,
        })
      })))
  }

  if (fs.existsSync(catalogPath)) {
    const stat = await fs.promises.stat(catalogPath)
    const raw = await fs.promises.readFile(catalogPath, 'utf-8')
    const catalogUpdated = resolveLastUpdated(catalogPath, stat)
    documents.push(createVirtualParsedDocument({
      sourceId: source.id,
      path: 'governance/project-catalog.md',
      name: 'project-catalog',
      title: 'Workspace Project Catalog',
      rawTitle: 'Workspace Project Catalog',
      description: '用途：工作区项目可读目录。范围：Axi workspace projects。对象：项目治理和入口导航',
      docType: 'index',
      status: 'active',
      tags: ['索引', '项目', '工作区'],
      categories: ['indexes'],
      updated: catalogUpdated,
      raw,
      body: parseMarkdownDocument(raw).content,
      frontmatter: {
        id: 'workspace-project-catalog',
        title: 'Workspace Project Catalog',
        type: 'index',
        status: 'active',
        tags: ['索引', '项目', '工作区'],
        modified: catalogUpdated,
        'graph-title': 'Workspace Project Catalog',
        'graph-tags': ['索引', '项目'],
      },
      aliases: ['project-catalog', 'workspace catalog'],
      sourceTags: ['index', 'project', 'workspace'],
    }))
  }

  if (fs.existsSync(workspaceIndexPath)) {
    const stat = workspaceIndexStat || await fs.promises.stat(workspaceIndexPath)
    const indexUpdated = resolveLastUpdated(workspaceIndexPath, stat)
    documents.push(createVirtualParsedDocument({
      sourceId: source.id,
      path: 'WORKSPACE_INDEX.md',
      name: 'WORKSPACE_INDEX',
      title: 'Axi Workspace Index',
      rawTitle: 'Axi Workspace Index',
      description: '用途：工作区级项目地图。范围：Codex 本地 workspace。对象：项目定位、路径解析和治理入口',
      docType: 'index',
      status: 'active',
      tags: ['索引', '项目', '工作区'],
      categories: ['indexes'],
      updated: indexUpdated,
      raw: indexText,
      body: parseMarkdownDocument(indexText).content,
      frontmatter: {
        id: 'axi-workspace-index',
        title: 'Axi Workspace Index',
        type: 'index',
        status: 'active',
        tags: ['索引', '项目', '工作区'],
        modified: indexUpdated,
        'graph-title': 'Axi Workspace Index',
        'graph-tags': ['索引', '项目'],
      },
      aliases: ['WORKSPACE_INDEX', 'workspace index'],
      sourceTags: ['index', 'project', 'workspace'],
    }))
  }

  const axiSkillsPath = path.resolve(workspaceRoot, 'shared', 'axi-skills')
  if (fs.existsSync(axiSkillsPath) && !documents.some((document) => document.projectId === 'axi-skills' || document.rawTitle === 'Axi Skills' || document.name.startsWith('axi-skills'))) {
    const axiSkillsProject = parseWorkspaceProjectRow([
      'Axi Skills',
      axiSkillsPath,
      'Axi 智能体共享技能树，用于沉淀可版本化、可复用的智能体技能入口。',
      'Markdown, Agent Skills',
      'active',
      'README.md, skills/**/SKILL.md, skills.zh/**/SKILL.md',
      'scripts/verify.py when editing skills; scripts/verify_i18n.py --all --json when editing localized mirrors',
      '工作区智能体与技能维护者使用的共享技能库。',
    ], updated)
    if (axiSkillsProject) {
      const axiSkillsRootDocuments = await buildWorkspaceProjectRootDocuments(source, axiSkillsProject)
      documents.push(...(axiSkillsRootDocuments.length > 0
        ? axiSkillsRootDocuments
        : buildWorkspaceProjectDocuments(source, [
          'Axi Skills',
          axiSkillsPath,
          'Axi 智能体共享技能树，用于沉淀可版本化、可复用的智能体技能入口。',
          'Markdown, Agent Skills',
          'active',
          'README.md, skills/**/SKILL.md, skills.zh/**/SKILL.md',
          'scripts/verify.py when editing skills; scripts/verify_i18n.py --all --json when editing localized mirrors',
          '工作区智能体与技能维护者使用的共享技能库。',
        ], updated)))
    }
  }

  // --- Root workspace-level documents (WRK-DOCS-001) ---
  // Ingest root AGENTS.md, docs/DEV_SERVICES.md, and selected docs/axi/* files
  // so they appear in the workspace bundle alongside project index pages.
  await addRootWorkspaceDoc(workspaceRoot, 'AGENTS.md', 'docs/AGENTS.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/DEV_SERVICES.md', 'docs/DEV_SERVICES.md', documents)

  // Selected docs/axi/ files: AGENTS.md, naming contract, ADR index, and contracts
  const axiDocsRoot = path.join(workspaceRoot, 'docs', 'axi')
  const axiRootFiles = ['AGENTS.md', 'AXIOMATICWORLD_NAMING.md', 'CHANGE.md']
  for (const fileName of axiRootFiles) {
    await addRootWorkspaceDoc(axiDocsRoot, fileName, `docs/axi/${fileName}`, documents)
  }
  await addRootWorkspaceDoc(path.join(axiDocsRoot, 'adr'), 'README.md', 'docs/axi/adr/README.md', documents)
  const contractsDir = path.join(axiDocsRoot, 'contracts')
  const contractFiles = ['AXI_ACCOUNTS_SHARED_SCHEMA.md']
  for (const fileName of contractFiles) {
    await addRootWorkspaceDoc(contractsDir, fileName, `docs/axi/contracts/${fileName}`, documents)
  }

  return documents.sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
}

async function addRootWorkspaceDoc(
  rootDir: string,
  fileName: string,
  bundlePath: string,
  documents: ParsedDocument[],
): Promise<void> {
  const fullPath = path.join(rootDir, fileName)
  if (!fs.existsSync(fullPath)) return
  const stat = await fs.promises.stat(fullPath)
  if (!stat.isFile()) return
  const raw = await fs.promises.readFile(fullPath, 'utf-8')
  const parsed = parseMarkdownDocument(raw)
  const frontmatter = parsed.data as Frontmatter
  const body = parsed.content
  const updated = resolveLastUpdated(fullPath, stat, frontmatter)
  const rawTitle = extractRawTitle(frontmatter, body, fileName.replace(/\.md$/i, ''))
  const description = extractDescription(frontmatter, body)
  documents.push(createVirtualParsedDocument({
    sourceId: 'workspace',
    path: bundlePath,
    name: fileName.replace(/\.md$/i, ''),
    title: rawTitle,
    rawTitle,
    description: description || `Root workspace document: ${bundlePath}`,
    docType: typeof frontmatter.type === 'string' ? frontmatter.type : 'guide',
    status: typeof frontmatter.status === 'string' ? frontmatter.status : 'active',
    tags: ['workspace-root', 'operator-docs', ...normalizeStringArray(frontmatter.tags)],
    categories: ['standards'],
    updated,
    raw,
    body,
    frontmatter: {
      ...frontmatter,
      id: `workspace-root-${bundlePath.replace(/[^a-z0-9]+/gi, '-')}`,
      title: rawTitle,
      type: typeof frontmatter.type === 'string' ? frontmatter.type : 'guide',
      status: typeof frontmatter.status === 'string' ? frontmatter.status : 'active',
      modified: updated,
      'graph-title': rawTitle,
      'graph-tags': ['workspace-root'],
    },
    aliases: [rawTitle, bundlePath],
    sourceTags: ['workspace-root', 'operator-docs'],
  }))
}

async function collectLocalMarkdownFiles(sourceRoot: string): Promise<LocalFileEntry[]> {
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

function buildLocalSourceIndex(
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
  }
}

function buildVirtualSourceIndex(source: DocSource, rootPath: string, documents: ParsedDocument[]): LocalSourceIndex {
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

async function getSpecializedSourceIndex(source: DocSource): Promise<LocalSourceIndex | null> {
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

async function getLocalSourceIndex(source: DocSource): Promise<LocalSourceIndex> {
  const specializedIndex = await getSpecializedSourceIndex(source)
  if (specializedIndex) return specializedIndex

  const rootPath = path.normalize(source.path)
  const cachedIndex = localSourceIndexCache.get(source.id)
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

function invalidateLocalSourceIndex(sourceId: string, relativePath?: string): void {
  if (!relativePath) {
    localSourceIndexCache.delete(sourceId)
    return
  }

  const cachedIndex = localSourceIndexCache.get(sourceId)
  if (!cachedIndex) return
  cachedIndex.files.delete(normalizeSlashes(relativePath))
}

export function __clearKnowledgeBaseCacheForTests(): void {
  localSourceIndexCache.clear()
  gitRootCache.clear()
  gitUpdatedCache.clear()
}

export async function getWorkspaceStatus() {
  const catalog = await getKnowledgeCatalog('workspace')
  return {
    sourceId: 'workspace',
    totalProjects: catalog.sections
      .flatMap((section) => section.items)
      .filter((item) => item.docType === 'project').length,
    totalDocs: catalog.totalDocs,
    generatedAt: catalog.generatedAt,
    recentProjects: catalog.recentDocs.filter((item) => item.docType === 'project').slice(0, 8),
    sections: catalog.sections.map((section) => ({
      key: section.key,
      title: section.title,
      count: section.count,
    })),
  }
}

export type HandoffReadiness = 'verified' | 'documented' | 'stale' | 'unready' | 'unknown'

export type ProjectHandoffCard = {
  state: 'ok' | 'stale' | 'missing'
  readiness: HandoffReadiness
  score: number
  readOrder: string[]
  entrypoints: Array<{ id: string; path: string; purpose: string }>
  smokeCommand: string | null
  verifyCommand: string | null
  currentWork: { active: string[]; knownFailures: string[] }
  lastVerifiedAt: string | null
  ageDays: number | null
  handoffPath: string | null
  manifestPath: string | null
  handoffSource: 'handoff' | 'none'
  handoffGeneratedAt: string | null
}

export type ProjectSummary = KnowledgeCatalogItem & { handoff: ProjectHandoffCard }

const HANDOFF_STALE_DAYS = 14

function normalizeReadiness(value: unknown): HandoffReadiness {
  if (typeof value !== 'string') return 'unknown'
  const v = value.trim().toLowerCase()
  if (v === 'verified' || v === 'documented' || v === 'stale' || v === 'unready') {
    return v
  }
  return 'unknown'
}

function computeAgeDays(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return Math.max(0, (now.getTime() - parsed) / (1000 * 60 * 60 * 24))
}

export async function getProjectHandoffCard(
  projectId: string,
  options: { now?: Date; handoffPath?: string } = {},
): Promise<ProjectHandoffCard> {
  const now = options.now || new Date()
  // Default: read from the same path the build script reads. Tests can
  // override `handoffPath` to point at a temp fixture.
  const targetPath = options.handoffPath
    || path.join('/Volumes/code/workspace', '.workspace', 'project-handoff.json')
  const emptyCard: ProjectHandoffCard = {
    state: 'missing',
    readiness: 'unknown',
    score: 0,
    readOrder: [],
    entrypoints: [],
    smokeCommand: null,
    verifyCommand: null,
    currentWork: { active: [], knownFailures: [] },
    lastVerifiedAt: null,
    ageDays: null,
    handoffPath: null,
    manifestPath: null,
    handoffSource: 'none',
    handoffGeneratedAt: null,
  }
  let raw: string
  try {
    raw = await fs.promises.readFile(targetPath, 'utf-8')
  } catch {
    return emptyCard
  }
  let snapshot: { projects?: HandoffProject[]; generatedAt?: string }
  try {
    snapshot = JSON.parse(raw)
  } catch {
    return emptyCard
  }
  if (!Array.isArray(snapshot.projects)) return emptyCard
  const generatedAt = typeof snapshot.generatedAt === 'string' ? snapshot.generatedAt : null
  const normalized = projectId.trim().toLowerCase()
  const hit = snapshot.projects.find((p) => typeof p.id === 'string' && p.id.toLowerCase() === normalized)
  if (!hit) {
    return {
      ...emptyCard,
      handoffSource: 'handoff',
      handoffGeneratedAt: generatedAt,
      ageDays: computeAgeDays(generatedAt, now),
    }
  }
  const lastVerifiedAt = typeof hit.lastVerifiedAt === 'string' ? hit.lastVerifiedAt : null
  const ageDays = computeAgeDays(lastVerifiedAt || generatedAt, now)
  const staleThreshold = HANDOFF_STALE_DAYS
  const commands = (hit.commands || {}) as { verify?: string[]; smoke?: string[] }
  const currentWork = (hit.currentWork || {}) as { active?: string | string[]; knownFailures?: string[] }
  const activeList = Array.isArray(currentWork.active)
    ? currentWork.active
    : typeof currentWork.active === 'string'
      ? [currentWork.active]
      : []
  return {
    state: typeof ageDays === 'number' && ageDays > staleThreshold ? 'stale' : 'ok',
    readiness: normalizeReadiness(hit.readiness),
    score: typeof hit.score === 'number' ? hit.score : 0,
    readOrder: Array.isArray(hit.readOrder) ? hit.readOrder.filter((s): s is string => typeof s === 'string') : [],
    entrypoints: Array.isArray(hit.entrypoints)
      ? hit.entrypoints
          .filter((e) => e && typeof e === 'object')
          .map((e) => ({
            id: typeof e.id === 'string' ? e.id : '',
            path: typeof e.path === 'string' ? e.path : '',
            purpose: typeof e.purpose === 'string' ? e.purpose : '',
          }))
      : [],
    smokeCommand: Array.isArray(commands.smoke) && commands.smoke.length > 0
      ? commands.smoke[0]
      : null,
    verifyCommand: Array.isArray(commands.verify) && commands.verify.length > 0
      ? commands.verify[0]
      : null,
    currentWork: {
      active: activeList.filter((s): s is string => typeof s === 'string'),
      knownFailures: Array.isArray(currentWork.knownFailures)
        ? currentWork.knownFailures.filter((s): s is string => typeof s === 'string')
        : [],
    },
    lastVerifiedAt,
    ageDays,
    handoffPath: typeof hit.handoffPath === 'string' ? hit.handoffPath : null,
    manifestPath: typeof hit.manifestPath === 'string' ? hit.manifestPath : null,
    handoffSource: 'handoff',
    handoffGeneratedAt: generatedAt,
  }
}

export async function getHandoffSnapshotStatus(options: { now?: Date; handoffPath?: string } = {}): Promise<{
  source: 'handoff' | 'none'
  generatedAt: string | null
  ageDays: number | null
}> {
  const card = await getProjectHandoffCard('__status__', options)
  return {
    source: card.handoffSource,
    generatedAt: card.handoffGeneratedAt,
    ageDays: card.ageDays,
  }
}

export async function getProjectSummary(projectId: string): Promise<ProjectSummary | null> {
  const normalized = projectId.trim().toLowerCase()
  const catalog = await getKnowledgeCatalog('workspace')
  const items = catalog.sections.flatMap((section) => section.items)
  const catalogItem = items.find((item) => (
    item.docType === 'project'
    && (
      item.name.toLowerCase() === normalized
      || item.title.toLowerCase() === normalized
      || item.path.toLowerCase().includes(normalized)
      || item.description?.toLowerCase().includes(normalized)
    )
  )) || null
  // If the catalog hit is on a project's overview item, projectId for
  // handoff lookup is the catalog item's `projectId` if set, otherwise the
  // item's `name`. This keeps the join stable across handoff versions.
  const handoffLookupId = catalogItem?.projectId || catalogItem?.name || projectId
  const handoff = await getProjectHandoffCard(handoffLookupId)
  if (!catalogItem) {
    // The catalog may not have the project (e.g. hand-curated addenda),
    // but handoff might. Return a stub item so MCP can still surface the
    // handoff fields.
    if (handoff.state === 'missing' && handoff.handoffSource === 'none') {
      return null
    }
    return {
      sourceId: 'workspace',
      path: `projects/${handoffLookupId}/README.md`,
      name: handoffLookupId,
      title: handoffLookupId,
      tags: [],
      categories: ['projects'],
      techStack: [],
      handoff,
    } as ProjectSummary
  }
  return { ...catalogItem, handoff }
}

function createSnippet(body: string, query: string): string {
  if (!body.trim()) return ''
  const normalizedBody = body.replace(/\s+/g, ' ')
  const lowerBody = normalizedBody.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerBody.indexOf(lowerQuery)
  if (index === -1) return normalizedBody.slice(0, 160)
  const start = Math.max(0, index - 70)
  const end = Math.min(normalizedBody.length, index + query.length + 110)
  return `${start > 0 ? '…' : ''}${normalizedBody.slice(start, end)}${end < normalizedBody.length ? '…' : ''}`
}

function toKnowledgeCatalogItem(document: ParsedDocument): KnowledgeCatalogItem {
  return {
    sourceId: document.sourceId,
    path: document.path,
    name: document.name,
    title: document.title,
    rawTitle: document.rawTitle,
    description: document.description,
    docType: document.docType,
    status: document.status,
    tags: [...document.tags],
    rawTags: [...(document.rawTags || [])],
    categories: [...document.categories],
    techStack: [...document.techStack],
    updated: document.updated,
    graphTitle: document.graphTitle,
    projectId: document.projectId,
    projectTitle: document.projectTitle,
    documentTypeKey: document.documentTypeKey,
  }
}

function sanitizeStaticFrontmatter(source: DocSource, document: ParsedDocument): Frontmatter {
  if (source.adapter !== 'skills') return document.frontmatter

  return {
    id: typeof document.frontmatter.id === 'string' ? document.frontmatter.id : `${source.id}:${document.name}`,
    title: document.title,
    type: document.docType || 'skill',
    status: document.status || 'active',
    tags: document.tags,
    modified: document.updated,
    description: truncateText(document.description),
    sourcePath: document.path,
    'graph-title': document.graphTitle || document.title,
    'graph-tags': ['技能', 'Agent'],
  }
}

function buildFileItemFrontmatter(source: DocSource, document: ParsedDocument): Frontmatter {
  if (source.adapter === 'skills') return sanitizeStaticFrontmatter(source, document)
  return document.frontmatter
}

function matchesQuery(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase()
  return tokens.every((token) => lower.includes(token))
}

async function blinkoRequest<T>(source: DocSource, urlPath: string, method: string, body?: unknown): Promise<T> {
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

type BlinkoNote = {
  id: number
  content: string
  type: 0 | 1
  tags?: string[]
  createdAt: string
  updatedAt: string
}

async function listBlinkoNotes(source: DocSource): Promise<BlinkoNote[]> {
  const result = await blinkoRequest<BlinkoNote[] | { message?: string }>(
    source,
    '/api/v1/note/list',
    'POST',
    { page: 1, size: 200, orderBy: 'desc', type: -1, isRecycle: false },
  )
  return Array.isArray(result) ? result : []
}

export async function scanKnowledgeSource(sourceId: string, dirPath?: string, filterTag?: string | null) {
  const source = getSource(sourceId)
  if (!source) return []

  if (source.type === 'api') {
    const notes = await listBlinkoNotes(source)
    return notes
      .filter((note) => !filterTag || (note.tags || []).includes(filterTag))
      .map((note) => ({
        id: `${source.id}:${note.id}`,
        name: note.content.split('\n')[0].slice(0, 60) || `Blinko #${note.id}`,
        path: String(note.id),
        relativePath: String(note.id),
        type: 'file' as const,
        extension: '.md',
        lastModified: note.updatedAt || note.createdAt,
        sourceId: source.id,
        tags: note.tags || [],
        blinkoData: note,
      }))
  }

  if (source.adapter === 'skills' || source.adapter === 'workspace') {
    const directoryIndex = await getKnowledgeDirectoryIndex(source.id)
    const directoryKey = (dirPath || '').replace(/^\/+|\/+$/g, '')
    const entries = directoryIndex[directoryKey] || []
    if (!filterTag) return entries
    return entries.filter((entry) => entry.type === 'directory' || entry.tags?.includes(filterTag))
  }

  const basePath = resolveLocalPath(source, dirPath || '')
  if (!basePath || !fs.existsSync(basePath)) return []

  const index = await getLocalSourceIndex(source)

  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(basePath, { withFileTypes: true })
  } catch {
    return []
  }

  const items = await Promise.all(entries.map(async (entry) => {
    if (isExcludedName(entry.name)) return null
    const fullPath = path.join(basePath, entry.name)
    const relativePath = normalizeSlashes(dirPath ? path.join(dirPath, entry.name) : entry.name)
    const stat = await fs.promises.stat(fullPath)

    if (entry.isDirectory()) {
      return {
        id: `${source.id}:${relativePath}`,
        name: entry.name,
        path: fullPath,
        relativePath,
        type: 'directory' as const,
        extension: '',
        lastModified: stat.mtime.toISOString(),
        sourceId: source.id,
      }
    }

    if (!entry.isFile() || !isSupportedFile(entry.name)) return null
    const parsed = index.byPath.get(relativePath)
    if (!parsed) return null
    if (filterTag && !parsed.tags.includes(filterTag)) return null
    return {
      id: `${source.id}:${relativePath}`,
      name: entry.name,
      path: fullPath,
      relativePath,
      type: 'file' as const,
      extension: path.extname(entry.name),
      lastModified: parsed.updated || stat.mtime.toISOString(),
      sourceId: source.id,
      tags: parsed.tags,
      rawTags: parsed.rawTags,
      graphTitle: parsed.graphTitle,
      frontmatter: parsed.frontmatter,
    }
  }))

  return items
    .filter(Boolean)
    .sort((left, right) => {
      if (left!.type !== right!.type) return left!.type === 'directory' ? -1 : 1
      return left!.name.localeCompare(right!.name, 'zh-CN')
    })
}

export async function readKnowledgeFile(sourceId: string, filePath: string): Promise<string | null> {
  const source = getSource(sourceId)
  if (!source) return null

  if (source.type === 'api') {
    if (!filePath) return null
    const detail = await blinkoRequest<{ content?: string; contentText?: string }>(
      source,
      '/api/v1/note/detail',
      'POST',
      { id: Number(filePath) },
    )
    return detail.content || detail.contentText || null
  }

  if (source.adapter === 'skills' || source.adapter === 'workspace') {
    const index = await getLocalSourceIndex(source)
    return index.byPath.get(normalizeSlashes(filePath))?.raw || null
  }

  const fullPath = resolveLocalPath(source, filePath)
  if (!fullPath || !fs.existsSync(fullPath) || !isSupportedFile(fullPath)) return null
  try {
    const index = await getLocalSourceIndex(source)
    if (!index.byPath.has(normalizeSlashes(filePath))) return null
    return await fs.promises.readFile(fullPath, 'utf-8')
  } catch {
    return null
  }
}

export async function writeKnowledgeFile(sourceId: string, filePath: string, content: string) {
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

export async function getKnowledgeTags(sourceId: string): Promise<Array<{ name: string; count: number }>> {
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

export async function searchKnowledge(sourceId: string, query: string, filterTag?: string | null): Promise<SearchResult[]> {
  const source = getSource(sourceId)
  const normalizedQuery = query.trim().toLowerCase()
  if (!source || !normalizedQuery) return []

  if (source.type === 'api') {
    const notes = await listBlinkoNotes(source)
    return notes
      .filter((note) => note.content.toLowerCase().includes(normalizedQuery))
      .filter((note) => !filterTag || (note.tags || []).includes(filterTag))
      .slice(0, 30)
      .map((note) => ({
        sourceId: source.id,
        path: String(note.id),
        name: note.content.split('\n')[0].slice(0, 60) || `Blinko #${note.id}`,
        title: note.content.split('\n')[0].slice(0, 60) || `Blinko #${note.id}`,
        type: 'blinko',
        snippet: createSnippet(note.content, query),
        matches: [],
        score: 10,
        tags: note.tags || [],
        docType: note.type === 0 ? 'flash-note' : 'note',
        categories: ['resources'],
        matchedBy: ['content'],
      }))
  }

  const index = await getLocalSourceIndex(source)
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean).slice(0, 8)
  const results: SearchResult[] = []

  for (const document of index.documents) {
    if (filterTag && !document.tags.includes(filterTag)) continue

    const matchedBy: string[] = []
    let score = 0
    const pathLower = document.path.toLowerCase()
    const titleLower = document.title.toLowerCase()
    const rawTitleLower = (document.rawTitle || '').toLowerCase()
    const descriptionLower = (document.description || '').toLowerCase()
    const bodyLower = document.body.toLowerCase()

    if (matchesQuery(titleLower, queryTokens)) {
      matchedBy.push('title')
      score += 20
    }
    if (rawTitleLower && matchesQuery(rawTitleLower, queryTokens)) {
      matchedBy.push('raw-title')
      score += 10
    }
    if (matchesQuery(pathLower, queryTokens)) {
      matchedBy.push('path')
      score += 12
    }
    if (document.tags.some((tag) => matchesQuery(tag.toLowerCase(), queryTokens))) {
      matchedBy.push('tags')
      score += 10
    }
    if (document.sourceTags.some((tag) => matchesQuery(tag.toLowerCase(), queryTokens))) {
      matchedBy.push('raw-tags')
      score += 8
    }
    if (document.aliases.some((alias) => matchesQuery(alias.toLowerCase(), queryTokens))) {
      matchedBy.push('aliases')
      score += 8
    }
    if (document.categories.some((category) => getKnowledgeCategoryQueryHints(category).some((hint) => normalizedQuery.includes(hint.toLowerCase())))) {
      matchedBy.push('category')
      score += 9
    }
    if (matchesQuery(descriptionLower, queryTokens)) {
      matchedBy.push('description')
      score += 5
    }
    if (matchesQuery(bodyLower, queryTokens)) {
      matchedBy.push('content')
      score += 6
    }

    if (matchedBy.length === 0) continue

    const contentFrequency = bodyLower.split(normalizedQuery).length - 1
    score += Math.min(contentFrequency, 8)

    results.push({
      sourceId: source.id,
      path: document.path,
      name: document.name,
      title: document.title,
      rawTitle: document.rawTitle,
      description: document.description,
      type: 'file',
      snippet: createSnippet(document.body, query),
      matches: [],
      score,
      tags: document.tags,
      rawTags: document.sourceTags,
      docType: document.docType,
      categories: document.categories,
      matchedBy,
    })
  }

  return results.sort((left, right) => right.score - left.score).slice(0, 30)
}

export async function searchKnowledgeAll(query: string, filterTag?: string | null): Promise<SearchResult[]> {
  const sources = listKnowledgeSources()
  const results = await Promise.all(sources.map(async (source) => {
    try {
      return await searchKnowledge(source.id, query, filterTag)
    } catch {
      return []
    }
  }))
  return results
    .flat()
    .sort((left, right) => right.score - left.score)
    .slice(0, 60)
}

function sortCatalogItems(items: KnowledgeCatalogItem[]): KnowledgeCatalogItem[] {
  return [...items].sort((left, right) => {
    const leftDate = Date.parse(left.updated || '')
    const rightDate = Date.parse(right.updated || '')
    if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate) && rightDate !== leftDate) {
      return rightDate - leftDate
    }
    return left.title.localeCompare(right.title, 'zh-CN')
  })
}

function buildFallbackSkillFamily(document: ParsedDocument, source?: DocSource): SkillFamilyDefinition {
  if (source?.organizationHint === 'skill-families') {
    return {
      key: 'skills-other',
      title: '其他专业技能',
      description: '未命中核心能力组的专业技能，保留完整入口并按名称排序。',
      match: ['other'],
    }
  }

  const skillKey = getSkillKey(document)
  const namespace = skillKey.includes(':')
    ? skillKey.split(':')[0]
    : skillKey.split('-')[0]
  const title = namespace ? `${namespace} 其他技能` : '其他技能'

  return {
    key: `skills-${namespace || 'other'}`,
    title,
    description: `${title}，按 skill 名称前缀自动归组。`,
    match: [namespace || 'other'],
  }
}

function buildSkillCatalogSections(source: DocSource, documents: ParsedDocument[]): KnowledgeCatalog['sections'] {
  const skillDocs = documents.filter((document) => document.docType === 'skill')
  const supportDocs = documents.filter((document) => document.docType !== 'skill')
  const definitions = source.organizationHint === 'dbskill' ? DB_SKILL_FAMILIES : AXI_SKILL_FAMILIES
  const grouped = new Map<string, { definition: SkillFamilyDefinition, items: KnowledgeCatalogItem[] }>()

  for (const document of skillDocs) {
    const definition = getSkillFamily(document, definitions) || buildFallbackSkillFamily(document, source)
    if (!grouped.has(definition.key)) {
      grouped.set(definition.key, { definition, items: [] })
    }
    grouped.get(definition.key)!.items.push(toKnowledgeCatalogItem(document))
  }

  const orderedKeys = definitions.map((definition) => definition.key)
  const sections = [...grouped.values()]
    .sort((left, right) => {
      const leftOrder = orderedKeys.indexOf(left.definition.key)
      const rightOrder = orderedKeys.indexOf(right.definition.key)
      if (leftOrder !== -1 || rightOrder !== -1) {
        if (leftOrder === -1) return 1
        if (rightOrder === -1) return -1
        return leftOrder - rightOrder
      }
      if (right.items.length !== left.items.length) return right.items.length - left.items.length
      return left.definition.title.localeCompare(right.definition.title, 'zh-CN')
    })
    .map(({ definition, items }) => {
      const sortedItems = sortCatalogItems(items)
      return {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        count: items.length,
        items: sortedItems,
        subsections: source.organizationHint === 'skill-families'
          ? buildSkillCatalogSubsections(definition.key, sortedItems)
          : undefined,
      }
    })

  if (supportDocs.length > 0) {
    sections.unshift({
      key: 'skill-support-docs',
      title: source.organizationHint === 'dbskill' ? 'dbskill 知识包与模板' : '技能库附属文档',
      description: 'README、知识包、模板、脚手架和其他可复用支持文档。',
      count: supportDocs.length,
      items: sortCatalogItems(supportDocs.map(toKnowledgeCatalogItem)),
      subsections: undefined,
    })
  }

  return sections
}

function compareWorkspaceProjectItems(left: KnowledgeCatalogItem, right: KnowledgeCatalogItem): number {
  const projectOrder = (left.projectTitle || left.title).localeCompare(right.projectTitle || right.title, 'zh-CN')
  if (projectOrder !== 0) return projectOrder
  const leftTypeOrder = WORKSPACE_DOCUMENT_TYPE_ORDER.indexOf(left.documentTypeKey || '')
  const rightTypeOrder = WORKSPACE_DOCUMENT_TYPE_ORDER.indexOf(right.documentTypeKey || '')
  if (leftTypeOrder !== -1 || rightTypeOrder !== -1) {
    if (leftTypeOrder === -1) return 1
    if (rightTypeOrder === -1) return -1
    return leftTypeOrder - rightTypeOrder
  }
  return left.title.localeCompare(right.title, 'zh-CN')
}

function buildWorkspaceCatalogSubsections(items: KnowledgeCatalogItem[]): KnowledgeCatalog['sections'][number]['subsections'] {
  const grouped = new Map<string, { title: string, items: KnowledgeCatalogItem[] }>()

  for (const item of items) {
    const key = item.projectId || item.path.split('/')[1] || item.name
    const title = item.projectTitle || key
    if (!grouped.has(key)) {
      grouped.set(key, { title, items: [] })
    }
    grouped.get(key)!.items.push(item)
  }

  return [...grouped.entries()]
    .sort((left, right) => left[1].title.localeCompare(right[1].title, 'zh-CN'))
    .map(([key, group]) => ({
      key,
      title: group.title,
      description: `${group.title} 的项目文档。`,
      count: group.items.length,
      items: [...group.items].sort(compareWorkspaceProjectItems),
    }))
}

function buildWorkspaceCatalogSections(documents: ParsedDocument[]): KnowledgeCatalog['sections'] {
  const items = documents.map(toKnowledgeCatalogItem)
  const sections = WORKSPACE_DOCUMENT_TYPE_DEFINITIONS
    .map((definition) => {
      const sectionItems = items
        .filter((item) => item.documentTypeKey === definition.key)
        .sort(compareWorkspaceProjectItems)
      if (sectionItems.length === 0) return null
      return {
        key: `workspace-${definition.key}`,
        title: definition.title,
        description: definition.description,
        count: sectionItems.length,
        items: sectionItems,
        subsections: buildWorkspaceCatalogSubsections(sectionItems),
      }
    })
    .filter(Boolean) as KnowledgeCatalog['sections']

  const workspaceIndexes = items
    .filter((item) => !item.documentTypeKey)
    .sort(compareWorkspaceProjectItems)
  if (workspaceIndexes.length > 0) {
    sections.push({
      key: 'workspace-source-indexes',
      title: '工作区索引',
      description: 'WORKSPACE_INDEX 和治理目录等工作区级入口。',
      count: workspaceIndexes.length,
      items: workspaceIndexes,
      subsections: undefined,
    })
  }

  return sections
}

export async function getKnowledgeCatalog(sourceId: string): Promise<KnowledgeCatalog> {
  const source = getSource(sourceId)
  if (!source) {
    return {
      sourceId,
      totalDocs: 0,
      totalTags: 0,
      generatedAt: new Date().toISOString(),
      topTags: [],
      recentDocs: [],
      sections: [],
    }
  }

  if (source.type === 'api') {
    const notes = await listBlinkoNotes(source)
    const items: KnowledgeCatalogItem[] = notes.map((note) => ({
      sourceId: source.id,
      path: String(note.id),
      name: `Blinko #${note.id}`,
      title: note.content.split('\n')[0].slice(0, 60) || `Blinko #${note.id}`,
      description: note.content.replace(/\s+/g, ' ').slice(0, 120),
      docType: note.type === 0 ? 'flash-note' : 'note',
      tags: note.tags || [],
      categories: ['resources'],
      techStack: [],
      updated: note.updatedAt || note.createdAt,
    }))
    return {
      sourceId: source.id,
      totalDocs: items.length,
      totalTags: new Set(items.flatMap((item) => item.tags)).size,
      generatedAt: new Date().toISOString(),
      topTags: await getKnowledgeTags(source.id),
      recentDocs: sortCatalogItems(items).slice(0, 8),
      sections: [
        {
          key: 'resources',
          title: 'Blinko 快速记录',
          description: '近期闪念和碎片内容，适合先做模糊回忆检索。',
          count: items.length,
          items: sortCatalogItems(items),
        },
      ],
    }
  }

  const index = await getLocalSourceIndex(source)
  const sections = source.kind === 'skill-library'
    ? buildSkillCatalogSections(source, index.documents)
    : source.kind === 'workspace-registry'
      ? buildWorkspaceCatalogSections(index.documents)
      : KNOWLEDGE_CATEGORY_ORDER
      .map((key) => {
        const items = sortCatalogItems(index.documents
          .filter((document) => document.categories.includes(key))
          .map(toKnowledgeCatalogItem))
        if (items.length === 0) return null
        const meta = getKnowledgeCategoryMeta(key)
        return {
          key,
          title: meta.title,
          description: meta.description,
          count: items.length,
          items,
        }
      })
      .filter(Boolean) as KnowledgeCatalog['sections']

  return {
    sourceId: source.id,
    totalDocs: index.documents.length,
    totalTags: index.tags.length,
    generatedAt: index.builtAt,
    topTags: index.tags.slice(0, 20),
    recentDocs: sortCatalogItems(index.documents.map(toKnowledgeCatalogItem)).slice(0, 8),
    sections,
  }
}

export async function getKnowledgeDocuments(sourceId: string): Promise<StaticKnowledgeDocument[]> {
  const source = getSource(sourceId)
  if (!source || source.type !== 'local') return []

  const index = await getLocalSourceIndex(source)
  return index.documents.map((document) => ({
    sourceId: document.sourceId,
    path: document.path,
    name: document.name,
    title: document.title,
    rawTitle: document.rawTitle,
    description: document.description,
    docType: document.docType,
    status: document.status,
    tags: [...document.tags],
    rawTags: [...document.sourceTags],
    categories: [...document.categories],
    techStack: [...document.techStack],
    updated: document.updated,
    graphTitle: document.graphTitle,
    content: createStaticDocumentContent(source, document),
    frontmatter: sanitizeStaticFrontmatter(source, document),
    aliases: [...document.aliases],
    sourceTags: [...document.sourceTags],
  }))
}

function createStaticDocumentContent(source: DocSource, document: ParsedDocument): string {
  if (source.adapter !== 'skills') return document.raw

  const body = document.body.trim() || document.description || 'No skill body available.'
  return buildFrontmatter({
    id: document.frontmatter.id || `${source.id}:${document.name}`,
    title: document.title,
    type: document.docType || 'skill',
    status: document.status || 'active',
    tags: document.tags,
    modified: document.updated,
    description: truncateText(document.description),
    sourcePath: document.path,
    'graph-title': document.graphTitle || document.title,
    'graph-tags': ['技能', 'Agent'],
  }) + body
}

export async function getKnowledgeDirectoryIndex(sourceId: string): Promise<Record<string, FileItem[]>> {
  const source = getSource(sourceId)
  if (!source || source.type !== 'local') return {}

  const index = await getLocalSourceIndex(source)
  const directoryChildren = new Map<string, FileItem[]>()
  const knownDirectories = new Set<string>([''])

  const ensureDirectory = (directoryPath: string) => {
    if (!directoryChildren.has(directoryPath)) {
      directoryChildren.set(directoryPath, [])
    }
    knownDirectories.add(directoryPath)
  }

  ensureDirectory('')

  for (const document of index.documents) {
    const segments = document.path.split('/').filter(Boolean)
    let currentDirectory = ''

    for (const [segmentIndex, segment] of segments.slice(0, -1).entries()) {
      const nextDirectory = currentDirectory ? `${currentDirectory}/${segment}` : segment
      ensureDirectory(nextDirectory)

      const parentChildren = directoryChildren.get(currentDirectory) || []
      const directoryId = `${source.id}:${nextDirectory}`
      if (!parentChildren.some((item) => item.id === directoryId)) {
        parentChildren.push({
          id: directoryId,
          name: segment,
          path: nextDirectory,
          relativePath: nextDirectory,
          type: 'directory',
          extension: '',
          lastModified: document.updated || index.builtAt,
          sourceId: source.id,
        })
        directoryChildren.set(currentDirectory, parentChildren)
      }

      currentDirectory = nextDirectory
      if (segmentIndex === segments.length - 2) {
        ensureDirectory(currentDirectory)
      }
    }

    const parentDirectory = segments.slice(0, -1).join('/')
    const parentChildren = directoryChildren.get(parentDirectory) || []
    const fileId = `${source.id}:${document.path}`
    if (!parentChildren.some((item) => item.id === fileId)) {
      parentChildren.push({
        id: fileId,
        name: `${document.name}.md`,
        path: document.path,
        relativePath: document.path,
        type: 'file',
        extension: path.extname(document.path) || '.md',
        lastModified: document.updated || index.builtAt,
        sourceId: source.id,
        tags: [...document.tags],
        rawTags: [...document.sourceTags],
        graphTitle: document.graphTitle,
        frontmatter: buildFileItemFrontmatter(source, document),
      })
      directoryChildren.set(parentDirectory, parentChildren)
    }
  }

  for (const directoryPath of knownDirectories) {
    const sorted = (directoryChildren.get(directoryPath) || [])
      .slice()
      .sort((left, right) => {
        if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
        return left.name.localeCompare(right.name, 'zh-CN')
      })
    directoryChildren.set(directoryPath, sorted)
  }

  return Object.fromEntries(directoryChildren.entries())
}

export function buildFrontmatter(meta: Record<string, unknown>): string {
  if (Object.keys(meta).length === 0) return ''
  const lines = ['---']
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((entry) => String(entry)).join(', ')}]`)
      continue
    }
    lines.push(`${key}: ${String(value)}`)
  }
  lines.push('---', '')
  return lines.join('\n')
}

export async function getKnowledgeGraph(sourceId: string, currentRelativePath: string): Promise<GraphData> {
  const source = getSource(sourceId)
  if (!source || source.type !== 'local') return { nodes: [], edges: [] }
  const index = await getLocalSourceIndex(source)
  const current = index.byPath.get(normalizeSlashes(currentRelativePath))
  if (!current) return { nodes: [], edges: [] }

  const nodes = new Map<string, GraphData['nodes'][number]>()
  const edges: GraphData['edges'] = []

  const addNode = (id: string, label: string, kind: 'current' | 'note' | 'tag') => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, label, kind, x: 0, y: 0, vx: 0, vy: 0 })
    }
  }

  addNode(current.path, current.title, 'current')

  const outgoing = new Set<string>()
  let match: RegExpExecArray | null
  WIKILINK_REGEX.lastIndex = 0
  while ((match = WIKILINK_REGEX.exec(current.body)) !== null) {
    const target = index.byStem.get(match[1].trim().toLowerCase())
    if (!target || target.path === current.path) continue
    outgoing.add(target.path)
    addNode(target.path, target.title, 'note')
    edges.push({ source: current.path, target: target.path, kind: 'wikilink' })
  }

  for (const tag of current.tags) {
    const tagId = `#${tag}`
    addNode(tagId, tag, 'tag')
    edges.push({ source: current.path, target: tagId, kind: 'tag' })
  }

  for (const document of index.documents) {
    if (document.path === current.path || outgoing.has(document.path)) continue
    WIKILINK_REGEX.lastIndex = 0
    while ((match = WIKILINK_REGEX.exec(document.body)) !== null) {
      const target = index.byStem.get(match[1].trim().toLowerCase())
      if (target?.path === current.path) {
        addNode(document.path, document.title, 'note')
        edges.push({ source: document.path, target: current.path, kind: 'wikilink' })
        break
      }
    }
  }

  return { nodes: [...nodes.values()], edges }
}

export async function getGlobalKnowledgeGraph(sourceId: string): Promise<{
  nodes: Array<{ id: string; label: string; kind: 'note' | 'tag'; path?: string; tags?: string[] }>
  edges: Array<{ source: string; target: string; kind: 'wikilink' | 'tag' }>
  orphanNodes: Array<{ id: string; label: string; kind: 'note'; path?: string; tags?: string[] }>
}> {
  const source = getSource(sourceId)
  if (!source || source.type !== 'local') return { nodes: [], edges: [], orphanNodes: [] }

  const index = await getLocalSourceIndex(source)
  const edges: Array<{ source: string; target: string; kind: 'wikilink' | 'tag' }> = []
  const connected = new Set<string>()
  const tagCounts = new Map<string, number>()

  for (const document of index.documents) {
    WIKILINK_REGEX.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = WIKILINK_REGEX.exec(document.body)) !== null) {
      const target = index.byStem.get(match[1].trim().toLowerCase())
      if (!target || target.path === document.path) continue
      edges.push({ source: document.path, target: target.path, kind: 'wikilink' })
      connected.add(document.path)
      connected.add(target.path)
    }

    for (const tag of document.tags) {
      const tagId = `#${tag}`
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      edges.push({ source: document.path, target: tagId, kind: 'tag' })
      connected.add(document.path)
    }
  }

  const nodes: Array<{ id: string; label: string; kind: 'note' | 'tag'; path?: string; tags?: string[] }> = index.documents
    .filter((document) => connected.has(document.path))
    .map((document) => ({
      id: document.path,
      label: document.title,
      kind: 'note' as const,
      path: document.path,
      tags: document.tags,
    }))

  const orphanNodes = index.documents
    .filter((document) => !connected.has(document.path))
    .map((document) => ({
      id: document.path,
      label: document.title,
      kind: 'note' as const,
      path: document.path,
      tags: document.tags,
    }))

  for (const [tag, count] of tagCounts.entries()) {
    if (count < 2) continue
    nodes.push({ id: `#${tag}`, label: tag, kind: 'tag', tags: [] })
  }

  return { nodes, edges, orphanNodes }
}
