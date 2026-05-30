import { describe, expect, it } from "vitest";
import {
  assertProjectCompletionSnapshot,
  buildProjectCompletionOverview,
  emptyProjectCompletionSnapshot,
  type ProjectCompletionSnapshot,
} from "./projectCompletion";

const snapshot: ProjectCompletionSnapshot = {
  schemaVersion: "2026-05-30",
  generatedAt: "2026-05-30T00:00:00.000Z",
  source: "test",
  summary: {
    total: 4,
    axiTotal: 3,
    complete: 1,
    usableOrBetter: 2,
    blocked: 1,
    byStage: { complete: 1, usable: 1, blocked: 1, building: 1 },
    byConfidence: { high: 1, medium: 2, low: 1 },
  },
  projects: [
    project("axi-image-preview", "Axi Image Preview", "complete", "high"),
    project("axi-docs", "Axi Docs", "usable", "medium"),
    project("axi-coder", "Axi Coder", "building", "medium"),
    { ...project("sports-management", "Sports Management", "blocked", "low"), isAxi: false },
  ],
};

describe("project completion overview", () => {
  it("groups Axi completion state for the overview panel", () => {
    const overview = buildProjectCompletionOverview(snapshot);

    expect(overview.metrics).toEqual([
      { label: "Axi 项目", value: "3" },
      { label: "完成", value: "1" },
      { label: "可用及以上", value: "2" },
      { label: "需关注", value: "1" },
    ]);
    expect(overview.completeProjects.map((item) => item.id)).toEqual(["axi-image-preview"]);
    expect(overview.attentionProjects.map((item) => item.id)).toEqual(["axi-coder"]);
    expect(overview.axiProjects.map((item) => item.id)).toEqual(["axi-coder", "axi-docs", "axi-image-preview"]);
  });

  it("returns an empty snapshot for malformed data", () => {
    expect(assertProjectCompletionSnapshot(null)).toBe(emptyProjectCompletionSnapshot);
    expect(buildProjectCompletionOverview(null).metrics[0]).toEqual({ label: "Axi 项目", value: "0" });
  });
});

function project(
  id: string,
  name: string,
  stage: ProjectCompletionSnapshot["projects"][number]["stage"],
  confidence: ProjectCompletionSnapshot["projects"][number]["confidence"],
): ProjectCompletionSnapshot["projects"][number] {
  return {
    id,
    name,
    path: `/workspace/${id}`,
    kind: "test",
    isAxi: true,
    stage,
    stageLabel: stage,
    confidence,
    confidenceLabel: confidence,
    summary: `${name} summary`,
    updatedAt: "2026-05-30",
    evidence: ["test evidence"],
    remaining: [],
    docs: { status: "partial", present: ["README.md"], missing: ["TODO.md"] },
    verify: ["pnpm test"],
    health: [],
    contracts: [],
  };
}
