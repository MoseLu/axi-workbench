/**
 * Composition-root SharedStateManager wiring tests (GHA-NEXT-025).
 *
 * Verifies that `buildServerRegistry` (apps/gateway composition root)
 * exposes a SharedStateManager whose surface matches the noop default
 * when GATEWAY_SHARED_STORE_URL is unset. The Valkey / Postgres code
 * paths are exercised separately by the orchestrator's
 * valkey-shared-state.test.ts; this file only checks that the
 * composition root actually wires the manager.
 */

import { describe, expect, it } from "vitest";
import { buildServerRegistry } from "../src/composition.js";
import type { ServerConfig } from "../src/config.js";

const baseConfig = (): ServerConfig => ({
  host: "127.0.0.1",
  port: 0,
  imagePreviewTarget: "http://127.0.0.1:1",
  axiDocsTarget: "http://127.0.0.1:2",
  projectTarget: "http://127.0.0.1:3",
  uiTarget: "http://127.0.0.1:4",
  iconTarget: "http://127.0.0.1:5",
  minimaxBridgeTarget: "http://127.0.0.1:6",
  corsOrigins: ["http://localhost:5173"],
  maxBodyBytes: 1024,
  maxResultItems: 8,
  dispatchTimeoutMs: 1000,
  drainTimeoutMs: 1000,
  maxChildTimeoutMs: 60000,
  apiKeys: [],
  adminToken: "",
});

describe("composition root — SharedStateManager (GHA-NEXT-025)", () => {
  it("exposes a SharedStateManager with all six stores", async () => {
    const original = process.env["GATEWAY_SHARED_STORE_URL"];
    delete process.env["GATEWAY_SHARED_STORE_URL"];
    try {
      const composition = await buildServerRegistry(baseConfig());
      expect(composition.sharedState).toBeDefined();
      expect(typeof composition.sharedState.breaker).toBe("object");
      expect(typeof composition.sharedState.rateLimit).toBe("object");
      expect(typeof composition.sharedState.idempotency).toBe("object");
      expect(typeof composition.sharedState.cache).toBe("object");
      expect(typeof composition.sharedState.snapshot).toBe("object");
      expect(typeof composition.sharedState.coalesce).toBe("object");
      // Without a configured store URL the noop manager is used.
      expect(composition.sharedState.isEnabled).toBe(false);
    } finally {
      if (original !== undefined) process.env["GATEWAY_SHARED_STORE_URL"] = original;
    }
  });

  it("assembles a Valkey manager when GATEWAY_SHARED_STORE_URL=redis://...", async () => {
    const original = process.env["GATEWAY_SHARED_STORE_URL"];
    process.env["GATEWAY_SHARED_STORE_URL"] = "redis://127.0.0.1:6379";
    try {
      const composition = await buildServerRegistry(baseConfig());
      // Valkey store is wired but its connection is lazy — isEnabled
      // reflects the *configuration*, not the connection state.
      expect(composition.sharedState.isEnabled).toBe(true);
    } finally {
      if (original !== undefined) process.env["GATEWAY_SHARED_STORE_URL"] = original;
      else delete process.env["GATEWAY_SHARED_STORE_URL"];
    }
  });
});