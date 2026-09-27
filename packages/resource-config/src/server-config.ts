import { parseServerEnv, type ParsedServerEnv } from "./env.js";

/**
 * Server-only configuration shape and factory.
 *
 * `ServerConfig` is the runtime contract used by `apps/gateway`. It is
 * consumed exclusively on the Node side and contains every secret and
 * provider endpoint the gateway needs to boot. Browser code must never
 * import this module — use `toPublicConfig` instead.
 *
 * Construction goes through `createServerConfig`, which:
 *   1. validates every required env entry;
 *   2. returns an immutable record (no further mutation);
 *   3. treats secret keys as opaque — it never re-emits them through
 *      its public surface (`toPublicConfig`) and never logs them.
 */

export interface ServerConfig {
  /** Bind host (default `127.0.0.1`). */
  readonly host: string;
  /** Bind port (default `8787`). */
  readonly port: number;
  /** Default upstream base URLs for the gateway's provider adapters. */
  readonly imagePreviewTarget: string;
  readonly axiDocsTarget: string;
  readonly projectTarget: string;
  readonly uiTarget: string;
  readonly iconTarget: string;
  /** Optional bearer token injected into Axi Docs upstream requests. */
  readonly axiDocsToken?: string;
  /** Optional path to the local MiniMax TokenPlan CLI. */
  readonly minimaxCli?: string;
  /** Optional output directory for MiniMax CLI generated artifacts. */
  readonly minimaxOutputDir?: string;
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

const freezeSecrets = (parsed: ParsedServerEnv): ServerConfig => {
  const config: ServerConfig = {
    host: parsed.host,
    port: parsed.port,
    imagePreviewTarget: parsed.imagePreviewTarget,
    axiDocsTarget: parsed.axiDocsTarget,
    projectTarget: parsed.projectTarget,
    uiTarget: parsed.uiTarget,
    iconTarget: parsed.iconTarget,
    axiDocsToken: parsed.axiDocsToken,
    minimaxCli: parsed.minimaxCli,
    minimaxOutputDir: parsed.minimaxOutputDir,
    corsOrigins: Object.freeze([...parsed.corsOrigins]),
    maxBodyBytes: parsed.maxBodyBytes,
    maxResultItems: parsed.maxResultItems,
    dispatchTimeoutMs: parsed.dispatchTimeoutMs,
    drainTimeoutMs: parsed.drainTimeoutMs,
  };
  return Object.freeze(config);
};

/**
 * Build a frozen `ServerConfig` from an injected env map. The function
 * is the only sanctioned entry point; tests can supply their own env
 * to assert behavior without touching `process.env`.
 */
export const createServerConfig = (
  env: Readonly<Record<string, string | undefined>>,
): ServerConfig => freezeSecrets(parseServerEnv(env));
