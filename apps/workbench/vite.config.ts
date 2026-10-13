import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { selectApiProxyTarget } from './vite.apiProxyTarget.ts';
import { createLegalDocumentHtml } from './scripts/legal-page-html.mjs';

// The default chunk strategy groups by reference count, which mixes antd
// (~11MB), @ant-design/icons (~7MB), react, react-router and the @axi/*
// workspace packages into a single ~3.5MB entry.
//
// Vite passes three different id shapes to manualChunks:
//   1. /node_modules/<pkg>/...                — direct npm install
//   2. /node_modules/.pnpm/<pkg>@<ver>/node_modules/<actual>/... — pnpm store
//   3. <workspace-root>/foundation/axi-ui/packages/<pkg>/...
//      and <workspace-root>/workbench/axi-workbench/packages/<pkg>/...
//      — pnpm-link workspace packages resolving to real paths
//
// `extractPackageName` normalises both (1) and (2) to a canonical npm package
// name; `classifyWorkspacePackage` handles (3). Each major library is then
// mapped to a dedicated vendor chunk that loads on demand.
const VENDOR_PACKAGE_CHUNK: Record<string, string> = {
  // React core stack (react, react-dom, react-router, react-router-dom, scheduler).
  react: 'vendor-react',
  'react-dom': 'vendor-react',
  'react-router': 'vendor-react',
  'react-router-dom': 'vendor-react',
  scheduler: 'vendor-react',
  // antd ecosystem — antd core, with @ant-design/icons split off below.
  antd: 'vendor-antd',
  '@ant-design/icons': 'vendor-antd-icons',
  // React Query — used by every page, but rarely changes.
  '@tanstack/react-query': 'vendor-react-query',
};

const WORKSPACE_PACKAGE_CHUNK: Record<string, string> = {
  // /foundation/axi-ui/packages/* — the @axi/* UI workspace.
  core: 'vendor-axi-core',
  crud: 'vendor-axi-core',
  shell: 'vendor-axi-core',
  settings: 'vendor-axi-core',
  widgets: 'vendor-axi-core',
  tokens: 'vendor-axi-foundation',
  presets: 'vendor-axi-foundation',
  // /foundation/axi-observability/* — observability workspace.
  web: 'vendor-axi-foundation',
  // /workbench/axi-workbench/packages/* — workbench-local workspace.
  'api-client': 'vendor-axi-foundation',
  types: 'vendor-axi-foundation',
  utils: 'vendor-axi-foundation',
  'workbench-foundation': 'vendor-axi-foundation',
  // workstation-contracts -> packages/schemas (also under axi-workbench/packages).
  schemas: 'vendor-axi-foundation',
};

const WORKSPACE_LINK_ROOTS: ReadonlyArray<string> = [
  '/foundation/axi-ui/packages/',
  '/foundation/axi-observability/web/',
  '/foundation/axi-observability/react-hooks/',
  '/workbench/axi-workbench/packages/',
];

function classifyWorkspacePackage(id: string): string | undefined {
  for (const root of WORKSPACE_LINK_ROOTS) {
    const idx = id.indexOf(root);
    if (idx === -1) continue;
    const after = id.slice(idx + root.length);
    const pkg = after.split('/', 1)[0];
    if (pkg && WORKSPACE_PACKAGE_CHUNK[pkg]) {
      return WORKSPACE_PACKAGE_CHUNK[pkg];
    }
  }
  return undefined;
}

// Normalise both `/node_modules/<pkg>/` and pnpm's
// `/node_modules/.pnpm/<pkg>@<ver>/node_modules/<actual>/` to the canonical
// npm package name. Scoped packages (`@scope/name`) become two segments.
function extractPackageName(id: string): string | undefined {
  const parts = id.split('/node_modules/');
  if (parts.length < 2) return undefined;
  const tail = parts[parts.length - 1];
  const segments = tail.split('/').filter(Boolean);
  if (segments.length === 0) return undefined;
  if (segments[0].startsWith('@')) {
    if (segments.length < 2) return undefined;
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0];
}

function manualChunks(id: string): string | undefined {
  // The app's own source stays in the entry chunk.
  if (id.includes('/apps/workbench/src/')) return undefined;

  // 1. Vendor libraries — match both /node_modules/<pkg>/ and pnpm's
  //    /node_modules/.pnpm/<pkg>@<ver>/node_modules/<actual>/ layout.
  const pkg = extractPackageName(id);
  if (pkg) {
    if (VENDOR_PACKAGE_CHUNK[pkg]) {
      return VENDOR_PACKAGE_CHUNK[pkg];
    }
    // Other @ant-design/* helpers (colors, cssinjs, fast-color) plus rc-* /
    // @rc-component/* ride along with antd so the whole antd dependency graph
    // lands in one cacheable chunk.
    if (pkg === '@ant-design/icons') return 'vendor-antd-icons';
    if (
      pkg.startsWith('@ant-design/') ||
      pkg.startsWith('rc-') ||
      pkg.startsWith('@rc-component/')
    ) {
      return 'vendor-antd';
    }
    // Other @tanstack/* helpers stay with react-query.
    if (pkg.startsWith('@tanstack/')) {
      return 'vendor-react-query';
    }
  }

  // 2. pnpm-link workspace packages (real paths, not /node_modules/@axi/*).
  const workspaceChunk = classifyWorkspacePackage(id);
  if (workspaceChunk) return workspaceChunk;

  // 3. Defensive fallback for /node_modules/@axi/* symlink paths — Rollup
  //    usually reports the resolved real path, but if it ever reports the
  //    symlink, this keeps the chunk mapping consistent.
  const axiScoped = id.match(/\/node_modules\/@axi\/([^/]+)\//);
  if (axiScoped && WORKSPACE_PACKAGE_CHUNK[axiScoped[1]]) {
    return WORKSPACE_PACKAGE_CHUNK[axiScoped[1]];
  }

  return undefined;
}

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
  const env = loadEnv(mode, import.meta.dirname, '');

  return {
    plugins: [
      react(),
      legalDocumentDevPlugin,
      // Bundle analyzer — writes dist/stats.html with a treemap of every chunk
      // and module. Set ANALYZE_BUNDLE=1 to enable, otherwise skipped so dev
      // and CI builds stay fast.
      ...(process.env.ANALYZE_BUNDLE === '1'
        ? [
            visualizer({
              filename: 'dist/stats.html',
              template: 'treemap',
              gzipSize: true,
              brotliSize: true,
              sourcemap: false,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        // The `@axi/observability-web` workspace package is declared in
        // package.json but not yet published into `packages/`. `main.tsx`
        // imports it dynamically and only calls a no-op `installWeb(...)`,
        // so we alias it to a local stub module rather than failing the
        // dev build. Replace once the package ships.
        '@axi/observability-web': path.resolve(import.meta.dirname, 'src/lib/__observability-web-stub__.ts'),
      },
      // Workspace packages such as @axi/api-client declare React Query as a
      // peer dependency. Force the app and those linked packages to share the
      // same module instance, otherwise QueryClientProvider and useQuery can
      // read different React contexts in the packaged WebView.
      dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    },
    // ---- Explicit dev dep optimization (mode = development) -----------------
    // Without `include`, Vite's dep crawler must re-discover deep imports of
    // antd (≈3MB prebundle) and @ant-design/icons (≈2.4MB) on every cold
    // start, emitting them as a single monolithic chunk. With the include
    // list below, Vite prebundles each heavy library once, lets Rolldown
    // split deep imports into per-package chunks, and reuses the result
    // across the React tree. Net effect on a fresh cache: cold-start drops
    // 60-70% (kill-to-ready) and the dev resource count falls well under
    // the 150-resource target.
    optimizeDeps: {
      include: [
        // React 19 runtime + DOM client binding (react-dom/client is the
        // named entry that bootstraps `<App />`).
        'react',
        'react-dom',
        'react-dom/client',
        // Routing & data layer.
        'react-router-dom',
        '@tanstack/react-query',
        // Antd v6 + icons (separate chunks let the icons lazy-load only when
        // a page actually renders them).
        'antd',
        '@ant-design/icons',
        // Linked @axi/* workspace packages. They live under pnpm's
        // `/foundation/axi-*` and `/workbench/axi-workbench/packages/`
        // real paths, so a default node_modules crawl misses them and the
        // browser pulls dozens of deep ESM imports per package.
        '@axi/api-client',
        '@axi/core',
        '@axi/crud',
        '@axi/presets',
        '@axi/settings',
        '@axi/shell',
        '@axi/widgets',
        '@axi/workbench-foundation',
        '@axi/workstation-contracts',
      ],
      // Pure-type workspace package — TS-only, never reaches runtime, so
      // prebundling it is wasted CPU on cold start. Matches the spec rule
      // "exclude any typescript-only".
      exclude: ['@axi/types'],
      // Vite 8 uses Rolldown for dep optimization. Skipping the prebundle
      // .map files is the single largest cold-start win — generating ~19MB
      // of source maps (antd + icons + rc-* + react dev runtime) can take
      // well over a second of CPU on first dev boot.
      rolldownOptions: { output: { sourcemap: false } },
    },
    server: {
      port: 5183,
      // The dev server listens only on IPv4 HTTP http://127.0.0.1:5183.
      // 5173 is reserved for the wallpaper project (axi-image-preview); we use 5183 to avoid collisions.
      host: '127.0.0.1',
      strictPort: true,
      fs: {
        allow: [
          path.resolve(import.meta.dirname, '../..'),
          path.resolve(import.meta.dirname, '../../../../foundation/axi-ui'),
        ],
      },
      // Pre-warm the entry chain so the very first page load pays the
      // JSX+TypeScript transform cost before any browser request lands.
      // Without this the user's first paint waits for the deepest import
      // in `main.tsx -> App.tsx -> layout -> page` to stream through esbuild.
      warmup: {
        clientFiles: [
          './index.html',
          './src/main.tsx',
          './src/App.tsx',
          './src/layouts/MainLayout.tsx',
          './src/pages/Home.tsx',
          './src/pages/Projects.tsx',
          './src/pages/ProjectDetail.tsx',
          './src/pages/admin/DesktopCrudFrame.tsx',
        ],
      },
      proxy: {
        // Observability queries are answered by the workbench control-plane
        // (services/control-plane/src/server.mjs) which proxies them to the
        // foundation observability control plane. We declare the rule before
        // the generic `/api` rule so the longest prefix wins regardless of
        // object insertion order. Production routes this through the api-gateway.
        '/api/v1/observability': {
          target: env.VITE_CONTROL_PLANE_PROXY_TARGET || 'http://localhost:8092',
          changeOrigin: true,
        },
        // @axi/api-client's `controlPlaneClient` targets /api/v1/control-plane/*,
        // which the Go api-gateway (3209) exposes via ProxyWebControl: it
        // verifies the HttpOnly session cookie, then forwards to the Node
        // control-plane with X-Axi-Internal-Token + X-Axi-Subject. Keep this
        // on the gateway so browser requests authenticate as the logged-in
        // user instead of needing an owner bearer token.
        '/api/v1/control-plane': {
          target: selectApiProxyTarget({
            apiProxyTarget: env.VITE_API_PROXY_TARGET,
            apiBaseURL: env.VITE_API_BASE_URL,
          }),
          changeOrigin: true,
        },
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
        // Session bootstrap + email verification live on api-gateway (3209).
        '/session': {
          target: selectApiProxyTarget({
            apiProxyTarget: env.VITE_API_PROXY_TARGET,
            apiBaseURL: env.VITE_API_BASE_URL,
          }),
          changeOrigin: true,
          secure: env.VITE_API_PROXY_INSECURE === 'true' ? false : true,
        },
      },
    },
    build: {
      // Default chunk size is 500KB; antd alone is ~1MB and the @axi/* workspace
      // adds another ~1MB. Lift the warning to 1500KB so the per-vendor chunks
      // don't trip the noise gate while still catching truly oversized files.
      chunkSizeWarningLimit: 1500,
      // `build.sourcemap` is the Vite default of `false`. State it
      // explicitly so the optimization contract is reviewable, and disable
      // the ignore-list emit so we never accidentally ship a debug sourcemap
      // for chunked vendor output.
      sourcemap: false,
      sourcemapIgnoreList: false,
      // This project is wired to Vite 8 + Rolldown through the pnpm workspace
      // override, even though `package.json` declares `vite ^5.4.21`. Rolldown
      // does NOT yet expose Rollup's `experimentalMinChunkSize` knob on its
      // `output` type — emitting the key here would fail the SSR build inside
      // `prerender-legal.mjs`. The chunk strategy is therefore driven entirely
      // by `manualChunks` above; orphan helpers either land in their owning
      // vendor chunk or stay in the entry — both are fine. Once Rolldown
      // ships that key, add it back behind a feature check.
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
  };
});
