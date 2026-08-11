import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { selectApiProxyTarget } from './src/lib/apiProxyTarget';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      // The dev server listens only on IPv4 HTTP http://127.0.0.1:5173.
      host: '127.0.0.1',
      strictPort: true,
      fs: {
        allow: [
          path.resolve(__dirname, '../..'),
          path.resolve(__dirname, '../../../../shared/axi-ui'),
        ],
      },
      proxy: {
        // Priority: trimmed VITE_API_PROXY_TARGET, exact-loopback VITE_API_BASE_URL,
        // then the local 127.0.0.1:8088 default. loadEnv makes .env* values apply.
        '/api': {
          target: selectApiProxyTarget({
            apiProxyTarget: env.VITE_API_PROXY_TARGET,
            apiBaseURL: env.VITE_API_BASE_URL,
          }),
          changeOrigin: true,
        },
        // Keep the local control-plane behind the Web origin in development.
        // Production supplies VITE_CONTROL_PLANE_BASE_URL through its gateway.
        '/control-plane': {
          target: env.VITE_CONTROL_PLANE_PROXY_TARGET || 'http://localhost:8092',
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/control-plane/u, ''),
        },
      },
    },
  };
});
