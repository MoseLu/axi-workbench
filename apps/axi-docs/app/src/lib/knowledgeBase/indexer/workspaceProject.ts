/**
 * Workspace project parsers and synthetic-suite generators.
 *
 * `parseWorkspaceProjectRow` extracts a `WorkspaceProjectInfo` from a markdown
 * table row; the `buildWorkspaceProject*` family turns that info into either
 * the project's on-disk governance docs (root variant) or the synthetic
 * 4-piece suite used for projects that keep their root private.
 */

import fs from 'fs'
import path from 'path'
import { normalizeStringArray } from '../../knowledgeIntake'
import type {
  DocSource,
  Frontmatter,
} from '../../../types'
import type {
  ParsedDocument,
  WorkspaceProjectInfo,
  WorkspaceProjectSuiteDoc,
} from '../types'
import {
  extractDescription,
  extractInlineTags,
  extractRawTitle,
  formatWorkspaceCommand,
  formatWorkspaceValue,
  joinChineseFacts,
  normalizeDate,
  parseMarkdownDocument,
  resolveWorkspacePurpose,
  resolveWorkspaceTitle,
  WORKSPACE_DOCUMENT_TYPE_DEFINITIONS,
} from '../utils'
import { buildFrontmatter } from '../catalog'
import { createVirtualParsedDocument } from './parseDocument'

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
// resolves the cycle between this module and catalog.ts.
function buildFrontmatterLocal(meta: Record<string, unknown>): string {
  return buildFrontmatter(meta)
}

export { parseWorkspaceProjectRow }