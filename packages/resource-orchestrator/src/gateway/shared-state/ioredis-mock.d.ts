/**
 * Minimal `ioredis-mock` type shim used by the shared-state test seam.
 *
 * We don't import the upstream `@types/ioredis-mock` directly because
 * its bundled declaration lags the runtime surface we rely on (Pub/Sub
 * `subscribe(channel, listener)`, Lua `eval`). The shim declares just
 * what the test seam needs; everything else flows through ioredis's
 * own types.
 */

declare module "ioredis-mock" {
  import type { EventEmitter } from "node:events";
  import type { Redis } from "ioredis";

  // Constructor signature compatible with `new RedisMock()` and
  // `new RedisMock({ data: {...} })`.
  interface RedisMockOptions {
    data?: Record<string, unknown>;
  }

  class RedisMock extends EventEmitter implements Redis {
    constructor(options?: RedisMockOptions);
    static data: Record<string, unknown>;
    flushall(): Promise<"OK">;
    quit(): Promise<"OK">;
  }

  export = RedisMock;
}