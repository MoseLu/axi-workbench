// HTTP / SSE transport: bearer-token auth, CORS, JSON-RPC dispatch,
// REST `/api/*` proxy, and static SPA hosting for the built `dist/`
// artifact. State for auth + rate limit lives in `./auth`.

import fs from 'fs'
const fsp = fs.promises
import http from 'http'
import path from 'path'
import { URL } from 'url'
import { handleToolCall, getToolSchemas } from './toolRegistry'
import { handleBlinkoApi } from './blinko'
import {
  scanDir,
  readFile,
  writeFile,
  searchFiles,
  searchFullText,
  getAllTags,
} from './fileOps'
import { buildGraphData, buildGlobalGraph } from './graph'
import { analyzeDocumentContent } from './ai'
import { docSources, sanitizeSource } from './docSources'
import {
  authMiddleware,
  getAllowedOrigin,
  getHttpCallerIdentity,
  readBody,
} from './auth'
import { guardBoundedAgentTool } from './agentGuard'

const HOME_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Axi Docs MCP</title>
<style>
  body { font-family: system-ui; max-width: 720px; margin: 60px auto; padding: 0 20px; background: #fafafa; }
  h1 { color: #333; }
  h2 { color: #666; margin-top: 2em; }
  code { background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  pre { background: #222; color: #eee; padding: 20px; border-radius: 8px; overflow-x: auto; }
  .tag { display: inline-block; background: #0070f3; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; margin-left: 8px; }
  .method { color: #79b8ff; }
  .path { color: #9ecbff; }
  .note { background: #fffbea; border: 1px solid #f0db4f; padding: 12px 16px; border-radius: 6px; margin: 20px 0; }
</style>
</head>
<body>
<h1>Axi Docs MCP Server <span class="tag">HTTP</span></h1>
<p>Obsidian 知识库 MCP 服务（HTTP 传输模式），支持 MCP JSON-RPC 和 REST API 两种调用方式。</p>

<div class="note">
  <strong>认证方式：</strong>所有需要认证的请求需带 <code>Authorization: Bearer <token></code> 请求头或 <code>?token=...</code> 查询参数。Token 在服务启动日志中显示，或查看 <code>.axi-docs-token</code> 文件。
</div>

<h2>可用工具 / REST 端点</h2>
<table style="width:100%;border-collapse:collapse;text-align:left;">
<tr style="border-bottom:1px solid #ddd;"><th style="padding:8px;">方法</th><th style="padding:8px;">路径</th><th style="padding:8px;">说明</th></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">GET</span></td><td style="padding:8px;"><code>/api/scan?source=obsidian&path=&token=...</code></td><td style="padding:8px;">扫描目录</td></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">GET</span></td><td style="padding:8px;"><code>/api/read?source=obsidian&path=&token=...</code></td><td style="padding:8px;">读取文件</td></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">POST</span></td><td style="padding:8px;"><code>/api/write?source=obsidian&path=&token=...</code></td><td style="padding:8px;">写入文件（body: {"content":"..."})</td></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">GET</span></td><td style="padding:8px;"><code>/api/sources?token=...</code></td><td style="padding:8px;">列出文档源</td></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">GET</span></td><td style="padding:8px;"><code>/api/search?source=obsidian&query=&path=&token=...</code></td><td style="padding:8px;">搜索文件</td></tr>
<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><span class="method">GET</span></td><td style="padding:8px;"><code>/health</code></td><td style="padding:8px;">健康检查（无需认证）</td></tr>
</table>

<h2>使用示例</h2>
<pre>TOKEN=$(cat .axi-docs-token)

curl -H "Authorization: Bearer $TOKEN" "http://localhost:3010/api/scan"

curl -H "Authorization: Bearer $TOKEN" \\
  "http://localhost:3010/api/read?source=obsidian&path=inbox/test.md"

curl -X POST -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"content":"# Hello\\n\\nworld"}' \\
  "http://localhost:3010/api/write?source=obsidian&path=inbox/test.md"</pre>

<h2>Claude Code 远程配置</h2>
<p>在 <code>~/.claude/settings.json</code> 中添加：</p>
<pre>{
  "allowedMcpServers": [{
    "serverName": "axi-docs-remote",
    "serverUrl": "http://你的服务器地址:3010/mcp"
  }]
}</pre>
<p>环境变量 <code>MCP_AUTH_TOKEN</code> 设置访问令牌。</p>
</body>
</html>`

export async function startHttpServer(port: number) {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  }

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname

    // ── MCP 协议端点 ────────────────────────────────────────────────────────

    if (pathname === '/mcp' || pathname === '/mcp/') {
      // 认证检查
      if (!authMiddleware(req)) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="axi-docs-mcp"',
        })
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null }))
        return
      }

      const body = await readBody(req)

      const origin = getAllowedOrigin(req.headers.origin)
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      })

      try {
        const request = JSON.parse(body)
        const id = request.id

        if (request.method === 'initialize') {
          const response = {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'axi-docs-mcp', version: '1.0.0' },
            },
          }
          res.end(JSON.stringify(response))
        } else if (request.method === 'tools/list') {
          const tools = getToolSchemas()
          const response = { jsonrpc: '2.0', id, result: { tools } }
          res.end(JSON.stringify(response))
        } else if (request.method === 'tools/call') {
          // 手动处理 tools/call，因为 MCP SDK 的 HTTP 传输需要额外依赖
          const { name, arguments: args } = request.params
          const result = await handleToolCall(name, args || {}, getHttpCallerIdentity(req) ?? 'human')
          const response = { jsonrpc: '2.0', id, result }
          res.end(JSON.stringify(response))
        } else {
          res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }))
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: `Internal error: ${msg}` } }))
      }
      return
    }

    // ── CORS 预检 ──────────────────────────────────────────────────────────

    if (req.method === 'OPTIONS') {
      const origin = getAllowedOrigin(req.headers.origin)
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      })
      res.end()
      return
    }

    // ── 健康检查 + 工具列表（无需认证，方便检测服务状态）─────────────────────

    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', tools: getToolSchemas().map((t) => t.name) }))
      return
    }

    // ── API 代理（便捷 HTTP API，无需 JSON-RPC，远程访问友好）────────────────

    if (pathname.startsWith('/api/')) {
      // Blinko API 代理
      if (url.searchParams.get('source') === 'blinko') {
        if (!authMiddleware(req)) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized' }))
          return
        }
        handleBlinkoApi(req, res, url)
        return
      }

      // 本地源 API - 无需认证（内部服务，通过 Nginx/IP 白名单保护）

      const apiPath = pathname.slice(5) // 去掉 /api/（pathname 以 / 开头）
      const source = url.searchParams.get('source') || 'obsidian'
      const filePath = url.searchParams.get('path') || ''

      try {
        let result: string | null = null
        let statusCode = 200

        switch (apiPath) {
          case 'file': // 别名：read
          case 'read': {
            if (!filePath) throw new Error('path 参数必填')
            result = await readFile(source, filePath)
            if (result === null) {
              statusCode = 404
              result = `文件不存在：${filePath}`
            }
            break
          }
          case 'scan': {
            const items = await scanDir(source, filePath || undefined)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(items))
            return
          }
          case 'write': {
            if (!filePath) throw new Error('path 参数必填')
            const payload = JSON.parse(await readBody(req))
            const guarded = guardBoundedAgentTool(
              'obsidian_write',
              { source, path: filePath, content: payload.content || '', axiExecution: payload.axiExecution },
              getHttpCallerIdentity(req) ?? 'human',
            )
            if (guarded) {
              statusCode = 409
              result = guarded.content[0].text
              break
            }
            const writeResult = await writeFile(source, filePath, payload.content || '')
            if (!writeResult.success) {
              statusCode = 400
              result = writeResult.error || '写入失败'
            } else {
              result = JSON.stringify({ success: true, path: writeResult.path })
            }
            break
          }
          case 'sources': {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(docSources.filter((s) => s.enabled).map(sanitizeSource)))
            return
          }
          case 'search': {
            const query = url.searchParams.get('query') || url.searchParams.get('q')
            if (!query) throw new Error('query 参数必填')
            const items = await searchFiles(source, query, filePath || undefined)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(items))
            return
          }
          case 'fulltext_search': {
            const query = url.searchParams.get('query')
            if (!query) throw new Error('query 参数必填')
            const items = await searchFullText(source, query)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(items))
            return
          }
          case 'tags': {
            const tags = await getAllTags(source)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(tags))
            return
          }
          case 'graph': {
            if (!filePath) throw new Error('path 参数必填')
            const graphData = await buildGraphData(source, filePath)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(graphData))
            return
          }
          case 'global-graph': {
            const { nodes, edges, orphanNodes } = await buildGlobalGraph(source)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ nodes, edges, orphanNodes }))
            return
          }
          case 'catalog': {
            const catalog = await (await import('../lib/knowledgeBase')).getKnowledgeCatalog(source)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(catalog))
            return
          }
          case 'ai/analyze': {
            const payload = JSON.parse(await readBody(req))
            const aiResult = await analyzeDocumentContent(payload.content || '', payload.fileName || '')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(aiResult))
            return
          }
          default:
            statusCode = 404
            result = `未知端点: ${apiPath}`
        }

        const origin = getAllowedOrigin(req.headers.origin)
        res.writeHead(statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Max-Age': '86400',
        })
        res.end(JSON.stringify(result))
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        const code = (e as { statusCode?: number }).statusCode ?? 400
        res.writeHead(code, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: msg }))
      }
      return
    }

    // ── 静态首页 / SPA 部署 ──────────────────────────────────────────────────

    const distDir = path.join(process.cwd(), 'dist')
    const distIndex = path.join(distDir, 'index.html')
    const hasBuiltApp = fs.existsSync(distIndex)

    const spaRoutes = [
      pathname === '/' || pathname === '/index.html',
      pathname.startsWith('/zh/guide/'),
      pathname.startsWith('/en/guide/'),
      pathname.startsWith('/nodes/'),
      pathname.startsWith('/docs/'),
    ]

    if (spaRoutes.some(Boolean)) {
      if (hasBuiltApp) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(await fsp.readFile(distIndex, 'utf-8'))
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(HOME_PAGE)
      }
      return
    }

    const staticRelativePath = pathname.slice(1)
    const ext = path.extname(staticRelativePath)
    if (ext && mimeTypes[ext]) {
      const staticPath = hasBuiltApp
        ? path.join(distDir, staticRelativePath)
        : path.join(process.cwd(), pathname)
      try {
        const staticContent = await fsp.readFile(staticPath)
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] })
        res.end(staticContent)
        return
      } catch {
        // file not found, fall through to 404
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  })

  // BIND_ADDRESS 可绑定到指定网卡，例如 Tailscale IP (100.x.x.x) 或仅本机 (127.0.0.1)
  const bindAddress = process.env.BIND_ADDRESS || '0.0.0.0'
  httpServer.listen(port, bindAddress, () => {
    console.error(`[axi-docs-mcp] HTTP 服务已启动: http://${bindAddress}:${port}`)
    console.error(`[axi-docs-mcp] 健康检查: http://${bindAddress}:${port}/health`)
    console.error('[axi-docs-mcp] 访问 token 已配置（值已脱敏，不写入日志）')
    console.error(`[axi-docs-mcp] MCP JSON-RPC: http://${bindAddress}:${port}/mcp`)
    console.error(`[axi-docs-mcp] REST API:     http://${bindAddress}:${port}/api/scan`)
  })

  return httpServer
}
