/**
 * MEM-MVP-006 — Memory redactor.
 *
 * Pure-function scrubber for memory candidates and stored entries.
 * Any field that matches a banned category is rejected outright:
 * tokens, secrets, bearer / basic / JWT credentials, absolute paths,
 * file URIs, raw provider payloads, or anything already flagged as
 * blocked by upstream safety checks. The redactor is deliberately
 * fail-closed: when in doubt the candidate is dropped and the
 * reason is returned so the caller can log / surface a stable code.
 */

export type RedactionReason =
  | "secret_token"
  | "secret_keyword"
  | "credential_header"
  | "absolute_path"
  | "file_uri"
  | "data_url"
  | "url_query_secret"
  | "raw_provider_payload"
  | "blocked_sensitivity";

export interface RedactionResult<T> {
  readonly value: T;
  readonly redacted: boolean;
}

export interface RedactionRejection {
  readonly ok: false;
  readonly reason: RedactionReason;
}

export interface RedactionOk<T> {
  readonly ok: true;
  readonly value: T;
  readonly redactedReasons: ReadonlyArray<RedactionReason>;
}

export type RedactionOutcome<T> = RedactionOk<T> | RedactionRejection;

const SECRET_KEYWORDS = [
  "token",
  "secret",
  "password",
  "passwd",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "session",
  "bearer",
  "private_key",
  "privateKey",
];

const PATH_PATTERNS: ReadonlyArray<RegExp> = [
  // POSIX absolute paths / home-relative
  /(^|\s)\/(?:Users|Volumes|home|root|etc|var|tmp|opt|usr)\/[^\s"'<>)]+/iu,
  // Windows drive paths
  /(^|\s)[A-Za-z]:\\[^\s"'<>)]+/u,
  // file: URI (allow scheme-only rejection)
  /(^|\s)file:\/\/[^\s"'<>)]+/iu,
  // explicit parent traversal in candidate text
  /\.\.\/(?:[^\s"'<>)]+)/u,
];

const DATA_URL_PATTERN = /^data:[^;,]+;base64,/iu;
const DATA_URL_PATTERN_ANYWHERE = /\bdata:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/iu;

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/iu;

const PROVIDER_PAYLOAD_HINTS = [
  "__rawProviderPayload",
  "providerPayload",
  "rawProviderPayload",
  "imageUrl",
  "imageBytes",
  "fileUrl",
];

const REDACTED_PLACEHOLDER = "[REDACTED]";

const containsSecretKeyword = (value: string): boolean => {
  const lower = value.toLowerCase();
  return SECRET_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
};

const isAbsolutePath = (value: string): boolean => PATH_PATTERNS.some((pattern) => pattern.test(value));

const hasUrlQuerySecret = (value: string): boolean => {
  // Find any http(s) URL within the value so we can inspect its query.
  const urlMatch = value.match(/https?:\/\/[^\s]+/iu);
  if (!urlMatch) return false;
  try {
    const parsed = new URL(urlMatch[0]);
    for (const key of parsed.searchParams.keys()) {
      if (SECRET_KEYWORDS.includes(key) || /sig|signature|nonce/i.test(key)) return true;
      const paramValue = parsed.searchParams.get(key);
      if (paramValue && paramValue.length >= 20 && /^[A-Za-z0-9_-]+$/u.test(paramValue)) return true;
    }
  } catch {
    // Fall through; not a parseable URL.
  }
  return false;
};

const hasCredentialHeader = (value: string): boolean => {
  if (/Bearer\s+[A-Za-z0-9._\-+/=]+/u.test(value)) return true;
  if (/Basic\s+[A-Za-z0-9=]+/u.test(value)) return true;
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/u.test(value)) return true; // JWT-ish
  if (/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/u.test(value)) return true;
  return false;
};

const stripCredentialHeader = (value: string): string => value
  .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gu, "Bearer [REDACTED]")
  .replace(/Basic\s+[A-Za-z0-9=]+/gu, "Basic [REDACTED]")
  .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu, "[REDACTED-JWT]")
  .replace(/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/gu, "[REDACTED-PRIVATE-KEY]");

const looksLikeProviderPayloadKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return PROVIDER_PAYLOAD_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
};

const inspectString = (value: string, reasons: Set<RedactionReason>): string => {
  let next = value;
  if (hasCredentialHeader(next)) {
    reasons.add("credential_header");
    next = stripCredentialHeader(next);
  }
  if (DATA_URL_PATTERN_ANYWHERE.test(next)) {
    reasons.add("data_url");
    next = REDACTED_PLACEHOLDER;
  }
  if (hasUrlQuerySecret(next)) {
    reasons.add("url_query_secret");
    next = REDACTED_PLACEHOLDER;
  }
  if (isAbsolutePath(next)) {
    // Checked BEFORE the generic secret_keyword sweep so a path
    // like `/Users/x/file` is reported as `absolute_path`, not the
    // generic keyword match.
    reasons.add("absolute_path");
    next = REDACTED_PLACEHOLDER;
  }
  if (containsSecretKeyword(next)) {
    reasons.add("secret_keyword");
    next = REDACTED_PLACEHOLDER;
  }
  return next;
};

const visit = (value: unknown, reasons: Set<RedactionReason>, key?: string): unknown => {
  if (key && looksLikeProviderPayloadKey(key)) {
    reasons.add("raw_provider_payload");
    return REDACTED_PLACEHOLDER;
  }
  if (typeof value === "string") return inspectString(value, reasons);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => visit(item, reasons, key));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = visit(v, reasons, k);
    return out;
  }
  return value;
};

export interface RedactInput {
  readonly summary?: string;
  readonly facts?: Record<string, unknown>;
  readonly tags?: ReadonlyArray<string>;
  readonly evidence?: string;
  readonly sensitivity?: "normal" | "sensitive" | "blocked";
}

export interface RedactedEntryFields {
  readonly summary: string;
  readonly facts: Record<string, string | number | boolean>;
  readonly tags: ReadonlyArray<string>;
  readonly evidence?: string;
}

/**
 * Redact a candidate. Returns either the cleaned value or a structured
 * rejection reason that callers should treat as a hard drop.
 *
 * Blocked sensitivity is always a rejection; the redactor never lets
 * `blocked` content reach the store.
 */
export const redactEntry = (input: RedactInput): RedactionOutcome<RedactedEntryFields> => {
  if (input.sensitivity === "blocked") {
    return { ok: false, reason: "blocked_sensitivity" };
  }
  const reasons = new Set<RedactionReason>();
  const cleanedSummary = inspectString(input.summary ?? "", reasons);
  if (!cleanedSummary) {
    return { ok: false, reason: "secret_keyword" };
  }
  const cleanedFacts: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input.facts ?? {})) {
    const next = visit(value, reasons, key);
    if (next === null || next === undefined) continue;
    if (typeof next === "string" || typeof next === "number" || typeof next === "boolean") {
      cleanedFacts[key] = next;
      continue;
    }
    // Non-primitive after redaction — drop the key to stay safe.
  }
  const cleanedTags = (input.tags ?? []).map((tag) => inspectString(tag, reasons));
  const cleanedEvidence = input.evidence === undefined ? undefined : inspectString(input.evidence, reasons);
  // Hard reject if any redacted reason targets secrets / paths / data
  // URLs (others are recoverable in place).
  if (reasons.has("absolute_path") || reasons.has("file_uri") || reasons.has("data_url") || reasons.has("credential_header") || reasons.has("secret_keyword") || reasons.has("url_query_secret")) {
    const firstHardReason = reasons.has("absolute_path") ? "absolute_path"
      : reasons.has("file_uri") ? "file_uri"
      : reasons.has("data_url") ? "data_url"
      : reasons.has("credential_header") ? "credential_header"
      : reasons.has("url_query_secret") ? "url_query_secret"
      : "secret_keyword";
    return { ok: false, reason: firstHardReason };
  }
  return {
    ok: true,
    value: {
      summary: cleanedSummary,
      facts: cleanedFacts,
      tags: cleanedTags,
      ...(cleanedEvidence !== undefined ? { evidence: cleanedEvidence } : {}),
    },
    redactedReasons: [...reasons],
  };
};

/**
 * Convenience export for redacting a free-form string. Used by the
 * extractor when normalising user text before any persistence happens.
 */
export const redactString = (value: string): RedactionResult<string> => {
  const reasons = new Set<RedactionReason>();
  const next = inspectString(value, reasons);
  return { value: next, redacted: reasons.size > 0 };
};
