// Workspace-level document tools (P1 索引完整性).
// These tools surface the cross-project documentation indexes
// (governance, state, audit, adr, architecture, axi, prd, registry,
// scripts, incubator) and provide a read/search API over them.

import fs from 'fs'
const fsp = fs.promises
import * as knowledgeBase from '../lib/knowledgeBase'
import { resolveWorkspacePathFromConfig } from '../config/documentSources'

export async function listWorkspaceDocCategories() {
  const categories = [
    { name: 'governance', source_id: 'docs/governance/', note: 'explicitly excluded per docs/governance/README.md' },
    { name: 'state', source_id: 'workspace-state-docs', files: 7 },
    { name: 'audit', source_id: 'workspace-audit-docs', files: 2 },
    { name: 'adr', source_id: 'axi-workspace-governance-docs/adr/', note: 'canonical in foundation/workspace-governance/docs/adr/' },
    { name: 'architecture', source_id: 'workspace-architecture-docs', files: 7 },
    { name: 'axi', source_id: 'workspace-axi-docs', files: 25 },
    { name: 'prd', source_id: 'workspace-prd-docs', files: 6 },
    { name: 'registry', source_id: 'docs/registry/', files: 1 },
    { name: 'scripts', source_id: 'docs/axi-meta/scripts/', files: 3 },
    { name: 'incubator', source_id: 'docs/incubator/', note: 'non-project, not indexed' },
  ]
  return { categories }
}

export async function readWorkspaceDoc({ category, path }: { category: string; path: string }) {
  const pathMap: Record<string, string> = {
    governance: resolveWorkspacePathFromConfig('docs', 'governance'),
    state: resolveWorkspacePathFromConfig('docs', 'state'),
    audit: resolveWorkspacePathFromConfig('docs', 'audit'),
    adr: resolveWorkspacePathFromConfig('foundation', 'workspace-governance', 'docs', 'adr'),
    architecture: resolveWorkspacePathFromConfig('docs', 'architecture'),
    axi: resolveWorkspacePathFromConfig('docs', 'axi'),
    prd: resolveWorkspacePathFromConfig('docs', 'prd'),
    registry: resolveWorkspacePathFromConfig('docs', 'registry'),
    scripts: resolveWorkspacePathFromConfig('scripts'),
    incubator: resolveWorkspacePathFromConfig('incubator'),
  }
  const baseDir = pathMap[category]
  if (!baseDir) {
    return { error: `unknown category: ${category}` }
  }
  try {
    const content = await fsp.readFile(`${baseDir}/${path}`, 'utf8')
    return { content }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}

export async function searchWorkspaceRoot({ query, locale }: { query: string; locale?: string }) {
  // 简化实现：从 knowledgeBase 检索（跨库搜索结果）
  try {
    const results = await knowledgeBase.searchKnowledgeAll(query)
    return { query, locale: locale || 'all', results }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { query, locale: locale || 'all', results: [], error: msg }
  }
}

export async function listGovernanceAdrs() {
  try {
    const files = await fsp.readdir(resolveWorkspacePathFromConfig('foundation', 'workspace-governance', 'docs', 'adr'))
    return {
      canonical_source: 'foundation/workspace-governance/docs/adr/',
      adrs: files.filter((f) => f.startsWith('ADR-')),
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}

export async function listWorkspaceAudits({ since }: { since?: string } = {}) {
  const sources = [
    resolveWorkspacePathFromConfig('docs', 'audit'),
    resolveWorkspacePathFromConfig('docs', 'audits'),
    resolveWorkspacePathFromConfig('workbench', 'axi-workbench', 'apps', 'axi-docs', 'docs', 'axi-workspace-governance', 'audits'),
    resolveWorkspacePathFromConfig('foundation', 'workspace-governance', 'docs', 'audits'),
  ]
  return { sources, since: since || 'all' }
}
