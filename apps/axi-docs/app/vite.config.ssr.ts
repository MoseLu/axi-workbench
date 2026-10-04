import type { Plugin } from 'vite'
import fs from 'fs'
import path from 'path'
import { buildStaticKnowledgeAssets } from './vite.config.plugin'

// ============================================================================
//  Static first-paint HTML
//
//  VitePress ships pre-rendered HTML for every route. In dev we don't have
//  a real SSG step, so this plugin serves pre-rendered document HTML inside
//  the React root. React replaces it when it activates; there is no overlay.
//
// ============================================================================

interface BundleRecord {
  documents: Array<{
    sourceId: string
    path: string
    name: string
    title: string
    description: string
    content: string
    frontmatter: Record<string, unknown>
    tags: string[]
    updated?: string
  }>
}

type Locale = 'zh' | 'en'
type DocSet = 'guide' | 'skills' | 'workspace'

interface ParsedRoute {
  locale: Locale
  docSet: DocSet
  docPath: string | null
}

const ROUTE_PATTERN = /^\/(zh|en)\/(guide|skills|workspace)(?:\/(.+))?\/?$/

function parseRoute(url: string): ParsedRoute | null {
  const cleaned = url.split('?')[0]?.split('#')[0] || '/'
  const m = ROUTE_PATTERN.exec(cleaned)
  if (!m) return null
  const [, locale, docSet, rest] = m
  return {
    locale: locale as Locale,
    docSet: docSet as DocSet,
    docPath: rest ? rest.replace(/\.md$/u, '') : null,
  }
}

function sourceIdForDocSet(docSet: DocSet, locale: Locale): string {
  if (docSet === 'guide') return `axi-docs-${locale}`
  if (docSet === 'skills') return locale === 'zh' ? 'axi-skills-zh' : 'axi-skills'
  return 'workspace'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;')
}

function inlineFormat(s: string): string {
  let out = escapeHtml(s)
  out = out.replace(/`([^`]+)`/gu, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
  out = out.replace(/\*([^*]+)\*/gu, '<em>$1</em>')
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/gu, '<a href="$2">$1</a>')
  return out
}

function stripFrontmatter(md: string): { body: string; fm: Record<string, unknown> } {
  const fm: Record<string, unknown> = {}
  const match = md.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return { body: md, fm }
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const k = line.slice(0, colon).trim()
    let v: string | boolean | number = line.slice(colon + 1).trim()
    if (v === 'true') v = true
    else if (v === 'false') v = false
    else if (/^-?\d+(\.\d+)?$/u.test(v)) v = Number(v)
    else if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    fm[k] = v
  }
  return { body: md.slice(match[0].length), fm }
}

function markdownToHtml(md: string): string {
  const { body } = stripFrontmatter(md)
  const lines = body.split('\n')
  const out: string[] = []
  let i = 0
  let inUl = false
  let inOl = false
  let inCode: { lang: string; buf: string[] } | null = null

  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false }
    if (inOl) { out.push('</ol>'); inOl = false }
  }

  while (i < lines.length) {
    const line = lines[i]
    if (inCode) {
      if (line.startsWith('```')) {
        out.push(`<pre><code class="language-${escapeHtml(inCode.lang || 'text')}">${escapeHtml(inCode.buf.join('\n'))}</code></pre>`)
        inCode = null
      } else {
        inCode.buf.push(line)
      }
      i++
      continue
    }
    if (line.startsWith('```')) {
      closeLists()
      inCode = { lang: line.slice(3).trim(), buf: [] }
      i++
      continue
    }
    const headerMatch = /^(#{1,6})\s+(.+?)\s*$/u.exec(line)
    if (headerMatch) {
      closeLists()
      const level = headerMatch[1].length
      out.push(`<h${level} id="${slugify(headerMatch[2])}">${inlineFormat(headerMatch[2])}</h${level}>`)
      i++
      continue
    }
    const olMatch = /^(\d+)\.\s+(.+)$/u.exec(line)
    if (olMatch) {
      if (inUl) { out.push('</ul>'); inUl = false }
      if (!inOl) { out.push('<ol>'); inOl = true }
      out.push(`<li>${inlineFormat(olMatch[2])}</li>`)
      i++
      continue
    }
    const ulMatch = /^[-*]\s+(.+)$/u.exec(line)
    if (ulMatch) {
      if (inOl) { out.push('</ol>'); inOl = false }
      if (!inUl) { out.push('<ul>'); inUl = true }
      out.push(`<li>${inlineFormat(ulMatch[1])}</li>`)
      i++
      continue
    }
    if (line.startsWith('> ')) {
      closeLists()
      out.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`)
      i++
      continue
    }
    if (/^-{3,}$/u.test(line.trim())) {
      closeLists()
      out.push('<hr />')
      i++
      continue
    }
    if (line.trim() === '') {
      closeLists()
      i++
      continue
    }
    closeLists()
    out.push(`<p>${inlineFormat(line)}</p>`)
    i++
  }
  closeLists()
  if (inCode) {
    out.push(`<pre><code>${escapeHtml(inCode.buf.join('\n'))}</code></pre>`)
  }
  return out.join('\n')
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-')
}

// Body is forced dark so the brief gap between HTML parse and React mount
// can never show a white margin. Fallback is fixed overlay; cleanup script
// removes it as soon as React puts its first child in #root.
const ssrStylesheet = `
html, body { background: #0f1115 !important; color: #e6e7eb; margin: 0; min-height: 100vh; color-scheme: dark; }
#axi-docs-ssr-fallback {
  position: relative;
  background: #0f1115; color: #e6e7eb;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  line-height: 1.6;
  overflow: hidden auto;
  pointer-events: auto;
}
#axi-docs-ssr-fallback.is-fading { display: none; }
#axi-docs-ssr-fallback .ssr-shell { display: grid; grid-template-rows: 60px 1fr; grid-template-columns: 280px 1fr 240px; grid-template-areas: "header header header" "sidebar main toc"; min-height: 100vh; width: 100%; }
#axi-docs-ssr-fallback .ssr-shell__header { grid-area: header; display: flex; align-items: center; gap: 16px; padding: 0 24px; border-bottom: 1px solid #1c2027; background: #0f1115; }
#axi-docs-ssr-fallback .ssr-shell__logo { display: flex; align-items: center; gap: 10px; font-weight: 600; color: #e6e7eb; }
#axi-docs-ssr-fallback .ssr-shell__logo-mark { width: 22px; height: 22px; border-radius: 4px; border: 1.5px solid currentColor; display: inline-block; }
#axi-docs-ssr-fallback .ssr-shell__search { flex: 1; max-width: 380px; height: 34px; border-radius: 6px; background: #161a20; border: 1px solid #232831; display: flex; align-items: center; padding: 0 12px; color: #8a929d; font-size: 14px; gap: 8px; }
#axi-docs-ssr-fallback .ssr-shell__search-kbd { margin-left: auto; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; padding: 2px 6px; border: 1px solid #2a2f37; border-radius: 4px; color: #8a929d; }
#axi-docs-ssr-fallback .ssr-shell__nav { margin-left: auto; display: flex; gap: 18px; }
#axi-docs-ssr-fallback .ssr-shell__nav a { color: #c0c4cb; font-size: 14px; }
#axi-docs-ssr-fallback .ssr-shell__nav a.is-active { color: #58a6ff; }
#axi-docs-ssr-fallback .ssr-shell__theme { width: 34px; height: 22px; border-radius: 999px; background: #161a20; border: 1px solid #232831; }
#axi-docs-ssr-fallback .ssr-shell__gh { width: 22px; height: 22px; border-radius: 50%; background: #161a20; border: 1px solid #232831; }
#axi-docs-ssr-fallback .ssr-shell__sidebar { grid-area: sidebar; border-right: 1px solid #1c2027; padding: 24px 16px; overflow: hidden; }
#axi-docs-ssr-fallback .ssr-shell__group { margin-bottom: 18px; }
#axi-docs-ssr-fallback .ssr-shell__group-h { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 600; color: #e6e7eb; padding: 4px 8px; }
#axi-docs-ssr-fallback .ssr-shell__group-h::after { content: "▾"; color: #7d8590; font-size: 10px; }
#axi-docs-ssr-fallback .ssr-shell__group-items { list-style: none; padding: 0; margin: 8px 0 0; }
#axi-docs-ssr-fallback .ssr-shell__group-items li { padding: 4px 8px; font-size: 13px; color: #c0c4cb; }
#axi-docs-ssr-fallback .ssr-shell__group-items li.is-active { color: #58a6ff; }
#axi-docs-ssr-fallback .ssr-shell__main { grid-area: main; padding: 0; overflow: auto; min-width: 0; }
#axi-docs-ssr-fallback .ssr-shell__toc { grid-area: toc; border-left: 1px solid #1c2027; padding: 48px 24px; font-size: 13px; color: #c0c4cb; }
#axi-docs-ssr-fallback .ssr-shell__toc-h { font-size: 13px; font-weight: 600; color: #e6e7eb; margin: 0 0 14px; }
#axi-docs-ssr-fallback .ssr-shell__toc-items { list-style: none; padding: 0; margin: 0; }
#axi-docs-ssr-fallback .ssr-shell__toc-items li { padding: 4px 0; color: #8a929d; }
#axi-docs-ssr-fallback .ssr-shell__toc-items li.is-active { color: #c0c4cb; }
#axi-docs-ssr-fallback .doc-fb { max-width: 760px; margin: 0 auto; padding: 56px 32px 96px; }
#axi-docs-ssr-fallback .doc-fb__eyebrow { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #7d8590; margin: 0 0 12px; }
#axi-docs-ssr-fallback .doc-fb__title { font-size: 36px; font-weight: 600; line-height: 1.2; margin: 0 0 16px; color: #f5f7fa; }
#axi-docs-ssr-fallback .doc-fb__desc { font-size: 16px; color: #c0c4cb; margin: 0 0 24px; }
#axi-docs-ssr-fallback .doc-fb__tags { margin: 0 0 24px; }
#axi-docs-ssr-fallback .doc-fb__tag { display: inline-block; font-size: 12px; padding: 4px 10px; border-radius: 999px; background: #1f242c; color: #b9bfc7; margin-right: 8px; margin-bottom: 4px; }
#axi-docs-ssr-fallback .doc-fb__meta { font-size: 12px; color: #7d8590; margin: 0 0 32px; }
#axi-docs-ssr-fallback .doc-fb__body { font-size: 16px; color: #e6e7eb; }
#axi-docs-ssr-fallback .doc-fb__body h1, #axi-docs-ssr-fallback .doc-fb__body h2, #axi-docs-ssr-fallback .doc-fb__body h3, #axi-docs-ssr-fallback .doc-fb__body h4, #axi-docs-ssr-fallback .doc-fb__body h5, #axi-docs-ssr-fallback .doc-fb__body h6 { color: #f5f7fa; line-height: 1.3; margin: 32px 0 12px; }
#axi-docs-ssr-fallback .doc-fb__body h2 { font-size: 24px; border-bottom: 1px solid #2a2f37; padding-bottom: 8px; }
#axi-docs-ssr-fallback .doc-fb__body h3 { font-size: 20px; }
#axi-docs-ssr-fallback .doc-fb__body h4 { font-size: 18px; }
#axi-docs-ssr-fallback .doc-fb__body p { margin: 12px 0; }
#axi-docs-ssr-fallback .doc-fb__body a { color: #58a6ff; text-decoration: none; border-bottom: 1px solid rgba(88,166,255,0.3); }
#axi-docs-ssr-fallback .doc-fb__body a:hover { border-bottom-color: #58a6ff; }
#axi-docs-ssr-fallback .doc-fb__body code { font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace; font-size: 0.92em; padding: 2px 6px; background: #1f242c; border-radius: 4px; color: #f0d3a8; }
#axi-docs-ssr-fallback .doc-fb__body pre { background: #161a20; border: 1px solid #2a2f37; border-radius: 8px; padding: 16px; overflow-x: auto; margin: 16px 0; }
#axi-docs-ssr-fallback .doc-fb__body pre code { background: transparent; padding: 0; color: #e6e7eb; font-size: 14px; line-height: 1.5; }
#axi-docs-ssr-fallback .doc-fb__body ul, #axi-docs-ssr-fallback .doc-fb__body ol { padding-left: 28px; margin: 12px 0; }
#axi-docs-ssr-fallback .doc-fb__body li { margin: 6px 0; }
#axi-docs-ssr-fallback .doc-fb__body blockquote { border-left: 3px solid #58a6ff; padding-left: 16px; color: #c0c4cb; margin: 16px 0; }
#axi-docs-ssr-fallback .doc-fb__body hr { border: none; border-top: 1px solid #2a2f37; margin: 24px 0; }
#axi-docs-ssr-fallback .doc-fb__body strong { color: #f5f7fa; font-weight: 600; }
#axi-docs-ssr-fallback .doc-fb--empty { color: #7d8590; padding: 96px 32px; text-align: center; }
@media (max-width: 1080px) {
  #axi-docs-ssr-fallback .ssr-shell { grid-template-columns: 240px 1fr; grid-template-areas: "header header" "sidebar main"; }
  #axi-docs-ssr-fallback .ssr-shell__toc { display: none; }
}
@media (max-width: 720px) {
  #axi-docs-ssr-fallback .ssr-shell { grid-template-columns: 1fr; grid-template-areas: "header" "main"; }
  #axi-docs-ssr-fallback .ssr-shell__sidebar, #axi-docs-ssr-fallback .ssr-shell__toc { display: none; }
  #axi-docs-ssr-fallback .doc-fb { padding: 32px 20px 64px; }
  #axi-docs-ssr-fallback .doc-fb__title { font-size: 28px; }
  #axi-docs-ssr-fallback .doc-fb__body h2 { font-size: 20px; }
}
`.trim()

function buildSkeletonHtml(doc: BundleRecord['documents'][number], route: ParsedRoute): string {
  const body = markdownToHtml(doc.content || '')
  const tags = (doc.tags || [])
    .slice(0, 8)
    .map((t) => `<span class="doc-fb__tag">${escapeHtml(String(t))}</span>`)
    .join('')
  const updated = doc.updated ? new Date(doc.updated).toISOString().slice(0, 10) : ''
  const tocHeadings = extractTocHeadings(doc.content || '')
  const docRoute = route.locale + '/' + route.docSet + (route.docPath ? '/' + route.docPath : '')
  const docSetLabel = route.docSet === 'guide' ? '指南' : route.docSet === 'skills' ? '技能库' : '工作区'
  const localeLabel = route.locale === 'zh' ? '中文' : 'English'

  return [
    '  <div class="ssr-shell">',
    '    <header class="ssr-shell__header">',
    '      <a class="ssr-shell__logo" href="/"><span class="ssr-shell__logo-mark"></span>Axi Docs</a>',
    '      <div class="ssr-shell__search" aria-hidden="true">',
    '        <span>搜索</span>',
    '        <span class="ssr-shell__search-kbd">⌘K</span>',
    '      </div>',
    '      <nav class="ssr-shell__nav" aria-hidden="true">',
    `        <a class="${route.docSet === 'guide' ? 'is-active' : ''}">${docSetLabel === '指南' ? '指南' : docSetLabel}</a>`,
    '        <a>技能库</a>',
    '        <a>工作区</a>',
    '      </nav>',
    '      <div class="ssr-shell__theme" aria-hidden="true"></div>',
    '      <div class="ssr-shell__gh" aria-hidden="true"></div>',
    '    </header>',
    '    <aside class="ssr-shell__sidebar" aria-hidden="true">',
    '      <div class="ssr-shell__group"><div class="ssr-shell__group-h">简介</div><ul class="ssr-shell__group-items"><li>什么是 Axi Docs？</li><li>快速开始</li><li>导航与路由</li></ul></div>',
    '      <div class="ssr-shell__group"><div class="ssr-shell__group-h">内容与写作</div><ul class="ssr-shell__group-items"><li>文档来源</li><li>方案库</li><li>Markdown 写作</li><li>Frontmatter</li><li>搜索与索引</li></ul></div>',
    '      <div class="ssr-shell__group"><div class="ssr-shell__group-h">知识系统</div><ul class="ssr-shell__group-items"><li>技能库</li><li>工作区</li><li>知识图谱</li></ul></div>',
    '      <div class="ssr-shell__group"><div class="ssr-shell__group-h">架构参考</div><ul class="ssr-shell__group-items"><li>前端 BFF 模式</li></ul></div>',
    '    </aside>',
    '    <main class="ssr-shell__main">',
    `      <article class="doc-fb" data-ssr-fallback="1" data-source-id="${escapeHtml(doc.sourceId)}" data-route="${escapeHtml(docRoute)}">`,
    '        <header class="doc-fb__header">',
    `          <p class="doc-fb__eyebrow">${escapeHtml(docSetLabel)} · ${escapeHtml(localeLabel)}</p>`,
    `          <h1 class="doc-fb__title">${escapeHtml(doc.title || doc.name)}</h1>`,
    doc.description ? `          <p class="doc-fb__desc">${escapeHtml(doc.description)}</p>` : '',
    tags ? `          <p class="doc-fb__tags">${tags}</p>` : '',
    updated ? `          <p class="doc-fb__meta">最后更新：<time datetime="${escapeHtml(updated)}">${escapeHtml(updated)}</time></p>` : '',
    '        </header>',
    '        <div class="doc-fb__body">',
    body,
    '        </div>',
    '      </article>',
    '    </main>',
    '    <aside class="ssr-shell__toc" aria-hidden="true">',
    '      <p class="ssr-shell__toc-h">页面导航</p>',
    `      <ul class="ssr-shell__toc-items">${tocHeadings || '<li>暂无目录</li>'}</ul>`,
    '    </aside>',
    '  </div>',
  ].join('\n')
}

function extractTocHeadings(md: string): string {
  const { body } = stripFrontmatter(md)
  const lines = body.split('\n')
  const out: string[] = []
  for (const line of lines) {
    const m = /^(#{2,3})\s+(.+?)\s*$/u.exec(line)
    if (!m) continue
    out.push(`<li>${inlineFormat(m[2])}</li>`)
  }
  return out.join('\n')
}

function findDoc(bundles: Map<string, BundleRecord>, route: ParsedRoute): BundleRecord['documents'][number] | null {
  if (!route.docPath) return null
  const candidates: string[] = []
  candidates.push(sourceIdForDocSet(route.docSet, route.locale))
  if (route.docSet === 'guide') {
    candidates.push(sourceIdForDocSet(route.docSet, route.locale === 'zh' ? 'en' : 'zh'))
  }
  for (const sid of candidates) {
    const bundle = bundles.get(sid)
    if (!bundle) continue
    const wanted = `${route.docPath}.md`
    const wantedNoExt = route.docPath
    const match = bundle.documents.find((d) => d.path === wanted || d.path === wantedNoExt || d.name === wantedNoExt)
    if (match) return match
  }
  return null
}

export function ssrFallbackPlugin(): Plugin {
  const appRoot = path.resolve(__dirname)
  const indexHtmlPath = path.join(appRoot, 'index.html')
  let bundles: Map<string, BundleRecord> | null = null
  let bundlesPromise: Promise<Map<string, BundleRecord>> | null = null

  const ensureBundles = (): Promise<Map<string, BundleRecord>> => {
    if (bundles) return Promise.resolve(bundles)
    if (!bundlesPromise) {
      bundlesPromise = (async () => {
        const assets = await buildStaticKnowledgeAssets()
        const out = new Map<string, BundleRecord>()
        for (const [key, asset] of assets.entries()) {
          const m = /^generated\/knowledge\/sources\/([^/]+)\/bundle\.json$/u.exec(key)
          if (!m) continue
          try {
            out.set(m[1], JSON.parse(asset.content) as BundleRecord)
          } catch {
            /* skip */
          }
        }
        bundles = out
        return out
      })()
    }
    return bundlesPromise
  }

  const handle = async (
    req: { url?: string; method?: string },
    res: { statusCode: number; setHeader(k: string, v: string): void; end(b: string | Buffer): void },
    server: { transformIndexHtml: (url: string, html: string, originalUrl?: string) => Promise<string> },
    next: () => void,
  ): Promise<boolean> => {
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') return false
    const rawUrl = req.url || '/'
    if (
      rawUrl.startsWith('/@')
      || rawUrl.startsWith('/api')
      || rawUrl.startsWith('/generated')
      || rawUrl.startsWith('/__')
      || /\.[a-z0-9]+$/iu.test(rawUrl.split('?')[0] || '')
      || rawUrl.startsWith('/node_modules')
    ) {
      return false
    }
    const route = parseRoute(rawUrl)
    if (!route) return false
    const allBundles = await ensureBundles()
    const doc = findDoc(allBundles, route)
    let template: string
    try {
      template = fs.readFileSync(indexHtmlPath, 'utf-8')
    } catch {
      return false
    }
    const fallback = doc
      ? buildSkeletonHtml(doc, route)
      : `<div class="doc-fb doc-fb--empty" data-ssr-fallback="1"><h1 class="doc-fb__title">${escapeHtml(route.docSet)}</h1><p class="doc-fb__desc">正在准备 ${escapeHtml(route.locale)}/${escapeHtml(route.docSet)} 视图…</p></div>`
    const preHtml = template.replace(
      /<div id="root"><\/div>/u,
      `<div id="root"><div id="axi-docs-ssr-fallback" data-ssr-fallback="1" aria-hidden="false">\n${fallback}\n</div></div>`,
    )
    const html = await server.transformIndexHtml(rawUrl, preHtml, rawUrl)
    const finalHtml = html.replace(
      /<\/head>/u,
      `<style data-ssr-fallback>${ssrStylesheet}</style>\n  </head>`,
    )
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(finalHtml)
    return true
  }

  return {
    name: 'vite-plugin-axiom-docs-ssr',
    apply: 'serve',
    async configureServer(server) {
      void ensureBundles()
      server.middlewares.use(async (req, res, next) => {
        try {
          const handled = await handle(
            req as { url?: string; method?: string },
            res as unknown as { statusCode: number; setHeader(k: string, v: string): void; end(b: string | Buffer): void },
            server,
            () => next(),
          )
          if (!handled) next()
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[ssrFallbackPlugin] handler failed:', err)
          next()
        }
      })
    },
    async configurePreviewServer(server) {
      void ensureBundles()
      server.middlewares.use(async (req, res, next) => {
        try {
          const handled = await handle(
            req as { url?: string; method?: string },
            res as unknown as { statusCode: number; setHeader(k: string, v: string): void; end(b: string | Buffer): void },
            server,
            () => next(),
          )
          if (!handled) next()
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[ssrFallbackPlugin] handler failed:', err)
          next()
        }
      })
    },
  }
}
