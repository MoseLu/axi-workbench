import type { ClarificationOption, ResourceCandidate, RunResult } from "@axi/gateway-contracts";
import { CandidateCard } from "./CandidateCard";
import { Clarification } from "./Clarification";
import { RunTrace } from "./RunTrace";
import { WarningBox } from "./WarningBox";
import { MemoryTraceHint } from "../memory/MemoryTraceHint";
import {
  elapsedLabelFor,
  isUnavailableProviderResultFor,
  renderableItemsFor,
  statusFor,
  summarizeKind,
  summaryFor,
  unavailableResourceMessageFor,
  unavailableImageCountFor,
} from "../../lib/result-presentation";

export interface AssistantResultProps {
  result: RunResult;
  hasProviderWarning: boolean;
  onChooseClarification: (option: ClarificationOption) => void;
  onPreview: (item: ResourceCandidate) => void;
  onRetry: () => void;
}

export function AssistantResult({
  result,
  hasProviderWarning,
  onChooseClarification,
  onPreview,
  onRetry,
}: AssistantResultProps) {
  const items = renderableItemsFor(result);
  const isUnavailableProviderResult = isUnavailableProviderResultFor(result, items);
  const visibleItems = isUnavailableProviderResult ? [] : items;
  const unavailableImageCount = unavailableImageCountFor(result);
  const status = statusFor(result, visibleItems);
  const kind = summarizeKind(result);
  const responseSummary = summaryFor(result, status, visibleItems);
  const trace = isUnavailableProviderResult
    ? result.trace.filter((event) => event.state !== "presenting")
    : result.trace;
  const unavailableMessage = isUnavailableProviderResult ? unavailableResourceMessageFor(result) : undefined;
  const elapsedLabel = elapsedLabelFor(result.trace);
  const isEmpty = visibleItems.length === 0;
  const isClarificationOnly = result.state === "clarifying" && isEmpty;
  const showStatusNotice = !isUnavailableProviderResult && status !== "success" && !isClarificationOnly && result.warnings.length === 0;
  const hasConfirmationAction = Boolean(result.clarification?.some((option) =>
    option.id === "allow-flagged" || option.id === "confirm-requested-quantity" || option.id === "show-all-results",
  ));

  return (
    <div className={"assistant-result assistant-result-" + status} data-result-status={status}>
      {(trace.length > 0 || isUnavailableProviderResult) && (
        <details className="run-trace-disclosure">
          <summary>{elapsedLabel}</summary>
          <div className="run-trace-drawer">
            <RunTrace
              trace={trace}
            />
            <MemoryTraceHint trace={trace} />
          </div>
        </details>
      )}
      {unavailableMessage && (
        <p
          className="assistant-result-notice assistant-result-notice-unavailable"
          role="alert"
          aria-label={kind + "结果：" + unavailableMessage}
        >
          {unavailableMessage}
        </p>
      )}
      {!unavailableMessage && showStatusNotice && (
        <p
          className={"assistant-result-notice assistant-result-notice-" + status}
          role={status === "error" ? "alert" : "status"}
          aria-label={kind + "结果：" + responseSummary}
        >
          {responseSummary}
        </p>
      )}

      {result.warnings.length > 0 && !isUnavailableProviderResult && (
        <WarningBox
          result={result}
          hasProviderWarning={hasProviderWarning}
          unavailableImageCount={unavailableImageCount}
        />
      )}
      {result.clarification && (
        hasConfirmationAction && (
          <Clarification
            options={result.clarification}
            onChoose={onChooseClarification}
            showMessage={false}
          />
        )
      )}
      {visibleItems.length > 0 && (
        <div className={"candidate-grid candidate-grid-" + (visibleItems.length === 1 ? "single" : "multiple")}>
          {visibleItems.map((item) => (
            <CandidateCard key={item.id} item={item} onPreview={onPreview} />
          ))}
        </div>
      )}
      {isEmpty && status === "error" && unavailableImageCount === 0 && !isUnavailableProviderResult && (
        <button type="button" className="secondary-button retry-button" onClick={onRetry}>
          重试这次请求
        </button>
      )}
    </div>
  );
}
