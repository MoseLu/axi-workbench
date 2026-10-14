// Backward-compatible entry point for the Axi Docs MCP server.
//
// `server.ts` previously contained the full implementation in one file
// (~2,500 lines). After this refactor it is a thin re-export shim that
// preserves the existing public surface (`createServer`, `getToolSchemas`,
// `getToolCapability`, `MCP_TOOL_CAPABILITIES`, the tool-capability types)
// and delegates the runtime entry point to `./stdioTransport`.
//
// New code should import directly from the focused modules:
//   ./stdioServer   — createServer factory for stdio
//   ./httpTransport — HTTP / SSE transport + REST proxy
//   ./toolRegistry  — getToolSchemas + handleToolCall dispatcher
//   ./capabilities  — getToolCapability + MCP_TOOL_CAPABILITIES
//   ./types         — shared ToolCapability / CallerIdentity / etc.

export { createServer } from './stdioServer'
export { getToolSchemas, handleToolCall } from './toolRegistry'
export { MCP_TOOL_CAPABILITIES, getToolCapability } from './capabilities'
export type {
  ToolAccessMode,
  CallerIdentity,
  ToolCapability,
  ToolAnnotations,
  ToolSchema,
  ToolCallResult,
  DocSource,
  FileItem,
  TagInfo,
  GraphNode,
  GraphEdge,
  GlobalGraphNode,
  GlobalGraphEdge,
  BlinkoNote,
  ToolDispatcher,
} from './types'

// Re-export `main` so legacy callers (and the package.json scripts
// `mcp` / `mcp:http`) can keep importing it from `./server` if they
// need to. The stdioTransport module also self-invokes `main()` on
// direct execution, so this import is sufficient.
export { main } from './stdioTransport'
