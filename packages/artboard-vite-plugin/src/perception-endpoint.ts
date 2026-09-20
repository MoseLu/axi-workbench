/**
 * perception-endpoint.ts — Vite middleware plugin that exposes the
 * server-side perception store via three HTTP endpoints:
 *
 *   GET  /@axi-artboard/perception           → JSON snapshot
 *   GET  /@axi-artboard/perception/stream    → SSE event stream
 *   POST /@axi-artboard/perception/publish   → receive a packet
 *                                              from the browser,
 *                                              push it to SSE
 *                                              subscribers
 *
 * Why a separate plugin (not the source-attrs one): the source stamper
 * needs to run in both dev and production (it's a transform hook),
 * while the perception endpoint is dev-only (configureServer).
 * Splitting them lets consumers pick whichever they need.
 */

import type { Plugin } from 'vite'
import { getLatest, mergePublished, subscribe } from './server-perception.js'

export interface PerceptionEndpointOptions {
  /** Mount prefix for the HTTP endpoints. Default: '/@axi-artboard' */
  mount?: string
}

export default function perceptionEndpointPlugin(
  _options: PerceptionEndpointOptions = {}
): Plugin {
  const mount = _options.mount ?? '/@axi-artboard'
  const snapshotPath = `${mount}/perception`
  const streamPath = `${mount}/perception/stream`
  const publishPath = `${mount}/perception/publish`

  return {
    name: 'axi-artboard:perception-endpoint',
    apply: 'serve',
    configureServer(server) {
      // Vite's middleware types are loose; use any here for the parts
      // we touch (url, method, statusCode, setHeader, write, end).
      server.middlewares.use((req: any, res: any, next: any) => {
        const u: string = req.url || ''
        const ok = (
          status: number,
          body: string,
          headers: Record<string, string> = {}
        ) => {
          res.statusCode = status
          for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
          res.end(body)
        }

        // JSON snapshot
        if (u === snapshotPath || u.startsWith(`${snapshotPath}?`)) {
          try {
            ok(200, JSON.stringify(getLatest(), null, 2), {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
              'Access-Control-Allow-Origin': '*',
            })
          } catch (e) {
            ok(500, JSON.stringify({ error: String(e) }), {
              'Content-Type': 'application/json',
            })
          }
          return
        }

        // SSE stream
        if (u === streamPath || u.startsWith(`${streamPath}?`)) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Connection', 'keep-alive')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('X-Accel-Buffering', 'no')

          const send = (event: string, data: unknown) => {
            try {
              res.write(`event: ${event}\n`)
              res.write(`data: ${JSON.stringify(data)}\n\n`)
            } catch {
              /* client disconnected mid-write */
            }
          }

          // Initial snapshot so consumers don't have to do a GET
          // before opening the stream.
          send('snapshot', getLatest())

          const off = subscribe((packet) => send('change', packet))
          // Heartbeat every 25s so middleboxes don't kill the
          // connection. SSE comments (`:` lines) are ignored by
          // EventSource.
          const beat = setInterval(() => {
            try {
              res.write(`: ping ${Date.now()}\n\n`)
            } catch {
              /* ignore */
            }
          }, 25_000)

          req.on('close', () => {
            clearInterval(beat)
            off()
          })
          return
        }

        // Publish (POST)
        if (u === publishPath && req.method === 'POST') {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', () => {
            try {
              const text = Buffer.concat(chunks).toString('utf8')
              const parsed = text ? JSON.parse(text) : {}
              mergePublished(parsed)
              ok(204, '', { 'Access-Control-Allow-Origin': '*' })
            } catch (e) {
              ok(400, JSON.stringify({ error: String(e) }), {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              })
            }
          })
          return
        }

        // CORS preflight for the publish endpoint.
        if (u === publishPath && req.method === 'OPTIONS') {
          ok(204, '', {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'content-type',
          })
          return
        }

        next()
      })
    },
  }
}
