import type { ResourceCandidate, RunEvent, RunResult } from "@axi/gateway-contracts";
import { describe, expect, it } from "vitest";
import { elapsedLabelFor, elapsedLabelFromMs, resultCopyTextFor } from "./result-presentation";

const traceAt = (...timestamps: string[]): RunEvent[] => timestamps.map((at, index) => ({
  state: index === timestamps.length - 1 ? "presenting" : "interpreting",
  label: "step",
  at,
}));

const candidate = (id: string, title: string): ResourceCandidate => ({
  id,
  kind: "image",
  title,
  preview: `/wallpapers/${id}.webp`,
  facts: { tags: ["test"] },
  provenance: { provider: "image-preview", ref: `fixture://image/${id}`, version: "fixture-v1" },
  safety: "safe",
});

const runResultWith = (items: ResourceCandidate[], warnings: string[] = []): RunResult => ({
  runId: "run-1",
  requestKey: "key-1",
  state: "presenting",
  planner: "heuristic",
  intent: { resourceKinds: ["image"] } as RunResult["intent"],
  items,
  warnings,
  trace: [],
});

describe("result presentation", () => {
  it("formats sub-minute runs as seconds", () => {
    expect(elapsedLabelFor(traceAt("2026-08-28T13:00:00.000Z", "2026-08-28T13:00:04.500Z"))).toBe("用时 4 秒");
  });

  it("formats longer runs as minutes and seconds", () => {
    expect(elapsedLabelFor(traceAt("2026-08-28T13:00:00.000Z", "2026-08-28T13:01:05.000Z"))).toBe("用时 1 分钟 5 秒");
  });

  it("shows at least one second when trace timestamps are unavailable", () => {
    expect(elapsedLabelFor([])).toBe("用时 1 秒");
    expect(elapsedLabelFor(traceAt("not-a-timestamp"))).toBe("用时 1 秒");
  });

  it("formats live elapsed milliseconds from the request start", () => {
    expect(elapsedLabelFromMs(0)).toBe("用时 1 秒");
    expect(elapsedLabelFromMs(1_250)).toBe("用时 1 秒");
    expect(elapsedLabelFromMs(61_000)).toBe("用时 1 分钟 1 秒");
  });

  it("copies the summary and one line per rendered candidate", () => {
    const text = resultCopyTextFor(runResultWith([
      candidate("c-1", "暖光人物头像"),
      candidate("c-2", "夜色城市剪影"),
    ]));
    expect(text).toBe([
      "2 个图片候选已就绪。",
      "- 暖光人物头像（fixture://image/c-1）",
      "- 夜色城市剪影（fixture://image/c-2）",
    ].join("\n"));
  });

  it("copies only the summary when there are no renderable candidates", () => {
    expect(resultCopyTextFor(runResultWith([]))).toBe("0 个图片候选已就绪。");
  });

  it("never copies internal warning diagnostics", () => {
    const text = resultCopyTextFor(runResultWith([candidate("c-1", "暖光人物头像")], [
      "image-preview route=resource.search.image attempt=1 kind=network code=ECONNREFUSED",
    ]));
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).toContain("暖光人物头像");
  });
});
