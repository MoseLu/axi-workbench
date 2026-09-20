import { z } from "zod";

/**
 * Server-side environment parsing for the gateway.
 *
 * The functions here accept an injected `env` map (or default to
 * `process.env` for the entrypoint wrapper). They never read globals
 * directly — tests and the loader call them with a frozen map so the
 * parse is deterministic. Keep this module pure: it must not perform
 * I/O, log, or touch network.
 *
 * Style rules:
 *  - Each helper returns a plain object that matches the corresponding
 *    section of `ServerConfig`. They do not throw on missing optional
 *    values; they only throw when a required value is invalid.
 *  - Numeric parse accepts only positive base-10 integers in a
 *    sane range. Anything else falls back to the supplied default.
 *  - URL parse uses Zod's `z.string().url()`. We do not silently coerce
 *    malformed strings because callers treat the result as a fetch
 *    target.
 *
 * Secrets (AXI_DOCS_TOKEN, MINIMAX_TOKENPLAN_CLI, MINIMAX_MCP_BASE_PATH)
 * are scrubbed from any value, error message, and log-friendly formatter
 * defined in this package. The redaction list is exported as
 * `SERVER_SECRET_KEYS` so other layers can audit their own surfaces.
 */

export const SERVER_SECRET_KEYS = [
  "AXI_DOCS_TOKEN",
  "MINIMAX_TOKENPLAN_CLI",
  "MINIMAX_MCP_BASE_PATH",
] as const;
export type ServerSecretKey = (typeof SERVER_SECRET_KEYS)[number];

/** A frozen, empty env used by tests and by the default export. */
export const EMPTY_ENV: Readonly<Record<string, string | undefined>> = Object.freeze({});

const nonEmptyString = z.string().min(1);

/** Trim a string and return undefined when the result is empty. */
const trimmedOptional = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().min(1).optional());

/** Parse a comma-separated list of CORS origins. Returns [] for missing input. */
const originsList = z.preprocess((value) => {
  if (typeof value !== "string") return [] as string[];
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}, z.array(z.string().min(1)).optional());

const optionalUrl = z.string().url().optional();

/** Resolve a positive integer env value with a default. Trims whitespace
 *  and rejects out-of-range / non-integer / non-finite values. The port
 *  range is bounded by 65535 (TCP/UDP practical max) so a typo like
 *  `GATEWAY_PORT=999999999999999999999` doesn't silently turn into a
 *  1e21-port the gateway then tries to bind. */
const intEnv = (
  raw: string | undefined,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number => {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || !/^\d+$/u.test(trimmed)) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
  const min = options.min ?? 1;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  if (parsed < min || parsed > max) return fallback;
  return parsed;
};

/**
 * Resolve every server-only env value into a typed shape. Each section
 * is independent so callers (and tests) can audit exactly which env
 * key produced which default.
 */
export interface ParsedServerEnv {
  readonly host: string;
  readonly port: number;
  readonly imagePreviewTarget: string;
  readonly axiDocsTarget: string;
  readonly projectTarget: string;
  readonly uiTarget: string;
  readonly iconTarget: string;
  readonly axiDocsToken: string | undefined;
  readonly minimaxCli: string | undefined;
  readonly minimaxOutputDir: string | undefined;
  readonly corsOrigins: ReadonlyArray<string>;
  readonly maxBodyBytes: number;
  readonly maxResultItems: number;
  readonly dispatchTimeoutMs: number;
  readonly drainTimeoutMs: number;
}

/** Canonical defaults; exported so callers can render them, e.g. in
 *  `/health/ready`. Bumping a default is a non-breaking change. */
export const SERVER_CONFIG_DEFAULTS = {
  host: "127.0.0.1",
  port: 8787,
  imagePreviewTarget: "http://127.0.0.1:5173",
  axiDocsTarget: "http://127.0.0.1:3010",
  projectTarget: "http://127.0.0.1:3010",
  uiTarget: "http://127.0.0.1:3010",
  iconTarget: "http://127.0.0.1:3010",
  maxBodyBytes: 256 * 1024,
  maxResultItems: 12,
  dispatchTimeoutMs: 30_000,
  drainTimeoutMs: 10_000,
} as const;

/** Sane upper bounds for the numeric limits. */
const PORT_MAX = 65535;
const BODY_MAX = 16 * 1024 * 1024; // 16 MiB hard ceiling
const RESULT_MAX = 256;
const TIMEOUT_MAX = 10 * 60 * 1000; // 10 minutes

const TARGET_KEYS = [
  "AXI_IMAGE_PREVIEW_TARGET",
  "AXI_DOCS_TARGET",
  "AXI_PROJECT_TARGET",
  "AXI_UI_TARGET",
  "AXI_ICON_TARGET",
] as const;

/**
 * Error class that preserves the offending env key name without
 * leaking the value. We keep it distinct from `Error` so callers can
 * match on it and format a redacted error response.
 */
export class ConfigParseError extends Error {
  public readonly key: string;
  public constructor(key: string, message: string) {
    super(message);
    this.name = "ConfigParseError";
    this.key = key;
  }
}

/**
 * Parse every server-only env entry into a typed shape. Throws
 * `ConfigParseError` when a value fails validation; the error message
 * never echoes the offending value.
 */
export const parseServerEnv = (env: Readonly<Record<string, string | undefined>>): ParsedServerEnv => {
  const host = trimmedOptional.parse(env.GATEWAY_HOST) ?? SERVER_CONFIG_DEFAULTS.host;
  const port = intEnv(env.GATEWAY_PORT, SERVER_CONFIG_DEFAULTS.port, { min: 1, max: PORT_MAX });

  const imagePreviewTarget = trimmedOptional.parse(env.AXI_IMAGE_PREVIEW_TARGET) ?? SERVER_CONFIG_DEFAULTS.imagePreviewTarget;
  const axiDocsTarget = trimmedOptional.parse(env.AXI_DOCS_TARGET) ?? SERVER_CONFIG_DEFAULTS.axiDocsTarget;
  const projectTarget = trimmedOptional.parse(env.AXI_PROJECT_TARGET) ?? SERVER_CONFIG_DEFAULTS.projectTarget;
  const uiTarget = trimmedOptional.parse(env.AXI_UI_TARGET) ?? SERVER_CONFIG_DEFAULTS.uiTarget;
  const iconTarget = trimmedOptional.parse(env.AXI_ICON_TARGET) ?? SERVER_CONFIG_DEFAULTS.iconTarget;

  const candidates: Array<readonly [string, string]> = [
    ["AXI_IMAGE_PREVIEW_TARGET", imagePreviewTarget],
    ["AXI_DOCS_TARGET", axiDocsTarget],
    ["AXI_PROJECT_TARGET", projectTarget],
    ["AXI_UI_TARGET", uiTarget],
    ["AXI_ICON_TARGET", iconTarget],
  ];
  const parsedTargets: Record<string, string> = {};
  for (const [key, value] of candidates) {
    const result = optionalUrl.safeParse(value);
    if (!result.success) {
      throw new ConfigParseError(key, `${key} is not a valid URL`);
    }
    parsedTargets[key] = result.data as string;
  }

  const corsOrigins = originsList.parse(env.GATEWAY_CORS_ORIGINS) ?? [];

  return {
    host,
    port,
    imagePreviewTarget: parsedTargets.AXI_IMAGE_PREVIEW_TARGET!,
    axiDocsTarget: parsedTargets.AXI_DOCS_TARGET!,
    projectTarget: parsedTargets.AXI_PROJECT_TARGET!,
    uiTarget: parsedTargets.AXI_UI_TARGET!,
    iconTarget: parsedTargets.AXI_ICON_TARGET!,
    axiDocsToken: trimmedOptional.parse(env.AXI_DOCS_TOKEN),
    minimaxCli: trimmedOptional.parse(env.MINIMAX_TOKENPLAN_CLI),
    minimaxOutputDir: trimmedOptional.parse(env.MINIMAX_MCP_BASE_PATH),
    corsOrigins,
    maxBodyBytes: intEnv(env.GATEWAY_MAX_BODY_BYTES, SERVER_CONFIG_DEFAULTS.maxBodyBytes, { min: 1, max: BODY_MAX }),
    maxResultItems: intEnv(env.GATEWAY_MAX_RESULT_ITEMS, SERVER_CONFIG_DEFAULTS.maxResultItems, { min: 1, max: RESULT_MAX }),
    dispatchTimeoutMs: intEnv(env.GATEWAY_DISPATCH_TIMEOUT_MS, SERVER_CONFIG_DEFAULTS.dispatchTimeoutMs, { min: 1, max: TIMEOUT_MAX }),
    drainTimeoutMs: intEnv(env.GATEWAY_DRAIN_TIMEOUT_MS, SERVER_CONFIG_DEFAULTS.drainTimeoutMs, { min: 1, max: TIMEOUT_MAX }),
  };
};

/** Read-only view of every env key the loader inspects. Exported so
 *  other packages can refuse to forward unknown keys. */
export const SERVER_ENV_KEYS: ReadonlyArray<string> = [
  "GATEWAY_HOST",
  "GATEWAY_PORT",
  "GATEWAY_CORS_ORIGINS",
  "GATEWAY_MAX_BODY_BYTES",
  "GATEWAY_MAX_RESULT_ITEMS",
  "GATEWAY_DISPATCH_TIMEOUT_MS",
  "GATEWAY_DRAIN_TIMEOUT_MS",
  ...TARGET_KEYS,
  ...SERVER_SECRET_KEYS,
];

// Silence unused-symbol warnings while leaving the schema references
// available for downstream schemas that re-use them.
void nonEmptyString;
void z;
