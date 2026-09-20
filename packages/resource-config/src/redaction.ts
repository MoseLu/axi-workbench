import { SERVER_SECRET_KEYS, type ServerSecretKey } from "./env.js";

/**
 * Secret-aware redaction helpers.
 *
 * The gateway never embeds server-only secrets (AXI_DOCS_TOKEN,
 * MINIMAX_TOKENPLAN_CLI, MINIMAX_MCP_BASE_PATH) into the public
 * configuration that the browser receives, and never lets them leak
 * through logs or error responses. The helpers here cover three
 * practical cases:
 *
 *   - `scrubObject` recursively walks a JSON-shaped value and replaces
 *     every known secret key with the literal `"[redacted]"`. Use it
 *     whenever you stringify an unknown payload for logging or for the
 *     public config surface.
 *
 *   - `scrubString` is for free-text messages (e.g. error messages
 *     produced by `node:fetch`). It scans for `<KEY>=value` or
 *     `<KEY>: value` substrings and replaces the value with
 *     `"[redacted]"`.
 *
 *   - `redactKey` / `isSecretKey` give callers a canonical way to ask
 *     "is this a secret?" and to redact a specific value when its key
 *     is not on the allowlist.
 *
 * Key normalisation: every comparison strips non-alphanumerics and
 * lowercases both sides, so `AXI_DOCS_TOKEN`, `axi_docs_token`,
 * `axiDocsToken`, and `axidocsToken` all match. This is what makes
 * the redaction safe when a JSON field name comes back in a different
 * shape than the env var (e.g. snake_case in env, camelCase in code).
 *
 * Keep this module dependency-free so any package can import it.
 */

export const REDACTED = "[redacted]" as const;

/** Normalise a key by stripping non-alphanumerics and lowercasing. */
const normaliseKey = (key: string): string => key.replace(/[^a-z0-9]/giu, "").toLowerCase();

/** Pre-computed set of normalised secret key names for O(1) lookup. */
const REDACTABLE_NORMALISED: ReadonlySet<string> = new Set(
  (SERVER_SECRET_KEYS as ReadonlyArray<string>).map(normaliseKey),
);

/** True when `key` (case/separator-insensitive) is a known server-side secret. */
export const isSecretKey = (key: string): key is ServerSecretKey =>
  REDACTABLE_NORMALISED.has(normaliseKey(key));

const SECRET_KEY_PATTERN = (() => {
  // Build one alternation pattern that matches any known secret key
  // case-insensitively, followed by `=` or `:` and an optional quoted
  // value. The replacement targets the value portion.
  const keys = (SERVER_SECRET_KEYS as ReadonlyArray<string>)
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`))
    .join("|");
  return new RegExp(String.raw`\b(?:${keys})\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)`, "giu");
})();

/** Scrub occurrences of `KEY=value` substrings inside a free-text string. */
export const scrubString = (input: string): string => {
  if (typeof input !== "string" || input.length === 0) return input;
  return input.replace(SECRET_KEY_PATTERN, (match, value: string) => {
    // The matched text looks like `KEY=value` (or `KEY: value`). Find
    // the separator by scanning from the end of the key part. We split
    // off the key+separator and append `[redacted]` so the output is
    // always `KEY=[redacted]` / `KEY: [redacted]` regardless of how
    // many `=` or `:` characters the original contained.
    const sepIndex = match.search(/[:=]/u);
    const head = match.slice(0, sepIndex + 1);
    const tail = match.slice(sepIndex + 1);
    const trailing = tail.slice(0, Math.max(0, tail.length - value.length));
    return `${head}${trailing}${REDACTED}`;
  });
};

/** Recursively redact known secret keys inside an arbitrary JSON object. */
export const scrubObject = <T>(value: T): T => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => scrubObject(entry)) as unknown as T;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (REDACTABLE_NORMALISED.has(normaliseKey(key))) {
        result[key] = REDACTED;
      } else {
        result[key] = scrubObject(entry);
      }
    }
    return result as unknown as T;
  }
  if (typeof value === "string") {
    return scrubString(value) as unknown as T;
  }
  return value;
};

/** Return the redacted placeholder if the key is a known secret, otherwise `value`. */
export const redactKey = (key: string, value: unknown): unknown => (isSecretKey(key) ? REDACTED : value);

/** Build a stable, alphabetically sorted list of secret key names for audit surfaces. */
export const listSecretKeys = (): ReadonlyArray<ServerSecretKey> => {
  const sorted = [...(SERVER_SECRET_KEYS as ReadonlyArray<ServerSecretKey>)];
  sorted.sort((a, b) => a.localeCompare(b));
  return sorted;
};
