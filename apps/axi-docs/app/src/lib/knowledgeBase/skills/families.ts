/**
 * Skill family taxonomy + family-resolution helpers.
 *
 * Holds the (large) static definitions for `DB_SKILL_FAMILIES` and
 * `AXI_SKILL_FAMILIES` plus `getSkillFamily` (which matches a document into a
 * family) and `buildFallbackSkillFamily` (used when no definition matches).
 *
 * Note: the `match` arrays below are byte-exact copies of the monolithic
 * skills.ts — modifying them risks content-engine mis-classification (see
 * arch-fix-6 lessons learned).
 */

import type { DocSource } from '../../../types'
import type {
  ParsedDocument,
  SkillFamilyDefinition,
} from '../types'
import {
  getSkillKey,
  normalizeSkillToken,
  tokenizeSkillKey,
} from '../utils'

// ---------------------------------------------------------------------------
// Skill family definitions (byte-exact; do not edit lightly)
// ---------------------------------------------------------------------------

export const DB_SKILL_FAMILIES: SkillFamilyDefinition[] = [
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
    description: 'Agent 工作台迁移和跨主机一致性整理。',
    match: ['dbs-agent-migration'],
  },
]

export const AXI_SKILL_FAMILIES: SkillFamilyDefinition[] = [
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

// ---------------------------------------------------------------------------
// Family matching / fallback
// ---------------------------------------------------------------------------

export function getSkillFamily(
  document: ParsedDocument,
  definitions: SkillFamilyDefinition[],
): SkillFamilyDefinition | null {
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

export function buildFallbackSkillFamily(document: ParsedDocument, source?: DocSource): SkillFamilyDefinition {
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