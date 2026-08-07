/**
 * Vitest configuration for apps/workbench.
 *
 * Why explicit: without pinning, vitest would walk the project for every test
 * file ending in test or spec. We pin to the test pattern under src so future
 * spec-style files (Playwright / E2E) do not accidentally run here.
 *
 * Environment: node. The workbench UI is browser-only and not exercised yet,
 * and the breadcrumb unit test is a pure function. Switch to jsdom only when
 * we add a component test.
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
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Keep coverage off by default — surfaces lazily when CI asks for it.
    coverage: {
      enabled: false,
    },
  },
});
