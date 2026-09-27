import { describe, expect, it } from "vitest";

import {
  allowlistInternals,
  assertAllowlistedTarget,
  isAllowlistedTarget,
} from "../src/allowlist";

/** Helper: parse once, run allowlist check with optional env override. */
const check = (raw: string, env?: NodeJS.ProcessEnv): boolean => {
  const url = new URL(raw);
  return isAllowlistedTarget(url, env ? { env } : {});
};

describe("apps/gateway allowlist (GHA-016)", () => {
  describe("allowlisted targets", () => {
    it("accepts http://127.0.0.1:5173", () => {
      expect(check("http://127.0.0.1:5173")).toBe(true);
    });

    it("accepts http://localhost:3010", () => {
      expect(check("http://localhost:3010")).toBe(true);
    });

    it("accepts http://127.0.0.1:8787", () => {
      expect(check("http://127.0.0.1:8787")).toBe(true);
    });

    it("accepts 127.0.0.1 over https", () => {
      expect(check("https://127.0.0.1:8443/foo")).toBe(true);
    });

    it("accepts localhost with no explicit port", () => {
      expect(check("http://localhost/path")).toBe(true);
    });

    it("honors GATEWAY_ALLOWLIST_HOSTS env injection (case-insensitive)", () => {
      const env: NodeJS.ProcessEnv = { GATEWAY_ALLOWLIST_HOSTS: "WORKBENCH.internal, AXI-DOCS.lan" };
      expect(check("http://workbench.internal:9000", env)).toBe(true);
      expect(check("http://axi-docs.lan:3010", env)).toBe(true);
    });

    it("ignores empty / whitespace segments in the env list", () => {
      const env: NodeJS.ProcessEnv = { GATEWAY_ALLOWLIST_HOSTS: " ,  workbench.local ,, " };
      expect(check("http://workbench.local:9000", env)).toBe(true);
      // Empty entry doesn't widen the allowlist.
      expect(check("http://not-allowed.example", env)).toBe(false);
    });
  });

  describe("rejected targets — RFC1918 private ranges", () => {
    it("rejects 10.0.0.1", () => {
      expect(check("http://10.0.0.1:1234")).toBe(false);
    });

    it("rejects 172.16.0.1 and the rest of 172.16.0.0/12", () => {
      expect(check("http://172.16.0.1:80")).toBe(false);
      expect(check("http://172.20.5.5:80")).toBe(false);
      expect(check("http://172.31.255.255:80")).toBe(false);
    });

    it("rejects 192.168.1.1", () => {
      expect(check("http://192.168.1.1")).toBe(false);
    });

    it("deny overrides allow: 10.0.0.1 is rejected even if env-whitelisted", () => {
      const env: NodeJS.ProcessEnv = { GATEWAY_ALLOWLIST_HOSTS: "10.0.0.1" };
      expect(check("http://10.0.0.1:80", env)).toBe(false);
    });
  });

  describe("rejected targets — link-local and metadata endpoints", () => {
    it("rejects 169.254.169.254 (AWS / GCP / Azure metadata)", () => {
      expect(check("http://169.254.169.254/latest/meta-data/")).toBe(false);
    });

    it("rejects arbitrary link-local hosts", () => {
      expect(check("http://169.254.0.1:80")).toBe(false);
      expect(check("http://169.254.255.255:80")).toBe(false);
    });
  });

  describe("rejected targets — IPv6", () => {
    it("rejects IPv6 loopback [::1]", () => {
      expect(check("http://[::1]:8080")).toBe(false);
    });

    it("rejects IPv6 link-local (fe80::)", () => {
      expect(check("http://[fe80::1]:80")).toBe(false);
    });

    it("rejects IPv6 unique-local (fc00::/7)", () => {
      expect(check("http://[fc00::1]:80")).toBe(false);
      expect(check("http://[fd12:3456:789a::1]:80")).toBe(false);
    });

    it("rejects IPv6 multicast (ff00::/8)", () => {
      expect(check("http://[ff02::1]:80")).toBe(false);
    });

    it("rejects IPv4-mapped IPv6 of forbidden IPv4", () => {
      // ::ffff:10.0.0.1
      expect(check("http://[::ffff:10.0.0.1]:80")).toBe(false);
      // ::ffff:169.254.169.254 (metadata over IPv6)
      expect(check("http://[::ffff:169.254.169.254]:80")).toBe(false);
    });

    it("rejects IPv4-compatible IPv6 of forbidden IPv4", () => {
      // ::10.0.0.1
      expect(check("http://[::10.0.0.1]:80")).toBe(false);
    });
  });

  describe("rejected targets — other ranges", () => {
    it("rejects arbitrary internet hostnames", () => {
      expect(check("http://attacker.com")).toBe(false);
      expect(check("https://example.org/path")).toBe(false);
    });

    it("rejects CGNAT 100.64.0.0/10", () => {
      expect(check("http://100.64.0.1:80")).toBe(false);
      expect(check("http://100.127.255.255:80")).toBe(false);
    });

    it("rejects 0.0.0.0/8", () => {
      expect(check("http://0.0.0.0:80")).toBe(false);
    });

    it("rejects multicast 224.0.0.0/4", () => {
      expect(check("http://224.0.0.1:80")).toBe(false);
      expect(check("http://239.255.255.255:80")).toBe(false);
    });

    it("rejects reserved 240.0.0.0/4", () => {
      expect(check("http://240.0.0.1:80")).toBe(false);
    });

    it("rejects TEST-NET ranges", () => {
      expect(check("http://198.51.100.1:80")).toBe(false);
      expect(check("http://203.0.113.1:80")).toBe(false);
    });
  });

  describe("rejected targets — non-HTTP schemes", () => {
    it("rejects file: scheme", () => {
      expect(check("file:///etc/passwd")).toBe(false);
    });

    it("rejects javascript: scheme", () => {
      expect(check("javascript:alert(1)")).toBe(false);
    });

    it("rejects data: scheme", () => {
      expect(check("data:text/plain,hello")).toBe(false);
    });

    it("rejects ftp: scheme", () => {
      expect(check("ftp://127.0.0.1/file")).toBe(false);
    });

    it("rejects ws: and gopher: schemes", () => {
      expect(check("ws://127.0.0.1:8080")).toBe(false);
      expect(check("gopher://127.0.0.1")).toBe(false);
    });
  });

  describe("assertAllowlistedTarget", () => {
    it("returns a parsed URL on success", () => {
      const parsed = assertAllowlistedTarget("http://127.0.0.1:5173");
      expect(parsed.hostname).toBe("127.0.0.1");
      expect(parsed.port).toBe("5173");
    });

    it("throws when URL is invalid", () => {
      expect(() => assertAllowlistedTarget("not-a-url")).toThrow(/failed to parse/u);
    });

    it("throws when URL is empty string", () => {
      expect(() => assertAllowlistedTarget("")).toThrow(/non-empty string/u);
    });

    it("throws when URL is not a string", () => {
      // Bypass the runtime type check by passing a non-string.
      expect(() => assertAllowlistedTarget(undefined as unknown as string)).toThrow(/non-empty string/u);
      expect(() => assertAllowlistedTarget(null as unknown as string)).toThrow(/non-empty string/u);
    });

    it("throws on forbidden host", () => {
      expect(() => assertAllowlistedTarget("http://10.0.0.1:1234")).toThrow(/not allowlisted/u);
      expect(() => assertAllowlistedTarget("http://192.168.1.1")).toThrow(/not allowlisted/u);
      expect(() => assertAllowlistedTarget("http://169.254.169.254/latest/meta-data/")).toThrow(/not allowlisted/u);
      expect(() => assertAllowlistedTarget("http://[::1]:8080")).toThrow(/not allowlisted/u);
      expect(() => assertAllowlistedTarget("http://attacker.com")).toThrow(/not allowlisted/u);
    });

    it("throws on file:// / javascript: / data:", () => {
      expect(() => assertAllowlistedTarget("file:///etc/passwd")).toThrow(/not allowlisted/u);
      expect(() => assertAllowlistedTarget("javascript:alert(1)")).toThrow(/not allowlisted/u);
      expect(() => assertAllowlistedTarget("data:text/plain,hi")).toThrow(/not allowlisted/u);
    });

    it("throws with a descriptive message that names the rejected host", () => {
      try {
        assertAllowlistedTarget("http://169.254.169.254/latest/meta-data/");
        throw new Error("expected throw");
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        const message = (error as Error).message;
        expect(message).toContain("169.254.169.254");
        expect(message).toContain("not allowlisted");
      }
    });

    it("respects env override", () => {
      const env: NodeJS.ProcessEnv = { GATEWAY_ALLOWLIST_HOSTS: "staging.workbench" };
      expect(() => assertAllowlistedTarget("http://staging.workbench:9000", { env })).not.toThrow();
      expect(() => assertAllowlistedTarget("http://127.0.0.1:9000", { env })).not.toThrow();
      expect(() => assertAllowlistedTarget("http://prod.invalid:9000", { env })).toThrow(/not allowlisted/u);
    });
  });

  describe("internals — visible only to tests", () => {
    it("default allowlist contains 127.0.0.1 and localhost", () => {
      expect(allowlistInternals.DEFAULT_ALLOWLISTED_HOSTS.has("127.0.0.1")).toBe(true);
      expect(allowlistInternals.DEFAULT_ALLOWLISTED_HOSTS.has("localhost")).toBe(true);
    });

    it("parseIPv4 round-trips for IPv4 literals", () => {
      expect(allowlistInternals.parseIPv4("127.0.0.1")).toEqual([127, 0, 0, 1]);
      expect(allowlistInternals.parseIPv4("::1")).toBeNull();
      expect(allowlistInternals.parseIPv4("not-an-ip")).toBeNull();
    });

    it("isForbiddenIPv4 matches every documented range", () => {
      const expectForbidden = (host: string) => {
        expect(allowlistInternals.isForbiddenIPv4(host)).toBe(true);
      };
      expectForbidden("0.0.0.1");
      expectForbidden("10.5.6.7");
      expectForbidden("100.64.0.1");
      expectForbidden("172.16.0.1");
      expectForbidden("172.31.255.255");
      expectForbidden("192.168.0.1");
      expectForbidden("169.254.169.254");
      expectForbidden("198.18.0.1");
      expectForbidden("198.51.100.5");
      expectForbidden("203.0.113.5");
      expectForbidden("224.0.0.1");
      expectForbidden("240.0.0.1");
    });

    it("isForbiddenIPv4 lets loopback through", () => {
      expect(allowlistInternals.isForbiddenIPv4("127.0.0.1")).toBe(false);
      expect(allowlistInternals.isForbiddenIPv4("127.255.255.254")).toBe(false);
    });

    it("isForbiddenIPv6 blocks every variant we tested above", () => {
      expect(allowlistInternals.isForbiddenIPv6("::1")).toBe(true);
      expect(allowlistInternals.isForbiddenIPv6("::")).toBe(true);
      expect(allowlistInternals.isForbiddenIPv6("fe80::1")).toBe(true);
      expect(allowlistInternals.isForbiddenIPv6("fc00::1")).toBe(true);
      expect(allowlistInternals.isForbiddenIPv6("fd12::1")).toBe(true);
      expect(allowlistInternals.isForbiddenIPv6("ff02::1")).toBe(true);
      expect(allowlistInternals.isForbiddenIPv6("2001:db8::1")).toBe(true);
    });

    it("resolveAllowlist merges defaults with operator-supplied hosts", () => {
      const resolved = allowlistInternals.resolveAllowlist({ GATEWAY_ALLOWLIST_HOSTS: "extra.host" });
      expect(resolved.has("127.0.0.1")).toBe(true);
      expect(resolved.has("localhost")).toBe(true);
      expect(resolved.has("extra.host")).toBe(true);
    });
  });
});