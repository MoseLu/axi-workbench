/**
 * apps/gateway/test/secret-file.test.ts — GHA-NEXT-032
 *
 * Verifies the file-based secrets loader. The `<NAME>_FILE` env
 * convention lets operators mount Docker / Kubernetes secrets as
 * files instead of plaintext, so the parent shell never sees the
 * raw value (it stays in `/proc/<pid>/environ` of the secret-
 * loader only, never in `ps eww` of every subprocess).
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readSecretFile, resolveSecret, SecretFileReadError } from "../src/config";

let workDir = "";

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "secret-file-test-"));
});

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

const writeSecret = (filename: string, body: string): string => {
  const fullPath = join(workDir, filename);
  writeFileSync(fullPath, body, "utf8");
  return fullPath;
};

describe("apps/gateway secret file loader — GHA-NEXT-032", () => {
  it("readSecretFile returns trimmed contents for a well-formed secret file", () => {
    const file = writeSecret("token.txt", "raw-secret-value\n");
    const env = { TOKEN_FILE: file };
    expect(readSecretFile(env, "TOKEN_FILE")).toBe("raw-secret-value");
  });

  it("readSecretFile trims trailing whitespace but preserves internal content", () => {
    const file = writeSecret("internal.txt", "  abc\ndef\t");
    const env = { TOKEN_FILE: file };
    expect(readSecretFile(env, "TOKEN_FILE")).toBe("abc\ndef");
  });

  it("readSecretFile throws when env var is unset", () => {
    expect(() => readSecretFile({}, "TOKEN_FILE")).toThrow(SecretFileReadError);
  });

  it("readSecretFile throws when file does not exist", () => {
    expect(() => readSecretFile({ TOKEN_FILE: "/no/such/path" }, "TOKEN_FILE")).toThrow(/file does not exist/u);
  });

  it("readSecretFile throws when file is empty", () => {
    const file = writeSecret("empty.txt", "");
    expect(() => readSecretFile({ TOKEN_FILE: file }, "TOKEN_FILE")).toThrow(/empty/u);
  });

  it("resolveSecret prefers <NAME>_FILE over the literal value", () => {
    const file = writeSecret("prefer.txt", "from-file\n");
    const env = { TOKEN_FILE: file, TOKEN: "from-env" };
    expect(resolveSecret(env, "TOKEN")).toBe("from-file");
  });

  it("resolveSecret falls back to the literal value when _FILE is unset", () => {
    const env = { TOKEN: "literal-value" };
    expect(resolveSecret(env, "TOKEN")).toBe("literal-value");
  });

  it("resolveSecret returns undefined when neither is configured", () => {
    expect(resolveSecret({}, "TOKEN")).toBeUndefined();
  });

  it("resolveSecret propagates SecretFileReadError when _FILE points at a missing file", () => {
    expect(() => resolveSecret({ TOKEN_FILE: "/no/such/file" }, "TOKEN")).toThrow(SecretFileReadError);
  });

  it("resolveSecret never throws when only the literal value is configured and empty", () => {
    // Empty literal is treated as "not configured" → undefined.
    expect(resolveSecret({ TOKEN: "" }, "TOKEN")).toBeUndefined();
  });
});