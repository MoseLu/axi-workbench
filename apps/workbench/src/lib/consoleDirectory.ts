// B1 batch 引入 Consoles 页时引用了 @axi/workstation-contracts 的 Console 类型，
// 但该包从未导出这些类型（snapshot schema 也没有 consoleCatalog 字段）。
// 类型暂驻本地：等 workstation-contracts 上线 ConsoleCatalog 后迁回并接入 schema。
export interface ConsoleEnvironmentEntry {
  url?: string;
}

export interface ConsoleDescriptor {
  id: string;
  projectId?: string;
  title: string;
  description?: string;
  owner: string;
  icon: string;
  status: 'active' | 'inactive';
  visibility: 'public' | 'admin' | 'hidden';
  surface: string;
  capabilities: string[];
  environments: Record<string, ConsoleEnvironmentEntry>;
  release?: { version?: string };
  uiContract?: { provider?: string; shell?: string };
}

export interface ConsoleCatalog {
  schemaVersion?: number;
  generatedBy?: string;
  consoles: ConsoleDescriptor[];
}

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
