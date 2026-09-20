import path from 'path'
import type { DocSource, DocumentSourceConfig } from '../types'

const DEFAULT_OBSIDIAN_PATH = 'F:/docs/obsidian/'
const DEFAULT_BLINKO_URL = 'http://localhost:1111'

function resolveProjectPath(...segments: string[]): string {
  return path.resolve(process.cwd(), '..', ...segments)
}

function resolveWorkspacePath(...segments: string[]): string {
  return path.resolve(process.cwd(), '../../..', ...segments)
}

function existingOrFallback(primary: string, fallback: string): string {
  return primary || fallback
}

export function getDocumentSourceRegistry(): DocumentSourceConfig[] {
  const axiSkillsPath = existingOrFallback(
    process.env.AXI_SKILLS_PATH || '',
    resolveWorkspacePath('shared', 'axi-skills'),
  )
  const workspaceGovernancePath = existingOrFallback(
    process.env.AXI_WORKSPACE_GOVERNANCE_PATH || '',
    resolveWorkspacePath('infra', 'axi-workspace-governance'),
  )
  const dbskillPath = existingOrFallback(
    process.env.DBSKILL_PATH || '',
    resolveWorkspacePath('shared', 'dbskill'),
  )
  const axiRulesPath = existingOrFallback(
    process.env.AXI_RULES_PATH || '',
    resolveWorkspacePath('projects', 'axi-rules'),
  )
  const axiDocsContentPath = existingOrFallback(
    process.env.AXI_DOCS_CONTENT_PATH || '',
    resolveProjectPath('docs', 'content'),
  )

  return [
    {
      id: 'workspace',
      name: 'Axi 工作区',
      description: 'Axi 工作区项目索引、治理目录和智能体入口。',
      path: workspaceGovernancePath,
      enabled: true,
      type: 'local',
      kind: 'workspace-registry',
      adapter: 'workspace',
      audience: ['agent', 'human'],
      readOnly: true,
      icon: 'folder',
    },
    {
      id: 'axi-skills',
      name: 'Axi Skills',
      description: 'Axi agents 共享技能库，索引 skills/**/SKILL.md。',
      path: axiSkillsPath,
      enabled: true,
      type: 'local',
      kind: 'skill-library',
      adapter: 'skills',
      audience: ['agent', 'human'],
      readOnly: true,
      organizationHint: 'skill-families',
      icon: 'folder',
      skillRoot: 'skills',
      locale: 'en',
    },
    {
      id: 'axi-skills-zh',
      name: 'Axi Skills · 中文镜像',
      description: 'Axi Skills 的中文本地化镜像，索引 skills.zh/**/SKILL.md。',
      path: axiSkillsPath,
      enabled: process.env.AXI_SKILLS_ZH_ENABLED !== 'false',
      type: 'local',
      kind: 'skill-library',
      adapter: 'skills',
      audience: ['agent', 'human'],
      readOnly: true,
      organizationHint: 'skill-families',
      icon: 'folder',
      skillRoot: 'skills.zh',
      locale: 'zh',
    },
    {
      // Cross-ecosystem registry: every skill the user owns across 14+
      // ecosystems (axi-skills, codex, hermes, minimax, newmax, workbuddy,
      // grok, opencodex, codex scratch, etc.), pre-split into per-skill
      // .md files under `axi-skills/docs/skill-registry/<ecosystem>/<skill>.md`.
      // Source-of-truth regenerator:
      //   bash ~/.claude/skills/scripts/find-my-skill.sh --rebuild
      //   python3 ~/.claude/skills/scripts/split-registry.py
      // Useful as a duplicate-detection surface: any skill that exists in
      // both `axi-skills` and `codex-scratch` shows up twice in this view.
      id: 'skill-registry',
      name: 'Skill Registry (cross-ecosystem)',
      description: '跨 14+ 生态的 skill 注册表，自动从 ~/.claude/skills/SKILL_REGISTRY.md 拆分。可用于检测重复(同名 skill 在多个生态出现)。',
      path: axiSkillsPath,
      enabled: process.env.SKILL_REGISTRY_ENABLED !== 'false',
      type: 'local',
      kind: 'markdown-vault',
      adapter: 'markdown',
      audience: ['agent', 'human'],
      readOnly: true,
      organizationHint: 'skill-families',
      icon: 'folder',
      skillRoot: 'docs/skill-registry',
      locale: 'en',
    },
    {
      // Zero-context handoff governance: agent rules, TODO contracts, and
      // source locks live in `axi-rules` and must be searchable as a
      // first-class source (not only via the per-project dossier). The
      // `index/docs-source.json` sidecar is consumed separately by
      // `axi_docs_project_onboard` and is intentionally NOT re-parsed
      // through the markdown adapter here.
      id: 'axi-rules',
      name: 'Axi Rules',
      description: 'Agent 规则、TODO 契约和源锁的一级知识源（rules/、todo/）。',
      path: axiRulesPath,
      enabled: process.env.AXI_RULES_ENABLED !== 'false',
      type: 'local',
      kind: 'markdown-vault',
      adapter: 'markdown',
      audience: ['agent', 'human'],
      readOnly: true,
      organizationHint: 'axi-rules',
      icon: 'folder',
      locale: 'en',
    },
    {
      id: 'axi-docs-en',
      name: 'Axi Docs · English',
      description: 'Axi Docs source-language documentation under docs/content/en.',
      path: path.join(axiDocsContentPath, 'en'),
      enabled: true,
      type: 'local',
      kind: 'markdown-vault',
      adapter: 'markdown',
      audience: ['agent', 'human'],
      readOnly: false,
      icon: 'folder',
      locale: 'en',
    },
    {
      id: 'axi-docs-zh',
      name: 'Axi Docs · 中文文档',
      description: 'Axi Docs 中文翻译目标目录，位于 docs/content/zh。',
      path: path.join(axiDocsContentPath, 'zh'),
      enabled: true,
      type: 'local',
      kind: 'markdown-vault',
      adapter: 'markdown',
      audience: ['agent', 'human'],
      readOnly: false,
      icon: 'folder',
      locale: 'zh',
    },
    {
      id: 'dbskill',
      name: 'dbskill',
      description: 'dontbesilent 最新 dbskill 工具箱，按 dbs 诊断、内容工程、决策、学习和状态管理组织。',
      path: dbskillPath,
      enabled: process.env.DBSKILL_CONTENT_ASSETS_ENABLED !== 'false',
      type: 'local',
      kind: 'skill-library',
      adapter: 'skills',
      audience: ['agent', 'human'],
      readOnly: true,
      includeSkillAssets: true,
      includeSupportDocs: true,
      organizationHint: 'dbskill',
      icon: 'folder',
    },
    {
      id: 'obsidian',
      name: 'Obsidian 知识库',
      description: '长期沉淀的结构化知识与项目文档。',
      path: process.env.OBSIDIAN_PATH || DEFAULT_OBSIDIAN_PATH,
      enabled: true,
      type: 'local',
      kind: 'markdown-vault',
      adapter: 'markdown',
      audience: ['agent', 'human'],
      readOnly: false,
      icon: 'obsidian',
    },
    {
      id: 'blinko',
      name: 'Blinko 闪念',
      description: '短期灵感、碎片记录与快速捕捉。',
      path: '',
      enabled: true,
      type: 'api',
      kind: 'api-notes',
      adapter: 'api',
      audience: ['agent', 'human'],
      readOnly: false,
      apiUrl: process.env.BLINKO_URL || DEFAULT_BLINKO_URL,
      apiToken: process.env.BLINKO_TOKEN || '',
      icon: 'blinko',
    },
  ]
}

export function validateDocumentSourceRegistry(sources: Pick<DocSource, 'id' | 'adapter' | 'enabled'>[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const validAdapters = new Set(['markdown', 'skills', 'workspace', 'api'])

  for (const source of sources) {
    if (!source.id.trim()) errors.push('source id is required')
    if (ids.has(source.id)) errors.push(`duplicate source id: ${source.id}`)
    ids.add(source.id)
    if (source.adapter && !validAdapters.has(source.adapter)) {
      errors.push(`invalid adapter for ${source.id}: ${source.adapter}`)
    }
  }

  if (!sources.some((source) => source.enabled)) {
    errors.push('at least one source must be enabled')
  }

  return errors
}
