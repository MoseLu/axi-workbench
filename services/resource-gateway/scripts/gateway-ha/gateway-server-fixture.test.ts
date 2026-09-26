/**
 * scripts/gateway-ha/gateway-server-fixture.test.ts
 *
 * Vitest fixture used by the lane-verification harness. It boots a
 * single apps/gateway in-process server on a port supplied via
 * `process.env.GATEWAY_HA_PORT`, wires a no-op router so
 * /health/ready reports ready=true, and idles forever (waiting on a
 * SIGTERM from the parent). The harness spawns two of these in
 * parallel to prove two-instance HA smoke without depending on real
 * upstream providers, the MiniMax CLI, or any other external state.
 *
 * The fixture is itself a vitest test: vitest's resolver handles all
 * workspace aliases and TS source transparently. We expose a single
 * trivial assertion that resolves once the server is listening; from
 * then on we hold the event loop alive until SIGTERM.
 *
 * The fixture never writes to disk, never reads outside the
 * workspace, and never logs a secret.
 */

import { afterAll, it } from "vitest";
import type { AddressInfo } from "node:net";
import { GatewayOrchestrator } from "@axi/resource-orchestrator";

import { createGatewayServer } from "../../apps/gateway/src/server.ts";
import { createMetricsState } from "../../apps/gateway/src/metrics.ts";
import { GatewayRouter } from "../../apps/gateway/src/router.ts";
import { Lifecycle } from "../../apps/gateway/src/lifecycle.ts";

const port = Number.parseInt(process.env.GATEWAY_HA_PORT ?? "0", 10);
const label = process.env.GATEWAY_HA_LABEL ?? "fixture";
const drainOnSignal = process.env.GATEWAY_HA_DRAIN_ON_SIGNAL === "true";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`GATEWAY_HA_PORT must be 1..65535, got ${process.env.GATEWAY_HA_PORT}`);
}

const gateway = new GatewayOrchestrator({ routes: [] });
(gateway as unknown as { dispatch: (input: unknown) => Promise<unknown> }).dispatch = async () => ({
  items: [],
  sourceVersion: "ha-smoke",
  confidence: "low",
  mode: "fixture",
});

const metrics = createMetricsState();
const router = new GatewayRouter({ gateway, manifestVersion: 1, metrics });
const lifecycle = new Lifecycle();

const built = createGatewayServer({
  config: {
    host: "127.0.0.1",
    port,
    imagePreviewTarget: "http://127.0.0.1:5173",
    axiDocsTarget: "http://127.0.0.1:3010",
    projectTarget: "http://127.0.0.1:3010",
    uiTarget: "http://127.0.0.1:3010",
    iconTarget: "http://127.0.0.1:3010",
    corsOrigins: [],
    apiKeys: [],
    adminToken: "",
    maxBodyBytes: 4096,
    maxResultItems: 12,
    dispatchTimeoutMs: 1500,
    drainTimeoutMs: 2000,
    maxChildTimeoutMs: 60000,
  },
  router,
  bridge: null,
  routeCount: 3,
  manifestVersion: 1,
  ready: true,
  lifecycle,
  metrics,
});

await new Promise<void>((resolve, reject) => {
  built.server.once("error", reject);
  built.server.listen(port, "127.0.0.1", () => resolve());
});

const actualPort = (built.server.address() as AddressInfo).port;
process.stdout.write(`[${label}] listening http://127.0.0.1:${actualPort}/\n`);

let stopping = false;
const stop = async (signal: NodeJS.Signals) => {
  if (stopping) return;
  stopping = true;
  if (drainOnSignal) lifecycle.beginDrain();
  await new Promise<void>((resolve) => {
    built.server.close(() => resolve());
  });
  process.stdout.write(`[${label}] drained on ${signal}\n`);
  process.exit(0);
};

process.on("SIGTERM", () => void stop("SIGTERM"));
process.on("SIGINT", () => void stop("SIGINT"));

afterAll(async () => {
  // If vitest itself decides to tear us down (e.g. on
  // `--bail` or a normal test finish), make sure the server
  // closes cleanly. SIGTERM during a run goes through the
  // signal handlers above.
  if (!stopping) await stop("vitest-afterAll");
});

it("holds the server open until the parent terminates it", async () => {
  // Once listening, the test passes trivially. We then idle by
  // awaiting a never-resolving promise; the parent uses SIGTERM
  // to tear us down, which our signal handler catches and turns
  // into process.exit(0). Vitest's `--watch` mode is disabled in
  // this config so this never loops.
  await new Promise(() => {});
});
