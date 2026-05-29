import type { CliRoute, RequestLog } from "../features/providers/types";

export function cliLabel(cli: string) {
  switch (cli) {
    case "claude":
      return "Claude";
    case "codex":
      return "Codex";
    case "gemini":
      return "Gemini";
    case "health":
      return "健康检查";
    default:
      return cli;
  }
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function relativeTime(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return "未知";
  }

  const diffSeconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (diffSeconds < 60) {
    return "刚刚";
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  return `${Math.round(diffHours / 24)} 天前`;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function logStatusLabel(status: string) {
  switch (status) {
    case "success":
      return "成功";
    case "failure":
      return "失败";
    default:
      return status;
  }
}

export function healthCategoryLabel(category: string) {
  switch (category) {
    case "ok":
      return "正常";
    case "auth":
      return "认证失败";
    case "billing":
      return "账单异常";
    case "forbidden":
      return "无权限";
    case "not_found":
      return "未找到";
    case "invalid_request":
      return "请求无效";
    case "rate_limit":
      return "速率限制";
    case "provider_error":
      return "提供方错误";
    case "provider_unavailable":
      return "提供方不可用";
    case "provider_timeout":
      return "提供方超时";
    case "network_timeout":
      return "网络超时";
    case "dns":
      return "DNS 解析失败";
    case "tls":
      return "TLS 失败";
    case "network":
      return "网络异常";
    case "http_error":
      return "HTTP 错误";
    default:
      return category;
  }
}

export function logReasonLabel(log: RequestLog) {
  if (log.errorReason) {
    return log.errorReason;
  }

  if (log.errorCategory) {
    return healthCategoryLabel(log.errorCategory);
  }

  return "-";
}

export function orderRoutes(routes: CliRoute[]) {
  const cliNames: Array<CliRoute["cli"]> = ["claude", "codex", "gemini"];
  return [...routes].sort((a, b) => cliNames.indexOf(a.cli) - cliNames.indexOf(b.cli));
}

export function trimTerminalTranscript(value: string) {
  const maxLength = 240_000;
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(value.length - maxLength);
}

export function profileLabel(profile: string) {
  switch (profile) {
    case "coding_math":
      return "编程/数学";
    case "creative":
      return "创意";
    case "long_context":
      return "长上下文";
    case "short_prompt":
      return "短提示";
    case "balanced":
      return "平衡";
    default:
      return profile;
  }
}

export function reasoningLabel(value: string) {
  switch (value) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    case "xhigh":
      return "超高";
    case "none":
      return "无";
    default:
      return value;
  }
}
