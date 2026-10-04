import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The `@axi/observability-web` workspace package is declared in
      // package.json but not yet published into `packages/`. `main.tsx`
      // imports it dynamically and only calls a no-op `installWeb(...)`,
      // so we alias it to a local stub module rather than failing the
      // dev build. Replace once the package ships.
      '@axi/observability-web': path.resolve(
        __dirname,
        '../../apps/workbench/src/lib/__observability-web-stub__.ts',
      ),
    },
  },
  server: {
    port: 5174,
    host: true,
    fs: {
      allow: [
        path.resolve(__dirname, '../..'),
        path.resolve(__dirname, '../../../../shared/axi-ui'),
      ],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8088',
        changeOrigin: true,
      },
    },
  },
});
