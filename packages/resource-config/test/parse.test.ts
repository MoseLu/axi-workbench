import { describe, expect, it } from "vitest";

import {
  ConfigParseError,
  SERVER_CONFIG_DEFAULTS,
  createServerConfig,
  parseServerEnv,
  toPublicConfig,
} from "../src/index.js";

const baseEnv = () => ({
  GATEWAY_HOST: "127.0.0.1",
  GATEWAY_PORT: "8787",
  AXI_IMAGE_PREVIEW_TARGET: "http://127.0.0.1:5173",
  AXI_DOCS_TARGET: "http://127.0.0.1:3010",
  AXI_PROJECT_TARGET: "http://127.0.0.1:3010",
  AXI_UI_TARGET: "http://127.0.0.1:3010",
  AXI_ICON_TARGET: "http://127.0.0.1:3010",
});

describe("@axi/resource-config parseServerEnv", () => {
  it("returns canonical defaults when env is empty", () => {
    const parsed = parseServerEnv({});
    expect(parsed.host).toBe(SERVER_CONFIG_DEFAULTS.host);
    expect(parsed.port).toBe(SERVER_CONFIG_DEFAULTS.port);
    expect(parsed.imagePreviewTarget).toBe(SERVER_CONFIG_DEFAULTS.imagePreviewTarget);
    expect(parsed.axiDocsTarget).toBe(SERVER_CONFIG_DEFAULTS.axiDocsTarget);
    expect(parsed.projectTarget).toBe(SERVER_CONFIG_DEFAULTS.projectTarget);
    expect(parsed.uiTarget).toBe(SERVER_CONFIG_DEFAULTS.uiTarget);
    expect(parsed.iconTarget).toBe(SERVER_CONFIG_DEFAULTS.iconTarget);
    expect(parsed.corsOrigins).toEqual([]);
    expect(parsed.maxBodyBytes).toBe(SERVER_CONFIG_DEFAULTS.maxBodyBytes);
    expect(parsed.maxResultItems).toBe(SERVER_CONFIG_DEFAULTS.maxResultItems);
    expect(parsed.dispatchTimeoutMs).toBe(SERVER_CONFIG_DEFAULTS.dispatchTimeoutMs);
    expect(parsed.drainTimeoutMs).toBe(SERVER_CONFIG_DEFAULTS.drainTimeoutMs);
    expect(parsed.axiDocsToken).toBeUndefined();
    expect(parsed.minimaxCli).toBeUndefined();
    expect(parsed.minimaxOutputDir).toBeUndefined();
  });

  it("overrides every supported key", () => {
    const parsed = parseServerEnv({
      ...baseEnv(),
      GATEWAY_HOST: "0.0.0.0",
      GATEWAY_PORT: "9000",
      AXI_IMAGE_PREVIEW_TARGET: "https://image.example.com",
      AXI_DOCS_TARGET: "https://docs.example.com",
      AXI_PROJECT_TARGET: "https://project.example.com",
      AXI_UI_TARGET: "https://ui.example.com",
      AXI_ICON_TARGET: "https://icon.example.com",
      GATEWAY_CORS_ORIGINS: "http://localhost:5177, http://10.0.0.2:5177",
      GATEWAY_MAX_BODY_BYTES: "65536",
      GATEWAY_MAX_RESULT_ITEMS: "24",
      GATEWAY_DISPATCH_TIMEOUT_MS: "45000",
      GATEWAY_DRAIN_TIMEOUT_MS: "15000",
    });
    expect(parsed.host).toBe("0.0.0.0");
    expect(parsed.port).toBe(9000);
    expect(parsed.imagePreviewTarget).toBe("https://image.example.com");
    expect(parsed.axiDocsTarget).toBe("https://docs.example.com");
    expect(parsed.projectTarget).toBe("https://project.example.com");
    expect(parsed.uiTarget).toBe("https://ui.example.com");
    expect(parsed.iconTarget).toBe("https://icon.example.com");
    expect(parsed.corsOrigins).toEqual(["http://localhost:5177", "http://10.0.0.2:5177"]);
    expect(parsed.maxBodyBytes).toBe(65536);
    expect(parsed.maxResultItems).toBe(24);
    expect(parsed.dispatchTimeoutMs).toBe(45_000);
    expect(parsed.drainTimeoutMs).toBe(15_000);
  });

  it("trims whitespace and treats blank values as missing", () => {
    const parsed = parseServerEnv({
      ...baseEnv(),
      GATEWAY_HOST: "  10.0.0.5  ",
      GATEWAY_PORT: "  9100 ",
      GATEWAY_CORS_ORIGINS: "  http://a, ,http://b  ",
    });
    expect(parsed.host).toBe("10.0.0.5");
    expect(parsed.port).toBe(9100);
    expect(parsed.corsOrigins).toEqual(["http://a", "http://b"]);
  });

  it("falls back to defaults when numeric values are non-positive", () => {
    const parsed = parseServerEnv({
      ...baseEnv(),
      GATEWAY_PORT: "0",
      GATEWAY_MAX_BODY_BYTES: "-1",
      GATEWAY_MAX_RESULT_ITEMS: "abc",
      GATEWAY_DISPATCH_TIMEOUT_MS: "1.5",
      GATEWAY_DRAIN_TIMEOUT_MS: "",
    });
    expect(parsed.port).toBe(SERVER_CONFIG_DEFAULTS.port);
    expect(parsed.maxBodyBytes).toBe(SERVER_CONFIG_DEFAULTS.maxBodyBytes);
    expect(parsed.maxResultItems).toBe(SERVER_CONFIG_DEFAULTS.maxResultItems);
    expect(parsed.dispatchTimeoutMs).toBe(SERVER_CONFIG_DEFAULTS.dispatchTimeoutMs);
    expect(parsed.drainTimeoutMs).toBe(SERVER_CONFIG_DEFAULTS.drainTimeoutMs);
  });

  it("refuses malformed upstream URLs without echoing the value", () => {
    let caught: unknown = null;
    try {
      parseServerEnv({
        ...baseEnv(),
        AXI_IMAGE_PREVIEW_TARGET: "not-a-url",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigParseError);
    expect((caught as ConfigParseError).key).toBe("AXI_IMAGE_PREVIEW_TARGET");
    expect((caught as ConfigParseError).message).toBe("AXI_IMAGE_PREVIEW_TARGET is not a valid URL");
    // The error message must not contain the offending value.
    expect((caught as ConfigParseError).message).not.toContain("not-a-url");
  });

  it("rejects a numeric port overflow", () => {
    const parsed = parseServerEnv({
      ...baseEnv(),
      GATEWAY_PORT: "999999999999999999999",
    });
    // Out-of-range values are not /^\d+$/u positive ints; they fall back.
    expect(parsed.port).toBe(SERVER_CONFIG_DEFAULTS.port);
  });

  it("loads secret values from env without leaking through the parse result", () => {
    const parsed = parseServerEnv({
      ...baseEnv(),
      AXI_DOCS_TOKEN: "super-secret-token",
      MINIMAX_TOKENPLAN_CLI: "/Users/example/.cc-connect/bin/minimax-tokenplan",
      MINIMAX_MCP_BASE_PATH: "/tmp/outputs",
    });
    expect(parsed.axiDocsToken).toBe("super-secret-token");
    expect(parsed.minimaxCli).toBe("/Users/example/.cc-connect/bin/minimax-tokenplan");
    expect(parsed.minimaxOutputDir).toBe("/tmp/outputs");
  });
});

describe("@axi/resource-config createServerConfig", () => {
  it("returns a frozen object that cannot be mutated", () => {
    const config = createServerConfig(baseEnv());
    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      // @ts-expect-error — testing runtime immutability, not type safety.
      config.port = 9999;
    }).toThrow();
  });

  it("freezes the corsOrigins array so consumers cannot mutate it in place", () => {
    const config = createServerConfig({
      ...baseEnv(),
      GATEWAY_CORS_ORIGINS: "http://a,http://b",
    });
    expect(Object.isFrozen(config.corsOrigins)).toBe(true);
    expect(() => {
      // @ts-expect-error — runtime guard.
      (config.corsOrigins as ReadonlyArray<string>).length = 0;
    }).toThrow();
  });

  it("ignores unknown env keys entirely", () => {
    const parsed = createServerConfig({
      ...baseEnv(),
      GATEWAY_RANDOM_FUTURE_FLAG: "1",
      AXI_TOTALLY_NEW_TARGET: "https://x",
    });
    // Future keys don't break parsing; the known fields still match.
    expect(parsed.host).toBe("127.0.0.1");
    expect(parsed.port).toBe(8787);
  });
});

describe("@axi/resource-config toPublicConfig", () => {
  it("exposes only the public-safe slice", () => {
    const server = createServerConfig({
      ...baseEnv(),
      AXI_DOCS_TOKEN: "super-secret",
      MINIMAX_TOKENPLAN_CLI: "/Users/example/.cc-connect/bin/minimax-tokenplan",
      MINIMAX_MCP_BASE_PATH: "/tmp/outputs",
      GATEWAY_CORS_ORIGINS: "http://localhost:5177",
    });
    const publicConfig = toPublicConfig(server);
    expect(Object.keys(publicConfig).sort()).toEqual([
      "corsOrigins",
      "dispatchTimeoutMs",
      "drainTimeoutMs",
      "host",
      "maxBodyBytes",
      "maxResultItems",
      "minimaxBridge",
      "port",
    ]);
    expect(publicConfig.minimaxBridge).toBe(true);
    expect(publicConfig.host).toBe("127.0.0.1");
    expect(publicConfig.port).toBe(8787);
    expect(publicConfig.corsOrigins).toEqual(["http://localhost:5177"]);
    expect(Object.isFrozen(publicConfig)).toBe(true);
    expect(Object.isFrozen(publicConfig.corsOrigins)).toBe(true);
  });

  it("flags minimaxBridge=false when CLI is missing even if output dir is set", () => {
    const server = createServerConfig({
      ...baseEnv(),
      MINIMAX_MCP_BASE_PATH: "/tmp/outputs",
    });
    const publicConfig = toPublicConfig(server);
    expect(publicConfig.minimaxBridge).toBe(false);
  });

  it("flags minimaxBridge=false when output dir is missing even if CLI is set", () => {
    const server = createServerConfig({
      ...baseEnv(),
      MINIMAX_TOKENPLAN_CLI: "/Users/example/.cc-connect/bin/minimax-tokenplan",
    });
    const publicConfig = toPublicConfig(server);
    expect(publicConfig.minimaxBridge).toBe(false);
  });

  it("never exposes upstream provider URLs to the browser", () => {
    const server = createServerConfig({
      ...baseEnv(),
      AXI_IMAGE_PREVIEW_TARGET: "https://image.example.com",
      AXI_DOCS_TARGET: "https://docs.example.com",
    });
    const publicConfig = toPublicConfig(server);
    const json = JSON.stringify(publicConfig);
    expect(json).not.toContain("image.example.com");
    expect(json).not.toContain("docs.example.com");
    expect(json).not.toContain("AXI_DOCS_TOKEN");
    expect(json).not.toContain("MINIMAX_TOKENPLAN_CLI");
    expect(json).not.toContain("MINIMAX_MCP_BASE_PATH");
  });
});
