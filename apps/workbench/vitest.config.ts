/**
 * Vitest configuration for apps/workbench.
 *
 * Why explicit: without pinning, vitest would walk the project for every test
 * file ending in test or spec. We pin to tests under src plus the one
 * config-only Vite proxy test so future spec-style files (Playwright / E2E)
 * do not accidentally run here.
 *
 * Environment: jsdom. Component behavior tests use the same DOM boundary as
 * the shipped browser surface; pure logic tests remain isolated in the same
 * runner.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'vite.apiProxyTarget.test.ts'],
    // Quarantined admin pages no longer reachable from App.tsx; their tests
    // would otherwise assert antd-era behavior that the new contract forbids.
    // 2026-09-26: Projects / ProjectDetail / admin pages have been migrated to
    // @axi/ui components; the quarantined tests can run again.
    exclude: ['src/pages/CommandCenter.test.tsx', 'src/pages/commit-ledger/**', 'src/pages/Settings.test.tsx'],
    // Mounting Handoff routes through slow Axi chrome; default 5s is too tight.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Keep coverage off by default — surfaces lazily when CI asks for it.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/vite-env.d.ts', 'src/main.tsx'],
      thresholds: { lines: 80, branches: 70 },
    },
  },
});
