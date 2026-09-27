import type { RunResult, SessionEntry, SessionRecord, SessionResultSnapshot } from "@axi/gateway-contracts";
import type { ConversationMessage } from "./format";
import type { ConversationRun } from "./conversation-turns";

const snapshotToItems = (snapshot: SessionResultSnapshot): RunResult["items"] =>
  snapshot.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    facts: item.description ? { description: item.description } : {},
    provenance: { provider: "session", ref: item.id },
    safety: "safe" as const,
  }));

const snapshotToResult = (entry: SessionEntry, runId: string): RunResult | null => {
  if (entry.outcome === "running") return null;
  const snapshot = entry.result;
  const state = snapshot?.state
    ?? (entry.outcome === "clarifying" ? "clarifying"
      : entry.outcome === "failed" || entry.outcome === "cancelled" ? "failed"
        : entry.outcome === "interrupted" ? "failed"
          : "presenting");
  const warnings = [
    ...(snapshot?.warnings ?? []),
    ...(snapshot?.items.some((item) => item.previewAvailable === false) ? ["资源已不可用"] : []),
    ...(entry.outcome === "interrupted" ? ["上次回复未完成。"] : []),
  ];
  return {
    runId,
    requestKey: entry.id,
    state,
    planner: "session-restore",
    explanation: snapshot?.explanation ?? entry.text,
    items: snapshot ? snapshotToItems(snapshot) : [],
    warnings,
    trace: [],
    ...(state === "failed" ? { error: snapshot?.explanation ?? entry.text } : {}),
  };
};

export const conversationFromSession = (
  record: SessionRecord,
): { history: ConversationMessage[]; runs: ConversationRun[] } => {
  const history: ConversationMessage[] = [];
  const runs: ConversationRun[] = [];
  let pendingUser: ConversationMessage | null = null;

  for (const entry of record.entries) {
    const at = Date.parse(entry.createdAt) || 0;
    if (entry.role === "user") {
      const message: ConversationMessage = { id: entry.id, role: "user", text: entry.text, at };
      history.push(message);
      pendingUser = message;
      continue;
    }
    if (entry.role !== "assistant") continue;
    const runId = entry.runId ?? entry.id;
    const result = snapshotToResult(entry, runId);
    if (entry.outcome !== "presenting" && entry.outcome !== "failed") {
      history.push({ id: entry.id, role: "assistant", text: entry.text, at });
    }
    if (pendingUser) {
      runs.push({
        id: runId,
        userMessageId: pendingUser.id,
        input: pendingUser.text,
        result,
        completedAt: entry.outcome === "running" ? null : at,
      });
    }
  }

  return { history, runs };
};
