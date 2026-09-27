import {
  SHELL_EVENTS,
  type LocalRuntimeStatus,
} from '@axi/workbench-foundation/shell-contracts';
import { isTauriShell, listenShell } from './shell';

export type { LocalRuntimeStatus } from '@axi/workbench-foundation/shell-contracts';

type LocalRuntimeTauriInternals = {
  invoke: <T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>;
};

export const LOCAL_RUNTIME_ORIGIN = 'https://workbench.axiomaticworld.com:8443';

export const LOCAL_RUNTIME_STARTING: LocalRuntimeStatus = {
  mode: 'local-project',
  phase: 'starting',
  services: {
    'control-plane': 'starting',
    'identity-adapter': 'starting',
    'platform-core': 'starting',
    'api-gateway': 'starting',
    'local-https': 'starting',
  },
  gatewayOrigin: LOCAL_RUNTIME_ORIGIN,
};

export function isLocalRuntimeBlocked(
  required: boolean,
  resolved: boolean,
  status: LocalRuntimeStatus | null,
): boolean {
  return required && (!resolved || status?.phase !== 'ready');
}

function getTauri() {
  if (typeof window === 'undefined') return undefined;
  return window.__TAURI_INTERNALS__ as unknown as LocalRuntimeTauriInternals | undefined;
}

export async function getLocalRuntimeStatus(): Promise<LocalRuntimeStatus | null> {
  const tauri = getTauri();
  if (!tauri) return null;
  try {
    return await tauri.invoke<LocalRuntimeStatus | null>('local_runtime_status');
  } catch {
    return {
      ...LOCAL_RUNTIME_STARTING,
      phase: 'failed',
      error: '无法读取本机服务启动状态',
    };
  }
}

export async function retryLocalRuntime(): Promise<void> {
  const tauri = getTauri();
  if (!tauri) return;
  await tauri.invoke('retry_local_runtime');
}

export async function listenLocalRuntimeStatus(
  handler: (status: LocalRuntimeStatus) => void,
): Promise<() => void> {
  if (!isTauriShell()) return () => undefined;
  return listenShell(SHELL_EVENTS.LOCAL_RUNTIME_STATUS, handler);
}
