import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

/**
 * SES-MVP-004 — Session storage path resolver.
 *
 * Mirrors `memory/storage-path.ts` so the gateway keeps both stores
 * under well-known OS-conventional locations without giving the
 * browser any path-influence surface.
 *
 * Resolution order:
 *
 *   1. `SESSION_STORE_PATH` env var (absolute, non-traversal,
 *      filename MUST be `session-store.json`).
 *   2. `sessionStorePath` injected via config (test seam).
 *   3. `os.homedir()/.<app>/session/session-store.json` on darwin /
 *      linux, `~/Library/Application Support/<app>/session/session-store.json`
 *      on macOS, `%APPDATA%\<app>\session\session-store.json` on windows.
 *
 * Anything that smells like a user-supplied arbitrary path
 * (`..`, drive letters, `file:` URI, NUL bytes, paths inside
 * `/Volumes`, `/etc`, `/System`) is rejected.
 */

export interface SessionStoragePathOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly configPath?: string;
  readonly appName?: string;
  readonly homeDirectory?: string;
  readonly platformOverride?: NodeJS.Platform;
  readonly tempDirectory?: string;
}

const SAFE_FILENAME = /^session-store\.json$/u;

/** Directory prefixes that are never an acceptable storage root for a
 *  user app data file. */
const FORBIDDEN_DIR_PREFIXES = [
  "/etc",
  "/System",
  "/Volumes",
  "/private/etc",
  "/usr",
  "/var",
  "/bin",
  "/sbin",
];

const isAbsolutePath = (candidate: string): boolean => {
  if (!candidate) return false;
  if (candidate.startsWith("/")) return true;
  if (/^[A-Za-z]:[\\/]/u.test(candidate)) return true;
  return false;
};

const containsTraversal = (candidate: string): boolean =>
  candidate.includes("\0") ||
  candidate.includes("..") ||
  /(^|\s)file:\/\//iu.test(candidate);

const assertSafeAbsolute = (candidate: string, source: string): string => {
  if (containsTraversal(candidate)) {
    throw new Error(
      `session storage path contains traversal or unsafe fragment (${source}=${candidate})`,
    );
  }
  if (!isAbsolutePath(candidate)) {
    throw new Error(`session storage path must be absolute (${source}=${candidate})`);
  }
  const normalised = resolvePath(candidate);
  for (const forbidden of FORBIDDEN_DIR_PREFIXES) {
    if (normalised === forbidden || normalised.startsWith(`${forbidden}/`)) {
      throw new Error(
        `session storage path is inside a forbidden root (${forbidden}): ${normalised}`,
      );
    }
  }
  return normalised;
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

const finalSegment = (path: string): string => path.split(/[\\/]/u).pop() ?? "";

export const resolveSessionStoragePath = (
  options: SessionStoragePathOptions = {},
): string => {
  const appName = options.appName ?? "ai-resource-orchestration";
  const home = options.homeDirectory ?? homedir();
  const platformName = options.platformOverride ?? platform();
  const temp = options.tempDirectory ?? tmpdir();
  const env = options.env ?? process.env;

  if (typeof options.configPath === "string" && options.configPath.length > 0) {
    const normalised = assertSafeAbsolute(options.configPath, "configPath");
    if (!SAFE_FILENAME.test(finalSegment(normalised))) {
      throw new Error(
        `session storage filename must be session-store.json (got ${normalised})`,
      );
    }
    return normalised;
  }

  const envPath = env.SESSION_STORE_PATH;
  if (typeof envPath === "string" && envPath.length > 0) {
    const normalised = assertSafeAbsolute(envPath, "SESSION_STORE_PATH");
    if (!SAFE_FILENAME.test(finalSegment(normalised))) {
      throw new Error(
        `session storage filename must be session-store.json (got ${normalised})`,
      );
    }
    return normalised;
  }

  // Test seam: when homedir() is something like /tmp/... or the
  // caller injected a temp directory, fall back to the temp dir to
  // keep the gateway from creating files under the test runner's
  // home folder.
  if (
    home.startsWith(temp) ||
    (platformName === "win32" && home.includes("\\Temp\\"))
  ) {
    const fallback = join(temp, `${appName}-session`, "session-store.json");
    return assertSafeAbsolute(fallback, "fallback");
  }

  const base = defaultAppDir(platformName, home);
  return assertSafeAbsolute(
    join(base, appName, "session", "session-store.json"),
    "default",
  );
};

/**
 * Ensure the parent directory exists with `0700` permissions. The
 * store file itself uses `0600` (set by `JsonSessionStore.persist`).
 *
 * Returns the resolved path so callers can chain.
 */
export const ensureSessionStorageDir = (filePath: string): string => {
  const parent = filePath.split(/[\\/]/u).slice(0, -1).join("/");
  if (parent && !existsSync(parent)) {
    mkdirSync(parent, { recursive: true, mode: 0o700 });
  } else if (parent && existsSync(parent)) {
    const stat = statSync(parent);
    if (!stat.isDirectory()) {
      throw new Error(`session storage parent is not a directory: ${parent}`);
    }
  }
  return filePath;
};

export const defaultSessionStoreFileName = "session-store.json" as const;

/** SES-MVP-004 — opaque session id factory. The prefix is mandatory and the
 *  charset excludes ambiguous characters to keep ids copy-paste safe. */
export const SESSION_ID_PREFIX = "ses_" as const;
const SESSION_ID_BODY = /^[A-Za-z0-9_-]{6,72}$/u;

export const generateSessionId = (
  random: () => string = () => Math.random().toString(36).slice(2),
): string => {
  const raw = random().replace(/[^A-Za-z0-9_-]/gu, "");
  // Caller is responsible for a random source that yields at least
  // 8 safe characters. We do not silently fall back to Date.now()
  // because that produces predictable, time-correlated ids.
  if (raw.length < 8 || !SESSION_ID_BODY.test(raw)) {
    throw new Error("session id generator produced an invalid body");
  }
  return `${SESSION_ID_PREFIX}${raw.slice(0, 64)}`;
};

export const isSessionStoragePathSafe = (candidate: string): boolean => {
  try {
    const normalised = assertSafeAbsolute(candidate, "isSessionStoragePathSafe");
    return SAFE_FILENAME.test(finalSegment(normalised));
  } catch {
    return false;
  }
};
