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

export class MobileControlError extends Error {
  constructor(public readonly code: string, public readonly status?: number) {
    super(code);
  }
}

type ActiveSession = MobileDeviceSession & { accessToken: string };
type PendingPairing = { privateKey: CryptoKey; publicKeyHex: string; pairingId: string; expiresAt: number | null };

let activeSession: ActiveSession | null = null;
let pendingPairing: PendingPairing | null = null;
const sessionListeners = new Set<() => void>();
export const MOBILE_REQUEST_TIMEOUT_MS = 8_000;

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

async function generateDeviceKeyPair(): Promise<{ privateKey: CryptoKey; publicKeyHex: string }> {
  if (!globalThis.crypto?.subtle) throw new MobileControlError('device_key_algorithm_unavailable', 503);
  try {
    const keyPair = await globalThis.crypto.subtle.generateKey(
      { name: 'Ed25519' } as AlgorithmIdentifier,
      true,
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

/** Starts pairing and keeps the Ed25519 private key in memory only. */
export async function startMobileDevicePairing(deviceName = 'Axi Workbench Mobile'): Promise<{ pairingId: string; expiresAt: number | null }> {
  const keyPair = await generateDeviceKeyPair();
  const response = await mobileFetch<{ pairingId: string; codeExpiresAt?: number }>('/pair/start', {
    method: 'POST',
    body: JSON.stringify({ publicKeyHex: keyPair.publicKeyHex, deviceName, clientInfo: { surface: 'workbench-mobile' } }),
  }, { requiresDevice: false });
  pendingPairing = { ...keyPair, pairingId: response.pairingId, expiresAt: response.codeExpiresAt ?? null };
  return { pairingId: response.pairingId, expiresAt: response.codeExpiresAt ?? null };
}

/** Completes pairing after the authenticated owner session approves the code. */
export async function confirmMobileDevicePairing(code: string): Promise<MobileDeviceSession> {
  if (!pendingPairing) throw new MobileControlError('pairing_not_started');
  const ownerApprovalToken = await requestOwnerPairApproval(pendingPairing.pairingId, code);
  const confirmed = await mobileFetch<{ deviceId: string; nonce: { nonceId: string; nonce: string } }>('/pair/confirm', {
    method: 'POST',
    body: JSON.stringify({ pairingId: pendingPairing.pairingId, code: code.trim(), ownerApprovalToken }),
  }, { requiresDevice: false });
  const signatureHex = await signNonce(pendingPairing.privateKey, confirmed.nonce.nonce);
  const token = await mobileFetch<{ accessToken: string; expiresAt: number }>('/auth/token', {
    method: 'POST',
    body: JSON.stringify({ deviceId: confirmed.deviceId, nonceId: confirmed.nonce.nonceId, nonce: confirmed.nonce.nonce, signatureHex }),
  }, { requiresDevice: false });
  activeSession = { deviceId: confirmed.deviceId, accessToken: token.accessToken, expiresAt: token.expiresAt };
  pendingPairing = null;
  publishSessionChange();
  return sessionSnapshot()!;
}

export function clearMobileDeviceSession() {
  activeSession = null;
  pendingPairing = null;
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

export function useInvalidateMobileWorkspace() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['mobile-workspace'] });
}
