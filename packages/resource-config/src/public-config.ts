import type { ServerConfig } from "./server-config.js";

/**
 * Public configuration shape — the slice the browser is allowed to see.
 *
 * The workbench (`apps/workbench`) needs a few non-secret values to
 * build the right HTTP client and to render its debug surface. Those
 * are exactly the fields in `PublicConfig`. Anything else — provider
 * secrets, internal limits, CLI paths, output dirs — stays server-side.
 *
 * Construction goes through `toPublicConfig`, which is the *only*
 * path that crosses the trust boundary. If a new field is added to
 * `ServerConfig`, it must be added here explicitly; the project does
 * not ship a generic spread because secret keys must be evaluated one
 * at a time.
 */

export interface PublicConfig {
  /** Bind host; used by the workbench when probing `/health/live`. */
  readonly host: string;
  /** Bind port; the workbench uses this to derive `http://host:port`. */
  readonly port: number;
  /** Whether the gateway can dispatch to the MiniMax bridge. */
  readonly minimaxBridge: boolean;
  /** Allowed CORS origins. Empty list disables CORS entirely. */
  readonly corsOrigins: ReadonlyArray<string>;
  /** Max body size accepted by the gateway HTTP layer, in bytes. */
  readonly maxBodyBytes: number;
  /** Max items returned in any single provider response. */
  readonly maxResultItems: number;
  /** Request timeout passed to the gateway dispatch, in ms. */
  readonly dispatchTimeoutMs: number;
  /** Drain timeout for in-flight requests on shutdown, in ms. */
  readonly drainTimeoutMs: number;
}

/**
 * Project a server-only config to the slice the browser is allowed to
 * see. This function is intentionally explicit about which fields make
 * it across — if you find yourself adding more, update the
 * `PublicConfig` shape and the workbench's `gateway-client.ts` at the
 * same time.
 */
export const toPublicConfig = (config: ServerConfig): PublicConfig => {
  const minimaxBridge = Boolean(config.minimaxCli && config.minimaxOutputDir);
  return Object.freeze({
    host: config.host,
    port: config.port,
    minimaxBridge,
    corsOrigins: Object.freeze([...config.corsOrigins]),
    maxBodyBytes: config.maxBodyBytes,
    maxResultItems: config.maxResultItems,
    dispatchTimeoutMs: config.dispatchTimeoutMs,
    drainTimeoutMs: config.drainTimeoutMs,
  });
};
