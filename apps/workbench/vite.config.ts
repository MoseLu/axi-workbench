import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // 把 /api/* 代理到 api-gateway（默认 localhost:8088）
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8088',
        changeOrigin: true,
      },
    },
  },
});
