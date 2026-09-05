type GatewayProxyResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

type TauriInternals = {
  invoke: <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;
};

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: TauriInternals;
  __axiTauriGatewayFetchInstalled__?: boolean;
};

const GATEWAY_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const DEFAULT_GATEWAY_BASE_URL = 'http://127.0.0.1:8088';
const metaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
const configuredGatewayBaseURL = metaEnv.VITE_API_BASE_URL?.trim() || '';

export function isPackagedTauriOrigin(pageURL: string): boolean {
  try {
    const url = new URL(pageURL);
    return url.protocol === 'tauri:' || url.hostname === 'tauri.localhost';
  } catch {
    return false;
  }
}

export function shouldUseNativeGatewayRequest(requestURL: string, pageURL: string): boolean {
  try {
    const url = new URL(requestURL, pageURL);
    if (!url.pathname.startsWith('/api/')) return false;
    if (isPackagedTauriOrigin(pageURL)) return true;
    return GATEWAY_HOSTNAMES.has(url.hostname) && url.port === '8088';
  } catch {
    return false;
  }
}

export function resolveNativeGatewayBaseURL(value = configuredGatewayBaseURL): string {
  return value.trim() || DEFAULT_GATEWAY_BASE_URL;
}

/**
 * Packaged macOS WebViews cannot reliably issue cross-origin HTTP requests
 * from the custom Tauri origin. Keep the Gateway transport native while
 * preserving the normal Fetch contract for the existing Web UI.
 */
export function installTauriGatewayFetch(): void {
  if (typeof window === 'undefined') return;
  const tauriWindow = window as TauriWindow;
  const tauri = tauriWindow.__TAURI_INTERNALS__;
  if (!tauri || tauriWindow.__axiTauriGatewayFetchInstalled__) return;

  const browserFetch = window.fetch.bind(window);
  tauriWindow.__axiTauriGatewayFetchInstalled__ = true;
  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url, window.location.href);
    if (!shouldUseNativeGatewayRequest(url.toString(), window.location.href)) {
      return browserFetch(input, init);
    }

    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      if (!['origin', 'host', 'cookie', 'content-length'].includes(name)) headers[name] = value;
    });
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
    const response = await tauri.invoke<GatewayProxyResponse>('proxy_gateway_request', {
      request: {
        method: request.method,
        path: `${url.pathname}${url.search}`,
        headers,
        body: body || undefined,
        baseUrl: resolveNativeGatewayBaseURL(),
      },
    });

    return new Response([204, 205, 304].includes(response.status) ? undefined : response.body, {
      status: response.status,
      headers: response.headers,
    });
  };
}
