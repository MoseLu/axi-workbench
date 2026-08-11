export const DEFAULT_API_PROXY_TARGET = 'http://127.0.0.1:8088';

export interface ApiProxyTargetInput {
  apiProxyTarget?: string;
  apiBaseURL?: string;
}

function isExactLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

function isHTTPURL(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function normalizeLoopbackApiBaseURL(value: string | undefined): string | undefined {
  if (!value) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  if (!isExactLoopbackHostname(url.hostname)) return undefined;
  if (!isHTTPURL(url)) {
    throw new Error('VITE_API_BASE_URL must be a valid HTTP or HTTPS URL when it targets the local Vite proxy');
  }
  return url.href;
}

function normalizeExplicitApiProxyTarget(value: string | undefined): string | undefined {
  const target = value?.trim();
  if (!target) return undefined;

  try {
    const url = new URL(target);
    if (isHTTPURL(url)) return url.href;
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
