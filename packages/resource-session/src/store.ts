/**
 * SES-MVP-005 / SES-MVP-006 — SessionStore interface + JSON file impl.
 *
 * On-disk shape (versioned JSON, schemaVersion 1):
 *   { schemaVersion: 1, updatedAt: iso, sessions: SessionRecord[] }
 *
 * Invariants:
 *   - Missing file → empty index, never throw.
 *   - schemaVersion mismatch refuses to overwrite; throws SessionSchemaMismatchError.
 *   - Writes are atomic: temp file + rename.
 *   - Concurrent mutations are serialised by an in-process mutex keyed on path.
 *   - createDaily is idempotent on projectId + dateKey + kind=daily.
 *   - append uses revision CAS; stale expectedRevision throws SessionConflictError.
 *   - Caps: 500 sessions, 1000 entries / session; exceeding throws SessionLimitExceededError.
 *   - Corrupt JSON/schema: original moved to `<path>.corrupt.<iso>`, then
 *     SessionStoreUnavailableError so the HTTP layer can return a stable code.
 *   - messageCount / lastMessagePreview / title / revision are computed here;
 *     the browser's values are never trusted.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import {
  SESSION_LIMITS,
  sessionAppendEntrySchema,
  sessionRecordSchema,
  sessionSchemaVersion,
  type SessionAppendEntry,
  type SessionEntry,
  type SessionRecord,
  type SessionSummary,
} from "@axi/gateway-contracts";
import {
  countMessages,
  generateEntryId,
  generateSessionId,
  previewFromText,
  sortSessionSummaries,
  titleFromUserText,
  toSummary,
} from "./helpers";
import { redactSessionText } from "./redactor";

const sessionFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    updatedAt: z.string().datetime({ offset: true }),
    sessions: z.array(sessionRecordSchema).max(SESSION_LIMITS.sessions),
  })
  .strict();

export type SessionFile = z.infer<typeof sessionFileSchema>;

export interface SessionStore {
  list(query?: { dateKey?: string; projectId?: string }): Promise<SessionSummary[]>;
  get(id: string): Promise<SessionRecord | null>;
  createDaily(input: { projectId: string; dateKey: string }): Promise<{ session: SessionRecord; created: boolean }>;
  createManual(input: { projectId: string; dateKey: string; title?: string }): Promise<SessionRecord>;
  append(
    id: string,
    entry: SessionAppendEntry,
    expectedRevision?: number,
  ): Promise<{ record: SessionRecord; entry: SessionEntry }>;
  rename(id: string, title: string, expectedRevision?: number): Promise<SessionRecord>;
  archive(id: string, expectedRevision?: number): Promise<SessionRecord>;
  delete(id: string, expectedRevision?: number): Promise<boolean>;
  export(id: string): Promise<SessionRecord>;
  path(): string;
}

export interface JsonSessionStoreOptions {
  readonly filePath: string;
  readonly maxSessions?: number;
  readonly filesystem?: {
    readonly readFile: (path: string) => Promise<string>;
    readonly writeFile: (path: string, content: string) => Promise<void>;
    readonly rename: (from: string, to: string) => Promise<void>;
    readonly mkdir: (path: string) => Promise<void>;
  };
  readonly clock?: () => Date;
  readonly sessionIdFactory?: () => string;
  readonly entryIdFactory?: () => string;
}

const inProcessMutex = (() => {
  const chains = new Map<string, Promise<unknown>>();
  return async function runExclusive<T>(key: string, body: () => Promise<T>): Promise<T> {
    const previous = chains.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
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

const safeDisplayPath = (filePath: string): string => {
  if (filePath.length <= 24) return "<session-store>";
  return `…/${filePath.split(/[\\/]/u).slice(-2).join("/")}`;
};

const emptyFile = (iso: string): SessionFile => ({
  schemaVersion: sessionSchemaVersion,
  updatedAt: iso,
  sessions: [],
});

export class SessionConflictError extends Error {
  constructor(readonly expected: number, readonly actual: number) {
    super("session revision conflict");
    this.name = "SessionConflictError";
  }
}

export class SessionLimitExceededError extends Error {
  constructor(
    readonly limit: number,
    readonly actual: number,
    readonly scope: "sessions" | "entries" | "text" = "sessions",
  ) {
    super(`session store at capacity: ${actual}/${limit} (${scope})`);
    this.name = "SessionLimitExceededError";
  }
}

export class SessionNotFoundError extends Error {
  constructor(readonly sessionId: string) {
    super("session not found");
    this.name = "SessionNotFoundError";
  }
}

export class SessionSchemaMismatchError extends Error {
  constructor(readonly expected: number, readonly actual: number) {
    super(`session store schema mismatch: expected ${expected}, got ${actual}`);
    this.name = "SessionSchemaMismatchError";
  }
}

export class SessionStoreUnavailableError extends Error {
  constructor() {
    super("session store unavailable");
    this.name = "SessionStoreUnavailableError";
  }
}

export class JsonSessionStore implements SessionStore {
  private readonly filePath: string;
  private readonly limit: number;
  private readonly fs: NonNullable<JsonSessionStoreOptions["filesystem"]>;
  private readonly clock: () => Date;
  private readonly sessionIdFactory: () => string;
  private readonly entryIdFactory: () => string;

  constructor(options: JsonSessionStoreOptions) {
    if (!options.filePath) throw new Error("session store requires a filePath");
    this.filePath = options.filePath;
    this.limit = options.maxSessions ?? SESSION_LIMITS.sessions;
    this.clock = options.clock ?? (() => new Date());
    this.sessionIdFactory = options.sessionIdFactory ?? (() => generateSessionId());
    this.entryIdFactory = options.entryIdFactory ?? (() => generateEntryId());
    this.fs = options.filesystem ?? {
      readFile: async (path) => readFile(path, "utf8"),
      writeFile: async (path, content) => {
        await writeFile(path, content, { encoding: "utf8", mode: 0o600 });
      },
      rename: async (from, to) => rename(from, to),
      mkdir: async (path) => {
        await mkdir(path, { recursive: true });
      },
    };
  }

  path(): string {
    return this.filePath;
  }

  async list(query: { dateKey?: string; projectId?: string } = {}): Promise<SessionSummary[]> {
    const file = await this.loadFile();
    const matched = file.sessions.filter((session) => {
      if (query.dateKey && session.dateKey !== query.dateKey) return false;
      if (query.projectId && session.projectId !== query.projectId) return false;
      return true;
    });
    return sortSessionSummaries(matched);
  }

  async get(id: string): Promise<SessionRecord | null> {
    const file = await this.loadFile();
    return file.sessions.find((session) => session.id === id) ?? null;
  }

  async createDaily(input: { projectId: string; dateKey: string }): Promise<{ session: SessionRecord; created: boolean }> {
    return inProcessMutex(this.filePath, async () => {
      const file = await this.loadFile();
      const existing = file.sessions.find(
        (session) =>
          session.projectId === input.projectId
          && session.dateKey === input.dateKey
          && session.kind === "daily",
      );
      if (existing) return { session: existing, created: false };
      const session = this.newRecord({
        projectId: input.projectId,
        dateKey: input.dateKey,
        kind: "daily",
      });
      await this.persist(this.withSession(file, session));
      return { session, created: true };
    });
  }

  async createManual(input: { projectId: string; dateKey: string; title?: string }): Promise<SessionRecord> {
    return inProcessMutex(this.filePath, async () => {
      const file = await this.loadFile();
      if (file.sessions.length >= this.limit) {
        throw new SessionLimitExceededError(this.limit, file.sessions.length, "sessions");
      }
      const title = input.title ? titleFromUserText(input.title) : "";
      const session = this.newRecord({
        projectId: input.projectId,
        dateKey: input.dateKey,
        kind: "manual",
        title,
      });
      await this.persist(this.withSession(file, session));
      return session;
    });
  }

  async append(
    id: string,
    entryInput: SessionAppendEntry,
    expectedRevision?: number,
  ): Promise<{ record: SessionRecord; entry: SessionEntry }> {
    const parsed = sessionAppendEntrySchema.parse(entryInput);
    const revision = expectedRevision ?? parsed.expectedRevision;
    return inProcessMutex(this.filePath, async () => {
      const file = await this.loadFile();
      const index = file.sessions.findIndex((session) => session.id === id);
      if (index < 0) throw new SessionNotFoundError(id);
      const current = file.sessions[index];
      this.assertRevision(current, revision);
      if (current.entries.length >= SESSION_LIMITS.entriesPerSession) {
        throw new SessionLimitExceededError(
          SESSION_LIMITS.entriesPerSession,
          current.entries.length,
          "entries",
        );
      }
      const iso = this.nowIso();
      const redactedText = redactSessionText(parsed.text).value.slice(0, SESSION_LIMITS.entryText);
      const entry: SessionEntry = {
        id: this.entryIdFactory(),
        role: parsed.role,
        text: redactedText,
        createdAt: iso,
        ...(parsed.runId ? { runId: parsed.runId } : {}),
        ...(parsed.outcome ? { outcome: parsed.outcome } : {}),
        ...(parsed.result ? { result: parsed.result } : {}),
      };
      const nextEntries = [...current.entries, entry];
      const firstUser = nextEntries.find((candidate) => candidate.role === "user");
      const nextTitle = current.title || (firstUser ? titleFromUserText(firstUser.text) : "");
      const next: SessionRecord = sessionRecordSchema.parse({
        ...current,
        title: nextTitle,
        updatedAt: iso,
        revision: current.revision + 1,
        messageCount: countMessages(nextEntries),
        lastMessagePreview: previewFromText(redactedText) || current.lastMessagePreview,
        entries: nextEntries,
      });
      const nextSessions = [...file.sessions];
      nextSessions[index] = next;
      await this.persist({ ...file, updatedAt: iso, sessions: nextSessions });
      return { record: next, entry };
    });
  }

  async rename(id: string, title: string, expectedRevision?: number): Promise<SessionRecord> {
    return this.mutate(id, expectedRevision, (current, iso) => ({
      ...current,
      title: titleFromUserText(title).slice(0, 120),
      updatedAt: iso,
      revision: current.revision + 1,
    }));
  }

  async archive(id: string, expectedRevision?: number): Promise<SessionRecord> {
    return this.mutate(id, expectedRevision, (current, iso) => ({
      ...current,
      status: "archived",
      updatedAt: iso,
      revision: current.revision + 1,
    }));
  }

  async delete(id: string, expectedRevision?: number): Promise<boolean> {
    return inProcessMutex(this.filePath, async () => {
      const file = await this.loadFile();
      const current = file.sessions.find((session) => session.id === id);
      if (!current) return false;
      this.assertRevision(current, expectedRevision);
      const remaining = file.sessions.filter((session) => session.id !== id);
      await this.persist({ ...file, updatedAt: this.nowIso(), sessions: remaining });
      return true;
    });
  }

  async export(id: string): Promise<SessionRecord> {
    const record = await this.get(id);
    if (!record) throw new SessionNotFoundError(id);
    return record;
  }

  private async mutate(
    id: string,
    expectedRevision: number | undefined,
    apply: (current: SessionRecord, iso: string) => SessionRecord,
  ): Promise<SessionRecord> {
    return inProcessMutex(this.filePath, async () => {
      const file = await this.loadFile();
      const index = file.sessions.findIndex((session) => session.id === id);
      if (index < 0) throw new SessionNotFoundError(id);
      const current = file.sessions[index];
      this.assertRevision(current, expectedRevision);
      const iso = this.nowIso();
      const next = sessionRecordSchema.parse(apply(current, iso));
      const nextSessions = [...file.sessions];
      nextSessions[index] = next;
      await this.persist({ ...file, updatedAt: iso, sessions: nextSessions });
      return next;
    });
  }

  private assertRevision(current: SessionRecord, expected?: number): void {
    if (expected === undefined) return;
    if (expected !== current.revision) {
      throw new SessionConflictError(expected, current.revision);
    }
  }

  private nowIso(): string {
    return this.clock().toISOString();
  }

  private newRecord(input: {
    projectId: string;
    dateKey: string;
    kind: "daily" | "manual";
    title?: string;
  }): SessionRecord {
    const iso = this.nowIso();
    return sessionRecordSchema.parse({
      id: this.sessionIdFactory(),
      schemaVersion: sessionSchemaVersion,
      projectId: input.projectId,
      dateKey: input.dateKey,
      kind: input.kind,
      status: "active",
      title: input.title ?? "",
      createdAt: iso,
      updatedAt: iso,
      revision: 0,
      messageCount: 0,
      entries: [],
    });
  }

  private withSession(file: SessionFile, session: SessionRecord): SessionFile {
    if (file.sessions.length >= this.limit) {
      throw new SessionLimitExceededError(this.limit, file.sessions.length, "sessions");
    }
    return {
      schemaVersion: sessionSchemaVersion,
      updatedAt: this.nowIso(),
      sessions: [...file.sessions, session],
    };
  }

  private async loadFile(): Promise<SessionFile> {
    let raw: string;
    try {
      raw = await this.fs.readFile(this.filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return emptyFile(this.nowIso());
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await this.handleCorruption(raw, "invalid_json");
      throw new SessionStoreUnavailableError();
    }
    if (
      parsed
      && typeof parsed === "object"
      && "schemaVersion" in parsed
      && typeof (parsed as { schemaVersion: unknown }).schemaVersion === "number"
      && (parsed as { schemaVersion: number }).schemaVersion !== sessionSchemaVersion
    ) {
      throw new SessionSchemaMismatchError(
        sessionSchemaVersion,
        (parsed as { schemaVersion: number }).schemaVersion,
      );
    }
    const result = sessionFileSchema.safeParse(parsed);
    if (!result.success) {
      await this.handleCorruption(raw, "schema_violation");
      throw new SessionStoreUnavailableError();
    }
    return result.data;
  }

  private async persist(file: SessionFile): Promise<void> {
    const validated = sessionFileSchema.parse(file);
    const serialised = JSON.stringify(validated, null, 2);
    const target = this.filePath;
    const parent = dirname(target);
    if (parent) await this.fs.mkdir(parent);
    const tmpPath = `${target}.tmp.${process.pid}.${Date.now().toString(36)}`;
    await this.fs.writeFile(tmpPath, serialised);
    try {
      await this.fs.rename(tmpPath, target);
    } catch (error) {
      try {
        await this.fs.writeFile(tmpPath, "");
      } catch {
        // tmp may already have moved
      }
      throw error;
    }
  }

  private async handleCorruption(raw: string, reason: string): Promise<void> {
    const stamp = this.clock().toISOString().replace(/[:.]/gu, "-");
    const corruptPath = `${this.filePath}.corrupt.${stamp}`;
    try {
      await this.fs.rename(this.filePath, corruptPath);
    } catch {
      try {
        await this.fs.writeFile(corruptPath, raw);
      } catch {
        // preserve best-effort; the HTTP layer still returns a stable code
      }
    }
    console.warn(`[session] corrupt store quarantined at ${safeDisplayPath(corruptPath)} (${reason})`);
  }
}

export { toSummary };
