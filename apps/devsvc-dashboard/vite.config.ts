import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function chunkVendor(id: string) {
  const normalized = id.replace(/\\/g, "/");

  // @axi/ui packages live under /foundation/axi-ui/packages/<name> after pnpm
  // link symlink resolution. Older config only matched the historical
  // /shared/axi-ui path, which silently kept every @axi/* module inside the
  // entry chunk. Match both so future renames keep working.
  const inAxiUi = (name: string) =>
    normalized.includes(`/foundation/axi-ui/packages/${name}/`) ||
    normalized.includes(`/shared/axi-ui/packages/${name}/`) ||
    normalized.includes(`/node_modules/@axi/${name}/`);

  if (inAxiUi("addons")) return "axi-addons";
  if (inAxiUi("crud")) return "axi-crud";
  if (inAxiUi("settings")) return "axi-settings";
  if (inAxiUi("shell")) return "axi-shell";
  if (inAxiUi("widgets")) return "axi-widgets";
  if (inAxiUi("tokens")) return "axi-tokens";
  if (inAxiUi("core")) {
    // Split the icon payload into per-chunk bundles so each one stays under
    // the 1 MB budget. The icons themselves are only fetched on first
    // `getAxiIconData()` call. Each chunk file gets its own chunk group so
    // the data is code-split rather than merged into a single big file.
    const iconDataChunkMatch = normalized.match(/\/(?:foundation|shared)\/axi-ui\/packages\/core\/(?:src|dist)\/icon-data-chunks\/chunk-(\d+)\.(?:ts|js)$/) ||
      normalized.match(/\/node_modules\/@axi\/core\/(?:src|dist)\/icon-data-chunks\/chunk-(\d+)\.(?:ts|js)$/);
    if (iconDataChunkMatch) return `axi-core-icons-${iconDataChunkMatch[1]}`;
    return "axi-core";
  }
  if (inAxiUi("presets")) return "axi-presets";

  if (!normalized.includes("/node_modules/")) return undefined;
  if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom|scheduler)[\\/]/.test(id)) return "react";
  if (id.includes("recharts") || id.includes("d3-")) return "charts";
  if (id.includes("lucide-react")) return "icons";
  if (normalized.includes("/node_modules/@ant-design/icons/")) return "antd-icons";
  if (
    normalized.includes("/node_modules/@ant-design/") ||
    normalized.includes("/node_modules/@rc-component/") ||
    /\/node_modules\/rc-[^/]+\//.test(normalized)
  ) return "antd-runtime";
  if (normalized.includes("/node_modules/antd/")) return "antd";
  if (normalized.includes("/node_modules/i18next/") || normalized.includes("/node_modules/react-i18next/")) return "i18n";
  return "vendor";
}

const maxChunkSizeBytes = 2_000_000;

function compressedAssets(): Plugin {
  const compressiblePattern = /\.(css|html|js|json|svg)$/;
  const minCompressSize = 1024;

  return {
    name: "devsvc-compressed-assets",
    apply: "build",
    generateBundle(_, bundle) {
      Object.entries(bundle).forEach(([fileName, output]) => {
        if (!compressiblePattern.test(fileName)) return;
        const source = output.type === "chunk" ? output.code : output.source;
        const sourceBuffer = typeof source === "string" ? Buffer.from(source) : Buffer.from(source);
        if (sourceBuffer.byteLength < minCompressSize) return;

        this.emitFile({
          type: "asset",
          fileName: `${fileName}.gz`,
          source: gzipSync(sourceBuffer, { level: 6 })
        });
        this.emitFile({
          type: "asset",
          fileName: `${fileName}.br`,
          source: brotliCompressSync(sourceBuffer, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 4
            }
          })
        });
      });
    }
  };
}

function enforceMaxChunkSize(): Plugin {
  return {
    name: "devsvc-max-chunk-size",
    apply: "build",
    generateBundle(_, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== "chunk") continue;
        const byteLength = new TextEncoder().encode(output.code).byteLength;
        if (byteLength > maxChunkSizeBytes) {
          this.error(`${fileName} is ${byteLength} bytes, exceeding ${maxChunkSizeBytes} bytes`);
        }
      }
    }
  };
}

function isHostedAppDocumentRequest(req: IncomingMessage) {
  const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
  if (!requestUrl.pathname.startsWith("/apps/")) return false;
  if (requestUrl.searchParams.has("__axi_frame")) return false;
  if (req.method && req.method !== "GET") return false;

  const destination = String(req.headers["sec-fetch-dest"] || "");
  const accept = String(req.headers.accept || "");
  return destination === "document" || accept.includes("text/html");
}

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
    alias: {
      // `@axi/observability-web` is not yet published into this workspace's
      // `packages/`; the closest artifact transitively depends on the
      // server-side `@axi/observability-logging` (pino + AsyncLocalStorage),
      // which breaks browser bundles with `Module "node:async_hooks" has been
      // externalized for browser compatibility`. We only call `installWeb`
      // as a no-op telemetry hook, so alias to a local stub.
      '@axi/observability-web': path.resolve(__dirname, 'src/lib/__observability-web-stub__.ts'),
    },
  },
  plugins: [react(), compressedAssets(), enforceMaxChunkSize()],
  server: {
    fs: {
      // Allow Vite to serve assets from the shared axi-ui monorepo (notably
      // @axi/core's branding SVG/PNG that lives outside this workspace).
      allow: [
        path.dirname(path.dirname(fileURLToPath(import.meta.url))),
        path.resolve(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "..", "..", "..", "shared", "axi-ui")
      ]
    },
    proxy: {
      "/api": "http://127.0.0.1:17888",
      "/apps": {
        target: "http://127.0.0.1:17888",
        bypass(req) {
          if (isHostedAppDocumentRequest(req)) return "/index.html";
        }
      }
    }
  },
  build: {
    cssCodeSplit: true,
    outDir: "dist",
    emptyOutDir: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: chunkVendor
      }
    }
  }
});
