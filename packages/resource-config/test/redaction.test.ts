import { describe, expect, it } from "vitest";

import {
  REDACTED,
  isSecretKey,
  listSecretKeys,
  redactKey,
  scrubObject,
  scrubString,
} from "../src/index.js";

describe("@axi/resource-config redaction helpers", () => {
  it("flags every documented secret key", () => {
    expect(isSecretKey("AXI_DOCS_TOKEN")).toBe(true);
    expect(isSecretKey("axi_docs_token")).toBe(true);
    expect(isSecretKey("MINIMAX_TOKENPLAN_CLI")).toBe(true);
    expect(isSecretKey("MINIMAX_MCP_BASE_PATH")).toBe(true);
    expect(isSecretKey("GATEWAY_HOST")).toBe(false);
    expect(isSecretKey("AXI_IMAGE_PREVIEW_TARGET")).toBe(false);
  });

  it("redacts values from free-text error messages", () => {
    const message = "upstream returned 500 with AXI_DOCS_TOKEN=abcdefghijk in the headers";
    expect(scrubString(message)).toContain("AXI_DOCS_TOKEN=[redacted]");
    expect(scrubString(message)).not.toContain("abcdefghijk");

    const colon = "fetch failed: MINIMAX_TOKENPLAN_CLI: /Users/example/.cc-connect/bin/minimax-tokenplan not executable";
    expect(scrubString(colon)).toContain("MINIMAX_TOKENPLAN_CLI: [redacted]");
    expect(scrubString(colon)).not.toContain("/Users/example/.cc-connect");

    const path = "wrote MINIMAX_MCP_BASE_PATH=/tmp/outputs leaked to stderr";
    expect(scrubString(path)).toContain("MINIMAX_MCP_BASE_PATH=[redacted]");
    expect(scrubString(path)).not.toContain("/tmp/outputs");
  });

  it("redacts secret keys recursively inside objects", () => {
    const scrubbed = scrubObject({
      requestId: "req-1",
      AXI_DOCS_TOKEN: "super-secret",
      minimax_tokenplan_cli: "/Users/example/.cc-connect/bin/minimax-tokenplan",
      nested: {
        minimaxMcpBasePath: "/tmp/outputs",
        safe: "keep me",
      },
      list: [
        { AXI_DOCS_TOKEN: "second-secret", id: "a" },
      ],
    });
    expect(scrubbed).toEqual({
      requestId: "req-1",
      AXI_DOCS_TOKEN: REDACTED,
      minimax_tokenplan_cli: REDACTED,
      nested: {
        minimaxMcpBasePath: REDACTED,
        safe: "keep me",
      },
      list: [{ AXI_DOCS_TOKEN: REDACTED, id: "a" }],
    });
  });

  it("redacts arrays in place without changing the shape", () => {
    const scrubbed = scrubObject(["AXI_DOCS_TOKEN=abcdef", "plain text"]);
    expect(scrubbed).toEqual([
      "AXI_DOCS_TOKEN=[redacted]",
      "plain text",
    ]);
  });

  it("redactKey only acts on known secret keys", () => {
    expect(redactKey("AXI_DOCS_TOKEN", "value")).toBe(REDACTED);
    expect(redactKey("MINIMAX_TOKENPLAN_CLI", "/Users/example")).toBe(REDACTED);
    expect(redactKey("MINIMAX_MCP_BASE_PATH", "/tmp/outputs")).toBe(REDACTED);
    expect(redactKey("GATEWAY_HOST", "127.0.0.1")).toBe("127.0.0.1");
  });

  it("listSecretKeys exposes a stable sorted list", () => {
    const list = listSecretKeys();
    expect(list).toContain("AXI_DOCS_TOKEN");
    expect(list).toContain("MINIMAX_TOKENPLAN_CLI");
    expect(list).toContain("MINIMAX_MCP_BASE_PATH");
    expect([...list].sort((a, b) => a.localeCompare(b))).toEqual(list);
  });

  it("scrubObject is safe on null / undefined / non-objects", () => {
    expect(scrubObject(null)).toBeNull();
    expect(scrubObject(undefined)).toBeUndefined();
    expect(scrubObject(42)).toBe(42);
    expect(scrubObject(false)).toBe(false);
  });

  it("scrubString returns the original when no secret patterns appear", () => {
    expect(scrubString("plain text without secrets")).toBe("plain text without secrets");
  });

  it("scrubString handles empty / non-string input gracefully", () => {
    expect(scrubString("")).toBe("");
    // @ts-expect-error — defensive runtime check.
    expect(scrubString(undefined)).toBeUndefined();
  });
});
