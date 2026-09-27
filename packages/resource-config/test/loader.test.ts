import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ConfigParseError,
  SERVER_CONFIG_DEFAULTS,
  loadPublicConfig,
  loadServerConfig,
} from "../src/index.js";

const ENV_KEYS = [
  "GATEWAY_HOST",
  "GATEWAY_PORT",
  "GATEWAY_CORS_ORIGINS",
  "GATEWAY_MAX_BODY_BYTES",
  "GATEWAY_MAX_RESULT_ITEMS",
  "GATEWAY_DISPATCH_TIMEOUT_MS",
  "GATEWAY_DRAIN_TIMEOUT_MS",
  "AXI_IMAGE_PREVIEW_TARGET",
  "AXI_DOCS_TARGET",
  "AXI_PROJECT_TARGET",
  "AXI_UI_TARGET",
  "AXI_ICON_TARGET",
  "AXI_DOCS_TOKEN",
  "MINIMAX_TOKENPLAN_CLI",
  "MINIMAX_MCP_BASE_PATH",
] as const;

const ENV_RECORDS = ENV_KEYS.map((key) => key) as unknown as Array<keyof NodeJS.ProcessEnv>;

const snapshotEnv = (): Record<string, string | undefined> => {
  const snapshot: Record<string, string | undefined> = {};
  for (const key of ENV_RECORDS) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
};

const restoreEnv = (snapshot: Record<string, string | undefined>): void => {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const clearEnv = (): void => {
  for (const key of ENV_RECORDS) {
    delete process.env[key];
  }
};

describe("@axi/resource-config loadServerConfig", () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = snapshotEnv();
    clearEnv();
  });
  afterEach(() => {
    restoreEnv(saved);
  });

  it("reads process.env by default when no env map is supplied", () => {
    process.env.GATEWAY_HOST = "10.0.0.1";
    process.env.GATEWAY_PORT = "9100";
    const config = loadServerConfig();
    expect(config.host).toBe("10.0.0.1");
    expect(config.port).toBe(9100);
  });

  it("prefers an injected env over process.env", () => {
    process.env.GATEWAY_PORT = "9999";
    const config = loadServerConfig({ env: { GATEWAY_PORT: "8888" } });
    expect(config.port).toBe(8888);
  });

  it("surfaces ConfigParseError for invalid URLs from injected env", () => {
    expect(() =>
      loadServerConfig({ env: { AXI_IMAGE_PREVIEW_TARGET: "definitely not a url" } }),
    ).toThrowError(ConfigParseError);
  });

  it("returns the documented defaults when process.env is empty", () => {
    const config = loadServerConfig();
    expect(config).toMatchObject({
      host: SERVER_CONFIG_DEFAULTS.host,
      port: SERVER_CONFIG_DEFAULTS.port,
      imagePreviewTarget: SERVER_CONFIG_DEFAULTS.imagePreviewTarget,
      axiDocsTarget: SERVER_CONFIG_DEFAULTS.axiDocsTarget,
      projectTarget: SERVER_CONFIG_DEFAULTS.projectTarget,
      uiTarget: SERVER_CONFIG_DEFAULTS.uiTarget,
      iconTarget: SERVER_CONFIG_DEFAULTS.iconTarget,
      maxBodyBytes: SERVER_CONFIG_DEFAULTS.maxBodyBytes,
      maxResultItems: SERVER_CONFIG_DEFAULTS.maxResultItems,
      dispatchTimeoutMs: SERVER_CONFIG_DEFAULTS.dispatchTimeoutMs,
      drainTimeoutMs: SERVER_CONFIG_DEFAULTS.drainTimeoutMs,
    });
  });

  it("accepts an injected envReader override", () => {
    const reader = () => ({ GATEWAY_PORT: "7654" });
    const config = loadServerConfig({ envReader: reader });
    expect(config.port).toBe(7654);
  });
});

describe("@axi/resource-config loadPublicConfig", () => {
  it("returns the public slice even when secrets are set", () => {
    const publicConfig = loadPublicConfig({
      env: {
        AXI_DOCS_TOKEN: "super-secret",
        MINIMAX_TOKENPLAN_CLI: "/Users/example/.cc-connect/bin/minimax-tokenplan",
        MINIMAX_MCP_BASE_PATH: "/tmp/outputs",
      },
    });
    const json = JSON.stringify(publicConfig);
    expect(json).not.toContain("super-secret");
    expect(json).not.toContain("cc-connect");
    expect(json).not.toContain("/tmp/outputs");
    expect(publicConfig.minimaxBridge).toBe(true);
  });

  it("throws the same ConfigParseError as the server loader", () => {
    expect(() =>
      loadPublicConfig({ env: { AXI_DOCS_TARGET: "no scheme here" } }),
    ).toThrowError(ConfigParseError);
  });

  it("honours the same env map shape as the server loader", () => {
    const publicConfig = loadPublicConfig({
      env: {
        GATEWAY_HOST: "0.0.0.0",
        GATEWAY_PORT: "9100",
        GATEWAY_CORS_ORIGINS: "http://workbench.local",
        GATEWAY_MAX_BODY_BYTES: "65536",
        GATEWAY_MAX_RESULT_ITEMS: "8",
        GATEWAY_DISPATCH_TIMEOUT_MS: "12345",
        GATEWAY_DRAIN_TIMEOUT_MS: "6789",
      },
    });
    expect(publicConfig).toMatchObject({
      host: "0.0.0.0",
      port: 9100,
      corsOrigins: ["http://workbench.local"],
      maxBodyBytes: 65536,
      maxResultItems: 8,
      dispatchTimeoutMs: 12_345,
      drainTimeoutMs: 6789,
    });
  });
});
