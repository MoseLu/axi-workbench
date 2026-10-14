/**
 * Compatibility shim.
 *
 * The gateway HTTP server was split from this 1632-line monolith into
 * the focused modules under `./server/`:
 *
 *   ./server/context.ts         — ServerState + send/read/request-id primitives
 *   ./server/ops-routes.ts      — health / metrics / routes / openapi / docs
 *   ./server/resource-search.ts — POST /resource/search (resource-search/v1)
 *   ./server/gateway-run.ts     — POST /gateway/run (planner dispatch)
 *   ./server/provider-routes.ts — MiniMax bridge + admin drain/reload
 *   ./server/create-server.ts   — request dispatcher (CORS gates + route table)
 *   ./server/index.ts           — `startGateway` + public re-exports
 *
 * This file keeps the historical import path (`../src/server`) working
 * for tests and tooling. New code should import from `./server/index.js`
 * (or a focused module) directly.
 *
 * The process entrypoint moved to `./server/index.ts` — see the
 * `start` / `dev` scripts in package.json.
 */

export * from "./server/index.js";
