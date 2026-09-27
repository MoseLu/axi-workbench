import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import {
  gatewayContractVersion,
  memoryApiContractVersion,
  memorySettingsSchema,
  type MemoryEntry,
  type MemorySettings,
} from "@axi/gateway-contracts";
import { JsonMemoryStore, defaultMemorySettings } from "@axi/resource-memory";
import { buildMemorySettingsStore } from "../src/memory/settings-store";
import {
  handleMemoryRequest,
  type MemoryHandlerContext,
} from "../src/memory/handlers";

/**
 * MEM-MVP-020 — Memory HTTP contract tests.
 *
 * Behaviour-first coverage for the documented memory endpoints.
 * No sockets are opened: each test constructs a stub IncomingMessage
 * + ServerResponse pair and invokes `handleMemoryRequest` directly,
 * which is the same code path the real HTTP server uses once the
 * route gate matches.
 */

const isoNow = "2026-08-29T00:00:00.000Z";

const baseActive: MemoryEntry = {
  id: "mem-test-1",
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
};

const writeJson = (response: any, payload: unknown): void => {
  response.body = JSON.stringify(payload);
  response.statusCode = response.statusCode || 200;
  response.headers = response.headers || {};
};

const makeRequest = (method: string, path: string, body?: unknown): any => {
  const headers: Record<string, string> = {
    "x-request-id": "req-test-1",
    "content-type": "application/json",
  };
  const readable = new Readable({ read() {} });
  if (body !== undefined) {
    const serialised = JSON.stringify(body);
    readable.push(serialised);
  }
  readable.push(null);
  return {
    method,
    url: path,
    headers,
    resume() {
      readable.resume();
    },
    pause() {
      readable.pause();
    },
    on(event: string, handler: (...args: unknown[]) => void) {
      if (event === "data" || event === "end" || event === "error" || event === "close") {
        readable.on(event, handler as never);
      }
      return this;
    },
    once(event: string, handler: (...args: unknown[]) => void) {
      readable.once(event, handler as never);
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
      else writeJson(this, this.body);
    },
  };
  return response;
};

interface Setup {
  context: MemoryHandlerContext;
  store: JsonMemoryStore;
  cleanup: () => void;
}

const setup = async (settings: Partial<MemorySettings> = {}): Promise<Setup> => {
  const dir = mkdtempSync(join(tmpdir(), "axi-memory-test-"));
  const storePath = join(dir, "memory-store.json");
  const settingsPath = join(dir, "memory-settings.json");
  const store = new JsonMemoryStore({ filePath: storePath });
  const settingsStore = buildMemorySettingsStore({ filePath: settingsPath });
  const baseSettings = memorySettingsSchema.parse({ ...defaultMemorySettings(), ...settings });
  await settingsStore.save(baseSettings);
  const context: MemoryHandlerContext = {
    store,
    maxBodyBytes: 1024 * 1024,
    loadSettings: () => settingsStore.load(),
    saveSettings: (patch) => settingsStore.save(patch),
    registerProjectId: () => undefined,
    knownProjectIds: () => ["ai-resource-orchestration"],
  };
  return {
    context,
    store,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
};

describe("memory HTTP contract", () => {
  let setupInstance: Setup;

  beforeEach(() => {
    setupInstance = undefined as unknown as Setup;
  });

  afterEach(() => {
    setupInstance?.cleanup();
  });

  it("GET /memory/settings returns the default settings envelope", async () => {
    setupInstance = await setup();
    const response = makeResponse();
    const handled = await handleMemoryRequest(
      setupInstance.context,
      "GET",
      "/memory/settings",
      makeRequest("GET", "/memory/settings"),
      response,
      "req-1",
    );
    expect(handled).toBe(true);
    const body = JSON.parse(response.body);
    expect(body.contractVersion).toBe(memoryApiContractVersion);
    expect(body.settings.useMemory).toBe(false);
    expect(body.settings.generateMemory).toBe(false);
  });

  it("PATCH /memory/settings persists the patched settings", async () => {
    setupInstance = await setup();
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "PATCH",
      "/memory/settings",
      makeRequest("PATCH", "/memory/settings", { useMemory: true, generateMemory: true }),
      response,
      "req-2",
    );
    const after = await setupInstance.context.loadSettings();
    expect(after.useMemory).toBe(true);
    expect(after.generateMemory).toBe(true);
  });

  it("PATCH /memory/settings rejects unknown fields", async () => {
    setupInstance = await setup();
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "PATCH",
      "/memory/settings",
      makeRequest("PATCH", "/memory/settings", { evil: 1 }),
      response,
      "req-3",
    );
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("invalid_request");
    expect(body.message.toLowerCase()).toContain("settings");
  });

  it("POST /memory/search returns empty memories when useMemory=false", async () => {
    setupInstance = await setup({ useMemory: false });
    await setupInstance.store.upsert(baseActive);
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "POST",
      "/memory/search",
      makeRequest("POST", "/memory/search", { query: "横屏" }),
      response,
      "req-4",
    );
    const body = JSON.parse(response.body);
    expect(body.memories).toEqual([]);
  });

  it("POST /memory/search returns ranked entries when useMemory=true", async () => {
    setupInstance = await setup({ useMemory: true });
    await setupInstance.store.upsert(baseActive);
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "POST",
      "/memory/search",
      makeRequest("POST", "/memory/search", { query: "默认 横屏 image 偏好" }),
      response,
      "req-5",
    );
    const body = JSON.parse(response.body);
    expect(body.memories.length).toBeGreaterThan(0);
    expect(body.memories[0].id).toBe(baseActive.id);
  });

  it("POST /memory/search rejects an unregistered projectId", async () => {
    setupInstance = await setup({ useMemory: true });
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "POST",
      "/memory/search",
      makeRequest("POST", "/memory/search", { query: "x", scope: "project", projectId: "not-registered" }),
      response,
      "req-6",
    );
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toMatch(/projectId/i);
  });

  it("POST /memory/search rejects a path-shaped projectId", async () => {
    setupInstance = await setup({ useMemory: true });
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "POST",
      "/memory/search",
      makeRequest("POST", "/memory/search", { query: "x", scope: "project", projectId: "/etc/passwd" }),
      response,
      "req-6b",
    );
    expect(response.statusCode).toBe(400);
  });

  it("POST /memory/clear without confirm=true is rejected", async () => {
    setupInstance = await setup();
    await setupInstance.store.upsert(baseActive);
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "POST",
      "/memory/clear",
      makeRequest("POST", "/memory/clear", { scope: "global", confirm: false }),
      response,
      "req-7",
    );
    expect(response.statusCode).toBe(400);
    const remaining = await setupInstance.store.readAll();
    expect(remaining).toHaveLength(1);
  });

  it("POST /memory/clear without an explicit scope is rejected", async () => {
    setupInstance = await setup();
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "POST",
      "/memory/clear",
      makeRequest("POST", "/memory/clear", { confirm: true }),
      response,
      "req-8",
    );
    expect(response.statusCode).toBe(400);
  });

  it("POST /memory/clear with confirm=true clears global entries", async () => {
    setupInstance = await setup();
    await setupInstance.store.upsert(baseActive);
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "POST",
      "/memory/clear",
      makeRequest("POST", "/memory/clear", { scope: "global", confirm: true }),
      response,
      "req-9",
    );
    expect(response.statusCode).toBe(200);
    const remaining = await setupInstance.store.readAll();
    expect(remaining).toEqual([]);
    expect(response.headers["x-memory-removed-count"]).toBe("1");
  });

  it("DELETE /memory/entries/:id removes a single entry", async () => {
    setupInstance = await setup();
    await setupInstance.store.upsert(baseActive);
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "DELETE",
      `/memory/entries/${baseActive.id}`,
      makeRequest("DELETE", `/memory/entries/${baseActive.id}`),
      response,
      "req-10",
    );
    expect(await setupInstance.store.get(baseActive.id)).toBeNull();
  });

  it("POST /memory/entries/:id/approve promotes a pending entry", async () => {
    setupInstance = await setup();
    const pending: MemoryEntry = { ...baseActive, id: "mem-pending", status: "pending" };
    await setupInstance.store.upsert(pending);
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "POST",
      "/memory/entries/mem-pending/approve",
      makeRequest("POST", "/memory/entries/mem-pending/approve", { confidence: "high" }),
      response,
      "req-11",
    );
    const after = await setupInstance.store.get("mem-pending");
    expect(after?.status).toBe("active");
  });

  it("POST /memory/entries/:id/reject deletes a pending entry", async () => {
    setupInstance = await setup();
    const pending: MemoryEntry = { ...baseActive, id: "mem-pending-2", status: "pending" };
    await setupInstance.store.upsert(pending);
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "POST",
      "/memory/entries/mem-pending-2/reject",
      makeRequest("POST", "/memory/entries/mem-pending-2/reject"),
      response,
      "req-12",
    );
    expect(await setupInstance.store.get("mem-pending-2")).toBeNull();
  });

  it("POST /memory/export returns the redacted, schema-validated file", async () => {
    setupInstance = await setup();
    await setupInstance.store.upsert(baseActive);
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "POST",
      "/memory/export",
      makeRequest("POST", "/memory/export"),
      response,
      "req-13",
    );
    const body = JSON.parse(response.body);
    expect(body.contractVersion).toBe(memoryApiContractVersion);
    expect(body.file.schemaVersion).toBe(1);
    expect(body.file.entries).toHaveLength(1);
    // Ensure no storage path leaked into the body
    const serialised = JSON.stringify(body);
    expect(serialised.includes("/memory-store.json")).toBe(false);
    expect(serialised.includes("memory-settings.json")).toBe(false);
  });

  it("POST /memory/contribute denies failed and external-context runs before extraction", async () => {
    setupInstance = await setup({ generateMemory: true });
    const processor = vi.fn().mockResolvedValue({ candidates: [], rejected: [] });
    const context = { ...setupInstance.context, processContribution: processor } as MemoryHandlerContext;
    const response = makeResponse();
    await handleMemoryRequest(
      context,
      "POST",
      "/memory/contribute",
      makeRequest("POST", "/memory/contribute", {
        sessionId: "failed-run",
        userInput: "记住以后横屏",
        outcome: "failed",
        usedExternalContext: true,
        toolIds: ["resource.search.web"],
      }),
      response,
      "req-contribute-denied",
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-memory-contribution"]).toBe("skipped");
    expect(response.headers["x-memory-contribution-reason"]).toBe("policy_denied");
    expect(processor).not.toHaveBeenCalled();
    expect(await setupInstance.store.readAll()).toEqual([]);
  });

  it("POST /memory/contribute schedules valid extraction and persists only after the idle task runs", async () => {
    setupInstance = await setup({ generateMemory: true });
    let scheduled: (() => Promise<void>) | undefined;
    const context = {
      ...setupInstance.context,
      scheduleContribution: (_sessionId: string, task: () => Promise<void>) => {
        scheduled = task;
      },
    } as MemoryHandlerContext;
    const response = makeResponse();
    await handleMemoryRequest(
      context,
      "POST",
      "/memory/contribute",
      makeRequest("POST", "/memory/contribute", {
        sessionId: "idle-run",
        userInput: "记住以后横屏图片",
        summary: "记住以后横屏图片",
        outcome: "presenting",
        usedExternalContext: false,
        toolIds: ["resource.search.image"],
      }),
      response,
      "req-contribute-scheduled",
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-memory-contribution"]).toBe("scheduled");
    expect(scheduled).toBeTypeOf("function");
    expect(await setupInstance.store.readAll()).toEqual([]);
    await scheduled?.();
    const entries = await setupInstance.store.readAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.facts.preferredOrientation).toBe("landscape");
  });

  it("GET /memory/entries lists the on-disk entries", async () => {
    setupInstance = await setup();
    await setupInstance.store.upsert(baseActive);
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "GET",
      "/memory/entries",
      makeRequest("GET", "/memory/entries"),
      response,
      "req-14",
    );
    const body = JSON.parse(response.body);
    expect(body.entries).toHaveLength(1);
  });

  it("matches the contract envelope on every response", async () => {
    setupInstance = await setup();
    const response = makeResponse();
    await handleMemoryRequest(
      setupInstance.context,
      "GET",
      "/memory/settings",
      makeRequest("GET", "/memory/settings"),
      response,
      "req-envelope",
    );
    expect(response.headers["x-request-id"]).toBe("req-envelope");
    const body = JSON.parse(response.body);
    // contractVersion on success uses memoryApiContractVersion; the
    // envelope helper wraps with gatewayContractVersion only on
    // errors. Here we only check the body side.
    expect(body.contractVersion).toBe(memoryApiContractVersion);
  });

  it("rejects oversized bodies with the gateway error envelope", async () => {
    setupInstance = await setup();
    const tiny = { ...setupInstance.context, maxBodyBytes: 8 } as MemoryHandlerContext;
    const response = makeResponse();
    await handleMemoryRequest(
      tiny,
      "PATCH",
      "/memory/settings",
      makeRequest("PATCH", "/memory/settings", { useMemory: true }),
      response,
      "req-overflow",
    );
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("invalid_request");
    expect(body.contractVersion).toBe(gatewayContractVersion);
    expect(body.message.toLowerCase()).toContain("body");
  });

  it("ignores unknown paths without claiming the request", async () => {
    setupInstance = await setup();
    const response = makeResponse();
    const handled = await handleMemoryRequest(
      setupInstance.context,
      "GET",
      "/memory/not-a-real-route",
      makeRequest("GET", "/memory/not-a-real-route"),
      response,
      "req-unknown",
    );
    expect(handled).toBe(false);
  });
});
