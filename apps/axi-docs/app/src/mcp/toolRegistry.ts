// Tool schema registry + canonical tool dispatch.
//
// Schemas (`getToolSchemas`) expose input shape + annotations to MCP/HTTP
// clients. `handleToolCall` is the canonical dispatcher that the stdio
// `createServer` factory and the HTTP `/mcp` JSON-RPC handler both call.
//
// Both code paths must stay byte-equivalent to the pre-refactor
// single-file implementation.

import * as knowledgeBase from '../lib/knowledgeBase'
import { docSources, sanitizeSource, searchSkillLibraries } from './docSources'
import {
  scanDir,
  readFile,
  writeFile,
  searchFiles,
  searchFullText,
  buildFrontmatter,
} from './fileOps'
import { fixedDocumentContextSummary } from './ai'
import {
  listWorkspaceDocCategories,
  readWorkspaceDoc,
  searchWorkspaceRoot,
  listGovernanceAdrs,
  listWorkspaceAudits,
} from './workspaceDocs'
import { blinkoRequest } from './blinko'
import { MCP_TOOL_CAPABILITIES, getToolCapability } from './capabilities'
import { guardBoundedAgentTool } from './agentGuard'
import type { ToolSchema, CallerIdentity, ToolCallResult, BlinkoNote } from './types'

export type { ToolSchema, CallerIdentity, ToolCallResult, BlinkoNote } from './types'

// ─── Tool schema list ────────────────────────────────────────────────────────

export function getToolSchemas(): ToolSchema[] {
  const tools: ToolSchema[] = [
    {
      name: 'obsidian_scan',
      description: '扫描 Obsidian 知识库的目录，返回文件/文件夹列表',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          path: {
            type: 'string',
            description: '子目录路径，不填则为根目录',
          },
        },
      },
    },
    {
      name: 'obsidian_read',
      description: '读取 Obsidian 知识库中的文件内容',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          path: {
            type: 'string',
            description: '文件相对路径（必填），如 notes/test.md',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'obsidian_write',
      description:
        '向 Obsidian 知识库写入（新建或覆盖）Markdown 文件，支持路径穿越检查',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          path: {
            type: 'string',
            description:
              '文件相对路径（必填），如 daily/2026-03-24.md，自动创建父目录',
          },
          content: {
            type: 'string',
            description: '文件内容（必填），Markdown 格式',
          },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'obsidian_list',
      description: '列出所有已配置的文档源',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'obsidian_search',
      description: '在 Obsidian 知识库中按文件名搜索文件（快速）',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          query: {
            type: 'string',
            description: '搜索关键词（必填）',
          },
          path: {
            type: 'string',
            description: '在指定子目录中搜索',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'obsidian_fulltext_search',
      description: '对 Obsidian 知识库进行全文搜索，返回包含关键词的文档片段（比 obsidian_search 慢但更准确）',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          query: {
            type: 'string',
            description: '搜索关键词（必填）',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'obsidian_write_note',
      description: '向知识库写入带有 frontmatter 元数据的 Markdown 笔记。如果文件已存在会覆盖。自动生成 YAML frontmatter（date/tags/title）。',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          path: {
            type: 'string',
            description: '文件相对路径（必填），如 daily/2026-03-24.md，会自动创建父目录',
          },
          content: {
            type: 'string',
            description: '笔记正文内容（Markdown，不含 frontmatter，必填）',
          },
          title: {
            type: 'string',
            description: '笔记标题（可选，写入 frontmatter）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表（可选，写入 frontmatter）',
          },
          date: {
            type: 'string',
            description: '创建日期（可选，默认今天，格式 YYYY-MM-DD）',
          },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'knowledge_catalog',
      description: '返回知识库的分类索引摘要，适合快速判断是否已有项目经验、架构决策、编码规范、组件/函数库和问题解决方案。',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
        },
      },
    },
    {
      name: 'knowledge_search',
      description: '面向经验复用的统一搜索，优先返回组件库、函数库、规范、架构、技术选型和 FAQ 等高价值文档。',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '文档源 ID，默认 obsidian',
            default: 'obsidian',
          },
          query: {
            type: 'string',
            description: '搜索关键词（必填）',
          },
          tag: {
            type: 'string',
            description: '按标签过滤（可选）',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'axi_docs_list_sources',
      description: '列出 Axi Docs 已接入的文档项目/source，适合 agent 先判断可用知识库。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'axi_docs_search',
      description: '跨 Axi Docs 全部文档库搜索，返回摘要化结果和 source/path。',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词（必填）' },
          source: { type: 'string', description: '可选 source id；不填则跨库搜索' },
          tag: { type: 'string', description: '按标签过滤（可选）' },
        },
        required: ['query'],
      },
    },
    {
      name: 'axi_docs_read',
      description: '读取 Axi Docs 中指定 source/path 的文档原文。',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'source id（必填）' },
          path: { type: 'string', description: '文档相对路径（必填）' },
        },
        required: ['source', 'path'],
      },
    },
    {
      name: 'axi_docs_skill_search',
      description: '专门搜索 Axi Skills 和 dbskill 技能库，返回匹配技能的 name/description/path。',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '技能名、触发词或描述关键词（必填）' },
        },
        required: ['query'],
      },
    },
    {
      name: 'axi_docs_workspace_status',
      description: '返回 Axi 工作区项目概览、文档数量和最近项目入口。',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'axi_docs_project_summary',
      description: '按项目名或 id 返回 workspace 项目摘要，包含路径、状态和验证入口。',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: '项目名、slug 或路径片段（必填）' },
        },
        required: ['project'],
      },
    },
    {
      // Zero-context handoff governance: Agent 想要在 Axi Docs 内完成
      // 「定位项目 → 读 handoff → 检查 readiness」闭环，调用本工具即可。
      // 不执行任何破坏性命令，不直接运行测试或 git，只读 handoff snapshot。
      name: 'axi_docs_project_onboard',
      description: '按项目 id 返回零上下文接手摘要（read order、entrypoints、smoke、current work、known failures）。与 workspace-project onboard <id> --json 同源。',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: '项目 id（必填）' },
        },
        required: ['project'],
      },
    },
    {
      // Default 不运行 smoke；smoke=true 时才执行 manifest.commands.smoke
      // 列表中的第一条命令。需要显式 opt-in，避免误触发长跑任务。
      name: 'axi_docs_handoff_check',
      description: '校验 handoff snapshot 是否对给定项目就绪：返回 readiness、score、ageDays、stale 标记。可选 smoke=true 触发 manifest 中的冒烟命令。',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: '项目 id（必填）' },
          smoke: { type: 'boolean', description: '显式启用时运行 manifest.commands.smoke[0]', default: false },
        },
        required: ['project'],
      },
    },
    {
      name: 'axi_docs_context_summary',
      description: '为受限 Agent 返回指定文档的固定长度只读上下文摘要，以及可追溯的 contextRef（id/version/uri）。',
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'source id（必填）' },
          path: { type: 'string', description: '文档相对路径（必填）' },
        },
        required: ['source', 'path'],
      },
    },
    {
      name: 'axi_docs_get_tool_capabilities',
      description: '返回每个 Axi Docs MCP 工具的只读/副作用能力标注及受限 Agent 可用性。',
      inputSchema: { type: 'object', properties: {} },
    },
    // ── Blinko 工具 ──────────────────────────────────────────────────────────────
    {
      name: 'blinko_list_notes',
      description: '列出 Blinko 闪念笔记（最近的笔记列表）',
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: '返回数量上限（默认 50，最大 200）',
            default: 50,
          },
        },
      },
    },
    {
      name: 'blinko_read_note',
      description: '读取 Blinko 笔记内容（通过笔记 ID）',
      inputSchema: {
        type: 'object',
        properties: {
          noteId: {
            type: 'number',
            description: '笔记 ID（必填）',
          },
        },
        required: ['noteId'],
      },
    },
    {
      name: 'blinko_write_note',
      description: '向 Blinko 创建或更新笔记内容',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: '笔记内容（必填），支持 Markdown',
          },
          noteId: {
            type: 'number',
            description: '笔记 ID（可选，不填则创建新笔记）',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签列表（可选，自动识别 #标签 格式）',
          },
        },
        required: ['content'],
      },
    },
    {
      name: 'blinko_search',
      description: '在 Blinko 笔记中全文搜索',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词（必填）',
          },
        },
        required: ['query'],
      },
    },
    // ── 工作区级文档入口工具（P1 索引完整性）───────────────────────────────────
    {
      name: 'axi_docs_list_workspace_doc_categories',
      description: '列出工作区级别给人看的文档分类',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: listWorkspaceDocCategories,
    },
    {
      name: 'axi_docs_read_workspace_doc',
      description: '按分类读工作区级文档',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['category', 'path'],
        additionalProperties: false,
      },
      handler: readWorkspaceDoc,
    },
    {
      name: 'axi_docs_search_workspace_root',
      description: '搜索工作区根协议门面',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          locale: { type: 'string', default: 'all' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: searchWorkspaceRoot,
    },
    {
      name: 'axi_docs_list_governance_adrs',
      description: '合并三处 ADR 目录',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      handler: listGovernanceAdrs,
    },
    {
      name: 'axi_docs_list_workspace_audits',
      description: '合并四处审计目录',
      inputSchema: {
        type: 'object',
        properties: { since: { type: 'string' } },
        additionalProperties: false,
      },
      handler: listWorkspaceAudits,
    },
  ]

  return tools.map((tool) => {
    const capability = getToolCapability(tool.name)
    return {
      ...tool,
      annotations: {
        readOnlyHint: capability.access === 'read_only',
        destructiveHint: capability.access === 'side_effect',
        idempotentHint: capability.access === 'read_only',
      },
      xAxiCapability: {
        access: capability.access,
        agentAllowed: capability.agentAllowed,
      },
    }
  })
}

// ─── Tool call dispatcher (shared by stdio + HTTP) ──────────────────────────

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  defaultCaller: CallerIdentity = 'human',
): Promise<ToolCallResult> {
  const guarded = guardBoundedAgentTool(name, args, defaultCaller)
  if (guarded) return guarded

  switch (name) {
    case 'obsidian_scan': {
      const source = (args.source as string) || 'obsidian'
      const dirPath = args.path as string | undefined
      return { content: [{ type: 'text', text: JSON.stringify(await scanDir(source, dirPath), null, 2) }] }
    }
    case 'obsidian_read': {
      const source = (args.source as string) || 'obsidian'
      const filePath = args.path as string
      if (!filePath) return { content: [{ type: 'text', text: '错误: path 参数必填' }], isError: true }
      const content = await readFile(source, filePath)
      if (content === null) return { content: [{ type: 'text', text: `文件不存在: ${filePath}` }], isError: true }
      return { content: [{ type: 'text', text: content }] }
    }
    case 'obsidian_write': {
      const source = (args.source as string) || 'obsidian'
      const filePath = args.path as string
      const content = args.content as string
      if (!filePath || content === undefined) return { content: [{ type: 'text', text: '错误: path 和 content 参数必填' }], isError: true }
      const result = await writeFile(source, filePath, content)
      if (result.success) return { content: [{ type: 'text', text: `✓ 文件已保存: ${result.path}` }] }
      return { content: [{ type: 'text', text: `✗ 保存失败: ${result.error}` }], isError: true }
    }
    case 'obsidian_list': {
      return { content: [{ type: 'text', text: JSON.stringify(docSources.filter((s) => s.enabled).map(sanitizeSource), null, 2) }] }
    }
    case 'obsidian_search': {
      const source = (args.source as string) || 'obsidian'
      const query = args.query as string
      const dirPath = args.path as string | undefined
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(await searchFiles(source, query, dirPath), null, 2) }] }
    }
    case 'obsidian_fulltext_search': {
      const source = (args.source as string) || 'obsidian'
      const query = args.query as string
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(await searchFullText(source, query), null, 2) }] }
    }
    case 'obsidian_write_note': {
      const source = (args.source as string) || 'obsidian'
      const filePath = args.path as string
      const body = args.content as string
      if (!filePath || body === undefined) return { content: [{ type: 'text', text: '错误: path 和 content 参数必填' }], isError: true }
      const meta: Record<string, unknown> = { date: (args.date as string) || new Date().toISOString().slice(0, 10) }
      if (args.title) meta.title = args.title as string
      if (args.tags && Array.isArray(args.tags)) meta.tags = args.tags
      const fullContent = buildFrontmatter(meta) + body
      const result = await writeFile(source, filePath, fullContent)
      if (result.success) return { content: [{ type: 'text', text: `✓ 笔记已保存: ${result.path}` }] }
      return { content: [{ type: 'text', text: `✗ 保存失败: ${result.error}` }], isError: true }
    }
    case 'knowledge_catalog': {
      const source = (args.source as string) || 'obsidian'
      return { content: [{ type: 'text', text: JSON.stringify(await knowledgeBase.getKnowledgeCatalog(source), null, 2) }] }
    }
    case 'knowledge_search': {
      const source = (args.source as string) || 'obsidian'
      const query = args.query as string
      const tag = args.tag as string | undefined
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(await knowledgeBase.searchKnowledge(source, query, tag), null, 2) }] }
    }
    case 'axi_docs_list_sources': {
      return { content: [{ type: 'text', text: JSON.stringify(knowledgeBase.getDocumentSourceRegistrySummary().map(sanitizeSource), null, 2) }] }
    }
    case 'axi_docs_search': {
      const query = args.query as string
      const source = args.source as string | undefined
      const tag = args.tag as string | undefined
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      const results = source
        ? await knowledgeBase.searchKnowledge(source, query, tag)
        : await knowledgeBase.searchKnowledgeAll(query, tag)
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
    }
    case 'axi_docs_read': {
      const source = args.source as string
      const filePath = args.path as string
      if (!source || !filePath) return { content: [{ type: 'text', text: '错误: source 和 path 参数必填' }], isError: true }
      const content = await knowledgeBase.readKnowledgeFile(source, filePath)
      if (content === null) return { content: [{ type: 'text', text: `文件不存在: ${source}:${filePath}` }], isError: true }
      return { content: [{ type: 'text', text: content }] }
    }
    case 'axi_docs_context_summary': {
      const source = args.source as string
      const filePath = args.path as string
      if (!source || !filePath) return { content: [{ type: 'text', text: '错误: source 和 path 参数必填' }], isError: true }
      const summary = await fixedDocumentContextSummary(source, filePath)
      if (summary === null) return { content: [{ type: 'text', text: `文件不存在: ${source}:${filePath}` }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
    }
    case 'axi_docs_get_tool_capabilities': {
      return { content: [{ type: 'text', text: JSON.stringify(MCP_TOOL_CAPABILITIES, null, 2) }] }
    }
    case 'axi_docs_skill_search': {
      const query = args.query as string
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(await searchSkillLibraries(query), null, 2) }] }
    }
    case 'axi_docs_workspace_status': {
      return { content: [{ type: 'text', text: JSON.stringify(await knowledgeBase.getWorkspaceStatus(), null, 2) }] }
    }
    case 'axi_docs_project_summary': {
      const project = args.project as string
      if (!project) return { content: [{ type: 'text', text: '错误: project 参数必填' }], isError: true }
      const summary = await knowledgeBase.getProjectSummary(project)
      if (!summary) return { content: [{ type: 'text', text: `未找到项目: ${project}` }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
    }
    case 'axi_docs_project_onboard': {
      const project = args.project as string
      if (!project) return { content: [{ type: 'text', text: '错误: project 参数必填' }], isError: true }
      const card = await knowledgeBase.getProjectHandoffCard(project)
      const summary = await knowledgeBase.getProjectSummary(project)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            project: {
              id: project,
              name: summary?.title || project,
              manifestPath: card.manifestPath,
              handoffPath: card.handoffPath,
            },
            readiness: card.readiness,
            score: card.score,
            readOrder: card.readOrder,
            entrypoints: card.entrypoints,
            smokeCommand: card.smokeCommand,
            verifyCommand: card.verifyCommand,
            currentWork: card.currentWork,
            lastVerifiedAt: card.lastVerifiedAt,
            ageDays: card.ageDays,
            state: card.state,
          }, null, 2),
        }],
      }
    }
    case 'axi_docs_handoff_check': {
      const project = args.project as string
      const smoke = args.smoke === true
      if (!project) return { content: [{ type: 'text', text: '错误: project 参数必填' }], isError: true }
      const card = await knowledgeBase.getProjectHandoffCard(project)
      const snapshotStatus = await knowledgeBase.getHandoffSnapshotStatus()
      const result: Record<string, unknown> = {
        project,
        snapshot: {
          source: snapshotStatus.source,
          generatedAt: snapshotStatus.generatedAt,
          ageDays: snapshotStatus.ageDays,
        },
        handoff: {
          state: card.state,
          readiness: card.readiness,
          score: card.score,
          ageDays: card.ageDays,
          lastVerifiedAt: card.lastVerifiedAt,
          manifestPath: card.manifestPath,
          handoffPath: card.handoffPath,
        },
        smoke: {
          enabled: smoke,
          ran: false,
          command: card.smokeCommand,
          exitCode: null,
          output: null,
        },
      }
      if (smoke) {
        if (!card.smokeCommand) {
          result.smoke = { ...(result.smoke as Record<string, unknown>), ran: false, output: 'no smoke command declared in manifest.commands.smoke[]' }
        } else {
          const { execFileSync } = await import('node:child_process')
          try {
            const cwd = card.manifestPath
              ? card.manifestPath.replace(/\/docs\/project-docs\.manifest\.json$/, '')
              : process.cwd()
            const output = execFileSync('sh', ['-c', card.smokeCommand], {
              cwd,
              encoding: 'utf8',
              timeout: 30_000,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            result.smoke = { ...(result.smoke as Record<string, unknown>), ran: true, exitCode: 0, output: output.slice(0, 4000) }
          } catch (error) {
            const err = error as { status?: number; stdout?: string; stderr?: string; message: string }
            result.smoke = {
              ...(result.smoke as Record<string, unknown>),
              ran: true,
              exitCode: typeof err.status === 'number' ? err.status : 1,
              output: ((err.stdout || '') + (err.stderr || '')).slice(0, 4000) || err.message,
            }
          }
        }
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }
    // ── Blinko 工具 ───────────────────────────────────────────────────────────
    case 'blinko_list_notes': {
      const limit = Math.min(Number(args.limit) || 50, 200)
      const apiToken = process.env.BLINKO_TOKEN || docSources.find(s => s.id === 'blinko')?.apiToken || ''
      if (!apiToken) {
        return { content: [{ type: 'text', text: '错误: 未配置 BLINKO_TOKEN，请在 .env 中配置' }], isError: true }
      }
      const notes = await blinkoRequest<BlinkoNote[]>(
        '/api/v1/note/list',
        'POST',
        { page: 1, size: limit, orderBy: 'desc', type: -1, isRecycle: false },
        apiToken,
      )
      if (!Array.isArray(notes)) {
        return { content: [{ type: 'text', text: `Blinko API 错误: ${JSON.stringify(notes)}` }], isError: true }
      }
      const preview = notes.map(n => ({
        id: n.id,
        content: n.content?.slice(0, 100) || '(empty)',
        tags: n.tags,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      }))
      return { content: [{ type: 'text', text: JSON.stringify(preview, null, 2) }] }
    }
    case 'blinko_read_note': {
      const noteId = Number(args.noteId)
      if (!noteId) return { content: [{ type: 'text', text: '错误: noteId 参数必填' }], isError: true }
      const apiToken = process.env.BLINKO_TOKEN || docSources.find(s => s.id === 'blinko')?.apiToken || ''
      if (!apiToken) {
        return { content: [{ type: 'text', text: '错误: 未配置 BLINKO_TOKEN，请在 .env 中配置' }], isError: true }
      }
      const detail = await blinkoRequest<{ content?: string; contentText?: string }>(
        '/api/v1/note/detail',
        'POST',
        { id: noteId },
        apiToken,
      )
      const content = detail?.content || detail?.contentText || ''
      if (!content) return { content: [{ type: 'text', text: `笔记 ${noteId} 为空或不存在` }], isError: true }
      return { content: [{ type: 'text', text: content }] }
    }
    case 'blinko_write_note': {
      const content = args.content as string
      const noteId = args.noteId !== undefined ? Number(args.noteId) : undefined
      const apiToken = process.env.BLINKO_TOKEN || docSources.find(s => s.id === 'blinko')?.apiToken || ''
      if (!apiToken) {
        return { content: [{ type: 'text', text: '错误: 未配置 BLINKO_TOKEN，请在 .env 中配置' }], isError: true }
      }
      if (!content) return { content: [{ type: 'text', text: '错误: content 参数必填' }], isError: true }
      const result = await blinkoRequest<{ id?: number; error?: string }>(
        '/api/v1/note/upsert',
        'POST',
        { content, ...(noteId ? { id: noteId } : {}), type: -1 },
        apiToken,
      )
      if (result.error || !result.id) {
        return { content: [{ type: 'text', text: `写入失败: ${result.error || JSON.stringify(result)}` }], isError: true }
      }
      return { content: [{ type: 'text', text: `✓ 笔记已保存，ID: ${result.id}` }] }
    }
    case 'blinko_search': {
      const query = args.query as string
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      const apiToken = process.env.BLINKO_TOKEN || docSources.find(s => s.id === 'blinko')?.apiToken || ''
      if (!apiToken) {
        return { content: [{ type: 'text', text: '错误: 未配置 BLINKO_TOKEN，请在 .env 中配置' }], isError: true }
      }
      // 先获取所有笔记，再在本地过滤（Blinko API 没有独立的搜索端点）
      const allNotes = await blinkoRequest<BlinkoNote[]>(
        '/api/v1/note/list',
        'POST',
        { page: 1, size: 200, orderBy: 'desc', type: -1, isRecycle: false },
        apiToken,
      )
      if (!Array.isArray(allNotes)) {
        return { content: [{ type: 'text', text: `Blinko API 错误: ${JSON.stringify(allNotes)}` }], isError: true }
      }
      const q = query.toLowerCase()
      const matches = allNotes.filter(n => n.content?.toLowerCase().includes(q))
      const preview = matches.slice(0, 20).map(n => ({
        id: n.id,
        content: n.content?.slice(0, 150) || '(empty)',
        tags: n.tags,
      }))
      return { content: [{ type: 'text', text: JSON.stringify({ count: matches.length, results: preview }, null, 2) }] }
    }
    // ── 工作区级文档入口工具（P1 索引完整性）───────────────────────────────────
    case 'axi_docs_list_workspace_doc_categories': {
      return { content: [{ type: 'text', text: JSON.stringify(await listWorkspaceDocCategories(), null, 2) }] }
    }
    case 'axi_docs_read_workspace_doc': {
      const category = args.category as string
      const docPath = args.path as string
      if (!category || !docPath) {
        return { content: [{ type: 'text', text: '错误: category 和 path 参数必填' }], isError: true }
      }
      return { content: [{ type: 'text', text: JSON.stringify(await readWorkspaceDoc({ category, path: docPath }), null, 2) }] }
    }
    case 'axi_docs_search_workspace_root': {
      const query = args.query as string
      const locale = args.locale as string | undefined
      if (!query) return { content: [{ type: 'text', text: '错误: query 参数必填' }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(await searchWorkspaceRoot({ query, locale }), null, 2) }] }
    }
    case 'axi_docs_list_governance_adrs': {
      return { content: [{ type: 'text', text: JSON.stringify(await listGovernanceAdrs(), null, 2) }] }
    }
    case 'axi_docs_list_workspace_audits': {
      const since = args.since as string | undefined
      return { content: [{ type: 'text', text: JSON.stringify(await listWorkspaceAudits({ since }), null, 2) }] }
    }
    default:
      return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true }
  }
}
