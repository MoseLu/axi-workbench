export const DEFAULT_API_PROXY_TARGET = 'http://127.0.0.1:8088';

export interface ApiProxyTargetInput {
  apiProxyTarget?: string;
  apiBaseURL?: string;
}

function isExactLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

function isLoopbackApiBaseURL(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return isExactLoopbackHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}

/**
 * Selects Vite's API proxy target without broadening the exact loopback-host
 * convention used by the browser-side Gateway URL normalizer.
 */
export function selectApiProxyTarget({ apiProxyTarget, apiBaseURL }: ApiProxyTargetInput): string {
  if (apiProxyTarget) return apiProxyTarget;
  if (isLoopbackApiBaseURL(apiBaseURL)) return apiBaseURL;
  return DEFAULT_API_PROXY_TARGET;
}
