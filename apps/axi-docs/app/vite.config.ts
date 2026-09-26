import { defineConfig, type Plugin } from 'vite'
import type { OutputBundle, OutputChunk } from 'rollup'
import react from '@vitejs/plugin-react'
import path from 'path'
import { localDocsPlugin } from './vite.config.plugin'

const DEFAULT_CHUNK_WARNING_LIMIT_KB = 1000
const WEBGL_CHUNK_WARNING_LIMIT_KB = 2000
const hostedBase = process.env.AXI_APP_BASE || process.env.VITE_AXI_APP_BASE || '/'

function isJsChunk(chunk: OutputChunk): boolean {
  return chunk.type === 'chunk' && chunk.fileName.endsWith('.js')
}

function isWebGlChunk(chunk: OutputChunk): boolean {
  return chunk.fileName.includes('GlobalGraph-')
    || chunk.facadeModuleId?.includes('/src/components/GlobalGraph.tsx')
    || Object.keys(chunk.modules).some((id) => (
      id.includes('/src/components/GlobalGraph.tsx')
      || id.includes('/react-force-graph-3d/')
      || id.includes('/three-spritetext/')
      || id.includes('/three/')
    ))
}

function chunkSizePolicyPlugin(): Plugin {
  return {
    name: 'chunk-size-policy',
    apply: 'build',
    generateBundle(_, bundle: OutputBundle) {
      const warnings: string[] = []

      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk' || !isJsChunk(output)) continue

        const sizeKb = Buffer.byteLength(output.code, 'utf8') / 1024
        const limitKb = isWebGlChunk(output)
          ? WEBGL_CHUNK_WARNING_LIMIT_KB
          : DEFAULT_CHUNK_WARNING_LIMIT_KB

        if (sizeKb <= limitKb) continue

        warnings.push(
          `Chunk ${output.fileName} is ${sizeKb.toFixed(2)} kB after minification, `
          + `exceeding the ${limitKb} kB limit${isWebGlChunk(output) ? ' for WebGL chunks' : ''}.`,
        )
      }

      for (const warning of warnings) {
        this.warn(warning)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), localDocsPlugin(), chunkSizePolicyPlugin()],
  base: hostedBase,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3005,
    host: '127.0.0.1',
    allowedHosts: ['docs', 'localhost', '127.0.0.1', 'axiomaticworld.com'],
  },
  preview: {
    port: 3005,
    host: '127.0.0.1',
  },
  build: {
    // Let Vite tolerate the dedicated WebGL graph bundle, while a custom policy
    // keeps the default 1 MB warning budget for every other JS chunk.
    chunkSizeWarningLimit: WEBGL_CHUNK_WARNING_LIMIT_KB,
  },
})
