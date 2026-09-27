/**
 * scripts/gateway-ha/handler-contract.vitest.config.ts
 *
 * Companion vitest config used by the lane-verification harness for
 * the *handler-contract* tests in `gateway-handler-contract.test.ts`.
 * These tests assert source-level invariants of the gateway HTTP
 * surface without binding a loopback port — they run cleanly in any
 * environment, including sandboxes where `listen 127.0.0.1` returns
 * EPERM. They cover the L1 (structural / contract) tier for the
 * seven endpoints:
 *
 *   GET  /health/live
 *   GET  /health/ready
 *   GET  /metrics
 *   GET  /openapi.json
 *   GET  /docs
 *   GET  /routes
 *   POST /gateway/run
 *
 * The companion runtime tests in `gateway-server-fixture.test.ts` and
 * `gateway-ha.test.mjs` cover L2 (real HTTP wiring) and L3 (kill-and-
 * survive). Together the three test files form the full lane
 * verification surface; this config exists so the L1 file can pull
 * in `@axi/resource-api-docs` and `@axi/resource-config`
 * without inflating the runtime fixture config.
 *
 * NOTE: this file lives entirely inside scripts/gateway-ha/. It does
 * NOT modify the lane-verification worktree's other files.
 */

import { defineConfig } from "vitest/config";
import { resolve as resolvePath } from "node:path";

const repoRoot = resolvePath(import.meta.dirname, "..", "..");

export default defineConfig({
  test: {
    root: resolvePath(import.meta.dirname),
    include: ["gateway-handler-contract.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    fileParallelism: false,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    cache: {
      dir: resolvePath(repoRoot, ".cache/vitest-gateway-ha-contract"),
    },
  },
  resolve: {
    alias: {
      "@axi/gateway-contracts": resolvePath(repoRoot, "packages/contracts/src/index.ts"),
      "@axi/resource-orchestrator": resolvePath(repoRoot, "packages/orchestrator/src/index.ts"),
      "@axi/resource-adapters": resolvePath(repoRoot, "packages/adapters/src/index.ts"),
      "@axi/resource-api-docs": resolvePath(repoRoot, "packages/api-docs/src/index.ts"),
      "@axi/resource-config": resolvePath(repoRoot, "packages/config/src/index.ts"),
    },
  },
});
