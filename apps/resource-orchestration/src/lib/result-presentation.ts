import type { ResourceCandidate, RunResult } from "@axi/gateway-contracts";

export type ResultPresentationStatus = "success" | "partial" | "error";

const KIND_LABEL: Record<string, string> = {
  image: "图片",
  document: "文档",
  project: "项目",
  ui: "UI 组件",
  icon: "图标",
  skill: "技能",
  workspace: "工作区",
  web: "网页",
};

export const summarizeKind = (result: RunResult): string => {
  const kinds = result.intent?.resourceKinds || [];
  if (!kinds.length) return "资源";
  const labels = kinds.map((kind) => KIND_LABEL[kind] || kind);
  return labels.length === 1 ? labels[0] : labels.join(" / ");
};

/** Image candidates without a preview are provider placeholders, not results
 * the user can actually inspect. Other resource kinds may legitimately have
 * no preview because their facts are rendered as text. */
export const isRenderableCandidate = (item: ResourceCandidate): boolean =>
  item.kind !== "image" || Boolean(item.preview);

export const renderableItemsFor = (result: RunResult): ResourceCandidate[] =>
  result.items.filter(isRenderableCandidate);

export const hasProviderFallbackWarningFor = (result: RunResult): boolean =>
  result.warnings.some((warning) => /provider|fallback|fixture/iu.test(warning));

const hasTextResourceIntentFor = (result: RunResult): boolean =>
  Boolean(result.intent?.resourceKinds.some((kind) => kind !== "image"));

/** A fixture-only fallback is not a trustworthy answer when the live provider failed. */
export const isFallbackOnlyResultFor = (
  result: RunResult,
  renderableItems: readonly ResourceCandidate[] = renderableItemsFor(result),
): boolean => renderableItems.length > 0
  && hasProviderFallbackWarningFor(result)
  && renderableItems.every((item) => item.provenance.provider.startsWith("fixture:"));

/** A text-resource provider failure with no candidates has no result to render. */
export const isUnavailableProviderResultFor = (
  result: RunResult,
  renderableItems: readonly ResourceCandidate[] = renderableItemsFor(result),
): boolean => hasTextResourceIntentFor(result)
  && hasProviderFallbackWarningFor(result)
  && (result.items.length === 0 || isFallbackOnlyResultFor(result, renderableItems));

export const unavailableResourceMessageFor = (result: RunResult): string => {
  const kind = summarizeKind(result);
  return kind + "服务暂时不可用，当前没有可用的" + kind + "结果。";
};

export const unavailableImageCountFor = (result: RunResult): number =>
  result.items.filter((item) => item.kind === "image" && !item.preview).length;

export const elapsedLabelFromMs = (elapsedMs: number): string => {
  const elapsedSeconds = Number.isFinite(elapsedMs)
    ? Math.max(1, Math.floor(elapsedMs / 1000))
    : 1;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return minutes > 0
    ? `用时 ${minutes} 分钟 ${seconds} 秒`
    : `用时 ${seconds} 秒`;
};

export const elapsedLabelFor = (trace: RunResult["trace"]): string => {
  const first = trace[0] ? Date.parse(trace[0].at) : Number.NaN;
  const last = trace.length > 1 ? Date.parse(trace[trace.length - 1].at) : first;
  const elapsedMs = Number.isFinite(first) && Number.isFinite(last) ? last - first : 0;
  return elapsedLabelFromMs(elapsedMs);
};

export const statusFor = (result: RunResult, renderableItems: ResourceCandidate[]): ResultPresentationStatus => {
  if (result.state === "failed" || Boolean(result.error)) return "error";
  if (!renderableItems.length && unavailableImageCountFor(result) > 0) return "error";
  if (result.warnings.length > 0) return "partial";
  return "success";
};

export const friendlyError = (error?: string): string => {
  if (!error) return "这次没有拿到可用结果。";
  if (error === "Failed to fetch") return "暂时无法连接到资源网关，请确认本地 gateway 正在运行。";
  return error;
};

export const headlineFor = (status: ResultPresentationStatus): string => {
  if (status === "error") return "这次没有拿到可用结果";
  if (status === "partial") return "已返回部分结果";
  return "结果已就绪";
};

export const summaryFor = (
  result: RunResult,
  status: ResultPresentationStatus,
  renderableItems: ResourceCandidate[],
): string => {
  const kind = summarizeKind(result);
  if (status === "error") return friendlyError(result.error);
  if (status === "partial") {
    return renderableItems.length
      ? String(renderableItems.length) + " 个" + kind + "候选可用，其余 provider 暂时不可用。"
      : "暂时没有可用的" + kind + "候选。";
  }
  return String(renderableItems.length) + " 个" + kind + "候选已就绪。";
};

/**
 * Plain-text rendition of an assistant result, used by the hover copy action.
 * We copy what the user can actually read: the summary line plus one line per
 * rendered candidate (title + provenance ref), never internal diagnostics.
 */
export const resultCopyTextFor = (result: RunResult): string => {
  const renderableItems = renderableItemsFor(result);
  const visibleItems = isUnavailableProviderResultFor(result, renderableItems) ? [] : renderableItems;
  const summary = isUnavailableProviderResultFor(result, renderableItems)
    ? unavailableResourceMessageFor(result)
    : summaryFor(result, statusFor(result, visibleItems), visibleItems);
  const lines = visibleItems.map((item) => `- ${item.title}（${item.provenance.ref}）`);
  return [summary, ...lines].join("\n");
};

export interface WarningDiagnostic {
  target: string;
  route: string;
  attempt: string;
  kind: string;
  code: string;
  status?: string;
}

const technicalWarningPattern = /^(?<target>\S+)\s+route=(?<route>\S+)\s+attempt=(?<attempt>\d+)\s+kind=(?<kind>\S+)\s+code=(?<code>\S+)(?:\s+status=(?<status>\d+))?/u;

export const parseWarningDiagnostic = (warning?: string): WarningDiagnostic | undefined => {
  if (!warning) return undefined;
  const match = warning.match(technicalWarningPattern);
  if (!match?.groups) return undefined;
  return {
    target: match.groups.target,
    route: match.groups.route,
    attempt: match.groups.attempt,
    kind: match.groups.kind,
    code: match.groups.code,
    ...(match.groups.status ? { status: match.groups.status } : {}),
  };
};

export const warningMessageFor = (
  result: RunResult,
  hasProviderWarning: boolean,
  unavailableImageCount = unavailableImageCountFor(result),
): string => {
  const kind = summarizeKind(result);
  const hasItems = result.items.some(isRenderableCandidate);
  if (unavailableImageCount > 0 || (!hasItems && result.state === "failed")) {
    return kind + "服务暂时不可用，当前没有可预览的" + kind + "结果。";
  }
  if (hasProviderWarning || result.warnings.some((warning) => /provider|fallback|route=/iu.test(warning))) {
    return kind + "服务部分不可用，以下结果来自当前可用的降级路径。";
  }
  return "执行过程中出现提示，但当前结果仍可继续查看。";
};
