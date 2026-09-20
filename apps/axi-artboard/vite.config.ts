/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { artboardVitePlugin } from '@axi/artboard-vite-plugin'

/**
 * Axi Artboard — hosted sub-app configuration.
 *
 * Runs as a `hosted` sub-application under Axi Workbench's
 * devsvc-dashboard host. The host injects:
 *   - AXI_APP_BASE   — public URL prefix, e.g. "/apps/axi-artboard/"
 *   - AXI_APP_PORT   — loopback port chosen by the host
 *   - VITE_AXI_APP_BASE / VITE_AXI_HOSTED_APP / VITE_AXI_APP_ID — Vite mirrors
 *
 * When `AXI_APP_PORT` is set we honour it (with strictPort so the host
 * crashes loudly if the port is taken). When unset we fall back to the
 * standalone dev port 5173 — useful when running `pnpm dev` from this
 * folder directly without the host.
 */

const hostedBase =
  process.env.AXI_APP_BASE ||
  process.env.VITE_AXI_APP_BASE ||
  './'
const devPort = Number(process.env.AXI_APP_PORT || process.env.PORT || 5173)

export default defineConfig({
  base: hostedBase,
  plugins: [
    react(),
    // Combined plugin: AST source stamper (dev + prod) +
    // perception HTTP middleware (dev only).
    artboardVitePlugin(),
  ],
  server: {
    host: '127.0.0.1',
    port: devPort,
    strictPort: true,
    hmr: {
      overlay: true,
    },
  },
  build: {
    sourcemap: true,
  },
  clearScreen: false,

  // Vitest config — TDD-driven PRD process. See AGENTS.md §145-151.
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/overlay/**/*.{ts,tsx}'],
      exclude: ['src/overlay/**/*.test.{ts,tsx}'],
    },
  },
})
