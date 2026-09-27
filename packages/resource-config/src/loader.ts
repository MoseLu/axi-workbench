import { parseServerEnv, type ParsedServerEnv } from "./env.js";
import { scrubObject } from "./redaction.js";
import { createServerConfig, type ServerConfig } from "./server-config.js";
import { toPublicConfig, type PublicConfig } from "./public-config.js";

/**
 * High-level loaders used by `apps/gateway`.
 *
 * - `loadServerConfig({ env })` returns a frozen `ServerConfig`. When
 *   `env` is omitted the function reads `process.env` directly so the
 *   binary entrypoint stays a one-liner.
 *
 * - `loadPublicConfig({ env })` returns the redacted slice the browser
 *   is allowed to see. It always reflects the same env the server
 *   saw — if the parse failed it throws the same `ConfigParseError`.
 *
 * Both loaders accept an explicit env map for tests and for layered
 * entrypoints (e.g. `node:test` harnesses).
 *
 * The default values, env keys, and secret list are all owned by the
 * `env` module so any change ripples through every helper here.
 */

export interface LoadServerConfigOptions {
  /** Process-shaped env map. Defaults to `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Override the default `process.env` reader (tests only). */
  readonly envReader?: () => Readonly<Record<string, string | undefined>>;
}

/** Build a frozen `ServerConfig`. Throws `ConfigParseError` on bad input. */
export const loadServerConfig = (options: LoadServerConfigOptions = {}): ServerConfig => {
  const env = resolveEnv(options);
  return createServerConfig(env);
};

export interface LoadPublicConfigOptions {
  /** Process-shaped env map. Defaults to `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Override the default `process.env` reader (tests only). */
  readonly envReader?: () => Readonly<Record<string, string | undefined>>;
}

/**
 * Build the public, redacted slice. Useful for `GET /health/ready`
 * metadata and for the workbench's bootstrap path. Always reflects the
 * same env the server would boot from.
 */
export const loadPublicConfig = (options: LoadPublicConfigOptions = {}): PublicConfig => {
  const env = resolveEnv(options);
  const server = createServerConfig(env);
  // Defence in depth: even if a future field is added to ServerConfig
  // and accidentally exposed via `toPublicConfig`, `scrubObject` will
  // still scrub any secret key from the resulting record.
  const publicConfig = toPublicConfig(server);
  return scrubObject(publicConfig);
};

const resolveEnv = (
  options: { readonly env?: Readonly<Record<string, string | undefined>>; readonly envReader?: () => Readonly<Record<string, string | undefined>> },
): Readonly<Record<string, string | undefined>> => {
  if (options.env) return options.env;
  if (options.envReader) return options.envReader();
  // We only read `process.env` at the very last moment so tests can
  // pass an explicit env without monkey-patching the global.
  return process.env as Readonly<Record<string, string | undefined>>;
};

export { parseServerEnv };
export type { ParsedServerEnv };
export type { ServerConfig, PublicConfig };
