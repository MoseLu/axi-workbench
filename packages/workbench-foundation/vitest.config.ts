/**
 * Vitest configuration for @axi/workbench-foundation.
 *
 * - jsdom environment: AuthProvider and friends reach for `window`,
 *   `fetch`, and `sessionStorage` during render; pin the same DOM
 *   boundary apps use at runtime.
 * - include pattern keeps specs inside `src/` so accidental
 *   `dist/*.test.ts` or repo-root scratch files do not get swept up.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
});