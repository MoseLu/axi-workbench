/**
 * scripts/gateway-ha/vitest.config.ts
 *
 * Vitest config used by the lane-verification harness. It maps the
 * three workspace aliases (`@axi/gateway-contracts|orchestrator|adapters`)
 * to the matching `src/index.ts` and resolves bare specifiers the
 * same way `tsconfig.base.json` does. The harness runs
 *
 *     pnpm --filter @axi/resource-gateway exec vitest run \
 *       --root scripts/gateway-ha \
 *       --config scripts/gateway-ha/vitest.config.ts \
 *       scripts/gateway-ha/gateway-server-fixture.test.ts
 *
 * to spawn a single in-process gateway server on the port supplied
 * via GATEWAY_HA_PORT.
 *
 * NOTE: this config lives in the lane-verification worktree. It does
 * NOT modify any other lane's files. The fixture file it picks up
 * is also local to this lane.
 */

import { defineConfig } from "vitest/config";
import { resolve as resolvePath } from "node:path";

const repoRoot = resolvePath(import.meta.dirname, "..", "..");

export default defineConfig({
  test: {
    root: resolvePath(import.meta.dirname),
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    // Threads (in-process) so SIGTERM delivered to this Node
    // process is observed by the fixture's signal handlers. The
    // forks pool would route the test into a child worker that
    // would not see the parent's signal — we need to control
    // signal-driven draining from the harness.
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    // Keep vitest caches out of the lane-verification tree.
    cache: {
      dir: resolvePath(repoRoot, ".cache/vitest-gateway-ha"),
    },
  },
  resolve: {
    alias: {
      "@axi/gateway-contracts": resolvePath(repoRoot, "packages/contracts/src/index.ts"),
      "@axi/resource-orchestrator": resolvePath(repoRoot, "packages/orchestrator/src/index.ts"),
      "@axi/resource-adapters": resolvePath(repoRoot, "packages/adapters/src/index.ts"),
    },
  },
});
