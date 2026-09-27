import { ConfigParseError, loadServerConfig as loadSharedServerConfig } from "@axi/resource-config";
import { existsSync, readFileSync, statSync } from "node:fs";
import { z } from "zod";

/**
 * Server-only configuration loader (GHA-014 / GHA-016 / GHA-064).
 *
 * `apps/gateway/src/config.ts` is a thin compatibility adapter over
 * `@axi/resource-config`. The package owns the canonical schema,
 * parsing, secret list, and redaction; this file re-exports the
 * runtime surface the rest of the gateway already imports so we
 * keep a single source of truth without rewriting callers.
 *
 * The package is a declared runtime dependency of the gateway. The
 * local parser remains exported only as a narrow compatibility seam
 * for callers that explicitly need the old `NodeJS.ProcessEnv` shape;
 * runtime loading always delegates to the shared package below.
 *
 * Secrets handled here (mirrored from `@axi/resource-config`'s
 * `SERVER_SECRET_KEYS`):
 *   - `AXI_DOCS_TOKEN`            (bearer token, never logged, never
 *                                   serialized into the public surface)
 *   - `MINIMAX_TOKENPLAN_CLI`     (CLI binary path; allowed but not
 *                                   a credential)
 *   - `MINIMAX_MCP_BASE_PATH`     (output directory; allowed but not
 *                                   a credential)
 *
 * Browser-facing code MUST keep using `toPublicConfig()` from the
 * shared package; the `ServerConfig` exported here is server-only.
 */

const nonEmptyString = z.string().min(1);

const optionalUrl = z.string().url().optional();

/** A trimmed non-empty string OR undefined. */
const trimmedOptional = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().min(1).optional());

/** Parse a comma-separated list of host:port origins (or full URLs) for CORS. */
const originsList = z.preprocess((value) => {
  if (typeof value !== "string") return [] as string[];
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}, z.array(z.string().min(1)).optional());

/** Parse a comma-separated list of accepted bearer keys. Empty list
 *  → auth disabled. */
const keysList = z.preprocess((value) => {
  if (typeof value !== "string") return [] as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of value.split(",")) {
    const trimmed = piece.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}, z.array(z.string().min(1)).optional());

/* -------------------------------------------------------------------------
 * GHA-NEXT-032 — File-based secrets loader.
 *
 * The Docker / Kubernetes / systemd credential idiom is to mount a
 * secret as a FILE (e.g. /var/run/secrets/axi-docs-token) and to set
 * the matching `<NAME>_FILE` env var to the file path. This avoids
 * putting the raw secret into the parent shell's environment, where
 * it would be visible to every subprocess, every `ps eww`, every
 * crash dump, every `/proc/<pid>/environ` snapshot.
 *
 * We honor the convention here. The wrapper:
 *   - Reads the file contents and trims trailing whitespace.
 *   - Treats an empty file as a hard error (the operator wanted a
 *     secret; an empty string is a misconfiguration).
 *   - Treats a missing file as a hard error (no silent fallback to
 *     the literal env value).
 *
 * The function is intentionally narrow: it returns the resolved
 * value or throws. Callers must opt in per-key (so we don't
 * accidentally re-interpret unrelated env vars).
 * -----------------------------------------------------------------------*/

export class SecretFileReadError extends Error {
  constructor(public readonly envKey: string, public readonly filePath: string, reason: string) {
    super(`failed to load secret from ${envKey} (${filePath}): ${reason}`);
    this.name = "SecretFileReadError";
  }
}

/** Resolve a `<NAME>_FILE` reference. Throws on missing / empty file.
 *  Never returns the file path, only the trimmed content. */
export const readSecretFile = (env: NodeJS.ProcessEnv, envKey: string): string => {
  const filePath = env[envKey];
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new SecretFileReadError(envKey, "(unset)", "env var is unset or empty");
  }
  if (!existsSync(filePath)) {
    throw new SecretFileReadError(envKey, filePath, "file does not exist");
  }
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(filePath);
  } catch (error) {
    throw new SecretFileReadError(envKey, filePath, `stat failed: ${(error as Error).message}`);
  }
  if (!stat.isFile()) {
    throw new SecretFileReadError(envKey, filePath, "path is not a regular file");
  }
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (error) {
    throw new SecretFileReadError(envKey, filePath, `read failed: ${(error as Error).message}`);
  }
  // Trim a single leading + trailing run of whitespace, but preserve
  // whitespace in the middle (so a multi-line secret stays intact).
  const trimmed = content
    .replace(/^[\r\n\t ]+/u, "")
    .replace(/[\r\n\t ]+$/u, "");
  if (trimmed.length === 0) {
    throw new SecretFileReadError(envKey, filePath, "file is empty");
  }
  return trimmed;
};

/** Convenience helper: pick `<envKey>_FILE` first; if unset, fall back
 *  to the literal `<envKey>` value. Returns `undefined` when neither
 *  is configured (or the only value is whitespace). Throws when a
 *  `_FILE` env points at a missing / empty file (we never silently
 *  ignore the operator's intent). */
export const resolveSecret = (env: NodeJS.ProcessEnv, envKey: string): string | undefined => {
  const fileEnvKey = `${envKey}_FILE`;
  if (typeof env[fileEnvKey] === "string" && env[fileEnvKey]!.length > 0) {
    return readSecretFile(env, fileEnvKey);
  }
  const direct = env[envKey];
  if (typeof direct !== "string") return undefined;
  const trimmed = direct.trim();
  return trimmed.length > 0 ? direct : undefined;
};

export interface ServerConfig {
  /** Bind host (default `127.0.0.1`). */
  host: string;
  /** Bind port (default `8787`). */
  port: number;
  /** Default upstream base URLs for the gateway's provider adapters. */
  imagePreviewTarget: string;
  axiDocsTarget: string;
  projectTarget: string;
  uiTarget: string;
  iconTarget: string;
  /** Internal server-side target for the MiniMax TokenPlan bridge. */
  minimaxBridgeTarget: string;
  /** Optional bearer token injected into Axi Docs upstream requests. */
  axiDocsToken?: string;
  /** Optional path to the local MiniMax TokenPlan CLI. */
  minimaxCli?: string;
  /** Optional output directory for MiniMax CLI generated artifacts. */
  minimaxOutputDir?: string;
  /** Allowed CORS origins. Empty list disables CORS entirely. */
  corsOrigins: ReadonlyArray<string>;
  /** Max body size accepted by the gateway HTTP layer, in bytes. */
  maxBodyBytes: number;
  /** Max items returned in any single provider response. */
  maxResultItems: number;
  /** Request timeout passed to the gateway dispatch, in ms. */
  dispatchTimeoutMs: number;
  /** Drain timeout for in-flight requests on shutdown, in ms. */
  drainTimeoutMs: number;
  /** GHA-NEXT-035 — hard timeout for child processes spawned by the
   *  MiniMax bridge. Defaults to 60_000 ms. Set to 0 to disable. */
  maxChildTimeoutMs: number;
  /** GHA-NEXT-029 — Accepted Bearer keys for `POST /gateway/run`.
   *  Empty array disables the middleware (default, backwards-compatible). */
  apiKeys: ReadonlyArray<string>;
  /** GHA-NEXT-034 — Admin token for `/admin/*` endpoints. Empty string
   *  disables the gate (default). */
  adminToken: string;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;
const DEFAULT_IMAGE_TARGET = "http://127.0.0.1:5173";
const DEFAULT_DOCS_TARGET = "http://127.0.0.1:3010";
const DEFAULT_PROJECT_TARGET = "http://127.0.0.1:3010";
const DEFAULT_UI_TARGET = "http://127.0.0.1:3010";
const DEFAULT_ICON_TARGET = "http://127.0.0.1:3010";
/** Default internal bridge target — a server-side route, not a secret. */
const DEFAULT_MINIMAX_BRIDGE_TARGET = "http://127.0.0.1:8787/provider/minimax-tokenplan";
const DEFAULT_MAX_BODY_BYTES = 256 * 1024; // 256 KiB
const DEFAULT_MAX_RESULT_ITEMS = 12;
const DEFAULT_DISPATCH_TIMEOUT_MS = 30_000;
const DEFAULT_DRAIN_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_CHILD_TIMEOUT_MS = 60_000;

/** Resolve a numeric env var with a default and clamp to positive ints. */
const intEnv = (raw: string | undefined, fallback: number): number => {
  if (typeof raw !== "string" || !/^\d+$/u.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export interface LoadServerConfigOptions {
  env?: NodeJS.ProcessEnv;
}

/**
 * Fallback parser — used only when `@axi/resource-config` cannot
 * be resolved. This exists so the gateway can still boot in a sandbox
 * where the workspace dependency wiring has not yet landed. The
 * function reads the same env keys as the package and produces the
 * same shape, but it does NOT re-implement secret redaction or the
 * `toPublicConfig` projection. Use `@axi/resource-config` for the
 * full feature set.
 *
 * Internal export so the dynamic-import path below can reuse it; not
 * a public surface — do not import from elsewhere.
 */
export const parseServerConfigFromEnv = (env: NodeJS.ProcessEnv): ServerConfig => {
  const host = trimmedOptional.parse(env.GATEWAY_HOST) ?? DEFAULT_HOST;
  const port = intEnv(env.GATEWAY_PORT, DEFAULT_PORT);
  const imagePreviewTarget = trimmedOptional.parse(env.AXI_IMAGE_PREVIEW_TARGET) ?? DEFAULT_IMAGE_TARGET;
  const axiDocsTarget = trimmedOptional.parse(env.AXI_DOCS_TARGET) ?? DEFAULT_DOCS_TARGET;
  const projectTarget = trimmedOptional.parse(env.AXI_PROJECT_TARGET) ?? DEFAULT_PROJECT_TARGET;
  const uiTarget = trimmedOptional.parse(env.AXI_UI_TARGET) ?? DEFAULT_UI_TARGET;
  const iconTarget = trimmedOptional.parse(env.AXI_ICON_TARGET) ?? DEFAULT_ICON_TARGET;
  const minimaxBridgeTarget = trimmedOptional.parse(env.MINIMAX_BRIDGE_TARGET) ?? DEFAULT_MINIMAX_BRIDGE_TARGET;

  // Validate that the targets are URLs. We never silently coerce an
  // attacker-controlled string into a fetch URL downstream.
  const targets: Array<[string, string]> = [
    ["AXI_IMAGE_PREVIEW_TARGET", imagePreviewTarget],
    ["AXI_DOCS_TARGET", axiDocsTarget],
    ["AXI_PROJECT_TARGET", projectTarget],
    ["AXI_UI_TARGET", uiTarget],
    ["AXI_ICON_TARGET", iconTarget],
    ["MINIMAX_BRIDGE_TARGET", minimaxBridgeTarget],
  ];
  const parsed: Record<string, string> = {};
  for (const [key, value] of targets) {
    const ok = optionalUrl.parse(value);
    if (!ok) throw new Error(`${key} is not a valid URL: ${value}`);
    parsed[key] = ok;
  }

  const corsOrigins = originsList.parse(env.GATEWAY_CORS_ORIGINS) ?? [];

  return {
    host,
    port,
    imagePreviewTarget: parsed.AXI_IMAGE_PREVIEW_TARGET!,
    axiDocsTarget: parsed.AXI_DOCS_TARGET!,
    projectTarget: parsed.AXI_PROJECT_TARGET!,
    uiTarget: parsed.AXI_UI_TARGET!,
    iconTarget: parsed.AXI_ICON_TARGET!,
    minimaxBridgeTarget: parsed.MINIMAX_BRIDGE_TARGET!,
    axiDocsToken: resolveSecret(env, "AXI_DOCS_TOKEN"),
    minimaxCli: trimmedOptional.parse(env.MINIMAX_TOKENPLAN_CLI),
    minimaxOutputDir: trimmedOptional.parse(env.MINIMAX_MCP_BASE_PATH),
    corsOrigins,
    apiKeys: keysList.parse(resolveSecret(env, "GATEWAY_API_KEYS")) ?? [],
    adminToken: resolveSecret(env, "GATEWAY_ADMIN_TOKEN") ?? "",
    maxBodyBytes: intEnv(env.GATEWAY_MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES),
    maxResultItems: intEnv(env.GATEWAY_MAX_RESULT_ITEMS, DEFAULT_MAX_RESULT_ITEMS),
    dispatchTimeoutMs: intEnv(env.GATEWAY_DISPATCH_TIMEOUT_MS, DEFAULT_DISPATCH_TIMEOUT_MS),
    drainTimeoutMs: intEnv(env.GATEWAY_DRAIN_TIMEOUT_MS, DEFAULT_DRAIN_TIMEOUT_MS),
    maxChildTimeoutMs: intEnv(env.GATEWAY_MAX_CHILD_TIMEOUT_MS, DEFAULT_MAX_CHILD_TIMEOUT_MS),
  };
};

/**
 * Convert a `@axi/resource-config` `ServerConfig` (which is a
 * frozen, readonly record) into the local mutable-shape record the
 * gateway already uses. The structural shape is identical; we cast
 * here because we don't want to take a compile-time dependency on
 * `@axi/resource-config` until the parent wires the package into
 * `apps/gateway/package.json`.
 *
 * When the package's loader returns an unknown / extra field, we
 * pass it through unchanged; when it omits a field we know the
 * gateway needs, we substitute the same default the fallback uses.
 * The result is the canonical `ServerConfig` view the rest of the
 * app already consumes.
 */
const fromSharedConfig = (raw: unknown): ServerConfig => {
  if (!raw || typeof raw !== "object") {
    throw new Error("config_package_returned_non_object");
  }
  const r = raw as Record<string, unknown>;
  return {
    host: typeof r.host === "string" ? r.host : DEFAULT_HOST,
    port: typeof r.port === "number" && r.port > 0 ? r.port : DEFAULT_PORT,
    imagePreviewTarget: typeof r.imagePreviewTarget === "string" ? r.imagePreviewTarget : DEFAULT_IMAGE_TARGET,
    axiDocsTarget: typeof r.axiDocsTarget === "string" ? r.axiDocsTarget : DEFAULT_DOCS_TARGET,
    projectTarget: typeof r.projectTarget === "string" ? r.projectTarget : DEFAULT_PROJECT_TARGET,
    uiTarget: typeof r.uiTarget === "string" ? r.uiTarget : DEFAULT_UI_TARGET,
    iconTarget: typeof r.iconTarget === "string" ? r.iconTarget : DEFAULT_ICON_TARGET,
    minimaxBridgeTarget: typeof r.minimaxBridgeTarget === "string" ? r.minimaxBridgeTarget : DEFAULT_MINIMAX_BRIDGE_TARGET,
    axiDocsToken: typeof r.axiDocsToken === "string" ? r.axiDocsToken : undefined,
    minimaxCli: typeof r.minimaxCli === "string" ? r.minimaxCli : undefined,
    minimaxOutputDir: typeof r.minimaxOutputDir === "string" ? r.minimaxOutputDir : undefined,
    corsOrigins: Array.isArray(r.corsOrigins)
      ? (r.corsOrigins as ReadonlyArray<unknown>).filter((entry): entry is string => typeof entry === "string")
      : [],
    apiKeys: Array.isArray(r.apiKeys)
      ? (r.apiKeys as ReadonlyArray<unknown>).filter((entry): entry is string => typeof entry === "string")
      : [],
    adminToken: typeof r.adminToken === "string" ? r.adminToken : "",
    maxBodyBytes: typeof r.maxBodyBytes === "number" && r.maxBodyBytes > 0 ? r.maxBodyBytes : DEFAULT_MAX_BODY_BYTES,
    maxResultItems: typeof r.maxResultItems === "number" && r.maxResultItems > 0 ? r.maxResultItems : DEFAULT_MAX_RESULT_ITEMS,
    dispatchTimeoutMs: typeof r.dispatchTimeoutMs === "number" && r.dispatchTimeoutMs > 0 ? r.dispatchTimeoutMs : DEFAULT_DISPATCH_TIMEOUT_MS,
    drainTimeoutMs: typeof r.drainTimeoutMs === "number" && r.drainTimeoutMs > 0 ? r.drainTimeoutMs : DEFAULT_DRAIN_TIMEOUT_MS,
    maxChildTimeoutMs: typeof r.maxChildTimeoutMs === "number" && r.maxChildTimeoutMs >= 0 ? r.maxChildTimeoutMs : DEFAULT_MAX_CHILD_TIMEOUT_MS,
  };
};

/**
 * Extract and validate MINIMAX_BRIDGE_TARGET from the env map.
 * Valid values are stored in the shared package's `ServerConfig`;
 * invalid values throw ConfigParseError with the offending key.
 * This is the correct hook for the gateway to inject a custom
 * bridge target without requiring a schema change in the shared
 * package first.
 */
const extractBridgeTarget = (env: NodeJS.ProcessEnv): string => {
  const raw = env["MINIMAX_BRIDGE_TARGET"];
  if (raw === undefined || raw === "") return DEFAULT_MINIMAX_BRIDGE_TARGET;
  const parsed = optionalUrl.safeParse(raw);
  if (!parsed.success) {
    // Throw the shared ConfigParseError so callers can match on type + key uniformly.
    throw new ConfigParseError("MINIMAX_BRIDGE_TARGET", "MINIMAX_BRIDGE_TARGET is not a valid URL");
  }
  return parsed.data as string;
};

export const loadServerConfig = (options: LoadServerConfigOptions = {}): ServerConfig => {
  const env = options.env ?? process.env;
  const minimaxBridgeTarget = extractBridgeTarget(env);
  const base = fromSharedConfig(loadSharedServerConfig({ env }));
  const apiKeysValue = keysList.parse(resolveSecret(env, "GATEWAY_API_KEYS")) ?? [];
  const adminTokenValue = resolveSecret(env, "GATEWAY_ADMIN_TOKEN") ?? "";
  return { ...base, minimaxBridgeTarget, apiKeys: apiKeysValue, adminToken: adminTokenValue, axiDocsToken: resolveSecret(env, "AXI_DOCS_TOKEN") };
};

/**
 * Async version that prefers the shared package. `startGateway` calls
 * this; tests that inject an env map can keep using the synchronous
 * `loadServerConfig`. The async surface is the right hook for the
 * shared package to attach redaction / public-config projection
 * without forcing every caller to migrate.
 */
export const loadServerConfigAsync = async (
  options: LoadServerConfigOptions = {},
): Promise<ServerConfig> => {
  const env = (options.env ?? process.env) as NodeJS.ProcessEnv;
  const minimaxBridgeTarget = extractBridgeTarget(env);
  const base = fromSharedConfig(loadSharedServerConfig({ env }));
  // GHA-NEXT-029 / GHA-NEXT-034 — overlay the auth + admin fields
  // that the shared package does not (yet) know about. The shared
  // package is the canonical schema, but the gateway-specific keys
  // (GATEWAY_API_KEYS, GATEWAY_ADMIN_TOKEN, plus their _FILE
  // companions from GHA-NEXT-032) live here. Both versions honor
  // resolveSecret so the file-based loader can take precedence.
  const apiKeysValue = keysList.parse(resolveSecret(env, "GATEWAY_API_KEYS")) ?? [];
  const adminTokenValue = resolveSecret(env, "GATEWAY_ADMIN_TOKEN") ?? "";
  return { ...base, minimaxBridgeTarget, apiKeys: apiKeysValue, adminToken: adminTokenValue, axiDocsToken: resolveSecret(env, "AXI_DOCS_TOKEN") };
};

/** Test-only: expose defaults for unit tests. */
export const serverConfigDefaults = {
  host: DEFAULT_HOST,
  port: DEFAULT_PORT,
  imagePreviewTarget: DEFAULT_IMAGE_TARGET,
  axiDocsTarget: DEFAULT_DOCS_TARGET,
  projectTarget: DEFAULT_PROJECT_TARGET,
  uiTarget: DEFAULT_UI_TARGET,
  iconTarget: DEFAULT_ICON_TARGET,
  minimaxBridgeTarget: DEFAULT_MINIMAX_BRIDGE_TARGET,
  maxBodyBytes: DEFAULT_MAX_BODY_BYTES,
  maxResultItems: DEFAULT_MAX_RESULT_ITEMS,
  dispatchTimeoutMs: DEFAULT_DISPATCH_TIMEOUT_MS,
  drainTimeoutMs: DEFAULT_DRAIN_TIMEOUT_MS,
  maxChildTimeoutMs: DEFAULT_MAX_CHILD_TIMEOUT_MS,
} as const;

// Keep `nonEmptyString` referenced so future schema additions don't break the
// export; this also documents the contract for new server-side config keys.
void nonEmptyString;
