// Blinko HTTP API client + REST proxy handler.
// Exposes the underlying note API (list/detail/upsert) and a proxy
// `/api/blinko/*` route used by the HTTP transport.

import http from 'http'
import { IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'
import * as knowledgeBase from '../lib/knowledgeBase'
import { docSources } from './docSources'
import type { BlinkoNote } from './types'

export type { BlinkoNote }

export function blinkoRequest<T>(
  urlPath: string,
  method: string,
  body?: unknown,
  apiToken?: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const sourceUrl = docSources.find(s => s.id === 'blinko')?.apiUrl || process.env.BLINKO_URL || 'http://localhost:1111'
    const url = new URL(urlPath, sourceUrl)
    const postData = body ? JSON.stringify(body) : undefined
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || '1111',
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
    }

    const req = http.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid JSON: ' + data.slice(0, 100))) }
      })
    })
    req.on('error', reject)
    if (postData) req.write(postData)
    req.end()
  })
}

export async function handleBlinkoApi(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const source = docSources.find(s => s.id === 'blinko')
  if (!source) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Blinko source is not configured' }))
    return
  }
  const apiPath = url.pathname.slice(5) // 去掉 /api/

  try {
    if (apiPath === 'scan') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(await knowledgeBase.scanKnowledgeSource('blinko')))
      return
    }

    if (apiPath === 'file') {
      const noteId = url.searchParams.get('path') || ''
      const content = await knowledgeBase.readKnowledgeFile('blinko', noteId)
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(content || '# 笔记内容为空')
      return
    }

    if (apiPath === 'tags') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(await knowledgeBase.getKnowledgeTags('blinko')))
      return
    }

    if (apiPath === 'search') {
      const query = url.searchParams.get('query') || url.searchParams.get('q') || ''
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(await knowledgeBase.searchKnowledge('blinko', query, url.searchParams.get('tag'))))
      return
    }

    if (apiPath === 'catalog') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(await knowledgeBase.getKnowledgeCatalog('blinko')))
      return
    }

    // 未知端点
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unknown Blinko API endpoint' }))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Blinko API error:', e)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: msg }))
  }
}
