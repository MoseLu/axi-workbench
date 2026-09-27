import { describe, expect, it } from "vitest";
import { ensureMemoryStorageDir, resolveMemoryStoragePath } from "./storage-path";

describe("resolveMemoryStoragePath", () => {
  it("honours an absolute MEMORY_STORE_PATH", () => {
    const path = resolveMemoryStoragePath({ env: { MEMORY_STORE_PATH: "/var/lib/axi/memory-store.json" } as NodeJS.ProcessEnv });
    expect(path).toBe("/var/lib/axi/memory-store.json");
  });

  it("rejects relative MEMORY_STORE_PATH", () => {
    expect(() => resolveMemoryStoragePath({ env: { MEMORY_STORE_PATH: "memory-store.json" } as NodeJS.ProcessEnv })).toThrow(/absolute/);
  });

  it("rejects paths with traversal segments", () => {
    expect(() => resolveMemoryStoragePath({ env: { MEMORY_STORE_PATH: "/var/lib/../etc/memory-store.json" } as NodeJS.ProcessEnv })).toThrow(/traversal|unsafe/);
  });

  it("rejects file URIs", () => {
    expect(() => resolveMemoryStoragePath({ env: { MEMORY_STORE_PATH: "file:///etc/passwd" } as NodeJS.ProcessEnv })).toThrow(/traversal|unsafe/);
  });

  it("rejects a configPath that is not absolute", () => {
    expect(() => resolveMemoryStoragePath({ configPath: "memory-store.json" })).toThrow(/absolute/);
  });

  it("rejects a configPath whose filename is not memory-store.json", () => {
    expect(() => resolveMemoryStoragePath({ configPath: "/tmp/anything.json" })).toThrow(/memory-store\.json/);
  });

  it("uses the injected configPath when safe", () => {
    expect(resolveMemoryStoragePath({ configPath: "/var/lib/axi/memory-store.json" })).toBe("/var/lib/axi/memory-store.json");
  });

  it("falls back to temp dir when home is under tmpdir (test runner)", () => {
    const path = resolveMemoryStoragePath({
      homeDirectory: "/tmp/test-home",
      tempDirectory: "/tmp",
      platformOverride: "linux",
    });
    expect(path.startsWith("/tmp/")).toBe(true);
    expect(path.endsWith("/memory-store.json")).toBe(true);
  });

  it("uses ~/.config on linux when home is normal", () => {
    const path = resolveMemoryStoragePath({
      homeDirectory: "/home/alice",
      platformOverride: "linux",
    });
    expect(path).toBe("/home/alice/.config/ai-resource-orchestration/memory/memory-store.json");
  });

  it("uses ~/Library/Application Support on macOS", () => {
    const path = resolveMemoryStoragePath({
      homeDirectory: "/Users/alice",
      platformOverride: "darwin",
    });
    expect(path).toBe("/Users/alice/Library/Application Support/ai-resource-orchestration/memory/memory-store.json");
  });

  it("ensureMemoryStorageDir creates a missing parent", () => {
    const target = `${process.env.TMPDIR || "/tmp"}/axi-mem-test-${Date.now()}/memory-store.json`;
    const resolved = ensureMemoryStorageDir(target);
    expect(resolved).toBe(target);
  });
});
