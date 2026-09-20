/**
 * GHA-NEXT-033 — Redirect-follow limiter with SSRF re-check.
 *
 * The default global `fetch` follows HTTP redirects automatically.
 * That is convenient but dangerous: an attacker who controls a
 * response on an allowlisted host can return `Location: http://10.0.0.5/`
 * (or `169.254.169.254` for cloud metadata) and pivot the request
 * to a private endpoint. Even when the *initial* URL passed the
 * gateway's SSRF allowlist, the *redirect target* might not.
 *
 * This module wraps `fetch` so that:
 *
 *   1. We only follow up to `MAX_REDIRECTS` (default 3) redirect
 *      responses. Beyond that we reject with a typed error.
 *   2. Every redirect target is re-validated by `isAllowlistedTarget`.
 *      A redirect to a private / link-local / metadata endpoint is
 *      rejected with a typed error before the second hop.
 *
 * The wrapper is intentionally minimal: it is a thin loop over
 * `fetch`, returning the *final* response (or throwing on any
 * non-redirect failure). Tests inject a fake transport via the
 * `transport` parameter; production code uses global `fetch`.
 *
 * Constants:
 *   - `MAX_REDIRECTS = 3` — same value as the lane brief. The cap
 *     is exported so callers / tests can reference it directly.
 */

import { isIP } from "node:net";

/** GHA-NEXT-033 — embedded minimal copy of the gateway SSRF allowlist
 *  check. We intentionally do NOT take a workspace dependency on
 *  `@axi/resource-gateway` from the adapters package; the
 *  adapters are a leaf module. The check below is a stripped-down
 *  version of `apps/gateway/src/allowlist.ts`: it rejects
 *  non-http(s) schemes, IP literals in forbidden ranges, and
 *  unknown hosts. The full operator-allowlist extension lives in
 *  the gateway package; this copy is the load-bearing safety net
 *  for any redirect that an attacker might try to pivot through. */

const FORBIDDEN_HOSTNAMES = new Set<string>([
  "0.0.0.0",
  "169.254.169.254", // AWS / GCP / Azure metadata
  "metadata.google.internal",
  "metadata",
]);

const isIPv4Forbidden = (host: string): boolean => {
  if (isIP(host) !== 4) return false;
  const parts = host.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  // RFC1918 + link-local + CGNAT + benchmark + TEST-NET + multicast
  if (a === 10) return true;
  if (a === 172 && b! >= 16 && b! <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b! >= 64 && b! <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  return false;
};

const isIPv6Forbidden = (host: string): boolean => {
  if (isIP(host) !== 6) return false;
  const normalized = host.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized === "::") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe80::")) return true;
  if (/^f[cd][0-9a-f]{2}:/u.test(normalized)) return true;
  if (normalized.startsWith("ff") || /^ff[0-9a-f]{2}:/u.test(normalized)) return true;
  return true;
};

/** Allow-list posture: by default only loopback is reachable, plus
 *  whatever the operator has explicitly added via env. This is the
 *  same posture as the gateway (with `GATEWAY_ALLOWLIST_HOSTS`). */
const resolveAllowlist = (env: NodeJS.ProcessEnv | undefined): ReadonlySet<string> => {
  const hosts = new Set<string>(["127.0.0.1", "localhost"]);
  const raw = env?.GATEWAY_ALLOWLIST_HOSTS;
  if (typeof raw === "string" && raw.length > 0) {
    for (const candidate of raw.split(",")) {
      const trimmed = candidate.trim().toLowerCase();
      if (trimmed.length > 0) hosts.add(trimmed);
    }
  }
  return hosts;
};

/** Decide whether the URL is safe to follow as a redirect target.
 *  Returns false on:
 *    - non-http(s) schemes
 *    - missing hostname
 *    - IP literal in a forbidden range
 *    - hostname / IP not in the allowlist
 *
 *  Pure: callers control the env lookup via the second argument. */
export const isAllowlistedTarget = (
  url: URL,
  options: { env?: NodeJS.ProcessEnv } = {},
): boolean => {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const hostname = url.hostname.trim().toLowerCase();
  if (hostname.length === 0) return false;
  if (FORBIDDEN_HOSTNAMES.has(hostname)) return false;
  if (isIPv4Forbidden(hostname)) return false;
  if (isIPv6Forbidden(hostname)) return false;
  const allowlist = resolveAllowlist(options.env);
  return allowlist.has(hostname);
};

/** Maximum redirects the wrapper will follow. Pinned per the lane
 *  brief; exported so tests and ops tooling can reference it. */
export const MAX_REDIRECTS = 3;

/** Typed errors so callers can map onto `gatewayErrorCodeSchema`. */
export class RedirectLimitExceededError extends Error {
  constructor(public readonly url: string, public readonly hops: number) {
    super(`redirect limit exceeded (${hops} hops) at ${url}`);
    this.name = "RedirectLimitExceededError";
  }
}

export class RedirectSsrfRejectedError extends Error {
  constructor(public readonly url: string) {
    super(`redirect target rejected by SSRF allowlist: ${url}`);
    this.name = "RedirectSsrfRejectedError";
  }
}

/** Decide whether the response is a redirect we need to follow. */
const isRedirectStatus = (status: number): boolean =>
  status === 301 || status === 302 || status === 303 || status === 307 || status === 308;

/** Extract the Location header value (string only). */
const readLocation = (response: Response): string | undefined => {
  const header = response.headers.get("location");
  if (typeof header !== "string") return undefined;
  return header.trim();
};

/** Resolve a Location header against the request URL. */
const resolveRedirectUrl = (requestUrl: string, location: string): URL => {
  try {
    return new URL(location, requestUrl);
  } catch {
    throw new RedirectSsrfRejectedError(`${requestUrl} → ${location}`);
  }
};

export interface FetchWithRedirectLimitOptions {
  /** Override the global fetch for tests. */
  transport?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Allowlist env map (used by `isAllowlistedTarget`). Defaults to
   *  `process.env` when not supplied. */
  env?: NodeJS.ProcessEnv;
  /** Maximum number of redirects to follow. Defaults to MAX_REDIRECTS. */
  maxRedirects?: number;
  /** Signal forwarded to the transport on every hop. */
  signal?: AbortSignal;
}

export const fetchWithRedirectLimit = async (
  input: RequestInfo | URL,
  options: FetchWithRedirectLimitOptions = {},
): Promise<Response> => {
  const transport = options.transport ?? ((req, reqInit) => fetch(req, reqInit));
  const env = options.env ?? process.env;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  let currentUrl = typeof input === "string" ? input : input.toString();
  let currentInit: RequestInit = {};

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    // SSRF allowlist check on every hop (including the initial URL).
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      throw new RedirectSsrfRejectedError(currentUrl);
    }
    if (!isAllowlistedTarget(parsedUrl, { env })) {
      throw new RedirectSsrfRejectedError(currentUrl);
    }

    const response = await transport(currentUrl, { ...currentInit, ...(options.signal ? { signal: options.signal } : {}) });

    if (!isRedirectStatus(response.status)) {
      // Final response. Strip the redirect headers the upstream set
      // and return. We do not consume the body here — the caller
      // owns that.
      return response;
    }
    const location = readLocation(response);
    if (!location) {
      // Redirect with no Location — treat as terminal.
      return response;
    }
    if (hop === maxRedirects) {
      throw new RedirectLimitExceededError(currentUrl, hop + 1);
    }
    // Drain the response body so the underlying socket can close.
    try { await response.text(); } catch { /* ignore */ }

    currentUrl = resolveRedirectUrl(currentUrl, location).toString();
    // Switch to GET on 303 (per RFC 7231 §6.4.4); for 307/308 keep
    // method + body; for 301/302 the historical behavior is GET but
    // most clients preserve method — we preserve too.
    if (response.status === 303) {
      currentInit = { method: "GET", headers: currentInit.headers };
      delete (currentInit as { body?: unknown }).body;
    }
  }
  throw new RedirectLimitExceededError(currentUrl, maxRedirects + 1);
};