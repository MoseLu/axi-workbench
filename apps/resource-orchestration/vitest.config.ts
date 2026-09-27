import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest config for apps/resource-orchestration.
 *
 * `test.env = {}` is intentional: vite would otherwise load
 * .env / .env.local from the app cwd at vite-plugin-react
 * transformation time, which would inject LAN-side values
 * (e.g. apps/resource-orchestration/.env.local setting
 * VITE_GATEWAY_BASE_URL to a phone-direct LAN IP) into every
 * test run. Tests that need to exercise the env-var code
 * path should stub the variable explicitly via vi.stubEnv.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    env: {},
  },
});
