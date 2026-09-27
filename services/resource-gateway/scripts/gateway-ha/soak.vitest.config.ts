/**
 * scripts/gateway-ha/soak.vitest.config.ts
 *
 * Companion vitest config for the *soak* test in
 * `scripts/gateway-ha/soak.test.ts`. Mirrors the alias surface from
 * the other gateway-ha configs so the soak test can resolve
 * `@axi/gateway-contracts`, `@axi/resource-orchestrator`, and
 * the apps/gateway source tree.
 *
 * This file lives entirely inside scripts/gateway-ha/ — it does not
 * modify the lane-verification worktree's other files.
 */

import { defineConfig } from "vitest/config";
import { resolve as resolvePath } from "node:path";

const repoRoot = resolvePath(import.meta.dirname, "..", "..");

export default defineConfig({
  test: {
    root: resolvePath(import.meta.dirname),
    include: ["soak.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 600_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    cache: {
      dir: resolvePath(repoRoot, ".cache/vitest-gateway-ha-soak"),
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