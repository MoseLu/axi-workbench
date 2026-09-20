import type { RunResult } from "@axi/gateway-contracts";
import type { ConversationMessage } from "./format";

export interface ConversationRun {
  id: string;
  userMessageId: string;
  input: string;
  result: RunResult | null;
  /** When the result landed — drives the turn's timestamp. */
  completedAt: number | null;
}

export interface UserTurn {
  kind: "user";
  id: string;
  message: ConversationMessage;
  /** The run this message triggered, if it has produced a result. */
  run?: ConversationRun;
}

export interface AssistantTurn {
  kind: "assistant";
  /** Feedback + copy identity for the whole turn: the run id when a run
   * produced it, otherwise the first reply's message id. */
  id: string;
  run?: ConversationRun;
  replies: ConversationMessage[];
  /** When the turn finished — drives the single timestamp. */
  at: number;
}

export type ConversationTurn = UserTurn | AssistantTurn;

/**
 * Groups the flat message log into rendered turns.
 *
 * One assistant reply can reach the user as several pieces — a result block
 * with candidates plus a plain conversational line (clarification, safety
 * confirmation). Those belong to a single turn and must show exactly one
 * hover action bar, so we fold them together here rather than letting each
 * fragment render its own controls.
 */
export const conversationTurnsFor = (
  history: readonly ConversationMessage[],
  runs: readonly ConversationRun[],
): ConversationTurn[] => {
  const turns: ConversationTurn[] = [];
  for (const message of history) {
    if (message.role === "user") {
      const run = runs.find((item) => item.userMessageId === message.id);
      turns.push({ kind: "user", id: message.id, message, ...(run ? { run } : {}) });
      // A run that produced a result opens the assistant turn immediately;
      // any assistant lines that follow fold into it.
      if (run?.result) {
        turns.push({ kind: "assistant", id: run.id, run, replies: [], at: run.completedAt ?? message.at });
      }
      continue;
    }
    const previous = turns[turns.length - 1];
    if (previous?.kind === "assistant") {
      previous.replies.push(message);
      previous.at = Math.max(previous.at, message.at);
      continue;
    }
    turns.push({ kind: "assistant", id: message.id, replies: [message], at: message.at });
  }
  return turns;
};
