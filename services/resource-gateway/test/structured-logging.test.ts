/**
 * apps/gateway/test/structured-logging.test.ts — GHA-NEXT-031
 *
 * Pure unit tests for the structured JSON logger + redactSecrets
 * helper. The logger is default-off (the existing console.log call
 * sites in server.ts continue to work); the helpers exist so new
 * log sites emit a stable JSON shape and never leak a secret.
 */

import { describe, expect, it } from "vitest";

import {
  buildLogLine,
  redactSecrets,
  serializeLogLine,
} from "../src/logging/structured";

describe("apps/gateway structured logging — GHA-NEXT-031", () => {
  it("buildLogLine stamps ts / level / msg and merges fields", () => {
    const line = buildLogLine({
      level: "info",
      msg: "request_completed",
      fields: { requestId: "req-1", status: 200 },
    });
    expect(line.level).toBe("info");
    expect(line.msg).toBe("request_completed");
    expect(line.requestId).toBe("req-1");
    expect(line.status).toBe(200);
    expect(typeof line.ts).toBe("string");
    expect(line.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });

  it("buildLogLine redacts secret-bearing keys", () => {
    const line = buildLogLine({
      level: "info",
      msg: "config_dumped",
      fields: {
        apiKey: "AKIA1234567890",
        GATEWAY_API_KEYS: "secret-list",
        authHeader: "Bearer abcdefghijklmnop",
        safeField: "harmless",
      },
    });
    expect(line.apiKey).toBe("[REDACTED]");
    expect(line.GATEWAY_API_KEYS).toBe("[REDACTED]");
    expect(line.authHeader).toBe("[REDACTED]");
    expect(line.safeField).toBe("harmless");
  });

  it("serializeLogLine emits a single JSON line with newline-free content", () => {
    const line = buildLogLine({ level: "warn", msg: "test", fields: { x: 1 } });
    const serialized = serializeLogLine(line);
    expect(serialized).not.toMatch(/\n/u);
    const parsed = JSON.parse(serialized);
    expect(parsed.msg).toBe("test");
    expect(parsed.level).toBe("warn");
    expect(parsed.x).toBe(1);
  });

  it("redactSecrets recurses into nested objects and arrays", () => {
    const input = {
      top: "harmless",
      nested: {
        apiKey: "secret-a",
        list: [{ token: "secret-b" }, { ok: "fine" }],
      },
      password: "secret-c",
    };
    const redacted = redactSecrets(input) as typeof input;
    expect(redacted.top).toBe("harmless");
    expect(redacted.nested.apiKey).toBe("[REDACTED]");
    expect(redacted.nested.list[0]?.token).toBe("[REDACTED]");
    expect(redacted.nested.list[1]?.ok).toBe("fine");
    expect(redacted.password).toBe("[REDACTED]");
    // Original is not mutated.
    expect(input.nested.apiKey).toBe("secret-a");
  });

  it("redactSecrets caps recursion at 8 levels to avoid cycles", () => {
    const deep: Record<string, unknown> = { level: 0 };
    let cursor = deep;
    for (let i = 1; i < 20; i += 1) {
      const next: Record<string, unknown> = { level: i };
      cursor.next = next;
      cursor = next;
    }
    const redacted = redactSecrets(deep) as Record<string, unknown>;
    // Walking 20 levels, we hit the cap and recurse into [REDACTED]
    // placeholders beyond depth 8. We assert that the helper does
    // not throw and that the output is well-formed.
    expect(redacted.level).toBe(0);
  });

  it("redactSecrets preserves primitive types and arrays", () => {
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets("plain")).toBe("plain");
    expect(redactSecrets(null)).toBeNull();
    expect(redactSecrets(undefined)).toBeUndefined();
    expect(redactSecrets([1, 2, { token: "x" }])).toEqual([1, 2, { token: "[REDACTED]" }]);
  });

  it("redactSecrets treats 'key' as a sensitive key but not 'keyword' or 'monkey'", () => {
    const out = redactSecrets({ key: "x", keyword: "y", monkey: "z", api_key: "a" }) as Record<string, unknown>;
    expect(out.key).toBe("[REDACTED]");
    expect(out.keyword).toBe("y");
    expect(out.monkey).toBe("z");
    expect(out.api_key).toBe("[REDACTED]");
  });
});