const DEFAULT_API_PORT = 8765;
const DISCOVERY_ENDPOINT = '/api/discovery';
const DISCOVERY_TIMEOUT_MS = 800;
const USER_DEFINED_API_URL_KEY = 'api_url';
const LAST_SUCCESSFUL_API_URL_KEY = 'sop_last_api_url';
const DISCOVERY_STATE_EVENT = 'sop:backend-discovery-state';
const FALLBACK_SCAN_CONCURRENCY = 24;
const FALLBACK_HOST_CANDIDATES = [
  `http://dxu:${DEFAULT_API_PORT}`,
  `http://10.80.8.207:${DEFAULT_API_PORT}`,
];
const FALLBACK_SCAN_RANGES = [
  { prefix: '10.80.8', start: 1, end: 253 },
  { prefix: '10.80.9', start: 1, end: 253 },
];

export type BackendDiscoverySource =
  | 'auto_hostname'
  | 'auto_fixed_ip'
  | 'auto_scan'
  | 'manual'
  | 'none';

export interface BackendDiscoveryState {
  phase: 'idle' | 'probing' | 'resolved' | 'unresolved';
  baseURL: string;
  source: BackendDiscoverySource;
  autoResolved: boolean;
  manualAllowed: boolean;
}

let backendDiscoveryState: BackendDiscoveryState = {
  phase: 'idle',
  baseURL: '',
  source: 'none',
  autoResolved: false,
  manualAllowed: false,
};

function canUseDOM(): boolean {
  return typeof window !== 'undefined';
}

function safeReadStorage(key: string): string {
  if (!canUseDOM()) return '';
  try {
    return localStorage.getItem(key)?.trim() || '';
  } catch {
    return '';
  }
}

function safeWriteStorage(key: string, value: string) {
  if (!canUseDOM()) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage write failures
  }
}

function safeRemoveStorage(key: string) {
  if (!canUseDOM()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage delete failures
  }
}

function emitBackendDiscoveryState() {
  if (!canUseDOM()) return;
  window.dispatchEvent(new CustomEvent<BackendDiscoveryState>(DISCOVERY_STATE_EVENT, {
    detail: getBackendDiscoveryState(),
  }));
}

function setBackendDiscoveryState(nextState: BackendDiscoveryState) {
  backendDiscoveryState = nextState;
  emitBackendDiscoveryState();
}

function setResolvedBackendDiscovery(baseURL: string, source: BackendDiscoverySource, autoResolved: boolean) {
  setBackendDiscoveryState({
    phase: 'resolved',
    baseURL,
    source,
    autoResolved,
    manualAllowed: !autoResolved,
  });
}

function setManualFallbackUnlocked() {
  setBackendDiscoveryState({
    phase: 'unresolved',
    baseURL: '',
    source: 'none',
    autoResolved: false,
    manualAllowed: true,
  });
}

export function normalizeApiBaseURL(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (!parsed.port) {
      parsed.port = String(DEFAULT_API_PORT);
    }
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.origin.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const rawUrl of urls) {
    const normalized = normalizeApiBaseURL(rawUrl);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function buildScanCandidates(): string[] {
  const candidates: string[] = [];
  for (const range of FALLBACK_SCAN_RANGES) {
    for (let host = range.start; host <= range.end; host++) {
      candidates.push(`http://${range.prefix}.${host}:${DEFAULT_API_PORT}`);
    }
  }
  return uniqueUrls(candidates);
}

async function probeDiscovery(baseURL: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseURL}${DISCOVERY_ENDPOINT}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null) as
      | { service?: string; base_urls?: string[] }
      | null;

    if (payload?.service && payload.service !== 'sop-server') {
      return null;
    }

    const canonical =
      Array.isArray(payload?.base_urls) && payload.base_urls.length > 0
        ? payload.base_urls[0]
        : baseURL;

    return normalizeApiBaseURL(canonical);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function probeCandidates(candidates: string[], concurrency: number): Promise<string> {
  if (!canUseDOM()) {
    throw new Error('discovery unavailable');
  }

  const deduped = uniqueUrls(candidates);
  if (deduped.length === 0) {
    throw new Error('no discovery candidates');
  }

  let index = 0;
  let found = '';

  async function worker() {
    while (!found && index < deduped.length) {
      const currentIndex = index++;
      const current = deduped[currentIndex];
      const hit = await probeDiscovery(current);
      if (hit && !found) {
        found = hit;
        return;
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, deduped.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (found) {
    return found;
  }

  throw new Error('backend not discovered');
}

export function getInitialApiBaseURL(): string {
  return FALLBACK_HOST_CANDIDATES[0] || '';
}

export function getUserDefinedApiBaseURL(): string {
  return normalizeApiBaseURL(safeReadStorage(USER_DEFINED_API_URL_KEY));
}

export function setUserDefinedApiBaseURL(baseURL: string) {
  const normalized = normalizeApiBaseURL(baseURL);
  if (normalized) {
    safeWriteStorage(USER_DEFINED_API_URL_KEY, normalized);
  } else {
    safeRemoveStorage(USER_DEFINED_API_URL_KEY);
  }
}

export function clearUserDefinedApiBaseURL() {
  safeRemoveStorage(USER_DEFINED_API_URL_KEY);
}

export function getLastSuccessfulApiBaseURL(): string {
  return normalizeApiBaseURL(safeReadStorage(LAST_SUCCESSFUL_API_URL_KEY));
}

export function clearLastSuccessfulApiBaseURL() {
  safeRemoveStorage(LAST_SUCCESSFUL_API_URL_KEY);
}

export function rememberSuccessfulApiBaseURL(baseURL: string) {
  const normalized = normalizeApiBaseURL(baseURL);
  if (normalized) {
    safeWriteStorage(LAST_SUCCESSFUL_API_URL_KEY, normalized);
  }
}

export function getBackendDiscoveryState(): BackendDiscoveryState {
  return { ...backendDiscoveryState };
}

export function markManualBackendResolved(baseURL: string) {
  const normalized = normalizeApiBaseURL(baseURL);
  if (!normalized) {
    return;
  }

  rememberSuccessfulApiBaseURL(normalized);
  setResolvedBackendDiscovery(normalized, 'manual', false);
}

export async function resolveApiBaseURL(): Promise<string> {
  setBackendDiscoveryState({
    phase: 'probing',
    baseURL: '',
    source: 'none',
    autoResolved: false,
    manualAllowed: false,
  });

  const hostnameHit = await probeDiscovery(FALLBACK_HOST_CANDIDATES[0]);
  if (hostnameHit) {
    rememberSuccessfulApiBaseURL(hostnameHit);
    setResolvedBackendDiscovery(hostnameHit, 'auto_hostname', true);
    return hostnameHit;
  }

  const fixedIpHit = await probeDiscovery(FALLBACK_HOST_CANDIDATES[1]);
  if (fixedIpHit) {
    rememberSuccessfulApiBaseURL(fixedIpHit);
    setResolvedBackendDiscovery(fixedIpHit, 'auto_fixed_ip', true);
    return fixedIpHit;
  }

  try {
    const scannedHit = await probeCandidates(buildScanCandidates(), FALLBACK_SCAN_CONCURRENCY);
    rememberSuccessfulApiBaseURL(scannedHit);
    setResolvedBackendDiscovery(scannedHit, 'auto_scan', true);
    return scannedHit;
  } catch {
    setManualFallbackUnlocked();
  }

  const manualCandidate = getUserDefinedApiBaseURL();
  if (manualCandidate) {
    const manualHit = await probeDiscovery(manualCandidate);
    if (manualHit) {
      rememberSuccessfulApiBaseURL(manualHit);
      setResolvedBackendDiscovery(manualHit, 'manual', false);
      return manualHit;
    }
  }

  setManualFallbackUnlocked();
  throw new Error('backend not discovered');
}

export {
  DEFAULT_API_PORT,
  DISCOVERY_STATE_EVENT,
  LAST_SUCCESSFUL_API_URL_KEY,
  USER_DEFINED_API_URL_KEY,
};
