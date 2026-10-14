// MCP stdio server factory. Owns the SDK Server instance and the request
// handlers (`tools/list`, `tools/call`). Calls into the shared
// `toolRegistry` for schema + dispatch.

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { getToolSchemas, handleToolCall } from './toolRegistry'
import type { CallerIdentity } from './types'

export type { CallerIdentity } from './types'

export function createServer(
  defaultCaller: CallerIdentity = process.env.AXI_DOCS_CALLER === 'bounded_agent' ? 'bounded_agent' : 'human',
) {
  const server = new Server(
    { name: 'axi-docs-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: getToolSchemas(),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    try {
      return await handleToolCall(name, (args ?? {}) as Record<string, unknown>, defaultCaller)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { content: [{ type: 'text', text: `错误: ${msg}` }], isError: true } as any
    }
  })

  return server
}
