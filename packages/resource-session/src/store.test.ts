import { beforeEach, describe, expect, it } from "vitest";
import { SESSION_LIMITS, type SessionRecord } from "@axi/gateway-contracts";
import {
  JsonSessionStore,
  SessionConflictError,
  SessionLimitExceededError,
  SessionStoreUnavailableError,
  type JsonSessionStoreOptions,
} from "./store";

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

const PROJECT = "ai-resource-orchestration";
const DATE = "2026-08-29";
const NOW = new Date("2026-08-29T12:00:00.000Z");

let fs: FakeFs;
let options: JsonSessionStoreOptions;
let idSeq: number;

beforeEach(() => {
  fs = makeFs();
  idSeq = 0;
  options = {
    filePath: "/tmp/session/session-store.json",
    filesystem: fs,
    clock: () => NOW,
    sessionIdFactory: () => `ses_${String(++idSeq).padStart(8, "a")}`,
    entryIdFactory: () => `ent_${String(++idSeq).padStart(8, "b")}`,
  };
});

const store = (): JsonSessionStore => new JsonSessionStore(options);

describe("JsonSessionStore", () => {
  it("returns an empty index when the file does not exist", async () => {
    expect(await store().list({ dateKey: DATE })).toEqual([]);
  });

  it("createDaily is idempotent for the same projectId+dateKey", async () => {
    const first = await store().createDaily({ projectId: PROJECT, dateKey: DATE });
    const second = await store().createDaily({ projectId: PROJECT, dateKey: DATE });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    expect(first.session.messageCount).toBe(0);
    expect(first.session.revision).toBe(0);
  });

  it("concurrent createDaily only produces one daily session", async () => {
    const target = store();
    const [a, b] = await Promise.all([
      target.createDaily({ projectId: PROJECT, dateKey: DATE }),
      target.createDaily({ projectId: PROJECT, dateKey: DATE }),
    ]);
    expect(a.session.id).toBe(b.session.id);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
    const listed = await target.list({ dateKey: DATE });
    expect(listed).toEqual([]);
  });

  it("omits empty sessions from the list until a message lands", async () => {
    const target = store();
    const created = await target.createDaily({ projectId: PROJECT, dateKey: DATE });
    expect(await target.list({ dateKey: DATE })).toEqual([]);
    await target.append(created.session.id, { role: "user", text: "找一张山水图片" });
    const listed = await target.list({ dateKey: DATE });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.title).toBe("找一张山水图片");
    expect(listed[0]?.messageCount).toBe(1);
    expect(listed[0]?.lastMessagePreview).toBe("找一张山水图片");
  });

  it("computes messageCount, preview and revision on the server", async () => {
    const target = store();
    const created = await target.createDaily({ projectId: PROJECT, dateKey: DATE });
    const appended = await target.append(created.session.id, {
      role: "assistant",
      text: "请补充一点描述。",
      outcome: "clarifying",
    });
    expect(appended.record.revision).toBe(1);
    expect(appended.record.messageCount).toBe(1);
    expect(appended.record.lastMessagePreview).toBe("请补充一点描述。");
    const serialised = fs.files.get(options.filePath) ?? "";
    expect(serialised).not.toContain("messageCount\": 99");
  });

  it("allows multiple manual sessions on the same day", async () => {
    const target = store();
    const a = await target.createManual({ projectId: PROJECT, dateKey: DATE, title: "草稿 A" });
    const b = await target.createManual({ projectId: PROJECT, dateKey: DATE, title: "草稿 B" });
    expect(a.id).not.toBe(b.id);
    await target.append(a.id, { role: "user", text: "A" });
    await target.append(b.id, { role: "user", text: "B" });
    const listed = await target.list({ dateKey: DATE });
    expect(listed).toHaveLength(2);
  });
});

describe("atomic|concurrency|corrupt|conflict|limit", () => {
  it("uses temp + rename for atomic write", async () => {
    const observed: string[] = [];
    const target = new JsonSessionStore({
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
    await target.createDaily({ projectId: PROJECT, dateKey: DATE });
    expect(observed.some((entry) => entry.startsWith("write:") && entry.includes(".tmp."))).toBe(true);
    expect(observed.some((entry) => entry.startsWith("rename:") && entry.includes(".tmp."))).toBe(true);
  });

  it("serialises concurrent appends without dropping updates", async () => {
    const target = store();
    const created = await target.createDaily({ projectId: PROJECT, dateKey: DATE });
    await Promise.all(Array.from({ length: 8 }, (_, index) =>
      target.append(created.session.id, { role: "user", text: `msg-${index}` }),
    ));
    const loaded = await target.get(created.session.id);
    expect(loaded?.entries).toHaveLength(8);
    expect(loaded?.revision).toBe(8);
    expect(loaded?.messageCount).toBe(8);
  });

  it("rejects a stale revision without overwriting newer content", async () => {
    const target = store();
    const created = await target.createDaily({ projectId: PROJECT, dateKey: DATE });
    await target.append(created.session.id, { role: "user", text: "first" });
    await expect(
      target.append(created.session.id, { role: "user", text: "stale" }, 0),
    ).rejects.toBeInstanceOf(SessionConflictError);
    const loaded = await target.get(created.session.id);
    expect(loaded?.entries.map((entry) => entry.text)).toEqual(["first"]);
    expect(loaded?.revision).toBe(1);
  });

  it("quarantines a corrupt JSON file and surfaces store unavailable", async () => {
    fs.files.set(options.filePath, "{not valid json");
    await expect(store().list({ dateKey: DATE })).rejects.toBeInstanceOf(SessionStoreUnavailableError);
    const corruptPath = [...fs.files.keys()].find((key) => key.includes(".corrupt."));
    expect(corruptPath).toBeDefined();
    expect(fs.files.get(corruptPath!)).toContain("not valid json");
  });

  it("quarantines schema violations", async () => {
    fs.files.set(options.filePath, JSON.stringify({
      schemaVersion: 1,
      updatedAt: "2026-08-29T00:00:00.000Z",
      sessions: [{ id: "broken" }],
    }));
    await expect(store().get("broken")).rejects.toBeInstanceOf(SessionStoreUnavailableError);
  });

  it("refuses a new session past the cap without deleting history", async () => {
    const small = new JsonSessionStore({ ...options, maxSessions: 1 });
    const first = await small.createManual({ projectId: PROJECT, dateKey: DATE });
    await small.append(first.id, { role: "user", text: "keep me" });
    await expect(small.createManual({ projectId: PROJECT, dateKey: DATE })).rejects.toBeInstanceOf(SessionLimitExceededError);
    const loaded = await small.get(first.id);
    expect(loaded?.entries[0]?.text).toBe("keep me");
  });

  it("refuses append past the entry cap", async () => {
    const target = store();
    const created = await target.createDaily({ projectId: PROJECT, dateKey: DATE });
    const raw = JSON.parse(fs.files.get(options.filePath)!) as { sessions: SessionRecord[] };
    raw.sessions[0].entries = Array.from({ length: SESSION_LIMITS.entriesPerSession }, (_, index) => ({
      id: `ent_${String(index).padStart(8, "0")}`,
      role: "user" as const,
      text: "x",
      createdAt: "2026-08-29T00:00:00.000Z",
    }));
    raw.sessions[0].messageCount = SESSION_LIMITS.entriesPerSession;
    fs.files.set(options.filePath, JSON.stringify(raw));
    await expect(
      target.append(created.session.id, { role: "user", text: "overflow" }),
    ).rejects.toBeInstanceOf(SessionLimitExceededError);
  });

  it("redacts secrets on append so they never land in the JSON file", async () => {
    const target = store();
    const created = await target.createDaily({ projectId: PROJECT, dateKey: DATE });
    await target.append(created.session.id, {
      role: "user",
      text: "token=supersecretvalue Bearer abcdefghijklmnop",
    });
    const serialised = fs.files.get(options.filePath) ?? "";
    expect(serialised).not.toContain("supersecretvalue");
    expect(serialised).not.toContain("abcdefghijklmnop");
    expect(serialised).toContain("[已脱敏]");
  });

  it("rename, archive, delete and export stay on the redacted record", async () => {
    const target = store();
    const created = await target.createManual({ projectId: PROJECT, dateKey: DATE });
    await target.append(created.id, { role: "user", text: "hello" });
    const renamed = await target.rename(created.id, "新标题");
    expect(renamed.title).toBe("新标题");
    const archived = await target.archive(created.id);
    expect(archived.status).toBe("archived");
    const exported = await target.export(created.id);
    expect(exported.id).toBe(created.id);
    expect(JSON.stringify(exported)).not.toContain("/Users/");
    expect(await target.delete(created.id, archived.revision)).toBe(true);
    expect(await target.get(created.id)).toBeNull();
  });
});
