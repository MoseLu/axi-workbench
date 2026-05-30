export type ProjectCompletionStage =
  | "unassessed"
  | "building"
  | "usable"
  | "near-complete"
  | "complete"
  | "maintenance"
  | "blocked"
  | "archived";

export type ProjectCompletionConfidence = "low" | "medium" | "high";

export type ProjectDocsStatus = "ready" | "partial" | "legacy" | "missing";

export type ProjectCompletionItem = {
  id: string;
  name: string;
  path: string;
  kind: string;
  isAxi: boolean;
  stage: ProjectCompletionStage;
  stageLabel: string;
  confidence: ProjectCompletionConfidence;
  confidenceLabel: string;
  summary: string;
  updatedAt: string;
  evidence: string[];
  remaining: string[];
  docs: {
    status: ProjectDocsStatus;
    present: string[];
    missing: string[];
  };
  verify: string[];
  health: string[];
  contracts: string[];
};

export type ProjectCompletionSnapshot = {
  schemaVersion: string;
  generatedAt: string;
  source: string;
  summary: {
    total: number;
    axiTotal: number;
    complete: number;
    usableOrBetter: number;
    blocked: number;
    byStage: Record<string, number>;
    byConfidence: Record<string, number>;
  };
  projects: ProjectCompletionItem[];
};

export type ProjectCompletionOverview = {
  generatedAt: string;
  metrics: Array<{ label: string; value: string }>;
  axiProjects: ProjectCompletionItem[];
  completeProjects: ProjectCompletionItem[];
  attentionProjects: ProjectCompletionItem[];
};

const stageRank: Record<ProjectCompletionStage, number> = {
  blocked: 0,
  building: 1,
  unassessed: 2,
  usable: 3,
  "near-complete": 4,
  complete: 5,
  maintenance: 6,
  archived: 7,
};

export const emptyProjectCompletionSnapshot: ProjectCompletionSnapshot = {
  schemaVersion: "2026-05-30",
  generatedAt: "",
  source: "fallback",
  summary: {
    total: 0,
    axiTotal: 0,
    complete: 0,
    usableOrBetter: 0,
    blocked: 0,
    byStage: {},
    byConfidence: {},
  },
  projects: [],
};

export function assertProjectCompletionSnapshot(value: unknown): ProjectCompletionSnapshot {
  if (!value || typeof value !== "object") {
    return emptyProjectCompletionSnapshot;
  }

  const snapshot = value as Partial<ProjectCompletionSnapshot>;
  if (!Array.isArray(snapshot.projects) || !snapshot.summary) {
    return emptyProjectCompletionSnapshot;
  }

  return snapshot as ProjectCompletionSnapshot;
}

export function buildProjectCompletionOverview(snapshot: ProjectCompletionSnapshot | null): ProjectCompletionOverview {
  const safeSnapshot = snapshot ?? emptyProjectCompletionSnapshot;
  const axiProjects = safeSnapshot.projects
    .filter((project) => project.isAxi)
    .sort(compareCompletionItems);
  const completeProjects = axiProjects.filter((project) => project.stage === "complete" || project.stage === "maintenance");
  const attentionProjects = axiProjects.filter((project) =>
    ["blocked", "building", "unassessed"].includes(project.stage),
  );

  return {
    generatedAt: safeSnapshot.generatedAt,
    metrics: [
      { label: "Axi 项目", value: `${axiProjects.length}` },
      { label: "完成", value: `${completeProjects.length}` },
      { label: "可用及以上", value: `${safeSnapshot.summary.usableOrBetter}` },
      { label: "需关注", value: `${attentionProjects.length}` },
    ],
    axiProjects,
    completeProjects,
    attentionProjects,
  };
}

export function formatCompletionDate(value: string): string {
  if (!value) return "未生成";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function compareCompletionItems(left: ProjectCompletionItem, right: ProjectCompletionItem) {
  const stageCompare = stageRank[left.stage] - stageRank[right.stage];
  if (stageCompare !== 0) return stageCompare;
  return left.id.localeCompare(right.id);
}
