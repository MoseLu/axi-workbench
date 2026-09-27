import { describe, expect, it, vi } from "vitest";
import {
  approveMemoryEntry,
  clearMemory,
  contributeMemory,
  deleteMemoryEntry,
  exportMemory,
  fetchMemorySettings,
  listMemoryEntries,
  patchMemorySettings,
  rejectMemoryEntry,
  searchMemory,
} from "./memory-client";

/**
 * MEM-MVP-021 — Browser-side memory client behaviour tests.
 *
 * Validate the typed projections and the never-throws posture of the
 * workbench → gateway boundary. We never mock the storage path; the
 * client only knows the gateway base URL.
 */

const jsonResponse = (payload: unknown, init: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}): Response =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(init.headers ?? {}),
    json: async () => payload,
  }) as unknown as Response;

describe("memory-client", () => {
  it("fetchMemorySettings returns null when the gateway returns a non-2xx envelope", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 503 }));
    expect(await fetchMemorySettings({ fetcher: fetcher as unknown as typeof fetch, baseUrl: "http://gw.test" })).toBeNull();
  });

  it("fetchMemorySettings parses a valid settings body", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      contractVersion: 1,
      requestId: "memory-settings",
      settings: { useMemory: true, generateMemory: false, externalContextProtection: true, defaultScope: "global" },
    }));
    const result = await fetchMemorySettings({ fetcher: fetcher as unknown as typeof fetch, baseUrl: "http://gw.test" });
    expect(result?.useMemory).toBe(true);
    expect(result?.generateMemory).toBe(false);
  });

  it("patchMemorySettings returns null on transport failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    expect(await patchMemorySettings({ useMemory: true }, { fetcher: fetcher as unknown as typeof fetch })).toBeNull();
  });

  it("searchMemory returns an empty context when the gateway returns an empty list", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ contractVersion: 1, requestId: "memory-search", memories: [] }));
    const result = await searchMemory("横屏", { fetcher: fetcher as unknown as typeof fetch, baseUrl: "http://gw.test" });
    expect(result?.memories).toEqual([]);
  });

  it("listMemoryEntries returns the entries array", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      contractVersion: 1,
      requestId: "memory-entries",
      entries: [
        {
          id: "mem-1", schemaVersion: 1, scope: "global", kind: "preference",
          status: "active", summary: "默认横屏", facts: { preferredOrientation: "landscape" },
          tags: ["image"], source: "explicit", sensitivity: "normal", confidence: "high",
          createdAt: "2026-08-29T00:00:00.000Z", updatedAt: "2026-08-29T00:00:00.000Z",
        },
      ],
    }));
    const result = await listMemoryEntries({ fetcher: fetcher as unknown as typeof fetch, baseUrl: "http://gw.test" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("mem-1");
  });

  it("approve / reject / delete return false when the gateway errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 401 }));
    expect(await approveMemoryEntry("x", { fetcher: fetcher as unknown as typeof fetch })).toBe(false);
    expect(await rejectMemoryEntry("x", { fetcher: fetcher as unknown as typeof fetch })).toBe(false);
    expect(await deleteMemoryEntry("x", { fetcher: fetcher as unknown as typeof fetch })).toBe(false);
  });

  it("clearMemory sends confirm=true and the explicit scope", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ contractVersion: 1, requestId: "memory-clear", ok: true }));
    const ok = await clearMemory("global", { fetcher: fetcher as unknown as typeof fetch, baseUrl: "http://gw.test" });
    expect(ok).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://gw.test/memory/clear");
    expect(JSON.parse(init.body as string)).toEqual({ scope: "global", confirm: true });
  });

  it("exportMemory returns the parsed payload", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ contractVersion: 1, requestId: "memory-export", exportedAt: "2026-08-29T00:00:00.000Z", file: { schemaVersion: 1, updatedAt: "2026-08-29T00:00:00.000Z", entries: [] } }));
    const result = await exportMemory({ fetcher: fetcher as unknown as typeof fetch, baseUrl: "http://gw.test" });
    expect(result).not.toBeNull();
  });

  it("contributeMemory reads the contribution counters from response headers", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ contractVersion: 1, requestId: "memory-contribute", ok: true }, {
      headers: { "x-memory-contribution": "processed", "x-memory-contribution-accepted": "2", "x-memory-contribution-rejected": "1" },
    }));
    const result = await contributeMemory(
      { sessionId: "s", userInput: "记住", outcome: "presenting", usedExternalContext: false },
      { fetcher: fetcher as unknown as typeof fetch, baseUrl: "http://gw.test" },
    );
    expect(result).toEqual({ processed: true, accepted: 2, rejected: 1 });
  });
});
