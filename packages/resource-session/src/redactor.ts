/**
 * SES-MVP-007 — Session text / snapshot redactor.
 *
 * Session persistence is fail-open on the entry itself: a user message
 * is never dropped. Sensitive spans are replaced with the stable
 * `[已脱敏]` placeholder so the UI can render the turn without storing
 * the original secret, path, data URL or provider payload.
 *
 * Unlike the memory redactor, the word "session" is not a banned
 * keyword — this module stores sessions.
 */

export const SESSION_REDACTED_PLACEHOLDER = "[已脱敏]" as const;

export type SessionRedactionReason =
  | "secret_token"
  | "secret_keyword"
  | "credential_header"
  | "absolute_path"
  | "file_uri"
  | "data_url"
  | "url_query_secret"
  | "raw_provider_payload";

export interface SessionRedactionResult {
  readonly value: string;
  readonly redacted: boolean;
  readonly reasons: ReadonlyArray<SessionRedactionReason>;
}

const SECRET_KEYWORDS = [
  "token",
  "secret",
  "password",
  "passwd",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "bearer",
  "private_key",
  "privateKey",
];

const PATH_PATTERNS: ReadonlyArray<RegExp> = [
  /(^|\s)\/(?:Users|Volumes|home|root|etc|var|tmp|opt|usr)\/[^\s"'<>)]+/iu,
  /(^|\s)[A-Za-z]:\\[^\s"'<>)]+/u,
  /\.\.\/(?:[^\s"'<>)]+)/u,
];

const FILE_URI_PATTERN = /(^|\s)file:\/\/[^\s"'<>)]+/iu;
const DATA_URL_PATTERN_ANYWHERE = /\bdata:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/iu;

const PROVIDER_PAYLOAD_HINTS = [
  "__rawProviderPayload",
  "providerPayload",
  "rawProviderPayload",
  "imageUrl",
  "imageBytes",
  "fileUrl",
];

const containsSecretKeyword = (value: string): boolean => {
  const lower = value.toLowerCase();
  return SECRET_KEYWORDS.some((keyword) => {
    if (keyword === "token" || keyword === "secret" || keyword === "cookie" || keyword === "bearer") {
      return new RegExp(`(?:^|[^a-z])${keyword}(?:[^a-z]|$)`, "iu").test(lower)
        && /[:=]|bearer\s+[a-z0-9]/iu.test(lower);
    }
    return lower.includes(keyword.toLowerCase());
  });
};

const isAbsolutePath = (value: string): boolean => PATH_PATTERNS.some((pattern) => pattern.test(value));

const hasUrlQuerySecret = (value: string): boolean => {
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
    // not a parseable URL
  }
  return false;
};

const stripSensitive = (value: string, reasons: Set<SessionRedactionReason>): string => {
  let next = value;
  if (/Bearer\s+[A-Za-z0-9._\-+/=]+/u.test(next) || /Basic\s+[A-Za-z0-9=]+/u.test(next)
    || /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/u.test(next)
    || /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/u.test(next)) {
    reasons.add("credential_header");
    next = next
      .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gu, `Bearer ${SESSION_REDACTED_PLACEHOLDER}`)
      .replace(/Basic\s+[A-Za-z0-9=]+/gu, `Basic ${SESSION_REDACTED_PLACEHOLDER}`)
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu, SESSION_REDACTED_PLACEHOLDER)
      .replace(/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/gu, SESSION_REDACTED_PLACEHOLDER);
  }
  if (DATA_URL_PATTERN_ANYWHERE.test(next)) {
    reasons.add("data_url");
    next = next.replace(DATA_URL_PATTERN_ANYWHERE, SESSION_REDACTED_PLACEHOLDER);
  }
  if (FILE_URI_PATTERN.test(next)) {
    reasons.add("file_uri");
    next = next.replace(FILE_URI_PATTERN, ` ${SESSION_REDACTED_PLACEHOLDER}`);
  }
  if (hasUrlQuerySecret(next)) {
    reasons.add("url_query_secret");
    next = SESSION_REDACTED_PLACEHOLDER;
  }
  if (isAbsolutePath(next)) {
    reasons.add("absolute_path");
    next = next.replace(PATH_PATTERNS[0], ` ${SESSION_REDACTED_PLACEHOLDER}`);
    next = next.replace(PATH_PATTERNS[1], ` ${SESSION_REDACTED_PLACEHOLDER}`);
    next = next.replace(PATH_PATTERNS[2], SESSION_REDACTED_PLACEHOLDER);
    if (isAbsolutePath(next)) next = SESSION_REDACTED_PLACEHOLDER;
  }
  if (containsSecretKeyword(next) && next !== SESSION_REDACTED_PLACEHOLDER) {
    reasons.add("secret_keyword");
    next = SESSION_REDACTED_PLACEHOLDER;
  }
  return next.trim();
};

export const redactSessionText = (value: string): SessionRedactionResult => {
  const reasons = new Set<SessionRedactionReason>();
  const next = stripSensitive(value, reasons);
  return {
    value: next,
    redacted: reasons.size > 0,
    reasons: [...reasons],
  };
};

export const looksLikeProviderPayloadKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return PROVIDER_PAYLOAD_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
};

export const redactUnknown = (value: unknown, key?: string): unknown => {
  if (key && looksLikeProviderPayloadKey(key)) return SESSION_REDACTED_PLACEHOLDER;
  if (typeof value === "string") return redactSessionText(value).value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => redactUnknown(item, key));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactUnknown(v, k);
    }
    return out;
  }
  return value;
};
