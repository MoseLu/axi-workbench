import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

/**
 * MEM-MVP-011 — Storage path resolver.
 *
 * Resolves the absolute path of the local JSON store that
 * `JsonMemoryStore` will read / write. The browser cannot influence
 * the choice; the path comes from server env / config and a few
 * well-known defaults.
 *
 * Resolution order:
 *
 *   1. `MEMORY_STORE_PATH` env var (absolute, non-traversal).
 *   2. `memoryStorePath` injected via config (test seam).
 *   3. `os.homedir()/.<app>/memory/store.json` on darwin / linux,
 *      `~/Library/Application Support/<app>/memory/store.json` on
 *      macOS, `%APPDATA%\<app>\memory\store.json` on windows.
 *
 * Anything that smells like a user-supplied arbitrary path
 * (`..`, drive letters, `file:` URI, NUL bytes) is rejected.
 */

export interface MemoryStoragePathOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly configPath?: string;
  readonly appName?: string;
  readonly homeDirectory?: string;
  readonly platformOverride?: NodeJS.Platform;
  readonly tempDirectory?: string;
}

const SAFE_FILENAME = /^memory-store\.json$/u;

const isAbsolutePath = (candidate: string): boolean => {
  if (!candidate) return false;
  if (candidate.startsWith("/")) return true;
  if (/^[A-Za-z]:[\\/]/u.test(candidate)) return true;
  return false;
};

const containsTraversal = (candidate: string): boolean => candidate.includes("\0") || candidate.includes("..") || /(^|\s)file:\/\//iu.test(candidate);

const assertSafeAbsolute = (candidate: string, source: string): string => {
  if (containsTraversal(candidate)) throw new Error(`memory storage path contains traversal or unsafe fragment (${source}=${candidate})`);
  if (!isAbsolutePath(candidate)) throw new Error(`memory storage path must be absolute (${source}=${candidate})`);
  return candidate;
};

const defaultAppDir = (platformName: NodeJS.Platform, home: string): string => {
  if (platformName === "darwin") {
    return join(home, "Library", "Application Support");
  }
  if (platformName === "win32") {
    return process.env.APPDATA || join(home, "AppData", "Roaming");
  }
  return join(home, ".config");
};

export const resolveMemoryStoragePath = (options: MemoryStoragePathOptions = {}): string => {
  const appName = options.appName ?? "ai-resource-orchestration";
  const home = options.homeDirectory ?? homedir();
  const platformName = options.platformOverride ?? platform();
  const temp = options.tempDirectory ?? tmpdir();
  const env = options.env ?? process.env;

  if (typeof options.configPath === "string" && options.configPath.length > 0) {
    assertSafeAbsolute(options.configPath, "configPath");
    const normalised = resolvePath(options.configPath);
    if (!SAFE_FILENAME.test(normalised.split(/[\\/]/u).pop() || "")) {
      throw new Error(`memory storage filename must be memory-store.json (got ${normalised})`);
    }
    return normalised;
  }

  const envPath = env.MEMORY_STORE_PATH;
  if (typeof envPath === "string" && envPath.length > 0) {
    assertSafeAbsolute(envPath, "MEMORY_STORE_PATH");
    const normalised = resolvePath(envPath);
    if (!SAFE_FILENAME.test(normalised.split(/[\\/]/u).pop() || "")) {
      throw new Error(`memory storage filename must be memory-store.json (got ${normalised})`);
    }
    return normalised;
  }

  // Test seam: when homedir() is something like /tmp/... or the
  // caller injected a temp directory, fall back to the temp dir to
  // keep the gateway from creating files under the test runner's
  // home folder.
  if (home.startsWith(temp) || platformName === "win32" && home.includes("\\Temp\\")) {
    const fallback = join(temp, `${appName}-memory`, "memory-store.json");
    return assertSafeAbsolute(fallback, "fallback");
  }

  const base = defaultAppDir(platformName, home);
  return assertSafeAbsolute(join(base, appName, "memory", "memory-store.json"), "default");
};

/**
 * Ensure the parent directory exists with `0700` permissions. The
 * store file itself uses `0600` (set by `JsonMemoryStore.persist`).
 *
 * Returns the resolved path so callers can chain.
 */
export const ensureMemoryStorageDir = (filePath: string): string => {
  const parent = filePath.split(/[\\/]/u).slice(0, -1).join("/");
  if (parent && !existsSync(parent)) {
    mkdirSync(parent, { recursive: true, mode: 0o700 });
  } else if (parent && existsSync(parent)) {
    const stat = statSync(parent);
    if (!stat.isDirectory()) throw new Error(`memory storage parent is not a directory: ${parent}`);
  }
  return filePath;
};

export const defaultMemoryStoreFileName = "memory-store.json" as const;
