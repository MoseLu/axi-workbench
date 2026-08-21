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
