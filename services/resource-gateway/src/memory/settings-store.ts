/**
 * Memory settings persistence.
 *
 * Stored next to the entries JSON file (`memory-settings.json`) so
 * the workbench can refresh / clear / edit settings without a
 * separate file system path to reason about. Writes go through the
 * same atomic temp+rename pipeline the entries store uses.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  memoryApiContractVersion,
  memorySettingsSchema,
  type MemorySettings,
} from "@axi/gateway-contracts";
import { defaultMemorySettings } from "@axi/resource-memory/policy";

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
      if (chains.get(key) === chained) chains.delete(key);
    }
  };
})();

export interface MemorySettingsStoreOptions {
  readonly filePath: string;
  readonly filesystem?: {
    readonly readFile: (path: string) => Promise<string>;
    readonly writeFile: (path: string, content: string) => Promise<void>;
    readonly rename: (from: string, to: string) => Promise<void>;
    readonly mkdir: (path: string) => Promise<void>;
  };
}

export interface MemorySettingsStore {
  load(): Promise<MemorySettings>;
  save(patch: Partial<MemorySettings>): Promise<MemorySettings>;
  filePath(): string;
}

export const buildMemorySettingsStore = (options: MemorySettingsStoreOptions): MemorySettingsStore => {
  const fs = options.filesystem ?? {
    readFile: async (path) => readFile(path, "utf8"),
    writeFile: async (path, content) => writeFile(path, content, { encoding: "utf8", mode: 0o600 }),
    rename: async (from, to) => rename(from, to),
    mkdir: async (path) => { await mkdir(path, { recursive: true }); },
  };

  const loadFromDisk = async (): Promise<MemorySettings> => {
    try {
      const raw = await fs.readFile(options.filePath);
      const parsed = JSON.parse(raw);
      // Settings file wraps the settings under `settings`; the bare
      // value is also accepted for backward compatibility.
      const candidate = parsed && typeof parsed === "object" && "settings" in parsed
        ? (parsed as { settings: unknown }).settings
        : parsed;
      const result = memorySettingsSchema.safeParse(candidate);
      if (result.success) return result.data;
      return defaultMemorySettings();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return defaultMemorySettings();
      return defaultMemorySettings();
    }
  };

  const writeToDisk = async (settings: MemorySettings): Promise<void> => {
    const validated = memorySettingsSchema.parse(settings);
    const parent = dirname(options.filePath);
    if (parent) await fs.mkdir(parent);
    const tmpPath = `${options.filePath}.tmp.${process.pid}.${Date.now().toString(36)}`;
    await fs.writeFile(tmpPath, JSON.stringify({ contractVersion: memoryApiContractVersion, settings: validated }, null, 2));
    await fs.rename(tmpPath, options.filePath);
  };

  return {
    async load() {
      return loadFromDisk();
    },
    async save(patch) {
      return inProcessMutex(options.filePath, async () => {
        const current = await loadFromDisk();
        const next = memorySettingsSchema.parse({ ...current, ...patch });
        await writeToDisk(next);
        return next;
      });
    },
    filePath() {
      return options.filePath;
    },
  };
};
