import { build } from 'vite';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLegalDocumentHtml } from './legal-page-html.mjs';

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = resolve(appRoot, 'dist');
const ssrRoot = await mkdtemp(join(tmpdir(), 'axi-workbench-legal-ssr-'));

try {
  await build({
    root: appRoot,
    configFile: resolve(appRoot, 'vite.config.ts'),
    ssr: { noExternal: ['react', 'react-dom', 'react-router-dom'] },
    build: {
      ssr: resolve(appRoot, 'src/legal-ssr-entry.tsx'),
      outDir: ssrRoot,
      emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: 'server.mjs' } },
    },
  });

  const { renderLegalDocument } = await import(pathToFileURL(join(ssrRoot, 'server.mjs')).href);
  const assetFiles = await readdir(join(distRoot, 'assets'));
  const mainStylesheet = assetFiles.find((file) => /^index-.*\.css$/u.test(file));
  if (!mainStylesheet) throw new Error('未找到 Workbench 主入口样式');

  for (const kind of ['terms', 'privacy']) {
    const outputRoot = join(distRoot, 'legal', kind);
    await mkdir(outputRoot, { recursive: true });
    const html = createLegalDocumentHtml({
      kind,
      markup: renderLegalDocument(kind),
      assets: { css: [`/assets/${mainStylesheet}`] },
    });
    await writeFile(join(outputRoot, 'index.html'), html, 'utf8');
  }
} finally {
  await rm(ssrRoot, { recursive: true, force: true });
}
