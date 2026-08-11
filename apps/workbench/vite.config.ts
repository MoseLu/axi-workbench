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
    host: '127.0.0.1',
    strictPort: true,
    fs: {
      allow: [
        path.resolve(__dirname, '../..'),
        path.resolve(__dirname, '../../../../shared/axi-ui'),
      ],
    },
    proxy: {
      // 把 /api/* 代理到 api-gateway（默认 127.0.0.1:8088）。
      // 浏览器端的 loopback Gateway 配置会被归一化为同源 /api。
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8088',
        changeOrigin: true,
      },
      // Keep the local control-plane behind the Web origin in development.
      // Production supplies VITE_CONTROL_PLANE_BASE_URL through its gateway.
      '/control-plane': {
        target: process.env.VITE_CONTROL_PLANE_PROXY_TARGET || 'http://localhost:8092',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/control-plane/u, ''),
      },
    },
  },
});
