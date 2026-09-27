import { afterEach, describe, expect, it, vi } from 'vitest'
import * as knowledgeBase from '../lib/knowledgeBase'
import { getToolCapability, getToolSchemas } from './server'

afterEach(() => {
  vi.restoreAllMocks()
})

const TOOL_NAMES_WITH_HANDOFF = new Set([
  'axi_docs_project_onboard',
  'axi_docs_handoff_check',
])

function findTool(name: string) {
  return getToolSchemas().find((t) => t.name === name)
}

async function callTool(name: string, args: Record<string, unknown>, caller: 'human' | 'bounded_agent' = 'human') {
  const { createServer } = await import('./server')
  const server = createServer(caller)
  const handlers = (server as unknown as { _requestHandlers?: Map<string, (req: unknown) => Promise<unknown>> })._requestHandlers
  expect(handlers).toBeInstanceOf(Map)
  const handler = handlers!.get('tools/call')
  expect(handler).toBeDefined()
  return handler!({ method: 'tools/call', params: { name, arguments: args } }) as Promise<{
    isError?: boolean
    content: Array<{ type: string; text: string }>
  }>
}

describe('mcp tools: handoff schema', () => {
  it('registers axi_docs_project_onboard in the tool schema list', () => {
    const onboard = findTool('axi_docs_project_onboard')
    expect(onboard).toBeDefined()
    expect(onboard?.inputSchema?.properties).toHaveProperty('project')
    expect(onboard?.inputSchema?.required).toEqual(['project'])
    expect(TOOL_NAMES_WITH_HANDOFF.has(onboard!.name)).toBe(true)
  })

  it('registers axi_docs_handoff_check with a smoke flag', () => {
    const check = findTool('axi_docs_handoff_check')
    expect(check).toBeDefined()
    expect(check?.inputSchema?.properties).toHaveProperty('project')
    expect(check?.inputSchema?.properties).toHaveProperty('smoke')
    expect(check?.inputSchema?.required).toEqual(['project'])
  })
})

describe('mcp tools: handoff / onboard runtime', () => {
  // Reach the registered handler via the SDK's internal Map. The keys are
  // method names ('tools/list', 'tools/call') and the values are functions
  // that accept a fully-formed JSON-RPC request object.
  it('project_onboard returns the project handoff card when the project is present (T1)', async () => {
    vi.spyOn(knowledgeBase, 'getProjectHandoffCard').mockResolvedValue({
      state: 'ok',
      readiness: 'verified',
      score: 10,
      readOrder: ['AGENTS.md', 'README.md'],
      entrypoints: [{ id: 'mcp', path: 'app/src/mcp/server.ts', purpose: 'Expose tools' }],
      smokeCommand: 'pnpm docs:check',
      verifyCommand: 'pnpm verify',
      currentWork: { active: ['Maintain handoff'], knownFailures: [] },
      lastVerifiedAt: '2026-06-11T05:34:37.955Z',
      ageDays: 0.5,
      handoffPath: '/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/HANDOFF.md',
      manifestPath: '/Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/project-docs.manifest.json',
      handoffSource: 'handoff',
      handoffGeneratedAt: '2026-06-11T05:34:37.955Z',
    })
    vi.spyOn(knowledgeBase, 'getProjectSummary').mockResolvedValue(null)

    const response = await callTool('axi_docs_project_onboard', { project: 'axi-docs' })
    const parsed = JSON.parse(response.content[0].text)
    expect(parsed.project.id).toBe('axi-docs')
    expect(parsed.readiness).toBe('verified')
    expect(parsed.readOrder).toContain('AGENTS.md')
    expect(parsed.smokeCommand).toBe('pnpm docs:check')
  })

  it('project_onboard returns an error when project is missing (T2)', async () => {
    const response = await callTool('axi_docs_project_onboard', {})
    expect(response.isError).toBe(true)
  })

  it('handoff_check returns snapshot + handoff fields without running smoke (T3)', async () => {
    vi.spyOn(knowledgeBase, 'getProjectHandoffCard').mockResolvedValue({
      state: 'ok',
      readiness: 'verified',
      score: 10,
      readOrder: ['AGENTS.md'],
      entrypoints: [],
      smokeCommand: 'echo smoke',
      verifyCommand: 'pnpm verify',
      currentWork: { active: [], knownFailures: [] },
      lastVerifiedAt: '2026-06-11T05:34:37.955Z',
      ageDays: 0.5,
      handoffPath: null,
      manifestPath: null,
      handoffSource: 'handoff',
      handoffGeneratedAt: '2026-06-11T05:34:37.955Z',
    })
    vi.spyOn(knowledgeBase, 'getHandoffSnapshotStatus').mockResolvedValue({
      source: 'handoff',
      generatedAt: '2026-06-11T05:34:37.955Z',
      ageDays: 0.5,
    })

    const response = await callTool('axi_docs_handoff_check', { project: 'axi-docs' })
    const parsed = JSON.parse(response.content[0].text)
    expect(parsed.snapshot.source).toBe('handoff')
    expect(parsed.handoff.state).toBe('ok')
    expect(parsed.smoke.enabled).toBe(false)
    expect(parsed.smoke.ran).toBe(false)
  })

  it('handoff_check with smoke=true runs the declared smoke command (T4)', async () => {
    vi.spyOn(knowledgeBase, 'getProjectHandoffCard').mockResolvedValue({
      state: 'ok',
      readiness: 'verified',
      score: 10,
      readOrder: [],
      entrypoints: [],
      smokeCommand: 'true',
      verifyCommand: null,
      currentWork: { active: [], knownFailures: [] },
      lastVerifiedAt: '2026-06-11T05:34:37.955Z',
      ageDays: 0.5,
      handoffPath: null,
      manifestPath: null,
      handoffSource: 'handoff',
      handoffGeneratedAt: '2026-06-11T05:34:37.955Z',
    })
    vi.spyOn(knowledgeBase, 'getHandoffSnapshotStatus').mockResolvedValue({
      source: 'handoff',
      generatedAt: '2026-06-11T05:34:37.955Z',
      ageDays: 0.5,
    })

    const response = await callTool('axi_docs_handoff_check', { project: 'axi-docs', smoke: true })
    const parsed = JSON.parse(response.content[0].text)
    expect(parsed.smoke.enabled).toBe(true)
    expect(parsed.smoke.ran).toBe(true)
    expect(parsed.smoke.exitCode).toBe(0)
  })

  it('handoff_check with smoke=true and no smoke command reports "no smoke command declared" (T5)', async () => {
    vi.spyOn(knowledgeBase, 'getProjectHandoffCard').mockResolvedValue({
      state: 'ok',
      readiness: 'verified',
      score: 10,
      readOrder: [],
      entrypoints: [],
      smokeCommand: null,
      verifyCommand: null,
      currentWork: { active: [], knownFailures: [] },
      lastVerifiedAt: '2026-06-11T05:34:37.955Z',
      ageDays: 0.5,
      handoffPath: null,
      manifestPath: null,
      handoffSource: 'handoff',
      handoffGeneratedAt: '2026-06-11T05:34:37.955Z',
    })
    vi.spyOn(knowledgeBase, 'getHandoffSnapshotStatus').mockResolvedValue({
      source: 'handoff',
      generatedAt: '2026-06-11T05:34:37.955Z',
      ageDays: 0.5,
    })

    const response = await callTool('axi_docs_handoff_check', { project: 'axi-docs', smoke: true })
    const parsed = JSON.parse(response.content[0].text)
    expect(parsed.smoke.enabled).toBe(true)
    expect(parsed.smoke.ran).toBe(false)
    expect(parsed.smoke.output).toContain('no smoke command')
  })
})

describe('mcp tools: workflow-first Agent boundary', () => {
  it('publishes machine-readable read-only/effect annotations', () => {
    const write = findTool('obsidian_write')
    const summary = findTool('axi_docs_context_summary')
    expect(getToolCapability('obsidian_write')).toMatchObject({ access: 'side_effect', agentAllowed: false })
    expect(getToolCapability('axi_docs_context_summary')).toMatchObject({ access: 'read_only', agentAllowed: true })
    expect(write?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true })
    expect(write?.xAxiCapability).toMatchObject({ access: 'side_effect', agentAllowed: false })
    expect(summary?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
  })

  it('converts bounded Agent document writes into a workflow approval proposal', async () => {
    const response = await callTool('obsidian_write', {
      source: 'obsidian',
      path: 'agent-output.md',
      content: '# proposal only',
      axiExecution: {
        actor: 'bounded_agent',
        traceId: 'trace-docs-agent-test',
        idempotencyKey: 'idempotency-docs-agent-test',
      },
    }, 'bounded_agent')
    const parsed = JSON.parse(response.content[0].text)
    expect(response.isError).toBe(true)
    expect(parsed.code).toBe('approval_required')
    expect(parsed.proposal.action.tool).toBe('obsidian_write')
    expect(parsed.proposal.actionDigest).toMatch(/^[a-f0-9]{64}$/)
  })

  it('does not expose raw document read to a bounded Agent', async () => {
    const response = await callTool('axi_docs_read', {
      source: 'obsidian',
      path: 'private.md',
    }, 'bounded_agent')
    const parsed = JSON.parse(response.content[0].text)
    expect(response.isError).toBe(true)
    expect(parsed.code).toBe('agent_tool_not_allowed')
  })

  it('returns a versioned fixed context summary for a bounded Agent', async () => {
    vi.spyOn(knowledgeBase, 'readKnowledgeFile').mockResolvedValue('# Title\n\nA bounded context.')
    const response = await callTool('axi_docs_context_summary', {
      source: 'axi-docs',
      path: 'docs/example.md',
    }, 'bounded_agent')
    const parsed = JSON.parse(response.content[0].text)
    expect(response.isError).not.toBe(true)
    expect(parsed.contextRef.id).toBe('axi-docs:axi-docs:docs/example.md')
    expect(parsed.contextRef.version).toMatch(/^[a-f0-9]{64}$/)
    expect(parsed.summary.excerpt).toContain('bounded context')
  })
})
