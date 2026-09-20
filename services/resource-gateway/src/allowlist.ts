/**
 * Gateway SSRF allowlist (GHA-016).
 *
 * The gateway only proxies requests to a small, explicitly enumerated set
 * of hosts. This is the load-bearing defense against SSRF: even if an
 * upstream payload (or a future bug in caller validation) injects an
 * attacker-controlled URL into one of the server-side adapters, the
 * adapter factory refuses to build a registry pointing at that URL and
 * the gateway refuses to become "ready".
 *
 * The allowlist is intentionally narrow:
 *   - loopback IPv4 (`127.0.0.0/8`)
 *   - loopback hostname (`localhost`)
 *   - anything reachable only on the local machine
 *
 * RFC1918 private space (`10.*`, `172.16/12`, `192.168/16`), link-local
 * (`169.254/16`, including AWS / GCP metadata endpoints), IPv6 loopback
 * (`::1`), multicast, and reserved ranges are always rejected, even if
 * the operator has injected them via `GATEWAY_ALLOWLIST_HOSTS`. The
 * allowlist defaults + operator-supplied hosts form the "permit" set;
 * the forbidden-ranges check is then applied as a final deny filter.
 *
 * We deliberately do NOT allow:
 *   - non-HTTP(S) schemes (no `file:`, `javascript:`, `data:`)
 *   - URLs without an explicit hostname (no opaque hosts)
 *   - wildcard or regex matches; the list is a literal set
 */

import { isIP } from "node:net";

/** Default hosts the gateway may talk to when no env override is present. */
const DEFAULT_ALLOWLISTED_HOSTS: ReadonlySet<string> = new Set<string>([
  "127.0.0.1",
  "localhost",
]);

/** RFC1918 + link-local + reserved IPv4 ranges the gateway must never reach. */
interface ForbiddenIPv4Range {
  test: (parts: number[]) => boolean;
  label: string;
}

const FORBIDDEN_IPV4_RANGES: ReadonlyArray<ForbiddenIPv4Range> = [
  // 0.0.0.0/8 — "this host on this network"
  { test: ([a]) => a === 0, label: "0.0.0.0/8" },
  // 10.0.0.0/8
  { test: ([a]) => a === 10, label: "RFC1918 10.0.0.0/8" },
  // 100.64.0.0/10 — CGNAT shared address space (RFC 6598)
  { test: ([a, b]) => a === 100 && b >= 64 && b <= 127, label: "CGNAT 100.64.0.0/10" },
  // 172.16.0.0/12
  { test: ([a, b]) => a === 172 && b >= 16 && b <= 31, label: "RFC1918 172.16.0.0/12" },
  // 192.168.0.0/16
  { test: ([a, b]) => a === 192 && b === 168, label: "RFC1918 192.168.0.0/16" },
  // 169.254.0.0/16 — includes AWS/GCP/Azure metadata endpoints.
  { test: ([a, b]) => a === 169 && b === 254, label: "link-local 169.254.0.0/16" },
  // 198.18.0.0/15 — benchmark testing
  { test: ([a, b]) => a === 198 && (b === 18 || b === 19), label: "benchmark 198.18.0.0/15" },
  // 198.51.100.0/24 — TEST-NET-2
  { test: ([a, b, c]) => a === 198 && b === 51 && c === 100, label: "TEST-NET-2 198.51.100.0/24" },
  // 203.0.113.0/24 — TEST-NET-3
  { test: ([a, b, c]) => a === 203 && b === 0 && c === 113, label: "TEST-NET-3 203.0.113.0/24" },
  // 224.0.0.0/4 — multicast
  { test: ([a]) => a >= 224 && a <= 239, label: "multicast 224.0.0.0/4" },
  // 240.0.0.0/4 — reserved / broadcast
  { test: ([a]) => a >= 240, label: "reserved 240.0.0.0/4" },
];

/**
 * Parse an IPv4 literal into 4 octets. Returns null for non-IPv4 inputs.
 */
const parseIPv4 = (host: string): number[] | null => {
  if (isIP(host) !== 4) return null;
  const parts = host.split(".").map((segment) => Number.parseInt(segment, 10));
  if (
    parts.length !== 4 ||
    parts.some((value) => !Number.isFinite(value) || value < 0 || value > 255)
  ) {
    return null;
  }
  return parts;
};

/**
 * True when the IPv4 address falls in a range the gateway must never
 * proxy to. Loopback (127.0.0.0/8) is *not* in this list because it
 * is the entire point of the allowlist; it is the caller's job to
 * confirm the host is in the allowlist.
 */
const isForbiddenIPv4 = (host: string): boolean => {
  const parts = parseIPv4(host);
  if (!parts) return false; // Not IPv4 — let the hostname allowlist decide.
  return FORBIDDEN_IPV4_RANGES.some((range) => {
    try {
      return range.test(parts);
    } catch {
      return false;
    }
  });
};

/**
 * True when the host string is an IPv6 literal the gateway must never
 * proxy to. Any IPv6 literal that isn't the IPv6 loopback is treated as
 * untrusted; the deny-by-default stance keeps the gateway from being
 * redirected to internal IPv6 services in dual-stack clusters.
 */
const isForbiddenIPv6 = (host: string): boolean => {
  if (isIP(host) !== 6) return false;
  // Strip zone identifiers (`fe80::1%eth0`); `URL.hostname` already
  // removes brackets for us.
  const normalized = host.split("%", 1)[0]!.toLowerCase();

  // IPv4-mapped IPv6 (`::ffff:127.0.0.1`) — check the embedded IPv4.
  const v4Mapped = /^::ffff:([0-9.]+)$/u.exec(normalized);
  if (v4Mapped) {
    return isForbiddenIPv4(v4Mapped[1]!);
  }
  // ::ffff:0:0/96 — IPv4-compatible (deprecated but still parsed).
  if (/^::\d+(\.\d+){3}$/u.test(normalized)) {
    const ipv4 = normalized.slice(2);
    return isForbiddenIPv4(ipv4);
  }

  // Always-blocked IPv6 ranges
  if (normalized === "::1") return true; // loopback
  if (normalized === "::") return true; // unspecified
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe80::")) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/u.test(normalized)) return true; // unique local fc00::/7
  if (normalized.startsWith("ff") || /^ff[0-9a-f]{2}:/u.test(normalized)) return true; // multicast ff00::/8
  // 2001:db8::/32 — documentation
  if (normalized.startsWith("2001:db8:") || /^2001:0?db8:/u.test(normalized)) return true;
  // ::ffff:0:0/96 above; everything else untrusted.
  return true;
};

/**
 * Resolve the operator-supplied allowlist. The env value is a
 * comma-separated list of hostnames or IP literals. Empty entries and
 * whitespace are ignored. The defaults are always included.
 */
const resolveAllowlist = (env: NodeJS.ProcessEnv | undefined): ReadonlySet<string> => {
  const hosts = new Set<string>(DEFAULT_ALLOWLISTED_HOSTS);
  const raw = env?.GATEWAY_ALLOWLIST_HOSTS;
  if (typeof raw === "string" && raw.length > 0) {
    for (const candidate of raw.split(",")) {
      const trimmed = candidate.trim().toLowerCase();
      if (trimmed.length > 0) hosts.add(trimmed);
    }
  }
  return hosts;
};

/**
 * Decide whether `url` is allowed. Returns false on:
 *   - non-http(s) schemes (file:, javascript:, data:, ftp:, etc.)
 *   - missing hostname
 *   - hostnames / IPs not present in the allowlist
 *   - IPv4 / IPv6 literals in forbidden ranges
 *
 * The function is pure: callers control the env lookup via the
 * optional second argument (useful for tests).
 */
export const isAllowlistedTarget = (
  url: URL,
  options: { env?: NodeJS.ProcessEnv } = {},
): boolean => {
  // Only http and https are gateway transports. Anything else
  // (file:, javascript:, data:, ftp:, ws:, etc.) is rejected outright.
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  // Empty hostnames cannot be reached and almost always indicate a
  // parse-time mistake; reject defensively.
  const hostname = url.hostname.trim().toLowerCase();
  if (hostname.length === 0) return false;

  // IP literals are checked against the forbidden-ranges list first.
  // A forbidden IP is rejected even if the operator whitelisted it
  // via env — this is the "deny overrides allow" rule.
  if (isIP(hostname) === 4 && isForbiddenIPv4(hostname)) return false;
  if (isIP(hostname) === 6 && isForbiddenIPv6(hostname)) return false;

  // Hostname or IP must appear in the allowlist.
  const allowlist = resolveAllowlist(options.env);
  if (allowlist.has(hostname)) return true;

  return false;
};

/**
 * Assert that `raw` is a string URL pointing at an allowlisted host.
 * Throws with a descriptive message on any failure. Callers should
 * treat the throw as a startup-time fatal error.
 */
export const assertAllowlistedTarget = (
  raw: string,
  options: { env?: NodeJS.ProcessEnv } = {},
): URL => {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error(`target URL must be a non-empty string: ${String(raw)}`);
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`target URL failed to parse: ${raw} (${detail})`);
  }
  if (!isAllowlistedTarget(parsed, options)) {
    throw new Error(
      `target URL is not allowlisted (must be loopback; rejected host="${parsed.hostname}" scheme="${parsed.protocol}"): ${raw}`,
    );
  }
  return parsed;
};

/** Exposed for tests only. */
export const allowlistInternals = {
  DEFAULT_ALLOWLISTED_HOSTS,
  FORBIDDEN_IPV4_RANGES,
  parseIPv4,
  isForbiddenIPv4,
  isForbiddenIPv6,
  resolveAllowlist,
};