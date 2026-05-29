import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const hostedBase = process.env.AXI_APP_BASE || process.env.VITE_AXI_APP_BASE || "/";

export default defineConfig({
  base: hostedBase,
  build: {
    chunkSizeWarningLimit: 1024,
  },
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: false,
  },
  test: {
    environment: "node",
    passWithNoTests: true,
  },
});
