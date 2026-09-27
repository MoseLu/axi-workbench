import type { RunResult } from "@axi/gateway-contracts";
import { warningMessageFor } from "../../lib/result-presentation";

export interface WarningBoxProps {
  result: RunResult;
  hasProviderWarning: boolean;
  unavailableImageCount?: number;
}

export function WarningBox({
  result,
  hasProviderWarning,
  unavailableImageCount = 0,
}: WarningBoxProps) {
  const message = warningMessageFor(result, hasProviderWarning, unavailableImageCount);

  return (
    <p
      className={"assistant-result-notice assistant-result-notice-" + (unavailableImageCount > 0 ? "error" : "warning")}
      role={unavailableImageCount > 0 ? "alert" : "status"}
      data-warning-kind={(result.intent?.resourceKinds || []).join(",") || "unknown"}
    >
      {message}
    </p>
  );
}
