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

function normalizeExplicitApiProxyTarget(value: string | undefined): string | undefined {
  const target = value?.trim();
  if (!target) return undefined;

  try {
    const url = new URL(target);
    if (url.protocol === 'http:' || url.protocol === 'https:') return target;
  } catch {
    // Invalid URL syntax falls through to the same actionable configuration error.
  }

  throw new Error('VITE_API_PROXY_TARGET must be a valid HTTP or HTTPS URL');
}

/**
 * Selects Vite's API proxy target without broadening the exact loopback-host
 * convention used by the browser-side Gateway URL normalizer.
 */
export function selectApiProxyTarget({ apiProxyTarget, apiBaseURL }: ApiProxyTargetInput): string {
  const explicitTarget = normalizeExplicitApiProxyTarget(apiProxyTarget);
  if (explicitTarget) return explicitTarget;
  if (isLoopbackApiBaseURL(apiBaseURL)) return apiBaseURL;
  return DEFAULT_API_PROXY_TARGET;
}
