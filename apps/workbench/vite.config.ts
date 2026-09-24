import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { selectApiProxyTarget } from './vite.apiProxyTarget';
import { createLegalDocumentHtml } from './scripts/legal-page-html.mjs';

const legalDocumentDevPlugin = {
  name: 'axi-workbench-legal-document-ssr',
  configureServer(server: {
    middlewares: { use: (handler: (request: any, response: any, next: () => void) => void) => void };
    ssrLoadModule: (url: string) => Promise<{ renderLegalDocument: (kind: 'terms' | 'privacy') => string }>;
    transformIndexHtml: (url: string, html: string) => Promise<string>;
    ssrFixStacktrace: (error: unknown) => void;
  }) {
    server.middlewares.use(async (request, response, next) => {
      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname.replace(/\/+$/u, '') || '/';
      const kind = pathname === '/legal/privacy'
        ? 'privacy'
        : pathname === '/legal/terms'
          ? 'terms'
          : null;
      if (!kind) {
        next();
        return;
      }

      try {
        const { renderLegalDocument } = await server.ssrLoadModule('/src/legal-ssr-entry.tsx');
        const html = createLegalDocumentHtml({
          kind,
          markup: renderLegalDocument(kind),
          assets: { css: ['/src/index.css', '/src/pages/LegalDocument.css'] },
        });
        const transformed = await server.transformIndexHtml(request.url || pathname, html);
        response.statusCode = 200;
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(transformed);
      } catch (error) {
        server.ssrFixStacktrace(error);
        next();
      }
    });
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    plugins: [react(), legalDocumentDevPlugin],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      // Workspace packages such as @axi/api-client declare React Query as a
      // peer dependency. Force the app and those linked packages to share the
      // same module instance, otherwise QueryClientProvider and useQuery can
      // read different React contexts in the packaged WebView.
      dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    },
    server: {
      port: 5183,
      // The dev server listens only on IPv4 HTTP http://127.0.0.1:5183.
      // 5173 is reserved for the wallpaper project (axi-image-preview); we use 5183 to avoid collisions.
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
          // Local Windows backends may expose a self-signed certificate on a
          // private address. Keep verification strict by default; opt in only
          // for an explicit local remote-backend session.
          secure: env.VITE_API_PROXY_INSECURE === 'true' ? false : true,
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
