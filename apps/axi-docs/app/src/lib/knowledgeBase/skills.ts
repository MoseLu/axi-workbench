/**
 * Skill family taxonomy + skill catalog/index builders.
 * Holds the (large) static definitions for `DB_SKILL_FAMILIES`,
 * `AXI_SKILL_FAMILIES`, and `AXI_SKILL_SUBSECTIONS` plus the helpers that
 * group skill documents into those families and emit the rendered skill
 * index markdown.
 */

import type { DocSource, Frontmatter, KnowledgeCatalog, KnowledgeCatalogItem } from '../../types'
import type { ParsedDocument, SkillFamilyDefinition, SkillSubsectionDefinition } from './types'
import fs from 'fs'
import path from 'path'
import {
  extractDescription,
  extractRawTitle,
  normalizeSlashes,
  normalizeSkillToken,
  parseMarkdownDocument,
  resolveLastUpdated,
  SKILL_SUBSECTION_THRESHOLD,
  tokenizeSkillKey,
  truncateText,
  getSkillKey,
} from './utils'
import { createVirtualParsedDocument } from './indexer'

// ---------------------------------------------------------------------------
// Skill family definitions
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

export const AXI_SKILL_SUBSECTIONS: Record<string, SkillSubsectionDefinition[]> = {
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
    { key: 'search-source', title: '搜索源接入', description: 'Exa、外部上下文、NotebookLM 和公司知识搜索。', match: ['exa', 'external', 'notebooklm', 'search'] },
    { key: 'knowledge-capture', title: '知识采集', description: 'Notion、Obsidian、Wiki 和知识捕获。', match: ['notion', 'obsidian', 'wiki', 'capture'] },
    { key: 'doc-agent', title: '文档 Agent', description: '软件团队文档 Agent 和本地搜索优先策略。', match: ['doc-agent', 'software-team', 'search-first'] },
  ],
  'business-ops': [
    { key: 'project-backlog', title: '项目与 Backlog', description: 'Backlog、看板项目流和规格落地。', match: ['backlog', 'kanban', 'project', 'spec', 'linear', 'notion'] },
    { key: 'operations-supply', title: '供应链与运营', description: '库存、物流、生产排期、逆向物流和能源采购。', match: ['inventory', 'logistics', 'production', 'returns', 'energy', 'carrier'] },
    { key: 'customer-growth', title: '客户与增长', description: '客户账单、线索情报、社交图谱和增长压力测试。', match: ['customer', 'lead', 'social', 'startup'] },
    { key: 'reporting-hotfix', title: '报告与热修', description: '状态报告、会议任务捕获和生产热修。', match: ['report', 'meeting', 'hotfix', 'ielts'] },
  ],
  'games-3d-creative': [
    { key: 'game-frameworks', title: '游戏框架', description: 'Web 游戏、Phaser、Three.js 和 React Three Fiber。', match: ['game', 'phaser', 'three', 'react-three'] },
    { key: 'assets-rendering', title: '资产与渲染', description: '3D 资产，Sprite、Shader、Blender 和 WebGL。', match: ['asset', 'sprite', 'shader', 'blender', 'webgl'] },
    { key: 'creative-coding', title: '创意编码', description: '算法艺术、宠物孵化和游戏 UI。', match: ['algorithmic', 'art', 'hatch', 'ui'] },
  ],
  'misc-utilities': [
    { key: 'example-minimal', title: '示例与最小模板', description: '示例命令、最小技能和最小插件。', match: ['example', 'minimal', 'template'] },
    { key: 'general-tools', title: '通用工具', description: '天气、Jupyter、签证翻译等通用工具。', match: ['weather', 'jupyter', 'visa'] },
    { key: 'openclaw-utils', title: 'OpenClaw 工具', description: 'OpenClaw 执行和计划工具。', match: ['openclaw', 'make-plan'] },
    { key: 'sandbox-labels', title: '实验标签', description: 'Alpha、Beta 等实验占位能力。', match: ['alpha', 'beta'] },
  ],
  'agent-orchestration': [
    { key: 'runtime-modes', title: '运行时模式', description: 'Ralph、tmux、OMX、Autopilot 等执行模式。', match: ['ralph', 'tmux', 'omx', 'omc', 'ultrawork', 'autopilot', 'workflow', 'pipeline', 'loop', 'dmux'] },
    { key: 'team-orchestration', title: '团队调度', description: '多智能体团队、控制面和协作编排。', match: ['team-builder', 'software-team', 'omo', 'ccg', 'control-plane', 'team'] },
    { key: 'parallel-subagent', title: '并行子代理', description: '子代理、并行分派、DevFleet 和 worker 调度。', match: ['subagent', 'parallel', 'dispatching', 'devfleet', 'worker'] },
    { key: 'task-routing', title: '计划与分流', description: '计划执行、Issue 分流、任务委派与请求路由。', match: ['writing-plans', 'executing-plans', 'triage', 'issue', 'request', 'github', 'do', 'task', 'delegate'] },
    { key: 'feedback-loops', title: '评审研究循环', description: '评审，研究，对抗验证与自我改进循环。', match: ['review', 'research', 'harness', 'santa', 'math', 'gan', 'trace', 'self', 'deep', 'automate'] },
  ],
  'agent-evaluation': [
    { key: 'completion-verification', title: '完成前验证', description: '完成前检查、验证循环与金丝雀监控。', match: ['verification', 'verify', 'canary', 'finish', 'finishing'] },
    { key: 'tests-quality-gates', title: '测试与质量门', description: '测试策略、QA、TDD 与质量门。', match: ['test', 'qa', 'tdd', 'django', 'quality'] },
    { key: 'evals-benchmarks', title: '评测与基准', description: '评测、基准、指标与回归测试。', match: ['eval', 'benchmark', 'metric', 'regression', 'harness'] },
    { key: 'review-compliance', title: '审查与合规', description: '插件评估、合规测量与领域安全验证。', match: ['plugin', 'skill', 'comply', 'arsenal', 'healthcare', 'review'] },
  ],
  'skill-authoring': [
    { key: 'authoring-template', title: '创作与模板', description: '指令包、插件模板，脚手架与示例。', match: ['create', 'creator', 'template', 'example', 'minimal', 'clean-room', 'agent-development', 'scaffold'] },
    { key: 'install-migrate', title: '安装与迁移', description: '安装、迁移、配置与发现。', match: ['install', 'installer', 'migrate', 'configure', 'setup', 'find'] },
    { key: 'governance-review', title: '治理与审查', description: '安全审查，质量审查、规则与合规。', match: ['vetter', 'stocktake', 'comply', 'pr-review', 'review', 'rule', 'quality'] },
    { key: 'learning-refinement', title: '沉淀与改进', description: '会话沉淀、持续学习、经验提炼与文档写作。', match: ['skillify', 'learner', 'continuous', 'improve', 'writing', 'write', 'grill'] },
  ],
  'codex-claude-runtime': [
    { key: 'codex-claude', title: 'Codex 与 claude', description: 'Codex、Claude Code、结果呈现与代码代理。', match: ['codex', 'claude', 'codeagent'] },
    { key: 'omx-omc', title: 'OMX 与 OMC', description: 'OMX/OMC 设置、状态栏、医生与目标模式。', match: ['omx', 'omc', 'doctor', 'statusline', 'cancel', 'performance'] },
    { key: 'hooks-plugins', title: 'Hook 与插件', description: 'Hook、插件结构、Hookify 规则与本地配置。', match: ['hook', 'plugin', 'hookify', 'structure', 'settings'] },
    { key: 'local-runtime', title: '本地环境', description: '本地循环、代理诊断、通知、定时任务与质量检查。', match: ['local', 'loop', 'proxy', 'notification', 'peon', 'plankton', 'runtime'] },
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
    { key: 'components-styling', title: '组件与样式', description: 'shadcn、Tailwind、组件库、AI Elements 与 MCP Widget。', match: ['component', 'components', 'shadcn', 'tailwind', 'ai-element', 'build-mcp-app'] },
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
    { key: 'vercel-cloud', title: 'Vercel 与云资源', description: 'Vercel 部署、API、存储，多服务和沙箱。', match: ['vercel'] },
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

// ---------------------------------------------------------------------------
// Skill family matching / grouping
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

// Sort helper re-used by catalog section builders. Kept here to avoid a
// circular import from search.ts and to mirror the original file's layout.
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

export function buildSkillCatalogSubsections(
  sectionKey: string,
  items: KnowledgeCatalogItem[],
): KnowledgeCatalog['sections'][number]['subsections'] {
  if (items.length <= SKILL_SUBSECTION_THRESHOLD) return undefined

  const definitions = AXI_SKILL_SUBSECTIONS[sectionKey] || []
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

export function buildSkillIndexMarkdown(source: DocSource, skillDocs: ParsedDocument[], originalRaw: string): string {
  if (skillDocs.length === 0) return originalRaw

  const definitions = source.organizationHint === 'dbskill' ? DB_SKILL_FAMILIES : AXI_SKILL_FAMILIES
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

// ---------------------------------------------------------------------------
// Skill catalog section builder
// ---------------------------------------------------------------------------

// Local copy of toKnowledgeCatalogItem — kept here to avoid a top-level
// cycle with catalog.ts. Catalog.ts owns the canonical implementation; both
// stay identical so consumer code can pass `toKnowledgeCatalogItem` into this
// function (or rely on the inlined version below).
function _toKnowledgeCatalogItemLocal(document: ParsedDocument): KnowledgeCatalogItem {
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

export function buildSkillCatalogSections(
  source: DocSource,
  documents: ParsedDocument[],
  toKnowledgeCatalogItem: (document: ParsedDocument) => KnowledgeCatalogItem = _toKnowledgeCatalogItemLocal,
): KnowledgeCatalog['sections'] {
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

// ---------------------------------------------------------------------------
// Skill document builders (live here so skills.ts owns its own builders)
// ---------------------------------------------------------------------------

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
