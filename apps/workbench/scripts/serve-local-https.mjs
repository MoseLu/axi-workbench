#!/usr/bin/env node

import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:https'
import { request as httpRequest } from 'node:http'
import { fileURLToPath } from 'node:url'
import { extname, join, relative, resolve, sep } from 'node:path'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distRoot = resolve(process.env.WORKBENCH_DIST_DIR || join(appRoot, 'dist'))
const host = process.env.WORKBENCH_HTTPS_HOST || '127.0.0.1'
const port = Number(process.env.WORKBENCH_HTTPS_PORT || '8443')
const certPath = process.env.WORKBENCH_TLS_CERT_FILE?.trim()
const keyPath = process.env.WORKBENCH_TLS_KEY_FILE?.trim()
const gatewayOrigin = process.env.WORKBENCH_LOCAL_GATEWAY_ORIGIN || 'http://127.0.0.1:8088'
const controlPlaneOrigin = process.env.WORKBENCH_LOCAL_CONTROL_PLANE_ORIGIN || 'http://127.0.0.1:8092'

function requiredFile(path, label) {
  if (!path || !existsSync(path)) {
    throw new Error(`${label} 不存在，请通过环境变量提供有效路径`)
  }
  return path
}

function parseOrigin(value, label) {
  let origin
  try {
    origin = new URL(value)
  } catch {
    throw new Error(`${label} 不是有效 URL: ${value}`)
  }
  if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
    throw new Error(`${label} 必须指向本机 HTTP 服务`)
  }
  return origin
}

const tlsCertPath = requiredFile(certPath, 'WORKBENCH_TLS_CERT_FILE')
const tlsKeyPath = requiredFile(keyPath, 'WORKBENCH_TLS_KEY_FILE')
if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
  throw new Error(`缺少 Web 构建产物: ${distRoot}，请先运行 pnpm --filter @axi/workbench build`)
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`WORKBENCH_HTTPS_PORT 无效: ${port}`)
}
const gateway = parseOrigin(gatewayOrigin, 'WORKBENCH_LOCAL_GATEWAY_ORIGIN')
const controlPlane = parseOrigin(controlPlaneOrigin, 'WORKBENCH_LOCAL_CONTROL_PLANE_ORIGIN')

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

function proxyRequest(request, response, origin, pathPrefix = '') {
  const incoming = new URL(request.url || '/', `https://${host}:${port}`)
  let pathname = incoming.pathname
  if (pathPrefix && pathname.startsWith(pathPrefix)) {
    pathname = pathname.slice(pathPrefix.length) || '/'
  }
  const target = new URL(`${pathname}${incoming.search}`, origin)
  const forwardedFor = request.socket.remoteAddress || '127.0.0.1'
  const headers = {
    ...request.headers,
    host: target.host,
    'x-forwarded-for': forwardedFor,
    'x-forwarded-host': request.headers.host || `${host}:${port}`,
    'x-forwarded-proto': 'https',
  }
  delete headers.connection

  const proxy = httpRequest(target, {
    headers,
    method: request.method,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
    upstreamResponse.pipe(response)
  })
  proxy.on('error', (error) => {
    if (!response.headersSent) {
      sendJson(response, 502, { ok: false, error: '本地上游服务不可用' })
    } else {
      response.destroy(error)
    }
  })
  request.pipe(proxy)
}

function resolveStaticFile(pathname) {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decodedPath.includes('\0') || decodedPath.includes('\\')) return null
  const requested = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '')
  const candidate = resolve(distRoot, requested)
  const relativePath = relative(distRoot, candidate)
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..' || relativePath.includes(`..${sep}`)) {
    return null
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  if (extname(requested)) return null
  const fallback = join(distRoot, 'index.html')
  return existsSync(fallback) ? fallback : null
}

function serveStatic(request, response, pathname) {
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.setHeader('allow', 'GET, HEAD')
    response.writeHead(405)
    response.end()
    return
  }
  const filePath = resolveStaticFile(pathname)
  if (!filePath) {
    sendJson(response, 404, { ok: false, error: '资源不存在' })
    return
  }
  const isDocument = filePath === join(distRoot, 'index.html')
  response.writeHead(200, {
    'cache-control': isDocument ? 'no-store' : 'public, max-age=31536000, immutable',
    'content-type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
  })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(filePath).on('error', () => {
    if (!response.headersSent) sendJson(response, 500, { ok: false, error: '资源读取失败' })
    else response.destroy()
  }).pipe(response)
}

const server = createServer({
  cert: readFileSync(tlsCertPath),
  key: readFileSync(tlsKeyPath),
}, (request, response) => {
  let incoming
  try {
    incoming = new URL(request.url || '/', `https://${host}:${port}`)
  } catch {
    sendJson(response, 400, { ok: false, error: '请求地址无效' })
    return
  }

  if (incoming.pathname === '/health') {
    sendJson(response, 200, { ok: true, service: 'axi-workbench-local-https' })
    return
  }
  if (incoming.pathname === '/api' || incoming.pathname.startsWith('/api/')) {
    proxyRequest(request, response, gateway)
    return
  }
  if (incoming.pathname === '/control-plane' || incoming.pathname.startsWith('/control-plane/')) {
    proxyRequest(request, response, controlPlane, '/control-plane')
    return
  }
  serveStatic(request, response, incoming.pathname)
})

server.on('clientError', (error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
  console.error(`[local-https] client error: ${error.message}`)
})

function close() {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 2_000).unref()
}

process.on('SIGINT', close)
process.on('SIGTERM', close)

server.listen(port, host, () => {
  console.log(`[local-https] https://${host}:${port}/`)
  console.log(`[local-https] static=${distRoot}`)
  console.log(`[local-https] gateway=${gateway.origin}`)
})
