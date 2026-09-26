/**
 * scripts/gateway-ha/shared-state.vitest.config.ts
 *
 * Companion vitest config for the *shared-state* test in
 * `scripts/gateway-ha/shared-state-ha.test.ts`. Mirrors the alias
 * surface from `handler-contract.vitest.config.ts` so the L1b / L2
 * shared-state tests can resolve `@axi/resource-orchestrator`,
 * `@axi/gateway-contracts`, and the apps/gateway source tree
 * without dragging in the runtime fixture config's extra deps.
 *
 * This file lives entirely inside scripts/gateway-ha/ — it does
 * not modify the lane-verification worktree's other files.
 */

import { defineConfig } from "vitest/config";
import { resolve as resolvePath } from "node:path";

const repoRoot = resolvePath(import.meta.dirname, "..", "..");

export default defineConfig({
  test: {
    root: resolvePath(import.meta.dirname),
    include: ["shared-state-ha.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    cache: {
      dir: resolvePath(repoRoot, ".cache/vitest-gateway-ha-shared"),
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