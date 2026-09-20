import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { sessionApiContractVersion } from "@axi/gateway-contracts";
import { JsonSessionStore } from "@axi/resource-session";
import {
  handleSessionRequest,
  type SessionHandlerContext,
} from "../src/session/handlers";

/**
 * SES-MVP-009 / SES-MVP-010 / SES-MVP-011 / SES-MVP-020 — session HTTP
 * contract tests. Listener-free: stub IncomingMessage + ServerResponse.
 */

const PROJECT = "ai-resource-orchestration";
const DATE = "2026-08-29";

const writeJson = (response: { body?: unknown; statusCode: number; headers: Record<string, string> }, payload: unknown): void => {
  response.body = payload;
  response.statusCode = response.statusCode || 200;
};

const makeRequest = (method: string, path: string, body?: unknown): any => {
  const headers: Record<string, string> = {
    "x-request-id": "req-session-1",
    "content-type": "application/json",
  };
  const readable = new Readable({ read() {} });
  if (body !== undefined) {
    readable.push(JSON.stringify(body));
  }
  readable.push(null);
  return {
    method,
    url: path,
    headers,
    resume() { readable.resume(); },
    on(event: string, handler: (...args: unknown[]) => void) {
      if (event === "data" || event === "end" || event === "error" || event === "close") {
        readable.on(event, handler as never);
      }
      return this;
    },
  };
};

const makeResponse = (): any => {
  const response: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
    end(payload?: string) {
      if (payload !== undefined) writeJson(this, JSON.parse(payload));
    },
  };
  return response;
};

interface Setup {
  context: SessionHandlerContext;
  store: JsonSessionStore;
  cleanup: () => void;
}

const setup = (): Setup => {
  const dir = mkdtempSync(join(tmpdir(), "axi-session-test-"));
  const store = new JsonSessionStore({ filePath: join(dir, "session-store.json") });
  return {
    store,
    context: {
      store,
      maxBodyBytes: 1024 * 1024,
      knownProjectIds: () => [PROJECT],
    },
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
};

const invoke = async (
  context: SessionHandlerContext,
  method: string,
  path: string,
  body?: unknown,
) => {
  const request = makeRequest(method, path, body);
  const response = makeResponse();
  const handled = await handleSessionRequest(context, method, path.split("?", 1)[0], request, response, "req-session-1");
  return { handled, response };
};

describe("session list|session create|session get", () => {
  let current: Setup | undefined;
  afterEach(() => {
    current?.cleanup();
    current = undefined;
  });

  it("lists an empty date without creating a session", async () => {
    current = setup();
    const { handled, response } = await invoke(current.context, "GET", `/sessions?dateKey=${DATE}`);
    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.body.summaries).toEqual([]);
    expect(response.body.contractVersion).toBe(sessionApiContractVersion);
  });

  it("creates a daily session once and returns the same id on retry", async () => {
    current = setup();
    const first = await invoke(current.context, "POST", "/sessions", {
      projectId: PROJECT,
      dateKey: DATE,
      kind: "daily",
    });
    const second = await invoke(current.context, "POST", "/sessions", {
      projectId: PROJECT,
      dateKey: DATE,
      kind: "daily",
    });
    expect(first.response.statusCode).toBe(201);
    expect(first.response.body.created).toBe(true);
    expect(second.response.statusCode).toBe(200);
    expect(second.response.body.created).toBe(false);
    expect(second.response.body.session.id).toBe(first.response.body.session.id);
  });

  it("returns session detail after create", async () => {
    current = setup();
    const created = await invoke(current.context, "POST", "/sessions", {
      projectId: PROJECT,
      dateKey: DATE,
      kind: "manual",
      title: "草稿",
    });
    const id = created.response.body.session.id as string;
    const { response } = await invoke(current.context, "GET", `/sessions/${id}`);
    expect(response.statusCode).toBe(200);
    expect(response.body.session.id).toBe(id);
    expect(response.body.session.entries).toEqual([]);
  });

  it("rejects an unregistered projectId", async () => {
    current = setup();
    const { response } = await invoke(current.context, "POST", "/sessions", {
      projectId: "not-a-project",
      dateKey: DATE,
      kind: "daily",
    });
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe("invalid_request");
  });
});

describe("session append|revision|interrupted", () => {
  let current: Setup | undefined;
  afterEach(() => {
    current?.cleanup();
    current = undefined;
  });

  it("appends a user entry then an interrupted assistant outcome", async () => {
    current = setup();
    const created = await invoke(current.context, "POST", "/sessions", {
      projectId: PROJECT,
      dateKey: DATE,
      kind: "daily",
    });
    const id = created.response.body.session.id as string;
    const user = await invoke(current.context, "POST", `/sessions/${id}/entries`, {
      entry: { role: "user", text: "找一张山水图片", runId: "run-1" },
    });
    expect(user.response.statusCode).toBe(200);
    expect(user.response.body.entry.text).toBe("找一张山水图片");
    const assistant = await invoke(current.context, "POST", `/sessions/${id}/entries`, {
      entry: { role: "assistant", text: "上次回复未完成。", outcome: "interrupted", runId: "run-1" },
      expectedRevision: user.response.body.summary.revision,
    });
    expect(assistant.response.statusCode).toBe(200);
    expect(assistant.response.body.entry.outcome).toBe("interrupted");
  });

  it("returns 409 session_conflict for a stale revision", async () => {
    current = setup();
    const created = await invoke(current.context, "POST", "/sessions", {
      projectId: PROJECT,
      dateKey: DATE,
      kind: "daily",
    });
    const id = created.response.body.session.id as string;
    await invoke(current.context, "POST", `/sessions/${id}/entries`, {
      entry: { role: "user", text: "first" },
    });
    const conflict = await invoke(current.context, "POST", `/sessions/${id}/entries`, {
      entry: { role: "user", text: "stale" },
      expectedRevision: 0,
    });
    expect(conflict.response.statusCode).toBe(409);
    expect(conflict.response.body.code).toBe("session_conflict");
    expect(JSON.stringify(conflict.response.body)).not.toContain("/tmp/");
    expect(JSON.stringify(conflict.response.body)).not.toContain("session-store.json");
  });

  it("rejects an illegal assistant append without outcome", async () => {
    current = setup();
    const created = await invoke(current.context, "POST", "/sessions", {
      projectId: PROJECT,
      dateKey: DATE,
      kind: "daily",
    });
    const id = created.response.body.session.id as string;
    const { response } = await invoke(current.context, "POST", `/sessions/${id}/entries`, {
      entry: { role: "assistant", text: "no outcome" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe("invalid_request");
  });
});

describe("session mutation|export|delete|archive", () => {
  let current: Setup | undefined;
  afterEach(() => {
    current?.cleanup();
    current = undefined;
  });

  it("requires confirm=true to delete", async () => {
    current = setup();
    const created = await invoke(current.context, "POST", "/sessions", {
      projectId: PROJECT,
      dateKey: DATE,
      kind: "manual",
    });
    const id = created.response.body.session.id as string;
    const denied = await invoke(current.context, "DELETE", `/sessions/${id}`, { confirm: false });
    expect(denied.response.statusCode).toBe(400);
    const missing = await invoke(current.context, "DELETE", `/sessions/${id}`, {});
    expect(missing.response.statusCode).toBe(400);
    const ok = await invoke(current.context, "DELETE", `/sessions/${id}`, { confirm: true });
    expect(ok.response.statusCode).toBe(200);
    expect(ok.response.body.deleted).toBe(true);
    const lookup = await invoke(current.context, "GET", `/sessions/${id}`);
    expect(lookup.response.statusCode).toBe(404);
    expect(lookup.response.body.code).toBe("session_not_found");
  });

  it("archives a session and exports a redacted copy without paths or secrets", async () => {
    current = setup();
    const created = await invoke(current.context, "POST", "/sessions", {
      projectId: PROJECT,
      dateKey: DATE,
      kind: "manual",
    });
    const id = created.response.body.session.id as string;
    await invoke(current.context, "POST", `/sessions/${id}/entries`, {
      entry: { role: "user", text: "Bearer abcdefghijklmnop see /Users/mose/secret.png" },
    });
    const renamed = await invoke(current.context, "PATCH", `/sessions/${id}`, { title: "归档前" });
    expect(renamed.response.body.summary.title).toBe("归档前");
    const archived = await invoke(current.context, "PATCH", `/sessions/${id}`, { status: "archived" });
    expect(archived.response.body.summary.status).toBe("archived");
    const exported = await invoke(current.context, "POST", "/sessions/export", { sessionId: id });
    expect(exported.response.statusCode).toBe(200);
    const serialised = JSON.stringify(exported.response.body);
    expect(serialised).not.toContain("/Users/mose");
    expect(serialised).not.toContain("abcdefghijklmnop");
    expect(serialised).toContain("[已脱敏]");
    expect(serialised).not.toContain(current.store.path());
  });
});
