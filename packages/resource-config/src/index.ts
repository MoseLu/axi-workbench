/**
 * @axi/resource-config
 *
 * Decoupled gateway configuration package.
 *
 * Public API:
 *   - `loadServerConfig`        — frozen `ServerConfig` for `apps/gateway`
 *   - `loadPublicConfig`        — redacted `PublicConfig` for the browser
 *   - `createServerConfig`      — direct factory used by tests and
 *                                 `mm-gateway-core` when it already
 *                                 has an env map
 *   - `toPublicConfig`          — explicit projection from server to public
 *   - `parseServerEnv`          — raw typed parser, no freezing
 *   - `SERVER_CONFIG_DEFAULTS`  — exported defaults (used by health
 *                                 endpoints and for diff-friendly
 *                                 startup logs)
 *   - `SERVER_ENV_KEYS`         — names of every env key inspected
 *   - `SERVER_SECRET_KEYS`      — names of secret env keys (audited)
 *   - `ConfigParseError`        — typed error class so callers can match
 *   - `scrubObject` / `scrubString` / `isSecretKey` / `redactKey`
 *
 * Boundary contract:
 *   - The browser must only import `loadPublicConfig` /
 *     `toPublicConfig` / `PublicConfig`.
 *   - `ServerConfig` is server-only and must never be JSON-stringified
 *     into the public bundle.
 */

export type { ServerConfig } from "./server-config.js";
export type { PublicConfig } from "./public-config.js";
export type { ParsedServerEnv, ServerSecretKey } from "./env.js";

export { createServerConfig } from "./server-config.js";
export { toPublicConfig } from "./public-config.js";
export {
  parseServerEnv,
  ConfigParseError,
  SERVER_CONFIG_DEFAULTS,
  SERVER_ENV_KEYS,
  SERVER_SECRET_KEYS,
  EMPTY_ENV,
} from "./env.js";
export {
  loadServerConfig,
  loadPublicConfig,
  type LoadServerConfigOptions,
  type LoadPublicConfigOptions,
} from "./loader.js";
export {
  REDACTED,
  isSecretKey,
  scrubObject,
  scrubString,
  redactKey,
  listSecretKeys,
} from "./redaction.js";
