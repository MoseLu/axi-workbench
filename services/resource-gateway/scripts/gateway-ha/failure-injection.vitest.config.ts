/**
 * scripts/gateway-ha/failure-injection.vitest.config.ts
 *
 * Companion vitest config for the *failure-injection* test in
 * `scripts/gateway-ha/failure-injection.test.ts`. Mirrors the alias
 * surface from `handler-contract.vitest.config.ts` so the L1b FI
 * contract tests can resolve `@axi/gateway-contracts`,
 * `@axi/resource-orchestrator`, `@axi/resource-api-docs`, and
 * `@axi/resource-config` without inflating the runtime fixture
 * config (which is bound to the L2 surface only).
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
    include: ["failure-injection.test.ts"],
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
      dir: resolvePath(repoRoot, ".cache/vitest-gateway-ha-fi"),
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