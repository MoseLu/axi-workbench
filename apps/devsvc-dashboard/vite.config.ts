import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import type { IncomingMessage } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function chunkVendor(id: string) {
  const normalized = id.replace(/\\/g, "/");

  if (normalized.includes("/shared/axi-ui/packages/addons/") || normalized.includes("/node_modules/@axi/addons/")) return "axi-addons";
  if (normalized.includes("/shared/axi-ui/packages/crud/") || normalized.includes("/node_modules/@axi/crud/")) return "axi-crud";
  if (normalized.includes("/shared/axi-ui/packages/settings/") || normalized.includes("/node_modules/@axi/settings/")) return "axi-settings";
  if (normalized.includes("/shared/axi-ui/packages/shell/") || normalized.includes("/node_modules/@axi/shell/")) return "axi-shell";
  if (normalized.includes("/shared/axi-ui/packages/widgets/") || normalized.includes("/node_modules/@axi/widgets/")) return "axi-widgets";
  if (
    normalized.includes("/shared/axi-ui/packages/core/") ||
    normalized.includes("/shared/axi-ui/packages/presets/") ||
    normalized.includes("/shared/axi-ui/packages/tokens/") ||
    normalized.includes("/node_modules/@axi/core/") ||
    normalized.includes("/node_modules/@axi/presets/") ||
    normalized.includes("/node_modules/@axi/tokens/")
  ) return "axi-core";

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

const maxChunkSizeBytes = 1_000_000;

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
          source: gzipSync(sourceBuffer, { level: 9 })
        });
        this.emitFile({
          type: "asset",
          fileName: `${fileName}.br`,
          source: brotliCompressSync(sourceBuffer, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 11
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
    dedupe: ["react", "react-dom", "react/jsx-runtime"]
  },
  plugins: [react(), compressedAssets(), enforceMaxChunkSize()],
  server: {
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
