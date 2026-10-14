// Machine-readable capability catalogue for task-execution-routing/v1 consumers.
// Unknown tools default to side_effect so a future registration cannot
// accidentally become available to an Agent without a policy review.

import type { ToolAccessMode, CallerIdentity, ToolCapability } from './types'

export type { ToolAccessMode, CallerIdentity, ToolCapability }

const READ_ONLY_AGENT_TOOL: ToolCapability = {
  access: 'read_only',
  agentAllowed: true,
  description: '只读检索或固定摘要，可由受限 Agent 在有效工作流路由下使用。',
}

const READ_ONLY_HUMAN_TOOL: ToolCapability = {
  access: 'read_only',
  agentAllowed: false,
  description: '只读原文或开放输出；不向受限 Agent 暴露。',
}

const EFFECT_TOOL: ToolCapability = {
  access: 'side_effect',
  agentAllowed: false,
  description: '会写入、运行命令或触发外部副作用；受限 Agent 只能提出工作流审批提案。',
}

export const MCP_TOOL_CAPABILITIES: Record<string, ToolCapability> = {
  obsidian_scan: READ_ONLY_AGENT_TOOL,
  obsidian_read: READ_ONLY_HUMAN_TOOL,
  obsidian_write: EFFECT_TOOL,
  obsidian_list: READ_ONLY_AGENT_TOOL,
  obsidian_search: READ_ONLY_AGENT_TOOL,
  obsidian_fulltext_search: READ_ONLY_AGENT_TOOL,
  obsidian_write_note: EFFECT_TOOL,
  knowledge_catalog: READ_ONLY_AGENT_TOOL,
  knowledge_search: READ_ONLY_AGENT_TOOL,
  axi_docs_list_sources: READ_ONLY_AGENT_TOOL,
  axi_docs_search: READ_ONLY_AGENT_TOOL,
  axi_docs_read: READ_ONLY_HUMAN_TOOL,
  axi_docs_context_summary: READ_ONLY_AGENT_TOOL,
  axi_docs_skill_search: READ_ONLY_AGENT_TOOL,
  axi_docs_workspace_status: READ_ONLY_AGENT_TOOL,
  axi_docs_project_summary: READ_ONLY_AGENT_TOOL,
  axi_docs_project_onboard: READ_ONLY_AGENT_TOOL,
  axi_docs_handoff_check: EFFECT_TOOL,
  axi_docs_get_tool_capabilities: READ_ONLY_AGENT_TOOL,
  blinko_list_notes: READ_ONLY_AGENT_TOOL,
  blinko_read_note: READ_ONLY_HUMAN_TOOL,
  blinko_write_note: EFFECT_TOOL,
  blinko_search: READ_ONLY_AGENT_TOOL,
  axi_docs_list_workspace_doc_categories: READ_ONLY_AGENT_TOOL,
  axi_docs_read_workspace_doc: READ_ONLY_HUMAN_TOOL,
  axi_docs_search_workspace_root: READ_ONLY_AGENT_TOOL,
  axi_docs_list_governance_adrs: READ_ONLY_AGENT_TOOL,
  axi_docs_list_workspace_audits: READ_ONLY_AGENT_TOOL,
}

export function getToolCapability(name: string): ToolCapability {
  // Unknown tools are effects by default, so a future registration cannot
  // accidentally become available to an Agent without a policy review.
  return MCP_TOOL_CAPABILITIES[name] ?? EFFECT_TOOL
}
