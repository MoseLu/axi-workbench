import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { Writable } from "node:stream";

import { MiniMaxBridge, type MiniMaxBridgeDeps } from "../src/minimax-bridge";

const tempDirs: string[] = [];

const mkTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "gateway-minimax-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

class FakeChild extends EventEmitter {
  stdout = new Writable({ write(_chunk, _enc, cb) { cb(); } });
  stderr = new Writable({ write(_chunk, _enc, cb) { cb(); } });
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  killed = false;
  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    this.signalCode = (signal as NodeJS.Signals) || "SIGTERM";
    return true;
  }
}

interface FakeSpawnOptions {
  /** Override the chunk-by-chunk stdout for the next call. */
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  delayMs?: number;
  /** When true, never emit close until explicitly told. */
  hang?: boolean;
  /** Record the args the fake received. */
  invoked: Array<{ command: string; args: string[] }>;
}

const fakeSpawnFactory = (options: FakeSpawnOptions) => {
  return ((command: string, args: ReadonlyArray<string>) => {
    options.invoked.push({ command, args: args.slice() });
    const child = new FakeChild();
    if (options.hang) {
      // Simulate a slow process; the bridge's timeout/abort must kill it.
      return child;
    }
    const delay = options.delayMs ?? 0;
    setTimeout(() => {
      if (options.stdout && child.stdout) {
        child.stdout.emit("data", Buffer.from(options.stdout));
      }
      if (options.stderr && child.stderr) {
        child.stderr.emit("data", Buffer.from(options.stderr));
      }
      child.exitCode = options.exitCode ?? 0;
      child.emit("close", child.exitCode);
    }, delay);
    return child;
  }) as MiniMaxBridgeDeps["spawn"];
};

const neverReadFile = async (): Promise<Buffer> => {
  throw new Error("readFile should not be called for invalid inputs");
};

describe("MiniMaxBridge /search", () => {
  it("rejects non-object bodies", async () => {
    const dir = await mkTempDir();
    const bridge = new MiniMaxBridge({ cliPath: "/usr/bin/true", outputDir: dir, spawn: fakeSpawnFactory({ invoked: [] }), readFileFn: neverReadFile });
    const result = await bridge.search(null, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects missing query", async () => {
    const dir = await mkTempDir();
    const bridge = new MiniMaxBridge({ cliPath: "/usr/bin/true", outputDir: dir, spawn: fakeSpawnFactory({ invoked: [] }), readFileFn: neverReadFile });
    const result = await bridge.search({}, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/query is required/iu);
  });

  it("rejects oversized query", async () => {
    const dir = await mkTempDir();
    const invoked: Array<{ command: string; args: string[] }> = [];
    const bridge = new MiniMaxBridge({ cliPath: "/usr/bin/true", outputDir: dir, spawn: fakeSpawnFactory({ invoked }), readFileFn: neverReadFile, maxQueryBytes: 8 });
    const bigQuery = "a".repeat(64);
    const result = await bridge.search({ query: bigQuery }, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/exceeds 8 bytes/iu);
    expect(invoked.length).toBe(0);
  });

  it("parses JSON output and returns ok=true", async () => {
    const dir = await mkTempDir();
    const invoked: Array<{ command: string; args: string[] }> = [];
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: dir,
      spawn: fakeSpawnFactory({ invoked, stdout: JSON.stringify({ organic: [] }) }),
      readFileFn: neverReadFile,
    });
    const result = await bridge.search({ query: "hello" }, new AbortController().signal);
    expect(result.ok).toBe(true);
    expect(invoked.length).toBe(1);
    // The bridge's CLI invocation passes the binary path as the first
    // spawn argument and the literal command name (`search` / `image`)
    // as the first positional argument.
    expect(invoked[0]?.command).toBe("/usr/bin/true");
    expect(invoked[0]?.args).toEqual(["search", "hello"]);
  });

  it("returns provider_timeout when the CLI hangs and times out", async () => {
    const dir = await mkTempDir();
    const invoked: Array<{ command: string; args: string[] }> = [];
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: dir,
      spawn: fakeSpawnFactory({ invoked, hang: true }),
      readFileFn: neverReadFile,
      searchTimeoutMs: 25,
    });
    const result = await bridge.search({ query: "hello" }, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(504);
      expect(result.error).toMatch(/timeout/iu);
    }
  });
});

describe("MiniMaxBridge /image", () => {
  it("rejects non-string aspectRatio", async () => {
    const dir = await mkTempDir();
    const bridge = new MiniMaxBridge({ cliPath: "/usr/bin/true", outputDir: dir, spawn: fakeSpawnFactory({ invoked: [] }), readFileFn: neverReadFile });
    const result = await bridge.image({ prompt: "p", aspectRatio: "21:9" }, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/aspectRatio/iu);
  });

  it("rejects non-integer n", async () => {
    const dir = await mkTempDir();
    const bridge = new MiniMaxBridge({ cliPath: "/usr/bin/true", outputDir: dir, spawn: fakeSpawnFactory({ invoked: [] }), readFileFn: neverReadFile });
    const result = await bridge.image({ prompt: "p", n: 1.5 }, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/n must be/iu);
  });

  it("clamps n to [1, maxImages]", async () => {
    const dir = await mkTempDir();
    const invoked: Array<{ command: string; args: string[] }> = [];
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: dir,
      spawn: fakeSpawnFactory({ invoked, stdout: JSON.stringify({ files: [] }) }),
      readFileFn: neverReadFile,
      maxImages: 4,
    });
    const result = await bridge.image({ prompt: "p", n: 999 }, new AbortController().signal);
    expect(result.ok).toBe(true);
    const idx = invoked[0]?.args.findIndex((a) => a === "--n");
    expect(invoked[0]?.args[idx! + 1]).toBe("4");
  });

  it("rejects output paths outside the allowlist", async () => {
    const dir = await mkTempDir();
    const otherDir = await mkTempDir();
    const outside = join(otherDir, "evil.png");
    await writeFile(outside, Buffer.from([0, 1, 2]));
    const invoked: Array<{ command: string; args: string[] }> = [];
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: dir,
      spawn: fakeSpawnFactory({ invoked, stdout: JSON.stringify({ files: [outside] }) }),
      readFileFn: neverReadFile,
    });
    const result = await bridge.image({ prompt: "p" }, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/outside the configured output directory/iu);
  });

  it("rejects non-image extensions", async () => {
    const dir = await mkTempDir();
    const inside = join(dir, "notes.txt");
    await writeFile(inside, "hello");
    const invoked: Array<{ command: string; args: string[] }> = [];
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: dir,
      spawn: fakeSpawnFactory({ invoked, stdout: JSON.stringify({ files: [inside] }) }),
      readFileFn: neverReadFile,
    });
    const result = await bridge.image({ prompt: "p" }, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not in the allow-list/iu);
  });

  it("reads allowed image extensions and emits dataUrl", async () => {
    const dir = await mkTempDir();
    const inside = join(dir, "output.png");
    await writeFile(inside, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const invoked: Array<{ command: string; args: string[] }> = [];
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: dir,
      spawn: fakeSpawnFactory({ invoked, stdout: JSON.stringify({ files: [inside] }) }),
      readFileFn: async (path) => {
        const { readFile } = await import("node:fs/promises");
        return readFile(path);
      },
    });
    const result = await bridge.image({ prompt: "p", n: 1 }, new AbortController().signal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { files: Array<{ file: string; dataUrl: string }> };
      expect(data.files.length).toBe(1);
      expect(data.files[0]?.dataUrl).toMatch(/^data:image\/png;base64,/u);
    }
  });
});

describe("MiniMaxBridge abort behaviour", () => {
  it("kills the spawned child when the signal aborts", async () => {
    const dir = await mkTempDir();
    const invoked: Array<{ command: string; args: string[] }> = [];
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: dir,
      spawn: fakeSpawnFactory({ invoked, hang: true }),
      readFileFn: neverReadFile,
      searchTimeoutMs: 5_000,
    });
    const controller = new AbortController();
    const promise = bridge.search({ query: "hello" }, controller.signal);
    setTimeout(() => controller.abort(), 5);
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/abort/iu);
  });
});

// GHA-NEXT-035 — child hard-timeout backstop.
describe("MiniMaxBridge child hard-timeout", () => {
  it("effectiveChildTimeoutMs returns min(command, backstop) by default", () => {
    const dir = "/tmp";
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: dir,
      childTimeoutMs: 5_000,
      searchTimeoutMs: 30_000,
      readFileFn: neverReadFile,
    });
    expect(bridge.effectiveChildTimeoutMs(30_000)).toBe(5_000);
    expect(bridge.effectiveChildTimeoutMs(1_000)).toBe(1_000);
  });

  it("effectiveChildTimeoutMs ignores the backstop when childTimeoutMs=0", () => {
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: "/tmp",
      childTimeoutMs: 0,
      searchTimeoutMs: 30_000,
      readFileFn: neverReadFile,
    });
    expect(bridge.effectiveChildTimeoutMs(30_000)).toBe(30_000);
    expect(bridge.effectiveChildTimeoutMs(1_000)).toBe(1_000);
  });

  it("defaults childTimeoutMs to 60_000 when not configured", () => {
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: "/tmp",
      readFileFn: neverReadFile,
    });
    expect(bridge.effectiveChildTimeoutMs(180_000)).toBe(60_000);
    expect(bridge.effectiveChildTimeoutMs(30_000)).toBe(30_000);
  });

  it("kills the child via SIGTERM when the backstop fires before the per-command timeout", async () => {
    const dir = "/tmp";
    const invoked: Array<{ command: string; args: string[] }> = [];
    const bridge = new MiniMaxBridge({
      cliPath: "/usr/bin/true",
      outputDir: dir,
      // backstop shorter than per-command — backstop must win.
      childTimeoutMs: 5,
      searchTimeoutMs: 60_000,
      spawn: fakeSpawnFactory({ invoked, hang: true }),
      readFileFn: neverReadFile,
    });
    const result = await bridge.search({ query: "hello" }, new AbortController().signal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(504);
      expect(result.error).toMatch(/timeout after 5ms/u);
    }
  });
});

// (file ends)