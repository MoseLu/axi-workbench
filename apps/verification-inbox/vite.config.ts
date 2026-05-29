import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const hostedBase = process.env.AXI_APP_BASE || process.env.VITE_AXI_APP_BASE || "./";
const devPort = Number(process.env.AXI_APP_PORT || process.env.PORT || 1420);

export default defineConfig({
  plugins: [react()],
  base: hostedBase,
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: devPort,
    strictPort: true,
  },
});
