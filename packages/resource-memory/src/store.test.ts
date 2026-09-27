import { beforeEach, describe, expect, it } from "vitest";
import {
  type JsonMemoryStoreOptions,
  JsonMemoryStore,
  MemoryLimitExceededError,
} from "./store";
import type { MemoryEntry } from "@axi/gateway-contracts";

interface FakeFs {
  files: Map<string, string>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
}

const makeFs = (): FakeFs => {
  const files = new Map<string, string>();
  return {
    files,
    readFile: async (path) => {
      const value = files.get(path);
      if (value === undefined) {
        const error = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return value;
    },
    writeFile: async (path, content) => {
      files.set(path, content);
    },
    rename: async (from, to) => {
      const value = files.get(from);
      if (value === undefined) {
        const error = new Error(`ENOENT: ${from}`) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      files.set(to, value);
      files.delete(from);
    },
    mkdir: async () => undefined,
  };
};

const isoNow = "2026-08-29T00:00:00.000Z";
const isoLater = "2026-09-30T00:00:00.000Z";

const baseEntry = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
  id: "mem-1",
  schemaVersion: 1,
  scope: "global",
  kind: "preference",
  status: "active",
  summary: "默认横屏",
  facts: { preferredOrientation: "landscape" },
  tags: ["image"],
  source: "explicit",
  sensitivity: "normal",
  confidence: "high",
  createdAt: isoNow,
  updatedAt: isoNow,
  ...overrides,
});

let fs: FakeFs;
let options: JsonMemoryStoreOptions;

beforeEach(() => {
  fs = makeFs();
  options = {
    filePath: "/tmp/memory/store.json",
    filesystem: fs,
  };
});

describe("JsonMemoryStore", () => {
  it("returns an empty list when the file does not exist", async () => {
    const store = new JsonMemoryStore(options);
    expect(await store.readAll()).toEqual([]);
  });

  it("round-trips entries via upsert + readAll", async () => {
    const store = new JsonMemoryStore(options);
    const entry = baseEntry();
    await store.upsert(entry);
    const entries = await store.readAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(entry.id);
  });

  it("overwrites an entry with the same id", async () => {
    const store = new JsonMemoryStore(options);
    await store.upsert(baseEntry({ summary: "v1" }));
    await store.upsert(baseEntry({ summary: "v2", updatedAt: isoLater }));
    const entries = await store.readAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].summary).toBe("v2");
  });

  it("removes an entry on delete", async () => {
    const store = new JsonMemoryStore(options);
    await store.upsert(baseEntry());
    expect(await store.delete("mem-1")).toBe(true);
    expect(await store.readAll()).toEqual([]);
  });

  it("delete returns false when the id is unknown", async () => {
    const store = new JsonMemoryStore(options);
    expect(await store.delete("missing")).toBe(false);
  });

  it("clears matching entries only", async () => {
    const store = new JsonMemoryStore(options);
    await store.upsert(baseEntry({ id: "a", scope: "global" }));
    await store.upsert(baseEntry({ id: "b", scope: "project", projectId: "p1" }));
    await store.upsert(baseEntry({ id: "c", scope: "project", projectId: "p2" }));
    const removed = await store.clear((entry) => entry.scope === "project" && entry.projectId === "p1");
    expect(removed).toBe(1);
    const remaining = await store.readAll();
    expect(remaining.map((e) => e.id).sort()).toEqual(["a", "c"]);
  });

  it("refuses new writes past the active limit", async () => {
    const small = new JsonMemoryStore({ ...options, maxEntries: 2 });
    await small.upsert(baseEntry({ id: "a" }));
    await small.upsert(baseEntry({ id: "b" }));
    await expect(small.upsert(baseEntry({ id: "c" }))).rejects.toBeInstanceOf(MemoryLimitExceededError);
  });

  it("recovers from a corrupt JSON file by quarantining it", async () => {
    fs.files.set(options.filePath, "{not valid json");
    const store = new JsonMemoryStore(options);
    expect(await store.readAll()).toEqual([]);
    const corruptPath = [...fs.files.keys()].find((key) => key.includes(".corrupt."));
    expect(corruptPath, `files=${[...fs.files.keys()].join(",")}`).toBeDefined();
    expect(fs.files.get(corruptPath!)).toContain("not valid json");
  });

  it("recovers from schema violations by quarantining the file", async () => {
    fs.files.set(options.filePath, JSON.stringify({ schemaVersion: 1, updatedAt: isoNow, entries: [{ id: "broken" }] }));
    const store = new JsonMemoryStore(options);
    expect(await store.readAll()).toEqual([]);
    const corruptPath = [...fs.files.keys()].find((key) => key.includes(".corrupt."));
    expect(corruptPath, `files=${[...fs.files.keys()].join(",")}`).toBeDefined();
  });

  it("serialises concurrent upserts without losing updates", async () => {
    const store = new JsonMemoryStore(options);
    await Promise.all(Array.from({ length: 20 }, (_, index) => store.upsert(baseEntry({ id: `mem-${index}` }))));
    const entries = await store.readAll();
    expect(entries).toHaveLength(20);
  });

  it("uses temp + rename for atomic write", async () => {
    const observed: string[] = [];
    const store = new JsonMemoryStore({
      ...options,
      filesystem: {
        ...fs,
        writeFile: async (path, content) => {
          observed.push(`write:${path}`);
          await fs.writeFile(path, content);
        },
        rename: async (from, to) => {
          observed.push(`rename:${from}->${to}`);
          await fs.rename(from, to);
        },
      },
    });
    await store.upsert(baseEntry());
    expect(observed.some((entry) => entry.startsWith("write:") && entry.includes(".tmp."))).toBe(true);
    expect(observed.some((entry) => entry.startsWith("rename:") && entry.includes(".tmp."))).toBe(true);
  });

  it("export returns the full file shape", async () => {
    const store = new JsonMemoryStore(options);
    await store.upsert(baseEntry());
    const file = await store.export();
    expect(file.schemaVersion).toBe(1);
    expect(file.entries).toHaveLength(1);
  });
});
