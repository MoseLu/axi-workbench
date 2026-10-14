// Bounded-agent guard helpers: caller identity resolution, canonical-JSON
// action digests, and effect-proposal responses for the workflow-routing
// protocol. Imported by tool registry + http transport.

import crypto from 'crypto'
import { getToolCapability } from './capabilities'
import type { CallerIdentity, ToolCallResult } from './types'

export type { CallerIdentity, ToolCallResult } from './types'

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function resolveCallerIdentity(
  defaultIdentity: CallerIdentity,
  args: Record<string, unknown> | undefined,
): CallerIdentity {
  const execution = asRecord(args?.axiExecution)
  return defaultIdentity === 'bounded_agent' || execution?.actor === 'bounded_agent'
    ? 'bounded_agent'
    : 'human'
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function actionDigest(action: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(canonicalJson(action)).digest('hex')
}

export function agentEffectProposal(name: string, args: Record<string, unknown>): ToolCallResult {
  const execution = asRecord(args.axiExecution)
  const traceId = typeof execution?.traceId === 'string' ? execution.traceId : ''
  const idempotencyKey = typeof execution?.idempotencyKey === 'string' ? execution.idempotencyKey : ''
  if (!traceId || !idempotencyKey) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ code: 'workflow_required', message: '受限 Agent 的副作用提案必须携带工作流 traceId 和 idempotencyKey。' }) }],
      isError: true,
    }
  }
  const actionArguments = { ...args }
  delete actionArguments.axiExecution
  const action = { kind: 'axi_docs_tool_effect', tool: name, arguments: actionArguments }
  const digest = actionDigest(action)
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        schemaVersion: 'task-execution-routing/v1',
        code: 'approval_required',
        proposal: {
          proposalId: `axi-docs-${digest.slice(0, 24)}`,
          traceId,
          idempotencyKey,
          summary: `Bounded Agent requested ${name}; no document or command was executed.`,
          action,
          actionDigest: digest,
        },
      }, null, 2),
    }],
    isError: true,
  }
}

export function guardBoundedAgentTool(
  name: string,
  args: Record<string, unknown> | undefined,
  caller: CallerIdentity,
): ToolCallResult | null {
  if (resolveCallerIdentity(caller, args) !== 'bounded_agent') return null
  const capability = getToolCapability(name)
  if (capability.agentAllowed) return null
  if (capability.access === 'side_effect') return agentEffectProposal(name, args ?? {})
  return {
    content: [{ type: 'text', text: JSON.stringify({ code: 'agent_tool_not_allowed', message: `${name} is not available to a bounded Agent.` }) }],
    isError: true,
  }
}
