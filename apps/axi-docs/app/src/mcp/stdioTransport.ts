// Command-line entry point: dispatches between stdio (default) and
// HTTP transport. Called from `pnpm mcp` / `pnpm mcp:http` via
// `tsx src/mcp/server.ts [http]`.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { startHttpServer } from './httpTransport'
import { createServer } from './stdioServer'
import { loadDotEnv } from './envLoader'

export async function main() {
  const mode = process.argv[2]

  if (mode === 'http') {
    const port = parseInt(process.env.MCP_HTTP_PORT || '3010', 10)
    await startHttpServer(port)
  } else {
    // 默认 stdio 模式（本地 Claude Code 使用）
    const transport = new StdioServerTransport()
    const server = createServer()
    await server.connect(transport)
    console.error('[axi-docs-mcp] 已启动，stdio 模式')
  }
}

// Direct invocation: `tsx src/mcp/server.ts`
loadDotEnv()
main().catch((e) => {
  console.error('[axi-docs-mcp] 启动失败:', e)
  process.exit(1)
})
