import fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { buildStaticKnowledgeAssets } from './vite.config.plugin'
import type { StaticKnowledgeManifest, StaticKnowledgeSourceBundle } from './src/types'
import type { InitialPageData } from './src/lib/initialPageData'

const guideRoute = /^\/(zh|en)\/guide\/([a-z0-9-]+)\/?$/u

export function documentHtmlPlugin(): Plugin {
  let assetsPromise: ReturnType<typeof buildStaticKnowledgeAssets> | null = null
  const getAssets = () => {
    assetsPromise ??= buildStaticKnowledgeAssets(['axi-docs-zh', 'axi-docs-en'])
    return assetsPromise
  }

  return {
    name: 'axi-docs-document-html',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.watcher.on('change', (file) => {
        if (file.includes(`${path.sep}docs${path.sep}content${path.sep}`)) {
          assetsPromise = null
          server.ws.send({ type: 'full-reload' })
        }
      })

      server.middlewares.use(async (request, response, next) => {
        if (request.method !== 'GET') return next()
        const rawUrl = request.url || '/'
        const pathname = new URL(rawUrl, 'http://localhost').pathname
        const route = guideRoute.exec(pathname)
        if (!route) return next()

        try {
          const assets = await getAssets()
          const manifestAsset = assets.get('generated/knowledge/manifest.json')
          const bundleAsset = assets.get(`generated/knowledge/sources/axi-docs-${route[1]}/bundle.json`)
          if (!manifestAsset || !bundleAsset) return next()

          const manifest = JSON.parse(manifestAsset.content) as StaticKnowledgeManifest
          const bundle = JSON.parse(bundleAsset.content) as StaticKnowledgeSourceBundle
          const filePath = `guide/${route[2]}.md`
          const document = bundle.documents.find((item) => item.path === filePath)
          if (!document) return next()

          const initialData: InitialPageData = {
            sourceId: bundle.source.id,
            path: filePath,
            sources: manifest.sources,
            catalog: bundle.catalog,
            content: document.content,
          }
          const { renderPage } = await server.ssrLoadModule('/src/entry-server.tsx')
          const rendered = renderPage(rawUrl, initialData) as string
          const template = await fs.readFile(path.join(server.config.root, 'index.html'), 'utf8')
          const transformed = await server.transformIndexHtml(rawUrl, template)
          const state = JSON.stringify(initialData).replace(/</gu, '\\u003c')
          const html = transformed.replace(
            '<div id="root"></div>',
            `<div id="root">${rendered}</div><script>window.__AXI_DOCS_INITIAL_DATA__=${state}</script>`,
          )
          response.statusCode = 200
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(html)
        } catch (error) {
          server.ssrFixStacktrace(error as Error)
          next(error)
        }
      })
    },
  }
}
