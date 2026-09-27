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
    include: ['src/pages/admin/Dashboard.test.tsx', 'src/pages/admin/Operations.test.tsx', 'src/pages/admin/EpsAudit.test.tsx'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
