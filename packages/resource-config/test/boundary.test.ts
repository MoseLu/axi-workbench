import { describe, expect, it } from "vitest";

import {
  ConfigParseError,
  createServerConfig,
  loadPublicConfig,
  loadServerConfig,
  parseServerEnv,
  scrubObject,
  toPublicConfig,
} from "../src/index.js";

/**
 * Cross-cutting boundary tests. The gateway's HTTP layer depends on
 * four limits from `ServerConfig`: `maxBodyBytes`, `maxResultItems`,
 * `dispatchTimeoutMs`, and `drainTimeoutMs`. The package must enforce
 * positive ints for all of them and must keep the limits visible to
 * the public config so the workbench can warn the user before it
 * tries to upload a body that exceeds `maxBodyBytes`.
 */

const baseEnv = () => ({
  GATEWAY_HOST: "127.0.0.1",
  GATEWAY_PORT: "8787",
  AXI_IMAGE_PREVIEW_TARGET: "http://127.0.0.1:5173",
  AXI_DOCS_TARGET: "http://127.0.0.1:3010",
  AXI_PROJECT_TARGET: "http://127.0.0.1:3010",
  AXI_UI_TARGET: "http://127.0.0.1:3010",
  AXI_ICON_TARGET: "http://127.0.0.1:3010",
});

const setLimit = (env: Record<string, string | undefined>, key: string, raw: string): void => {
  env[key] = raw;
};

describe("@axi/resource-config limit parsing", () => {
  it.each([
    ["GATEWAY_MAX_BODY_BYTES", "maxBodyBytes"],
    ["GATEWAY_MAX_RESULT_ITEMS", "maxResultItems"],
    ["GATEWAY_DISPATCH_TIMEOUT_MS", "dispatchTimeoutMs"],
    ["GATEWAY_DRAIN_TIMEOUT_MS", "drainTimeoutMs"],
  ] as const)("accepts a positive integer for %s", (envKey, field) => {
    const env = baseEnv();
    setLimit(env, envKey, "100");
    const config = createServerConfig(env);
    expect((config as unknown as Record<string, number>)[field]).toBe(100);
  });

  it.each([
    ["GATEWAY_MAX_BODY_BYTES", "maxBodyBytes"],
    ["GATEWAY_MAX_RESULT_ITEMS", "maxResultItems"],
    ["GATEWAY_DISPATCH_TIMEOUT_MS", "dispatchTimeoutMs"],
    ["GATEWAY_DRAIN_TIMEOUT_MS", "drainTimeoutMs"],
  ] as const)("rejects non-positive values for %s by falling back to the default", (envKey, field) => {
    const env = baseEnv();
    setLimit(env, envKey, "0");
    const config = createServerConfig(env);
    const defaults = {
      maxBodyBytes: 256 * 1024,
      maxResultItems: 12,
      dispatchTimeoutMs: 30_000,
      drainTimeoutMs: 10_000,
    } as const;
    expect((config as unknown as Record<string, number>)[field]).toBe(defaults[field]);
  });

  it.each([
    ["GATEWAY_MAX_BODY_BYTES", "maxBodyBytes"],
    ["GATEWAY_MAX_RESULT_ITEMS", "maxResultItems"],
    ["GATEWAY_DISPATCH_TIMEOUT_MS", "dispatchTimeoutMs"],
    ["GATEWAY_DRAIN_TIMEOUT_MS", "drainTimeoutMs"],
  ] as const)("rejects non-integer values for %s by falling back to the default", (envKey, field) => {
    const env = baseEnv();
    setLimit(env, envKey, "1.5");
    const config = createServerConfig(env);
    const defaults = {
      maxBodyBytes: 256 * 1024,
      maxResultItems: 12,
      dispatchTimeoutMs: 30_000,
      drainTimeoutMs: 10_000,
    } as const;
    expect((config as unknown as Record<string, number>)[field]).toBe(defaults[field]);
  });

  it("uses different defaults for body and dispatch limits", () => {
    const config = createServerConfig(baseEnv());
    expect(config.maxBodyBytes).toBeGreaterThan(0);
    expect(config.maxResultItems).toBeGreaterThan(0);
    expect(config.dispatchTimeoutMs).toBeGreaterThan(0);
    expect(config.drainTimeoutMs).toBeGreaterThan(0);
    expect(config.maxBodyBytes).toBeGreaterThan(config.maxResultItems);
    expect(config.dispatchTimeoutMs).toBeGreaterThan(config.drainTimeoutMs);
  });
});

describe("@axi/resource-config URL parsing", () => {
  it("treats each upstream target as an independent URL", () => {
    const config = createServerConfig({
      ...baseEnv(),
      AXI_IMAGE_PREVIEW_TARGET: "https://image.example.com",
      AXI_DOCS_TARGET: "https://docs.example.com",
      AXI_PROJECT_TARGET: "https://project.example.com",
      AXI_UI_TARGET: "https://ui.example.com",
      AXI_ICON_TARGET: "https://icon.example.com",
    });
    expect(config.imagePreviewTarget).toBe("https://image.example.com");
    expect(config.axiDocsTarget).toBe("https://docs.example.com");
    expect(config.projectTarget).toBe("https://project.example.com");
    expect(config.uiTarget).toBe("https://ui.example.com");
    expect(config.iconTarget).toBe("https://icon.example.com");
  });

  it("rejects each upstream URL independently", () => {
    for (const targetKey of [
      "AXI_IMAGE_PREVIEW_TARGET",
      "AXI_DOCS_TARGET",
      "AXI_PROJECT_TARGET",
      "AXI_UI_TARGET",
      "AXI_ICON_TARGET",
    ] as const) {
      expect(() => createServerConfig({ ...baseEnv(), [targetKey]: "no-protocol" })).toThrowError(ConfigParseError);
    }
  });
});

describe("@axi/resource-config port parsing", () => {
  it("treats GATEWAY_PORT=0 as missing", () => {
    const config = createServerConfig({ ...baseEnv(), GATEWAY_PORT: "0" });
    expect(config.port).toBe(8787);
  });

  it("treats GATEWAY_PORT with leading zeros as a valid integer", () => {
    const config = createServerConfig({ ...baseEnv(), GATEWAY_PORT: "09000" });
    expect(config.port).toBe(9000);
  });

  it("refuses whitespace-only numeric env values", () => {
    const config = createServerConfig({ ...baseEnv(), GATEWAY_PORT: ""  });
    expect(config.port).toBe(8787);
  });
});

describe("@axi/resource-config CORS origin parsing", () => {
  it("treats an empty string as zero origins", () => {
    const config = createServerConfig({ ...baseEnv(), GATEWAY_CORS_ORIGINS: "" });
    expect(config.corsOrigins).toEqual([]);
  });

  it("drops empty entries between commas", () => {
    const config = createServerConfig({ ...baseEnv(), GATEWAY_CORS_ORIGINS: "http://a,,http://b," });
    expect(config.corsOrigins).toEqual(["http://a", "http://b"]);
  });

  it("does not interpret spaces as part of an origin", () => {
    const config = createServerConfig({ ...baseEnv(), GATEWAY_CORS_ORIGINS: " http://a , http://b " });
    expect(config.corsOrigins).toEqual(["http://a", "http://b"]);
  });

  it("treats a missing CORS var as zero origins (default = no CORS)", () => {
    const config = createServerConfig(baseEnv());
    expect(config.corsOrigins).toEqual([]);
  });
});

describe("@axi/resource-config secret boundary", () => {
  it("forbids secrets from appearing in toPublicConfig output", () => {
    const server = createServerConfig({
      ...baseEnv(),
      AXI_DOCS_TOKEN: "super-secret-token",
      MINIMAX_TOKENPLAN_CLI: "/Users/example/.cc-connect/bin/minimax-tokenplan",
      MINIMAX_MCP_BASE_PATH: "/tmp/outputs",
    });
    const publicConfig = toPublicConfig(server);
    const serialized = JSON.stringify(scrubObject(publicConfig));
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("/Users/example");
    expect(serialized).not.toContain("/tmp/outputs");
  });

  it("loadPublicConfig never echoes secrets even when they were set", () => {
    const publicConfig = loadPublicConfig({
      env: {
        AXI_DOCS_TOKEN: "super-secret-token",
        MINIMAX_TOKENPLAN_CLI: "/Users/example/.cc-connect/bin/minimax-tokenplan",
        MINIMAX_MCP_BASE_PATH: "/tmp/outputs",
      },
    });
    const serialized = JSON.stringify(publicConfig);
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("/Users/example");
    expect(serialized).not.toContain("/tmp/outputs");
  });

  it("loadServerConfig keeps secrets server-side (positive case)", () => {
    const server = loadServerConfig({
      env: {
        AXI_DOCS_TOKEN: "super-secret-token",
        MINIMAX_TOKENPLAN_CLI: "/Users/example/.cc-connect/bin/minimax-tokenplan",
        MINIMAX_MCP_BASE_PATH: "/tmp/outputs",
      },
    });
    // The server config retains the secrets — but never exposes them.
    expect(server.axiDocsToken).toBe("super-secret-token");
    const publicConfig = toPublicConfig(server);
    expect(JSON.stringify(publicConfig)).not.toContain("super-secret-token");
  });
});

describe("@axi/resource-config env invariants", () => {
  it("throws a typed ConfigParseError when an upstream URL is malformed", () => {
    try {
      parseServerEnv({ AXI_DOCS_TARGET: "no-protocol" });
      throw new Error("expected ConfigParseError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigParseError);
      expect((error as ConfigParseError).key).toBe("AXI_DOCS_TARGET");
    }
  });

  it("rejects all five upstream URLs from a single factory call without leaking values", () => {
    const cases = [
      ["AXI_IMAGE_PREVIEW_TARGET", "no-scheme"],
      ["AXI_DOCS_TARGET", "junk1"],
      ["AXI_PROJECT_TARGET", "junk2"],
      ["AXI_UI_TARGET", "junk3"],
      ["AXI_ICON_TARGET", "no-scheme"],
    ] as const;
    for (const [key, value] of cases) {
      expect(() => createServerConfig({ ...baseEnv(), [key]: value })).toThrowError(
        expect.objectContaining({ name: "ConfigParseError", key }),
      );
    }
  });
});
