/**
 * Local-source index construction.
 *
 * Owns the `LocalSourceIndex` cache (`localSourceIndexCache`),
 * `getLocalSourceIndex(...)` and the worker functions that build a source's
 * `LocalSourceIndex` (markdown walk, parse, virtual document builders for
 * the `skills` and `workspace` adapters, root workspace doc ingestion).
 *
 * No public API surface change: `knowledgeBase.ts` re-exports everything
 * callers used to import from the monolithic module.
 */

import fs from 'fs'
import path from 'path'
import { normalizeStringArray, runKnowledgeIntake } from '../knowledgeIntake'
import {
  formatKnowledgeDocumentDescription,
  formatKnowledgeDocumentTitle,
} from '../knowledgeFormatter'
import { classifyKnowledgeCategories } from '../../config/knowledgeRules'
import type {
  DocSource,
  Frontmatter,
  NormalizedDocument,
} from '../../types'
import type {
  IndexedLocalFile,
  LocalFileEntry,
  LocalSourceIndex,
  ParsedDocument,
  WorkspaceProjectInfo,
  WorkspaceProjectSuiteDoc,
} from './types'
import {
  extractDescription,
  extractInlineTags,
  extractRawTitle,
  extractTechStack,
  formatWorkspaceCommand,
  formatWorkspaceValue,
  getHandoffSnapshotPath,
  gitPrefilledRoots,
  gitRootCache,
  gitUpdatedCache,
  isExcludedName,
  isSupportedFile,
  joinChineseFacts,
  mapHandoffProjectToWorkspaceInfo,
  normalizeDate,
  normalizeSlashes,
  parseMarkdownDocument,
  resolveLastUpdated,
  resolveWorkspacePurpose,
  resolveWorkspaceTitle,
  splitMarkdownTableRow,
  WORKSPACE_DOCUMENT_TYPE_DEFINITIONS,
} from './utils'
import {
  buildSkillAssetDocument,
  buildSkillDocument,
  buildSkillIndexMarkdown,
  collectSelectedSkillAssets,
  collectSkillSupportDocuments,
} from './skills'
import { getSource, listBlinkoNotes } from './sources'
import { buildFrontmatter } from './catalog'

// ---------------------------------------------------------------------------
// LocalSourceIndex cache (module-level; mirrors original behavior)
// ---------------------------------------------------------------------------

export const localSourceIndexCache = new Map<string, LocalSourceIndex>()

let localSourceIndexStaticMode = false

export function setLocalSourceIndexStaticMode(enabled: boolean): void {
  localSourceIndexStaticMode = enabled
}

export function isLocalSourceIndexStaticMode(): boolean {
  return localSourceIndexStaticMode
}

export function invalidateLocalSourceIndex(sourceId: string, relativePath?: string): void {
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
  gitPrefilledRoots.clear()
}

// ---------------------------------------------------------------------------
// Document parsing
// ---------------------------------------------------------------------------

export async function parseLocalDocumentFromFile(
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
  const title = formatKnowledgeDocumentTitle(rawTitle, relativePath, graphTitle, source.locale === 'en' ? 'en' : 'zh')
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

export function createVirtualParsedDocument(input: NormalizedDocument & {
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
  sourceLocale?: 'en' | 'zh'
}): ParsedDocument {
  const fileName = input.name || path.basename(input.path).replace(/\.(md|markdown)$/i, '')
  const rawTitle = input.rawTitle || input.title
  const sourceTags = [...new Set(input.sourceTags || input.tags)]
  const title = formatKnowledgeDocumentTitle(input.title || rawTitle, input.path, input.graphTitle, input.sourceLocale === 'en' ? 'en' : 'zh')
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

// ---------------------------------------------------------------------------
// Workspace project parsing
// ---------------------------------------------------------------------------

function parseWorkspaceProjectRow(row: string[], updated: string): WorkspaceProjectInfo | null {
  const [name, projectPath, purpose, stack, status, docs, verification, notes] = row
  if (!name || !projectPath || name === 'Project' || /^-+$/.test(name)) return null
  const cleanName = stripMarkdownLinksLocal(name)
  const cleanPath = stripMarkdownLinksLocal(projectPath)
  const cleanStatus = stripMarkdownLinksLocal(status || 'active')
  const cleanStack = stripMarkdownLinksLocal(stack || '')
  const cleanDocs = stripMarkdownLinksLocal(docs || '')
  const cleanVerification = stripMarkdownLinksLocal(verification || '')
  const cleanPurpose = stripMarkdownLinksLocal(purpose || '')
  const cleanNotes = stripMarkdownLinksLocal(notes || '')
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

// Local helper: stripMarkdownLinks lives in utils.ts; re-export with a short
// local name to keep the original control-flow readable without re-shaping it.
function stripMarkdownLinksLocal(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

// ---------------------------------------------------------------------------
// Skill / Workspace document builders
// ---------------------------------------------------------------------------

export {
  buildSkillDocument,
  buildSkillAssetDocument,
  collectSkillSupportDocuments,
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
    const indexRaw = buildSkillIndexMarkdownLocal(source, documents.filter((document) => document.docType === 'skill'), raw)
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

// Local re-export of buildSkillIndexMarkdown so we don't have to expose it
// from skills.ts (which already has its own buildSkillIndexMarkdown export;
// keeping a local alias here preserves the call site verbatim).
function buildSkillIndexMarkdownLocal(source: DocSource, skillDocs: ParsedDocument[], originalRaw: string): string {
  return buildSkillIndexMarkdown(source, skillDocs, originalRaw)
}

export async function buildWorkspaceProjectRootDocuments(
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

export function buildWorkspaceProjectSuiteDefinitions(project: WorkspaceProjectInfo): WorkspaceProjectSuiteDoc[] {
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
    '| 文档 | 路径 |',
    '|---|---|',
    '| 项目入口 | README |',
    '| 需求 | PRD |',
    '| 技术设计 | TDD |',
    '| 智能体指南 | AGENTS |',
    '| 任务清单 | TODO |',
    '| 里程碑 | MILESTONE |',
    '| 变更记录 | CHANGELOG |',
    '| 文档索引 | INDEX |',
    '| 安全策略 | SECURITY |',
    '',
  ].join('\n')

  const architectureBody = [
    `# ${project.name} 架构`,
    '',
    `## 边界`,
    '',
    `- 项目路径：${project.projectPath}`,
    `- 文档来源：${formatWorkspaceValue(project.docs)}`,
    '',
    '## 技术栈',
    '',
    project.stack || '未标注',
    '',
    '## 契约',
    '',
    '- 跨项目契约以 workspace.graph.json 为准；不在项目内重复声明。',
    '- 修改对外契约前先在 AXIOMATICWORLD_NAMING 与治理索引中检索同名词条。',
    '',
  ].join('\n')

  const operationsBody = [
    `# ${project.name} 运维与验证`,
    '',
    '## 验证命令',
    '',
    project.verification || '未标注',
    '',
    '## 运维记录',
    '',
    '- 每次部署至少留下一个验证证据。',
    '- 任何回滚应同步更新 RUNBOOK 与 TODO。',
    '',
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

export function buildWorkspaceProjectDocuments(source: DocSource, row: string[], updated: string): ParsedDocument[] {
  const project = parseWorkspaceProjectRow(row, updated)
  if (!project) return []

  return buildWorkspaceProjectSuiteDefinitions(project).map((definition) => {
    const documentPath = definition.suffix
      ? `projects/${project.id}/${definition.suffix}.md`
      : `projects/${project.id}.md`
    const raw = buildFrontmatterLocal({
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

// Local helper: buildFrontmatter lives in catalog.ts (presentation layer);
// we import it directly via top-level import — ES module late-binding
// resolves the cycle between indexer.ts and catalog.ts.
function buildFrontmatterLocal(meta: Record<string, unknown>): string {
  return buildFrontmatter(meta)
}

// ---------------------------------------------------------------------------
// Handoff loaders (used by collectWorkspaceDocuments)
// ---------------------------------------------------------------------------

async function __loadHandoffProjects(workspaceRoot: string) {
  const handoffPath = getHandoffSnapshotPath(workspaceRoot)
  try {
    const raw = await fs.promises.readFile(handoffPath, 'utf-8')
    const snapshot = JSON.parse(raw) as { projects?: unknown[]; generatedAt?: string }
    if (!Array.isArray(snapshot.projects)) {
      return { source: 'none' as const, projects: [], generatedAt: null, handoffPath, error: new Error('snapshot missing projects[]') }
    }
    const generatedAt = typeof snapshot.generatedAt === 'string' ? snapshot.generatedAt : null
    const projects = snapshot.projects
      .map((entry) => mapHandoffProjectToWorkspaceInfo(entry as never, generatedAt))
      .filter((entry): entry is WorkspaceProjectInfo => entry !== null)
    if (projects.length === 0) {
      return { source: 'none' as const, projects: [], generatedAt, handoffPath, error: new Error('snapshot projects[] mapped to empty list') }
    }
    return { source: 'handoff' as const, projects, generatedAt, handoffPath, error: null as Error | null }
  } catch (error) {
    return {
      source: 'none' as const,
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
  const projectPath = project.projectPath
  if (typeof projectPath !== 'string') return true
  // Best-effort signal: lifecycle is not stored in WorkspaceProjectInfo, but
  // the synthetic path also fires when the project name ends in '-local' or
  // the path contains '/local/' as a defensive marker.
  if (/\/local\//i.test(projectPath)) return true
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

// ---------------------------------------------------------------------------
// collectWorkspaceDocuments
// ---------------------------------------------------------------------------

export async function collectWorkspaceDocuments(source: DocSource): Promise<ParsedDocument[]> {
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
        const raw = buildFrontmatterLocal({
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
  // A. bundlePath 冲突修复：根 /AGENTS.md 与 /docs/AGENTS.md 分离，避免 MCP 端 bundlePath 冲突
  await addRootWorkspaceDoc(workspaceRoot, 'AGENTS.md', 'docs/AGENTS-ROOT.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/DEV_SERVICES.md', 'docs/DEV_SERVICES.md', documents)

  // B. zh-CN 镜像与根级长期文档摄入（addRootWorkspaceDoc 在文件缺失时静默跳过）
  await addRootWorkspaceDoc(workspaceRoot, 'AGENTS.zh-CN.md', 'docs/AGENTS.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'WORKSPACE_INDEX.zh-CN.md', 'docs/WORKSPACE_INDEX.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'ONBOARDING.zh-CN.md', 'docs/ONBOARDING.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'ONBOARDING-REFERENCE.zh-CN.md', 'docs/ONBOARDING-REFERENCE.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'CHANGE.md', 'docs/CHANGE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'CHANGELOG.md', 'docs/CHANGELOG.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'README.md', 'docs/README.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'README.zh-CN.md', 'docs/README.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'INDEX.md', 'docs/INDEX.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/DEV_SERVICES.zh-CN.md', 'docs/DEV_SERVICES.zh-CN.md', documents)

  // C. docs/state/ 长期工作状态文档（README/PRD/TDD/TODO/MILESTONE/VERIFICATION/CLI-REFERENCE）
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/README.md', 'docs/state/README.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/PRD.md', 'docs/state/PRD.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/TDD.md', 'docs/state/TDD.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/TODO.md', 'docs/state/TODO.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/MILESTONE.md', 'docs/state/MILESTONE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/VERIFICATION.md', 'docs/state/VERIFICATION.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/state/CLI-REFERENCE.md', 'docs/state/CLI-REFERENCE.md', documents)

  // D. docs/audit/ + docs/architecture/ 摄入
  await addRootWorkspaceDoc(workspaceRoot, 'docs/audit/audit-results-2026-09-25.md', 'docs/audit/audit-results-2026-09-25.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/architecture/workspace-backend-architecture.md', 'docs/architecture/workspace-backend-architecture.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/architecture/axi-notify-architecture.md', 'docs/architecture/axi-notify-architecture.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/architecture/ai-resource-orchestration-architecture.md', 'docs/architecture/ai-resource-orchestration-architecture.md', documents)

  // E. docs/axi/ + docs/prd/ + docs/registry/ 摄入（含 P0 contracts、命名合约、PRD 与模板）
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/AXIOMATICWORLD_NAMING.md', 'docs/axi/AXIOMATICWORLD_NAMING.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/AXIOMATICWORLD_NAMING.zh-CN.md', 'docs/axi/AXIOMATICWORLD_NAMING.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md', 'docs/axi/contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/contracts/AI_CAPABILITY_CONTRACT.md', 'docs/axi/contracts/AI_CAPABILITY_CONTRACT.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/contracts/MINIMAX_TOKENPLAN_CONTRACT.md', 'docs/axi/contracts/MINIMAX_TOKENPLAN_CONTRACT.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/axi/contracts/OLLAMA_LOCAL_CONTRACT.md', 'docs/axi/contracts/OLLAMA_LOCAL_CONTRACT.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/README.md', 'docs/prd/README.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/00-PRD-SYSTEM-GUIDE.md', 'docs/prd/00-PRD-SYSTEM-GUIDE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/01-AxiomaticWorld-Personal-OS-PRD.md', 'docs/prd/01-AxiomaticWorld-Personal-OS-PRD.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md', 'docs/prd/02-CONTRACT-AND-CONSTRAINT-GOVERNANCE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/templates/PROJECT-PRD-TEMPLATE.md', 'docs/prd/templates/PROJECT-PRD-TEMPLATE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/prd/templates/SPRINT-PRD-TEMPLATE.md', 'docs/prd/templates/SPRINT-PRD-TEMPLATE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'docs/registry/project-cross-references.md', 'docs/registry/project-cross-references.md', documents)

  // F. .claude/ + scripts/ + incubator/ 摄入（根级文件统一归并到 docs/ bundlePath 命名空间）
  await addRootWorkspaceDoc(workspaceRoot, '.claude/PARADIGM.md', 'docs/.claude/PARADIGM.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, '.claude/ARCHITECTURE.md', 'docs/.claude/ARCHITECTURE.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'scripts/AGENTS.md', 'docs/scripts/AGENTS.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'scripts/AGENTS.zh-CN.md', 'docs/scripts/AGENTS.zh-CN.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'scripts/README.md', 'docs/scripts/README.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'incubator/AGENTS.md', 'docs/incubator/AGENTS.md', documents)
  await addRootWorkspaceDoc(workspaceRoot, 'incubator/README.md', 'docs/incubator/README.md', documents)

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

export async function addRootWorkspaceDoc(
  rootDir: string,
  fileName: string,
  bundlePath: string,
  documents: ParsedDocument[],
): Promise<void> {
  // Deduplicate by bundlePath: if the same bundlePath is already present, skip.
  // Root workspace docs may be declared by multiple call sites (e.g. both the
  // explicit `addRootWorkspaceDoc(...)` lines above and the `axiRootFiles` /
  // `contractFiles` loops below, or by future overrides). Skipping duplicates
  // here prevents `documents.length` from being inflated by repeated pushes.
  if (documents.some((d) => d.path === bundlePath)) {
    return
  }
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
    name: bundlePath.replace(/^.*\//, '').replace(/\.md$/i, ''),
    title: rawTitle,
    rawTitle,
    description,
    docType: 'index',
    status: 'active',
    tags: ['工作区', '长期文档'],
    categories: ['indexes'],
    updated,
    raw,
    body,
    frontmatter: {
      ...frontmatter,
      id: typeof frontmatter.id === 'string' ? frontmatter.id : `workspace-${bundlePath.replace(/[\\/]+/g, '-')}`,
      title: rawTitle,
      type: 'index',
      status: 'active',
      tags: ['工作区', '长期文档'],
      modified: updated,
      'graph-title': rawTitle,
      'graph-tags': ['工作区'],
    },
    aliases: [rawTitle, bundlePath],
    sourceTags: ['workspace-root', 'operator-docs'],
  }))
}

// ---------------------------------------------------------------------------
// File walker + index construction
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
  if (localSourceIndexStaticMode && cachedIndex && cachedIndex.rootPath === rootPath) {
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