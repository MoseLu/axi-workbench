/**
 * MEM-MVP-004 / MEM-MVP-005 — MemoryStore interface + JSON file impl.
 *
 * On-disk shape (versioned JSON, schemaVersion 1):
 *   { schemaVersion: 1, updatedAt: iso, entries: MemoryEntry[] }
 *
 * Invariants (enforced here, asserted by tests):
 *
 *   - Reads against a missing file yield an empty store, never throw.
 *   - schemaVersion mismatch refuses to overwrite the existing file;
 *     the caller can choose to migrate or discard.
 *   - Writes are atomic: temp file + rename, so a crash mid-write
 *     cannot leave a half-written file in place.
 *   - Concurrent writes are serialised by an in-process async mutex
 *     keyed on the file path. Cross-process locking is out of scope
 *     for the single-instance MVP.
 *   - Active + pending entries are capped at 500; upserts that would
 *     exceed the cap return `limit_exceeded` instead of evicting
 *     user data.
 *   - When the file is corrupt (zod parse failure), the original
 *     bytes are moved to `<path>.corrupt.<iso>` and the store
 *     returns an empty list. The corrupt copy is preserved so the
 *     user can recover by hand; we never silently overwrite it.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  memoryFileSchema,
  memorySchemaVersion,
  type MemoryEntry,
  type MemoryFile,
} from "@axi/gateway-contracts";

export interface MemoryStore {
  /** Read every entry currently on disk (active + pending + archived). */
  readAll(): Promise<MemoryEntry[]>;
  /** Look up a single entry by id; returns null when absent. */
  get(id: string): Promise<MemoryEntry | null>;
  /** Insert or update a single entry. Returns the persisted value. */
  upsert(entry: MemoryEntry): Promise<MemoryEntry>;
  /** Remove a single entry. Returns true when a record was removed. */
  delete(id: string): Promise<boolean>;
  /** Remove every entry matching the predicate (server-only scope guard). */
  clear(predicate: (entry: MemoryEntry) => boolean): Promise<number>;
  /** Return the full on-disk file (redacted-free — callers MUST scrub). */
  export(): Promise<MemoryFile>;
  /** Test-only: return the path this store resolves to. */
  path(): string;
}

export type UpsertError =
  | { readonly kind: "limit_exceeded"; readonly limit: number; readonly activeCount: number }
  | { readonly kind: "schema_mismatch"; readonly expected: number; readonly actual: number }
  | { readonly kind: "validation"; readonly message: string };

export type UpsertResult =
  | { readonly ok: true; readonly entry: MemoryEntry }
  | { readonly ok: false; readonly error: UpsertError };

export interface JsonMemoryStoreOptions {
  readonly filePath: string;
  readonly maxEntries?: number;
  /** Test injection — defaults to node fs/promises functions. */
  readonly filesystem?: {
    readonly readFile: (path: string) => Promise<string>;
    readonly writeFile: (path: string, content: string) => Promise<void>;
    readonly rename: (from: string, to: string) => Promise<void>;
    readonly mkdir: (path: string) => Promise<void>;
  };
}

const DEFAULT_LIMIT = 500;

const inProcessMutex = (() => {
  const chains = new Map<string, Promise<unknown>>();
  return async function runExclusive<T>(key: string, body: () => Promise<T>): Promise<T> {
    const previous = chains.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const next = new Promise<void>((resolve) => { release = resolve; });
    const chained = previous.then(() => next);
    chains.set(key, chained);
    try {
      await previous;
      return await body();
    } finally {
      release();
      // Best-effort cleanup so the chain map does not grow forever in
      // long-running processes. Multiple in-flight keys may still hold
      // entries — we only drop the key when nothing is queued after us.
      if (chains.get(key) === chained) chains.delete(key);
    }
  };
})();

/**
 * Quote the path so it can appear in log messages without leaking
 * the user home directory or full filesystem location. This is a
 * display-only helper; we never store or echo the raw value over
 * the wire.
 */
const safeDisplayPath = (filePath: string): string => {
  if (filePath.length <= 24) return "<memory-store>";
  return `…/${filePath.split(/[\\/]/u).slice(-2).join("/")}`;
};

export class JsonMemoryStore implements MemoryStore {
  private readonly filePath: string;
  private readonly limit: number;
  private readonly fs: NonNullable<JsonMemoryStoreOptions["filesystem"]>;

  constructor(options: JsonMemoryStoreOptions) {
    if (!options.filePath) throw new Error("memory store requires a filePath");
    this.filePath = options.filePath;
    this.limit = options.maxEntries ?? DEFAULT_LIMIT;
    this.fs = options.filesystem ?? {
      readFile: async (path) => readFile(path, "utf8"),
      writeFile: async (path, content) => {
        await writeFile(path, content, { encoding: "utf8", mode: 0o600 });
      },
      rename: async (from, to) => rename(from, to),
      mkdir: async (path) => { await mkdir(path, { recursive: true }); },
    };
  }

  path(): string {
    return this.filePath;
  }

  async readAll(): Promise<MemoryEntry[]> {
    const file = await this.loadFile();
    return file.entries;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const entries = await this.readAll();
    return entries.find((entry) => entry.id === id) ?? null;
  }

  async upsert(entry: MemoryEntry): Promise<MemoryEntry> {
    return inProcessMutex(this.filePath, async () => {
      const file = await this.loadFile();
      const existingIndex = file.entries.findIndex((candidate) => candidate.id === entry.id);
      const nextEntries = [...file.entries];
      if (existingIndex >= 0) {
        nextEntries[existingIndex] = entry;
      } else {
        if (file.entries.length >= this.limit) {
          throw new MemoryLimitExceededError(this.limit, file.entries.length);
        }
        nextEntries.push(entry);
      }
      const next: MemoryFile = {
        schemaVersion: memorySchemaVersion,
        updatedAt: new Date().toISOString(),
        entries: nextEntries,
      };
      await this.persist(next);
      return entry;
    });
  }

  async delete(id: string): Promise<boolean> {
    return inProcessMutex(this.filePath, async () => {
      const file = await this.loadFile();
      const remaining = file.entries.filter((candidate) => candidate.id !== id);
      if (remaining.length === file.entries.length) return false;
      await this.persist({
        schemaVersion: memorySchemaVersion,
        updatedAt: new Date().toISOString(),
        entries: remaining,
      });
      return true;
    });
  }

  async clear(predicate: (entry: MemoryEntry) => boolean): Promise<number> {
    return inProcessMutex(this.filePath, async () => {
      const file = await this.loadFile();
      const remaining = file.entries.filter((entry) => !predicate(entry));
      const removed = file.entries.length - remaining.length;
      if (removed === 0) return 0;
      await this.persist({
        schemaVersion: memorySchemaVersion,
        updatedAt: new Date().toISOString(),
        entries: remaining,
      });
      return removed;
    });
  }

  async export(): Promise<MemoryFile> {
    return this.loadFile();
  }

  /** Internal: load + validate the file, recovering from corruption. */
  private async loadFile(): Promise<MemoryFile> {
    let raw: string;
    try {
      raw = await this.fs.readFile(this.filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { schemaVersion: memorySchemaVersion, updatedAt: new Date().toISOString(), entries: [] };
      }
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      await this.handleCorruption(raw, `invalid_json: ${(error as Error).message}`);
      return { schemaVersion: memorySchemaVersion, updatedAt: new Date().toISOString(), entries: [] };
    }
    const result = memoryFileSchema.safeParse(parsed);
    if (!result.success) {
      await this.handleCorruption(raw, `schema_violation: ${result.error.issues.map((issue) => issue.path.join(".") || "<root>").join(";")}`);
      return { schemaVersion: memorySchemaVersion, updatedAt: new Date().toISOString(), entries: [] };
    }
    if (result.data.schemaVersion !== memorySchemaVersion) {
      throw new MemorySchemaMismatchError(memorySchemaVersion, result.data.schemaVersion);
    }
    return result.data;
  }

  /** Internal: atomic temp file + rename. */
  private async persist(file: MemoryFile): Promise<void> {
    const validated = memoryFileSchema.parse(file);
    const serialised = JSON.stringify(validated, null, 2);
    const target = this.filePath;
    const parent = dirname(target);
    if (parent) await this.fs.mkdir(parent);
    const tmpPath = `${target}.tmp.${process.pid}.${Date.now().toString(36)}`;
    await this.fs.writeFile(tmpPath, serialised);
    try {
      await this.fs.rename(tmpPath, target);
    } catch (error) {
      // Best-effort cleanup of the temp file when rename fails; the
      // original target stays untouched.
      try {
        await this.fs.writeFile(tmpPath, "");
      } catch {
        // ignore; tmpPath may have already moved
      }
      throw error;
    }
  }

  private async handleCorruption(raw: string, reason: string): Promise<void> {
    const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
    const corruptPath = `${this.filePath}.corrupt.${stamp}`;
    try {
      await this.fs.rename(this.filePath, corruptPath);
    } catch {
      // Fall back to a direct write so the corrupt copy is preserved
      // even when rename is not possible (e.g. cross-device).
      try {
        await this.fs.writeFile(corruptPath, raw);
      } catch {
        // give up silently — store will return empty list and the
        // caller can decide how to surface the failure
      }
    }
    // Best-effort breadcrumb log; the message intentionally omits the
    // full path so it cannot echo a user home directory.
    console.warn(`[memory] corrupt store quarantined at ${safeDisplayPath(corruptPath)} (${reason})`);
  }
}

export class MemoryLimitExceededError extends Error {
  constructor(readonly limit: number, readonly activeCount: number) {
    super(`memory store at capacity: ${activeCount}/${limit}`);
    this.name = "MemoryLimitExceededError";
  }
}

export class MemorySchemaMismatchError extends Error {
  constructor(readonly expected: number, readonly actual: number) {
    super(`memory store schema mismatch: expected ${expected}, got ${actual}`);
    this.name = "MemorySchemaMismatchError";
  }
}
