// Shared TypeScript types for the Axi Docs MCP server.
// Pure type module — no runtime side effects, safe to import from anywhere.

export type ToolAccessMode = 'read_only' | 'side_effect'

export type CallerIdentity = 'human' | 'bounded_agent'

export interface ToolCapability {
  access: ToolAccessMode
  agentAllowed: boolean
  description: string
}

export interface ToolAnnotations {
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
}

export interface ToolSchema {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: ToolAnnotations
  xAxiCapability?: { access: ToolAccessMode; agentAllowed: boolean }
  handler?: (...args: any[]) => Promise<unknown>
}

export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export interface DocSource {
  id: string
  name: string
  path: string
  enabled: boolean
  description?: string
  type?: 'local' | 'api'
  kind?: string
  adapter?: string
  audience?: string[]
  readOnly?: boolean
  organizationHint?: string
  apiUrl?: string
  apiToken?: string
  icon?: string
}

export interface FileItem {
  id: string
  name: string
  path: string
  relativePath: string
  type: 'file' | 'directory'
  extension: string
  lastModified: string
  sourceId: string
}

export interface TagInfo {
  name: string
  count: number
}

export interface GraphNode {
  id: string
  label: string
  kind: 'current' | 'note' | 'tag'
  x: number
  y: number
  vx: number
  vy: number
}

export interface GraphEdge {
  source: string
  target: string
  kind: 'wikilink' | 'tag'
}

export interface GlobalGraphNode {
  id: string
  label: string
  kind: 'note' | 'tag'
  path?: string
  tags?: string[]
  x?: number
  y?: number
  vx?: number
  vy?: number
}

export interface GlobalGraphEdge {
  source: string | object
  target: string | object
  kind: 'wikilink' | 'tag'
}

export interface BlinkoNote {
  id: number
  content: string
  type: 0 | 1
  tags?: string[]
  files?: unknown[]
  createdAt: string
  updatedAt: string
}

export type ToolDispatcher = (
  name: string,
  args: Record<string, unknown>,
  caller: CallerIdentity,
) => Promise<ToolCallResult>
