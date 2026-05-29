import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

declare const process: { env: Record<string, string | undefined> };

const hostedBase = process.env.AXI_APP_BASE || process.env.VITE_AXI_APP_BASE || "/";

export default defineConfig({
  base: hostedBase,
  build: {
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.indexOf("node_modules") >= 0 ? "vendor" : undefined;
        },
      },
    },
  },
  plugins: [react()],
  server: {
    port: 4173,
    strictPort: false,
  },
});
