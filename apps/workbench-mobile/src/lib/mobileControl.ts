import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { resolveGatewayURL } from '@axi/workbench-foundation';

export type MobileProjectAction = {
  actionId: string;
  commandId: string;
  label: string;
  actionType: string;
  executionMode: 'immediate' | 'requires_approval';
  riskLevel: 'low' | 'medium' | 'high' | 'destructive';
  summary: string;
};

export type MobileProject = {
  id: string;
  name: string;
  status: string;
  health: 'healthy' | 'attention' | 'blocked' | 'stale' | 'unknown';
  summary: string;
  lastVerifiedAt: string | null;
  progress: { summary: string; updatedAt: string | null; stage: string; evidenceCount: number };
  actions: MobileProjectAction[];
};

export type MobileWorkspaceSnapshot = {
  generatedAt: string;
  source: string;
  summary: { total: number; healthy: number; attention: number; blocked: number; stale: number; unknown: number };
  attentionItems: Array<{ id: string; projectId: string | null; severity: string; title: string; summary: string; updatedAt: string }>;
  projects: MobileProject[];
  runningTasks: Array<{ id: string; projectId: string | null; status: string; summary: string; updatedAt: string }>;
  recentTasks: Array<{ id: string; projectId: string | null; status: string; summary: string; updatedAt: string }>;
  approvals: Array<{ id: string; projectId: string | null; actionSummary: string; riskLevel: string; createdAt: string }>;
};

export type ApprovalScanPreview = {
  scanId: string;
  approvalId: string;
  object: { type: 'approval'; id: string; projectId: string | null; actionId: string | null; actionType: string | null };
  impact: string;
  riskLevel: 'low' | 'medium' | 'high' | 'destructive';
  currentStatus: 'pending';
  availableDecisions: Array<'approved' | 'rejected' | 'handoff'>;
  expiresAt: string;
  handoffCorrelationId: string;
};

export type MobileDeviceSession = { deviceId: string; expiresAt: number };

export type MobileWebLoginQrPayload = Pick<
  import('./webLoginQr').WebLoginQrPayload,
  'webLoginId' | 'scanToken'
>;

export class MobileControlError extends Error {
  constructor(public readonly code: string, public readonly status?: number) {
    super(code);
  }
}

type ActiveSession = MobileDeviceSession & { accessToken: string };
type PendingPairing = { privateKey: CryptoKey; publicKeyHex: string; pairingId: string; expiresAt: number | null };
type PersistedDeviceKey = { deviceId: string; privateKey: CryptoKey; publicKeyHex: string };
type DeviceKeyStore = {
  read: () => Promise<PersistedDeviceKey | null>;
  write: (record: PersistedDeviceKey) => Promise<void>;
  remove: () => Promise<void>;
};

let activeSession: ActiveSession | null = null;
let pendingPairing: PendingPairing | null = null;
const sessionListeners = new Set<() => void>();
export const MOBILE_REQUEST_TIMEOUT_MS = 8_000;
const DEVICE_KEY_DATABASE = 'axi.workbench.mobile.device-keys';
const DEVICE_KEY_STORE = 'device-keys';
const DEVICE_KEY_ID = 'current';

const mobilePath = (path: string) => resolveGatewayURL(`/api/v1/mobile${path}`);

function publishSessionChange() {
  sessionListeners.forEach((listener) => listener());
}

function sessionSnapshot(): MobileDeviceSession | null {
  if (!activeSession || activeSession.expiresAt * 1000 <= Date.now()) {
    activeSession = null;
    return null;
  }
  return { deviceId: activeSession.deviceId, expiresAt: activeSession.expiresAt };
}

function withRequestTimeout(callerSignal?: AbortSignal | null) {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = globalThis.setTimeout(() => controller.abort('request_timeout'), MOBILE_REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    dispose() {
      globalThis.clearTimeout(timeout);
      callerSignal?.removeEventListener('abort', abortFromCaller);
    },
  };
}

export function useMobileDeviceSession() {
  return useSyncExternalStore(
    (listener) => {
      sessionListeners.add(listener);
      return () => sessionListeners.delete(listener);
    },
    sessionSnapshot,
    () => null,
  );
}

export function useRestoreMobileDeviceSession() {
  return useQuery({
    queryKey: ['mobile-device-session-restore'],
    queryFn: restoreMobileDeviceSession,
    staleTime: Infinity,
    retry: false,
  });
}

export function useEnsureMobileDeviceSession() {
  const restored = useRestoreMobileDeviceSession();
  return {
    isRestoring: restored.isPending,
    restoreError: restored.error,
    retryRestore: restored.refetch,
  };
}

/** A recoverable startup failure must be visible; silently rendering an unpaired shell is misleading. */
export function mobileDeviceRestoreMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof MobileControlError && error.code === 'device_key_storage_unavailable') {
    return '无法访问本机设备密钥。请使用支持本机安全存储的浏览器后重试。';
  }
  if (error instanceof MobileControlError && error.status === 401) {
    return '此设备配对已失效，需要重新配对。';
  }
  if (error instanceof MobileControlError && error.status === 503) {
    return '设备恢复服务暂时不可用；本机配对信息未被清除，请稍后重试。';
  }
  return '无法恢复已配对设备，请稍后重试。';
}

async function mobileFetch<T>(path: string, init: RequestInit = {}, { requiresDevice = true }: { requiresDevice?: boolean } = {}): Promise<T> {
  const session = sessionSnapshot();
  if (requiresDevice && !session) throw new MobileControlError('device_pairing_required', 401);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (session && activeSession) headers.set('Authorization', `Bearer ${activeSession.accessToken}`);
  const request = withRequestTimeout(init.signal);
  let response: Response;
  try {
    response = await fetch(mobilePath(path), { ...init, headers, signal: request.signal, credentials: 'include' });
  } catch {
    throw new MobileControlError('service_unavailable', 503);
  } finally {
    request.dispose();
  }
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    if (response.status === 401) {
      activeSession = null;
      publishSessionChange();
    }
    throw new MobileControlError(String(payload.error || `request_failed_${response.status}`), response.status);
  }
  return payload as T;
}

function bytesToHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (part) => part.toString(16).padStart(2, '0')).join('');
}

function deviceKeyStorageUnavailable(): MobileControlError {
  return new MobileControlError('device_key_storage_unavailable', 503);
}

function openDeviceKeyDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(deviceKeyStorageUnavailable());
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEVICE_KEY_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DEVICE_KEY_STORE)) request.result.createObjectStore(DEVICE_KEY_STORE);
    };
    request.onerror = () => reject(deviceKeyStorageUnavailable());
    request.onsuccess = () => resolve(request.result);
  });
}

async function useDeviceKeyStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDeviceKeyDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(DEVICE_KEY_STORE, mode);
      const request = operation(transaction.objectStore(DEVICE_KEY_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(deviceKeyStorageUnavailable());
      transaction.onabort = () => reject(deviceKeyStorageUnavailable());
    });
  } finally {
    database.close();
  }
}

const indexedDbDeviceKeyStore: DeviceKeyStore = {
  async read() {
    const value = await useDeviceKeyStore<unknown>('readonly', (store) => store.get(DEVICE_KEY_ID));
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<PersistedDeviceKey>;
    if (typeof record.deviceId !== 'string' || typeof record.publicKeyHex !== 'string' || !record.privateKey || record.privateKey.type !== 'private' || record.privateKey.extractable) {
      return null;
    }
    return { deviceId: record.deviceId, publicKeyHex: record.publicKeyHex, privateKey: record.privateKey };
  },
  async write(record) {
    await useDeviceKeyStore<IDBValidKey>('readwrite', (store) => store.put(record, DEVICE_KEY_ID));
  },
  async remove() {
    await useDeviceKeyStore<undefined>('readwrite', (store) => store.delete(DEVICE_KEY_ID));
  },
};

let deviceKeyStore: DeviceKeyStore = indexedDbDeviceKeyStore;

/** Test seam; production always keeps the private CryptoKey in IndexedDB. */
export function setMobileDeviceKeyStoreForTest(store: DeviceKeyStore): () => void {
  const previous = deviceKeyStore;
  deviceKeyStore = store;
  return () => { deviceKeyStore = previous; };
}

async function generateDeviceKeyPair(): Promise<{ privateKey: CryptoKey; publicKeyHex: string }> {
  if (!globalThis.crypto?.subtle) throw new MobileControlError('device_key_algorithm_unavailable', 503);
  try {
    const keyPair = await globalThis.crypto.subtle.generateKey(
      { name: 'Ed25519' } as AlgorithmIdentifier,
      false,
      ['sign', 'verify'],
    ) as CryptoKeyPair;
    const publicKey = await globalThis.crypto.subtle.exportKey('raw', keyPair.publicKey);
    return { privateKey: keyPair.privateKey, publicKeyHex: bytesToHex(publicKey) };
  } catch {
    throw new MobileControlError('device_key_algorithm_unavailable', 503);
  }
}

async function signNonce(privateKey: CryptoKey, nonce: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new MobileControlError('device_key_algorithm_unavailable', 503);
  try {
    const signature = await globalThis.crypto.subtle.sign(
      { name: 'Ed25519' } as AlgorithmIdentifier,
      privateKey,
      new TextEncoder().encode(nonce),
    );
    return bytesToHex(signature);
  } catch {
    throw new MobileControlError('device_key_algorithm_unavailable', 503);
  }
}

async function requestOwnerPairApproval(pairingId: string, code: string): Promise<string> {
  const request = withRequestTimeout();
  try {
    const response = await fetch(resolveGatewayURL('/api/v1/control-plane/mobile/pair-approval'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingId, code: code.trim() }),
      signal: request.signal,
    });
    const payload = await response.json().catch(() => ({})) as { ownerApprovalToken?: string; error?: string };
    if (!response.ok || !payload.ownerApprovalToken) {
      throw new MobileControlError(String(payload.error || `pairing_approval_failed_${response.status}`), response.status);
    }
    return payload.ownerApprovalToken;
  } catch (error) {
    if (error instanceof MobileControlError) throw error;
    throw new MobileControlError('service_unavailable', 503);
  } finally {
    request.dispose();
  }
}

/** Starts pairing; the non-extractable Ed25519 private key is persisted only after owner confirmation. */
export async function startMobileDevicePairing(deviceName = 'Axi Workbench Mobile'): Promise<{ pairingId: string; expiresAt: number | null }> {
  const keyPair = await generateDeviceKeyPair();
  const response = await mobileFetch<{ pairingId: string; codeExpiresAt?: number }>('/pair/start', {
    method: 'POST',
    body: JSON.stringify({ publicKeyHex: keyPair.publicKeyHex, deviceName, clientInfo: { surface: 'workbench-mobile' } }),
  }, { requiresDevice: false });
  pendingPairing = { ...keyPair, pairingId: response.pairingId, expiresAt: response.codeExpiresAt ?? null };
  return { pairingId: response.pairingId, expiresAt: response.codeExpiresAt ?? null };
}

async function exchangeDeviceNonce(device: PersistedDeviceKey): Promise<ActiveSession> {
  const nonce = await mobileFetch<{ nonceId: string; nonce: string }>('/auth/nonce', {
    method: 'POST',
    body: JSON.stringify({ deviceId: device.deviceId }),
  }, { requiresDevice: false });
  const signatureHex = await signNonce(device.privateKey, nonce.nonce);
  const token = await mobileFetch<{ accessToken: string; expiresAt: number }>('/auth/token', {
    method: 'POST',
    body: JSON.stringify({ deviceId: device.deviceId, nonceId: nonce.nonceId, nonce: nonce.nonce, signatureHex }),
  }, { requiresDevice: false });
  return { deviceId: device.deviceId, accessToken: token.accessToken, expiresAt: token.expiresAt };
}

/** Restores a paired device by signing a fresh server nonce; no access token is persisted. */
export async function restoreMobileDeviceSession(): Promise<MobileDeviceSession | null> {
  if (sessionSnapshot()) return sessionSnapshot();
  let device: PersistedDeviceKey | null;
  try {
    device = await deviceKeyStore.read();
  } catch (error) {
    if (error instanceof MobileControlError) throw error;
    throw deviceKeyStorageUnavailable();
  }
  if (!device) return null;
  try {
    activeSession = await exchangeDeviceNonce(device);
    publishSessionChange();
    return sessionSnapshot();
  } catch (error) {
    if (error instanceof MobileControlError && error.status === 401) {
      await deviceKeyStore.remove().catch(() => undefined);
    }
    activeSession = null;
    publishSessionChange();
    throw error;
  }
}

/** Completes pairing after the authenticated owner session approves the code. */
export async function confirmMobileDevicePairing(code: string): Promise<MobileDeviceSession> {
  if (!pendingPairing) throw new MobileControlError('pairing_not_started');
  const ownerApprovalToken = await requestOwnerPairApproval(pendingPairing.pairingId, code);
  const confirmed = await mobileFetch<{ deviceId: string; nonce: { nonceId: string; nonce: string } }>('/pair/confirm', {
    method: 'POST',
    body: JSON.stringify({ pairingId: pendingPairing.pairingId, code: code.trim(), ownerApprovalToken }),
  }, { requiresDevice: false });
  const device = { deviceId: confirmed.deviceId, privateKey: pendingPairing.privateKey, publicKeyHex: pendingPairing.publicKeyHex };
  try {
    await deviceKeyStore.write(device);
  } catch (error) {
    if (error instanceof MobileControlError) throw error;
    throw deviceKeyStorageUnavailable();
  }
  try {
    activeSession = await exchangeDeviceNonce(device);
    pendingPairing = null;
    publishSessionChange();
    return sessionSnapshot()!;
  } catch (error) {
    await deviceKeyStore.remove().catch(() => undefined);
    throw error;
  }
}

export async function clearMobileDeviceSession() {
  activeSession = null;
  pendingPairing = null;
  await deviceKeyStore.remove().catch(() => undefined);
  publishSessionChange();
}

export function useMobileWorkspaceQuery() {
  const session = useMobileDeviceSession();
  return useQuery({
    queryKey: ['mobile-workspace', session?.deviceId ?? 'unpaired'],
    queryFn: () => mobileFetch<MobileWorkspaceSnapshot>('/workspace'),
    enabled: Boolean(session),
    retry: false,
    staleTime: 20_000,
  });
}

export async function runMobileProjectAction(action: Pick<MobileProjectAction, 'actionId' | 'actionType'> & { projectId: string }) {
  return mobileFetch('/jobs', {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), projectId: action.projectId, actionId: action.actionId, actionType: action.actionType }),
  });
}

export async function resolveMobileApprovalScan(scanToken: string): Promise<ApprovalScanPreview> {
  return mobileFetch<ApprovalScanPreview>('/approval-scans/resolve', {
    method: 'POST',
    body: JSON.stringify({ scanToken }),
  });
}

export async function decideMobileApprovalScan(scanId: string, decision: ApprovalScanPreview['availableDecisions'][number], handoffCorrelationId: string) {
  return mobileFetch(`/approval-scans/${encodeURIComponent(scanId)}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, idempotencyKey: crypto.randomUUID(), handoffCorrelationId }),
  });
}

/** Confirms a browser-owned login QR with the current paired-device bearer. */
export async function approveMobileWebLoginQr(payload: MobileWebLoginQrPayload) {
  return mobileFetch<{ ok: true; status: 'approved' }>('/web-login/qr/scan', {
    method: 'POST',
    body: JSON.stringify({ webLoginId: payload.webLoginId, scanToken: payload.scanToken }),
  });
}

export function useInvalidateMobileWorkspace() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['mobile-workspace'] });
}
