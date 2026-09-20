import { spawn as defaultSpawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { readFile as defaultReadFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

/**
 * GHA-013 / GHA-031 / GHA-NEXT-035 — MiniMax TokenPlan bridge (server-side).
 *
 * Migrated from apps/workbench/vite.config.ts:22-77. The bridge is the
 * only gateway handler that spawns a child process; everything else is
 * in-process HTTP. The safety contract here is:
 *
 *   - body inputs are bounded (query/prompt length, n∈[1,4], aspectRatio
 *     enum);
 *   - the CLI child is killed when the caller aborts, when the timeout
 *     elapses, or when the server begins draining;
 *   - generated files are read only from a configured allow-list
 *     directory; absolute paths and `..` are rejected;
 *   - data URLs are produced only for `.png`/`.jpg`/`.jpeg` files
 *     inside the allow-list; everything else is rejected;
 *   - GHA-NEXT-035: a top-level `childTimeoutMs` cap (default 60_000)
 *     bounds how long any one child can run; the per-command
 *     `searchTimeoutMs` / `imageTimeoutMs` continue to operate as
 *     finer-grained ceilings. Whichever fires first wins, and the
 *     timer is cleared once the child exits cleanly so a fast CLI
 *     does not pay an unnecessary SIGTERM.
 */

export interface MiniMaxBridgeDeps {
  /** Path to the MiniMax TokenPlan CLI binary. */
  readonly cliPath: string;
  /** Directory all generated files must live under. */
  readonly outputDir: string;
  /** Hard timeout for `/search`. Default 30_000. */
  readonly searchTimeoutMs?: number;
  /** Hard timeout for `/image`. Default 180_000. */
  readonly imageTimeoutMs?: number;
  /** GHA-NEXT-035 — absolute cap on any single child-process run.
   *  Default 60_000 ms (mirrors `GATEWAY_MAX_CHILD_TIMEOUT_MS`). Set
   *  to 0 to disable. When the per-command timeout is shorter than
   *  this cap, the per-command value still wins; this field exists
   *  as a backstop so an operator can tighten the absolute bound
   *  without having to override every command. */
  readonly childTimeoutMs?: number;
  /** Max image generations per request. Default 4. */
  readonly maxImages?: number;
  /** Max prompt/query bytes. Defaults: query 600, prompt 600. */
  readonly maxQueryBytes?: number;
  readonly maxPromptBytes?: number;
  /** Override the child-process spawn (tests inject a stub). */
  readonly spawn?: (command: string, args: ReadonlyArray<string>, options?: unknown) => unknown;
  /** Override file read (tests inject a stub). */
  readonly readFileFn?: (path: string) => Promise<Buffer>;
  /** Override the path resolver (tests inject a stub). */
  readonly resolvePath?: (value: string) => string;
}

export type MiniMaxSearchRequest = { query: string };
export type MiniMaxImageRequest = {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "3:4" | "4:3" | "9:16";
  n?: number;
};

export interface MiniMaxSearchResult {
  ok: true;
  data: unknown;
}

export interface MiniMaxImageResult {
  ok: true;
  data: {
    files: Array<{ file: string; dataUrl: string }>;
    source_urls?: string[];
  };
}

export interface MiniMaxError {
  ok: false;
  status: number;
  error: string;
}

export type MiniMaxResult = (MiniMaxSearchResult | MiniMaxImageResult | MiniMaxError) & { __kind?: string };

const ALLOWED_ASPECT_RATIOS = new Set(["1:1", "16:9", "3:4", "4:3", "9:16"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

export class MiniMaxBridge {
  private readonly cliPath: string;
  private readonly outputDir: string;
  private readonly searchTimeoutMs: number;
  private readonly imageTimeoutMs: number;
  private readonly childTimeoutMs: number;
  private readonly maxImages: number;
  private readonly maxQueryBytes: number;
  private readonly maxPromptBytes: number;
  private readonly spawnFn: (command: string, args: ReadonlyArray<string>, options?: unknown) => unknown;
  private readonly readFileFn: (path: string) => Promise<Buffer>;
  private readonly resolvePathFn: (value: string) => string;

  constructor(deps: MiniMaxBridgeDeps) {
    if (!deps.cliPath) throw new Error("MiniMaxBridge requires cliPath");
    if (!deps.outputDir) throw new Error("MiniMaxBridge requires outputDir");
    this.cliPath = deps.cliPath;
    this.outputDir = resolve(deps.outputDir);
    this.searchTimeoutMs = deps.searchTimeoutMs ?? 30_000;
    this.imageTimeoutMs = deps.imageTimeoutMs ?? 180_000;
    this.childTimeoutMs = deps.childTimeoutMs ?? 60_000;
    this.maxImages = deps.maxImages ?? 4;
    this.maxQueryBytes = deps.maxQueryBytes ?? 600;
    this.maxPromptBytes = deps.maxPromptBytes ?? 600;
    this.spawnFn = deps.spawn ?? ((command, args, options) => defaultSpawn(command as string, args as string[], options as Parameters<typeof defaultSpawn>[2])) as (command: string, args: ReadonlyArray<string>, options?: unknown) => unknown;
    this.readFileFn = deps.readFileFn ?? ((path: string) => defaultReadFile(path));
    this.resolvePathFn = deps.resolvePath ?? resolve;
  }

  /** Validate and execute a /search request. */
  async search(body: unknown, signal: AbortSignal): Promise<MiniMaxResult> {
    const parsed = parseSearchBody(body);
    if (!parsed.ok) return parsed;
    if (Buffer.byteLength(parsed.value.query, "utf8") > this.maxQueryBytes) {
      return { ok: false, status: 400, error: `query exceeds ${this.maxQueryBytes} bytes` };
    }
    try {
      const stdout = await this.runCli("search", [parsed.value.query], this.effectiveChildTimeoutMs(this.searchTimeoutMs), signal);
      let data: unknown;
      try { data = JSON.parse(stdout); } catch { return { ok: false, status: 502, error: "MiniMax search returned non-JSON output" }; }
      return { ok: true, data };
    } catch (error) {
      return mapCliError(error, "search");
    }
  }

  /** Validate and execute an /image request. */
  async image(body: unknown, signal: AbortSignal): Promise<MiniMaxResult> {
    const parsed = parseImageBody(body);
    if (!parsed.ok) return parsed;
    if (Buffer.byteLength(parsed.value.prompt, "utf8") > this.maxPromptBytes) {
      return { ok: false, status: 400, error: `prompt exceeds ${this.maxPromptBytes} bytes` };
    }
    const n = Math.min(this.maxImages, Math.max(1, Math.floor(parsed.value.n ?? 1)));
    const aspectRatio = parsed.value.aspectRatio ?? "1:1";
    try {
      const stdout = await this.runCli("image", [
        "--prompt", parsed.value.prompt,
        "--aspect-ratio", aspectRatio,
        "--n", String(n),
      ], this.effectiveChildTimeoutMs(this.imageTimeoutMs), signal);
      let raw: unknown;
      try { raw = JSON.parse(stdout); } catch { return { ok: false, status: 502, error: "MiniMax image returned non-JSON output" }; }
      const filesRaw = (raw as { files?: unknown }).files;
      const fileList = Array.isArray(filesRaw) ? filesRaw.filter((value): value is string => typeof value === "string") : [];
      const files = await Promise.all(fileList.map((file) => this.readOutputFile(file)));
      return { ok: true, data: { files, source_urls: (raw as { source_urls?: unknown }).source_urls as string[] | undefined } };
    } catch (error) {
      return mapCliError(error, "image");
    }
  }

  /** GHA-NEXT-035 — Effective timeout applied to a child run.
   *  Returns whichever is shorter of the per-command timeout and
   *  the absolute `childTimeoutMs` backstop. Returns the
   *  per-command value when the backstop is 0 (disabled). */
  effectiveChildTimeoutMs(commandTimeoutMs: number): number {
    if (this.childTimeoutMs <= 0) return commandTimeoutMs;
    return Math.min(commandTimeoutMs, this.childTimeoutMs);
  }

  /** Read a generated file and produce a data URL. Rejects paths
   *  outside the allow-list and unknown extensions. */
  private async readOutputFile(file: string): Promise<{ file: string; dataUrl: string }> {
    const resolved = this.resolvePathFn(file);
    if (!resolved.startsWith(`${this.outputDir}/`)) {
      throw new Error(`MiniMax output path is outside the configured output directory: ${resolved}`);
    }
    const ext = extname(resolved).toLocaleLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      throw new Error(`MiniMax output extension ${ext || "<none>"} is not in the allow-list`);
    }
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    const bytes = await this.readFileFn(resolved);
    return { file: resolved, dataUrl: `data:${mime};base64,${bytes.toString("base64")}` };
  }

  private runCli(command: string, args: ReadonlyArray<string>, timeoutMs: number, signal: AbortSignal): Promise<string> {
    return new Promise((resolveOutput, rejectOutput) => {
      let settled = false;
      let child: ChildProcess;
      try {
        child = this.spawnFn(this.cliPath, [command, ...args], { env: process.env }) as ChildProcess;
      } catch (error) {
        rejectOutput(error);
        return;
      }
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
        setTimeout(() => {
          try {
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
          } catch { /* ignore */ }
        }, 200).unref?.();
        rejectOutput(new Error(`MiniMax CLI timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();

      const onAbort = (): void => {
        if (settled) return;
        settled = true;
        try { child.kill("SIGTERM"); } catch { /* ignore */ }
        clearTimeout(timer);
        rejectOutput(signal.reason ?? new DOMException("aborted", "AbortError"));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });

      child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        rejectOutput(error);
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        if (code === 0) resolveOutput(stdout.trim());
        else rejectOutput(new Error(stderr.trim() || `MiniMax CLI exited with ${code}`));
      });
    });
  }
}

const parseSearchBody = (body: unknown): { ok: true; value: MiniMaxSearchRequest } | MiniMaxError => {
  if (!body || typeof body !== "object") return { ok: false, status: 400, error: "body must be an object" };
  const query = (body as Record<string, unknown>).query;
  if (typeof query !== "string" || !query.trim()) return { ok: false, status: 400, error: "query is required" };
  return { ok: true, value: { query: query.trim() } };
};

const parseImageBody = (body: unknown): { ok: true; value: MiniMaxImageRequest } | MiniMaxError => {
  if (!body || typeof body !== "object") return { ok: false, status: 400, error: "body must be an object" };
  const record = body as Record<string, unknown>;
  const prompt = record.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) return { ok: false, status: 400, error: "prompt is required" };
  const aspectRatio = record.aspectRatio;
  if (aspectRatio !== undefined && (typeof aspectRatio !== "string" || !ALLOWED_ASPECT_RATIOS.has(aspectRatio))) {
    return { ok: false, status: 400, error: `aspectRatio must be one of ${Array.from(ALLOWED_ASPECT_RATIOS).join(", ")}` };
  }
  const n = record.n;
  if (n !== undefined && (typeof n !== "number" || !Number.isInteger(n) || n < 1)) {
    return { ok: false, status: 400, error: "n must be a positive integer" };
  }
  return { ok: true, value: { prompt: prompt.trim(), aspectRatio: aspectRatio as MiniMaxImageRequest["aspectRatio"], n: typeof n === "number" ? n : undefined } };
};

const mapCliError = (error: unknown, route: string): MiniMaxError => {
  if (error instanceof Error && /timeout/iu.test(error.message)) {
    return { ok: false, status: 504, error: `MiniMax ${route} timeout: ${error.message}` };
  }
  if (error instanceof Error && /aborted/iu.test(error.message)) {
    return { ok: false, status: 499, error: `MiniMax ${route} aborted` };
  }
  const message = error instanceof Error ? error.message : "MiniMax bridge failed";
  return { ok: false, status: 502, error: `${route}: ${message.slice(0, 400)}` };
};