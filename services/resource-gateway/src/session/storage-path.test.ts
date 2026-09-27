import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import {
  resolveSessionStoragePath,
  ensureSessionStorageDir,
  generateSessionId,
  isSessionStoragePathSafe,
} from "./storage-path";

const platformStub = "darwin" as const;

describe("resolveSessionStoragePath", () => {
  it("honours an absolute SESSION_STORE_PATH", () => {
    const target = `/Users/test/sessions/session-store.json`;
    const resolved = resolveSessionStoragePath({
      env: { SESSION_STORE_PATH: target },
      platformOverride: platformStub,
      homeDirectory: "/Users/test",
      tempDirectory: tmpdir(),
    });
    expect(resolved).toBe(target);
  });

  it("rejects a relative SESSION_STORE_PATH", () => {
    expect(() =>
      resolveSessionStoragePath({
        env: { SESSION_STORE_PATH: "session-store.json" },
        platformOverride: platformStub,
        homeDirectory: "/Users/test",
        tempDirectory: tmpdir(),
      }),
    ).toThrow(/must be absolute/);
  });

  it("rejects a traversal SESSION_STORE_PATH", () => {
    expect(() =>
      resolveSessionStoragePath({
        env: { SESSION_STORE_PATH: "/tmp/../etc/session-store.json" },
        platformOverride: platformStub,
        homeDirectory: "/Users/test",
        tempDirectory: tmpdir(),
      }),
    ).toThrow(/traversal|forbidden/);
  });

  it("rejects a forbidden root", () => {
    expect(() =>
      resolveSessionStoragePath({
        env: { SESSION_STORE_PATH: "/etc/session-store.json" },
        platformOverride: platformStub,
        homeDirectory: "/Users/test",
        tempDirectory: tmpdir(),
      }),
    ).toThrow(/forbidden/);
  });

  it("rejects file URI", () => {
    expect(() =>
      resolveSessionStoragePath({
        env: { SESSION_STORE_PATH: "file:///etc/session-store.json" },
        platformOverride: platformStub,
        homeDirectory: "/Users/test",
        tempDirectory: tmpdir(),
      }),
    ).toThrow(/traversal|unsafe/);
  });

  it("rejects non-session-store.json filenames from env", () => {
    expect(() =>
      resolveSessionStoragePath({
        env: { SESSION_STORE_PATH: "/tmp/foo.json" },
        platformOverride: platformStub,
        homeDirectory: "/Users/test",
        tempDirectory: tmpdir(),
      }),
    ).toThrow(/must be session-store\.json/);
  });

  it("rejects non-session-store.json filenames from configPath", () => {
    expect(() =>
      resolveSessionStoragePath({
        configPath: "/tmp/foo.json",
        platformOverride: platformStub,
        homeDirectory: "/Users/test",
        tempDirectory: tmpdir(),
      }),
    ).toThrow(/must be session-store\.json/);
  });

  it("rejects path-shaped projectId (must be opaque)", () => {
    expect(isSessionStoragePathSafe("/etc/passwd")).toBe(false);
  });

  it("falls back to a path under home when temp is forbidden", () => {
    const resolved = resolveSessionStoragePath({
      platformOverride: platformStub,
      homeDirectory: `/Users/test-fallback-${Date.now()}`,
      tempDirectory: tmpdir(),
    });
    expect(resolved.startsWith("/Users/")).toBe(true);
    expect(resolved.endsWith("session-store.json")).toBe(true);
  });

  it("uses ~/Library/Application Support on macOS by default", () => {
    const resolved = resolveSessionStoragePath({
      platformOverride: "darwin",
      homeDirectory: "/Users/test",
      tempDirectory: tmpdir(),
    });
    expect(resolved).toBe(
      "/Users/test/Library/Application Support/ai-resource-orchestration/session/session-store.json",
    );
  });

  it("uses ~/.config on linux by default", () => {
    const resolved = resolveSessionStoragePath({
      platformOverride: "linux",
      homeDirectory: "/home/test",
      tempDirectory: tmpdir(),
    });
    expect(resolved).toBe(
      "/home/test/.config/ai-resource-orchestration/session/session-store.json",
    );
  });
});

describe("ensureSessionStorageDir", () => {
  it("creates the parent directory if missing", () => {
    const target = `${tmpdir()}/ensure-${Date.now()}-${Math.random().toString(36).slice(2)}/session-store.json`;
    const out = ensureSessionStorageDir(target);
    expect(out).toBe(target);
  });
});

describe("generateSessionId", () => {
  it("produces ids with the ses_ prefix", () => {
    expect(generateSessionId()).toMatch(/^ses_/);
  });

  it("produces stable chars", () => {
    for (let i = 0; i < 25; i += 1) {
      const id = generateSessionId();
      expect(id).toMatch(/^ses_[A-Za-z0-9_-]+$/);
      expect(id.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("rejects unsafe random sources", () => {
    // Force raw to empty AND a fallback that also fails the body regex.
    expect(() => generateSessionId(() => "")).toThrow();
  });
});
