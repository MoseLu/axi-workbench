import type { ClarificationOption, ResourceCandidate } from "@axi/gateway-contracts";
import { AssistantResult } from "../results/AssistantResult";
import { ResultActions } from "../results/ResultActions";
import { AssistantReply } from "./AssistantReply";
import type { AssistantTurn as AssistantTurnModel } from "../../lib/conversation-turns";

export interface AssistantTurnProps {
  turn: AssistantTurnModel;
  copied: boolean;
  onCopy: () => void;
  onChooseClarification: (runId: string, option: ClarificationOption) => void;
  onPreview: (runId: string, item: ResourceCandidate) => void;
  onRetry: (runId: string) => void;
}

/**
 * One assistant reply, however many pieces it arrived in. A run's result block
 * and any conversational lines that follow it render inside a single turn so
 * the hover bar (copy + time) appears exactly once at the end.
 */
export function AssistantTurn({
  turn,
  copied,
  onCopy,
  onChooseClarification,
  onPreview,
  onRetry,
}: AssistantTurnProps) {
  const run = turn.run;
  return (
    <div className="assistant-turn">
      {run?.result && (
        <AssistantResult
          result={run.result}
          hasProviderWarning={run.result.warnings.some((warning) => /provider 不可用/iu.test(warning))}
          onChooseClarification={(option) => onChooseClarification(run.id, option)}
          onPreview={(item) => onPreview(run.id, item)}
          onRetry={() => onRetry(run.id)}
        />
      )}
      {turn.replies.map((reply) => (
        <AssistantReply key={reply.id} text={reply.text} />
      ))}
      <ResultActions at={turn.at} copied={copied} onCopy={onCopy} />
    </div>
  );
}
