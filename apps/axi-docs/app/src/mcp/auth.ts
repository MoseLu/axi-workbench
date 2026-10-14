// Token management, request size guard, CORS allow-list, brute-force
// protection, and the bearer-token auth middleware used by the HTTP
// transport. Single shared mutable state across the HTTP server lifetime.

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import http from 'http'
import { URL } from 'url'
import type { CallerIdentity } from './types'

export type { CallerIdentity } from './types'

// ─── Token 管理 ──────────────────────────────────────────────────────────────

const TOKEN_FILE = path.resolve(process.cwd(), '.axi-docs-token')

export function loadOrCreateToken(): string {
  // 1. 优先使用环境变量
  if (process.env.MCP_AUTH_TOKEN) return process.env.MCP_AUTH_TOKEN

  // 2. 从持久化文件读取
  if (fs.existsSync(TOKEN_FILE)) {
    const saved = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
    if (saved.length >= 32) return saved
  }

  // 3. 首次运行：生成强随机 token 并持久化
  const newToken = crypto.randomBytes(32).toString('hex')
  fs.writeFileSync(TOKEN_FILE, newToken, { mode: 0o600 }) // 仅 owner 可读
  console.error('[axi-docs-mcp] 首次运行，已生成访问 token 并保存至:', TOKEN_FILE)
  return newToken
}

export const AUTH_TOKEN = loadOrCreateToken()
// Agent Platform receives a separate credential. It must never reuse the
// human/UI token, so the caller identity can be enforced at the MCP boundary.
export const BOUNDED_AGENT_TOKEN = process.env.AXI_DOCS_BOUNDED_AGENT_TOKEN || ''

// ─── 请求安全常量 ──────────────────────────────────────────────────────────

export const MAX_BODY_SIZE = 10 * 1024 * 1024 // 10 MB

export const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim())
  : []

export function getAllowedOrigin(requestOrigin: string | undefined): string {
  if (!requestOrigin) return ALLOWED_ORIGINS[0] || ''
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin
  // 开发模式：若未配置允许域名则允许所有（便于本地调试）
  if (ALLOWED_ORIGINS.length === 0) return requestOrigin
  return ALLOWED_ORIGINS[0] || ''
}

export async function readBody(req: http.IncomingMessage): Promise<string> {
  let body = ''
  let size = 0
  for await (const chunk of req) {
    const bytes = chunk as { length: number }
    size += bytes.length
    if (size > MAX_BODY_SIZE) {
      throw Object.assign(new Error('Payload Too Large'), { statusCode: 413 })
    }
    body += chunk
  }
  return body
}

// ─── 暴力破解保护（速率限制）────────────────────────────────────────────────

const authFailures = new Map<string, { count: number; until: number }>()
const MAX_FAILURES = 10        // 10 次失败
const LOCKOUT_MS = 5 * 60_000 // 锁定 5 分钟

function getClientIp(req: http.IncomingMessage): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
    || req.socket.remoteAddress
    || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const rec = authFailures.get(ip)
  if (!rec) return false
  if (Date.now() < rec.until) return true
  authFailures.delete(ip)
  return false
}

function recordAuthFailure(ip: string): void {
  const rec = authFailures.get(ip) || { count: 0, until: 0 }
  rec.count++
  if (rec.count >= MAX_FAILURES) {
    rec.until = Date.now() + LOCKOUT_MS
    console.error(`[axi-docs-mcp] IP ${ip} 认证失败 ${rec.count} 次，锁定 5 分钟`)
  }
  authFailures.set(ip, rec)
}

function recordAuthSuccess(ip: string): void {
  authFailures.delete(ip)
}

// ─── 认证中间件 ───────────────────────────────────────────────────────────────

function requestToken(req: http.IncomingMessage): string {
  const authHeader = req.headers.authorization
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  return authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : url.searchParams.get('token') ?? ''
}

function tokenEquals(token: string, expected: string): boolean {
  if (!expected) return false
  const actualDigest = crypto.createHash('sha256').update(token).digest()
  const expectedDigest = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(actualDigest, expectedDigest) && token.length === expected.length
}

export function getHttpCallerIdentity(req: http.IncomingMessage): CallerIdentity | null {
  const token = requestToken(req)
  if (tokenEquals(token, BOUNDED_AGENT_TOKEN)) return 'bounded_agent'
  if (tokenEquals(token, AUTH_TOKEN)) return 'human'
  return null
}

export function authMiddleware(req: http.IncomingMessage): boolean {
  const ip = getClientIp(req)
  if (isRateLimited(ip)) return false

  const ok = getHttpCallerIdentity(req) !== null

  if (ok) { recordAuthSuccess(ip) } else { recordAuthFailure(ip) }
  return ok
}
