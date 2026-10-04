import type { ConsoleDescriptor, ConsoleCatalog } from '@axi/workstation-contracts';

export type WorkbenchEnvironmentId = string;

type EnvironmentWindow = Window & {
  __AXI_WORKBENCH_ENVIRONMENT__?: string;
  __APP_CONFIG__?: { environment?: string };
};

export function getWorkbenchEnvironment(): WorkbenchEnvironmentId {
  if (typeof window !== 'undefined') {
    const runtime = window as EnvironmentWindow;
    const configured = runtime.__AXI_WORKBENCH_ENVIRONMENT__ || runtime.__APP_CONFIG__?.environment;
    if (configured?.trim()) return configured.trim();
    try {
      const stored = window.localStorage.getItem('axi.workbench.environment');
      if (stored?.trim()) return stored.trim();
    } catch {
      // Storage-disabled browsers use the build-time/default environment.
    }
  }
  return String(import.meta.env.VITE_AXI_WORKBENCH_ENVIRONMENT || 'dev').trim() || 'dev';
}

export function subscribeWorkbenchEnvironment(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => listener();
  window.addEventListener('axi:environment-changed', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('axi:environment-changed', handler);
    window.removeEventListener('storage', handler);
  };
}

export function getVisibleConsoles(catalog: ConsoleCatalog | undefined, role: string): ConsoleDescriptor[] {
  return (catalog?.consoles ?? [])
    .filter((entry) => entry.visibility !== 'hidden')
    .filter((entry) => entry.visibility !== 'admin' || role === 'admin')
    .filter((entry) => entry.surface === 'hosted-app')
    .sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
}

export function resolveConsoleUrl(entry: ConsoleDescriptor, environment: WorkbenchEnvironmentId): string | null {
  const configured = entry.environments[environment]?.url?.trim();
  if (!configured) return null;
  if (/^https?:\/\//iu.test(configured)) return configured;
  if (typeof window === 'undefined') return configured;
  return new URL(configured, window.location.origin).toString();
}

export function consoleSearchText(entry: ConsoleDescriptor): string {
  return [entry.id, entry.title, entry.description, entry.owner, ...entry.capabilities]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('zh-CN');
}
