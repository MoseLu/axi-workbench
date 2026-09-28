import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(appRoot, 'dist')
const knowledgeRoot = path.join(distRoot, 'generated', 'knowledge')
const template = await readFile(path.join(distRoot, 'index.html'), 'utf8')
const manifest = JSON.parse(await readFile(path.join(knowledgeRoot, 'manifest.json'), 'utf8'))

const vite = await createServer({
  configFile: path.join(appRoot, 'vite.config.ts'),
  server: { middlewareMode: true, hmr: false },
  logLevel: 'error',
})

try {
  const { renderPage } = await vite.ssrLoadModule('/src/entry-server.tsx')
  for (const locale of ['zh', 'en']) {
    const sourceId = `axi-docs-${locale}`
    const bundle = JSON.parse(await readFile(
      path.join(knowledgeRoot, 'sources', sourceId, 'bundle.json'),
      'utf8',
    ))
    for (const document of bundle.documents) {
      const match = /^guide\/([a-z0-9-]+)\.md$/u.exec(document.path)
      if (!match) continue
      const url = `/${locale}/guide/${match[1]}`
      const initialData = {
        sourceId,
        path: document.path,
        sources: manifest.sources,
        catalog: bundle.catalog,
        content: document.content,
      }
      const markup = renderPage(url, initialData)
      const state = JSON.stringify(initialData).replace(/</gu, '\\u003c')
      const html = template.replace(
        '<div id="root"></div>',
        `<div id="root">${markup}</div><script>window.__AXI_DOCS_INITIAL_DATA__=${state}</script>`,
      )
      const outputPath = path.join(distRoot, locale, 'guide', `${match[1]}.html`)
      await mkdir(path.dirname(outputPath), { recursive: true })
      await writeFile(outputPath, html)
    }
  }
} finally {
  await vite.close()
}
