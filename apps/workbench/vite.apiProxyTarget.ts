export const DEFAULT_API_PROXY_TARGET = 'http://127.0.0.1:8088';

export interface ApiProxyTargetInput {
  apiProxyTarget?: string;
  apiBaseURL?: string;
}

function isExactLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

function normalizeLoopbackApiBaseURL(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return isExactLoopbackHostname(url.hostname) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function normalizeExplicitApiProxyTarget(value: string | undefined): string | undefined {
  const target = value?.trim();
  if (!target) return undefined;

  try {
    const url = new URL(target);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
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
  return normalizeLoopbackApiBaseURL(apiBaseURL) || DEFAULT_API_PROXY_TARGET;
}
