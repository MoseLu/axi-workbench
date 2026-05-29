import type { ScaffoldConfig } from '@axi/scaffold-kit';
import { serializeJson } from '@axi/scaffold-kit';

export function createWebPackageJson(config: ScaffoldConfig): string {
  return serializeJson({
    dependencies: {
      '@axi/core': '^0.2.1',
      '@axi/shell': '^0.1.0',
      '@axi/tokens': '^0.2.0',
      [config.tokensPackageName]: 'workspace:*',
      antd: '^6.4.3',
      react: '^19.2.4',
      'react-dom': '^19.2.4',
      zod: '^4.3.6',
    },
    devDependencies: {
      '@eslint/js': '^9.0.0',
      '@testing-library/jest-dom': '^6.9.1',
      '@testing-library/react': '^16.3.2',
      '@types/node': '^25.5.0',
      '@types/react': '^19.2.14',
      '@types/react-dom': '^19.2.3',
      '@vitejs/plugin-react': '^6.0.1',
      '@vitest/coverage-v8': '^4.1.2',
      eslint: '^9.0.0',
      'eslint-plugin-react-hooks': '^7.0.1',
      'eslint-plugin-react-refresh': '^0.5.2',
      globals: '^17.4.0',
      jsdom: '^29.0.1',
      sass: '^1.98.0',
      typescript: '^6.0.2',
      'typescript-eslint': '^8.58.0',
      vite: '^8.0.3',
      vitest: '^4.1.2',
    },
    name: config.webPackageName,
    private: true,
    scripts: {
      build: 'tsc --noEmit && vite build',
      coverage: 'vitest run --coverage',
      dev: 'vite',
      lint: 'eslint .',
      preview: 'vite preview',
      test: 'vitest run',
    },
    type: 'module',
    version: '0.1.0',
  });
}

export function createWebTsConfig(): string {
  return serializeJson({
    compilerOptions: {
      allowSyntheticDefaultImports: true,
      baseUrl: '.',
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      ignoreDeprecations: '6.0',
      isolatedModules: true,
      jsx: 'react-jsx',
      lib: ['DOM', 'DOM.Iterable', 'ES2022'],
      module: 'ESNext',
      moduleResolution: 'Bundler',
      noEmit: true,
      paths: {
        '@/*': ['./src/*'],
      },
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: true,
      target: 'ES2022',
      types: ['node', 'vite/client', 'vitest/globals', '@testing-library/jest-dom'],
      useDefineForClassFields: true,
    },
    include: ['src', 'vite.config.ts', 'eslint.config.js'],
  });
}

export function createWebViteConfig(): string {
  return `import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const hostedBase = process.env.AXI_APP_BASE || process.env.VITE_AXI_APP_BASE || '/';

export default defineConfig({
  base: hostedBase,
  build: {
    chunkSizeWarningLimit: 1024,
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [path.resolve(rootDir, '../../packages/tokens/dist/scss')],
      },
    },
  },
  plugins: [react()],
  publicDir: path.resolve(rootDir, '../../resources/public/web'),
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
`;
}

export function createWebEslintConfig(): string {
  return `import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['coverage', 'dist'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
`;
}

export function createWebIndexHtml(config: ScaffoldConfig): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/brand/axi-trident-icon.svg" />
    <title>${config.projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
`;
}

export function createWebMain(config: ScaffoldConfig): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';

import '@axi/tokens/css';
import '@axi/core/styles.css';
import '@axi/shell/styles.css';
import '${config.tokensPackageName}/css';

import App from './App';
import '@/shared/theme/theme.css';
import './styles/global.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;
}

export function createWebApp(config: ScaffoldConfig): string {
  return `import { useState } from 'react';
import {
  AxiHostedAppProvider,
  AxiLogoMark,
  AxiThemeProvider,
  createAxiHostedAppContext,
  useAxiTheme,
} from '@axi/core';
import { AxiDashboardShell, type AxiDashboardNavGroup } from '@axi/shell';
import { HomePage } from '@/features/home/components/HomePage';

const hostedApp = createAxiHostedAppContext(import.meta.env);

const navGroups: AxiDashboardNavGroup[] = [
  {
    key: 'workspace',
    label: '工作台',
    iconName: 'workbench',
    children: [
      { key: '/overview', label: '总览', iconName: 'component' },
    ],
  },
  {
    key: 'governance',
    label: '项目治理',
    iconName: 'auth',
    children: [
      { key: '/quality', label: '质量门禁', iconName: 'stats' },
      { key: '/settings', label: '项目设置', iconName: 'theme' },
    ],
  },
];

function AppConsole() {
  const [activeRoute, setActiveRoute] = useState('/overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const [query, setQuery] = useState('');
  const { toggleMode } = useAxiTheme();
  const activeLabel = activeRoute === '/overview' ? '总览' : activeRoute === '/quality' ? '质量门禁' : '项目设置';

  return (
    <AxiDashboardShell
      activeNavKey={activeRoute}
      activeTabKey={activeRoute}
      avatarConfig={{
        avatar: <span>AX</span>,
        description: 'project@axi.local',
        label: '管理员',
        menuItems: [
          { key: 'profile', label: '个人中心', iconName: 'my' },
          { key: 'logout', label: '退出登录', iconName: 'exit' },
        ],
        name: '管理员',
      }}
      brand={{ logo: <AxiLogoMark />, title: '${config.projectName}', subtitle: 'Axi Dashboard' }}
      breadcrumbLabel="页面位置"
      breadcrumbs={[
        { key: 'workspace', title: '工作台' },
        { key: activeRoute, title: activeLabel, current: true },
      ]}
      contentFullscreen={contentFullscreen}
      globalSearchLabel="搜索"
      globalSearchShortcut="⌘ K"
      navGroups={navGroups}
      onBack={() => window.history.back()}
      onFullscreenToggle={() => setContentFullscreen((current) => !current)}
      onHome={() => setActiveRoute('/overview')}
      onNavSelect={(key) => setActiveRoute(key)}
      onReload={() => window.location.reload()}
      onSidebarSearchChange={setQuery}
      onSidebarToggle={() => setSidebarCollapsed((current) => !current)}
      onTabMenu={() => setActiveRoute('/settings')}
      onTabSelect={setActiveRoute}
      pageProps={{ fluid: true }}
      sidebarCollapsed={sidebarCollapsed}
      sidebarSearchValue={query}
      tabs={[{ key: activeRoute, label: activeLabel, pinned: activeRoute === '/overview' }]}
      topbarActions={{
        github: { href: 'https://github.com', iconName: 'github', key: 'github', label: 'GitHub', target: '_blank' },
        notice: { iconName: 'notice', key: 'notice', label: '通知' },
        message: { iconName: 'msg', key: 'message', label: '消息' },
        language: { iconName: 'lang', key: 'language', label: '语言' },
        theme: { iconName: 'theme', key: 'theme', label: '切换主题', onClick: (event) => toggleMode(event.currentTarget) },
        settings: { iconName: 'theme', key: 'settings', label: '设置', onClick: () => setActiveRoute('/settings') },
      }}
    >
      <HomePage />
    </AxiDashboardShell>
  );
}

export default function App() {
  return (
    <AxiThemeProvider defaultPreference="dark" storageNamespace="${config.projectName}">
      <AxiHostedAppProvider value={hostedApp}>
        <AppConsole />
      </AxiHostedAppProvider>
    </AxiThemeProvider>
  );
}
`;
}

export function createAxiAppManifest(config: ScaffoldConfig): string {
  return `export default {
  appId: '${config.packageSlug}',
  title: '${config.projectName}',
  icon: 'workbench',
  defaultRoute: '/overview',
  healthPath: '/',
  routes: ['/overview', '/quality', '/settings'],
  menuGroups: [
    {
      key: 'workspace',
      label: '工作台',
      icon: 'workbench',
      children: [
        { key: 'overview', label: '总览', icon: 'component', route: '/overview' },
      ],
    },
    {
      key: 'governance',
      label: '项目治理',
      icon: 'auth',
      children: [
        { key: 'quality', label: '质量门禁', icon: 'stats', route: '/quality' },
        { key: 'settings', label: '项目设置', icon: 'theme', route: '/settings' },
      ],
    },
  ],
  capabilities: ['web', 'tool', 'dashboard-hosted'],
  hostedMode: true,
  nativeFallback: false,
};
`;
}

export function createAxiDashboardAppConfig(config: ScaffoldConfig): string {
  return serializeJson({
    appId: config.packageSlug,
    title: config.projectName,
    icon: 'workbench',
    cwd: `\${workspaceRoot}/projects/${config.packageSlug}`,
    startCommand: `\${workspaceRoot}/scripts/run-node22-command.sh pnpm --filter ${config.tokensPackageName} build && \${workspaceRoot}/scripts/run-node22-command.sh pnpm --filter ${config.webPackageName} dev -- --host 127.0.0.1 --port \${port} --strictPort`,
    packageManager: 'pnpm',
    defaultRoute: '/overview',
    healthPath: '/',
    routes: ['/overview', '/quality', '/settings'],
    menuGroups: [
      {
        key: 'workspace',
        label: '工作台',
        icon: 'workbench',
        children: [
          { key: 'overview', label: '总览', icon: 'component', route: '/overview' },
        ],
      },
      {
        key: 'governance',
        label: '项目治理',
        icon: 'auth',
        children: [
          { key: 'quality', label: '质量门禁', icon: 'stats', route: '/quality' },
          { key: 'settings', label: '项目设置', icon: 'theme', route: '/settings' },
        ],
      },
    ],
    capabilities: ['web', 'tool', 'dashboard-hosted'],
    hostedMode: true,
    nativeFallback: false,
  });
}

export function createGlobalStyles(config: ScaffoldConfig): string {
  return `@use 'tokens' as tokens;

:root {
  color: var(--color-text-primary);
  background:
    radial-gradient(circle at top left, var(--color-surface-spotlight), transparent 45%),
    linear-gradient(160deg, var(--color-surface-page), var(--color-surface-backdrop));
  font-family: var(--font-family-sans);
  font-size: var(--font-size-body-md);
  line-height: var(--font-line-height-relaxed);
  transition:
    background var(--motion-duration-slow) var(--motion-easing-emphasized),
    color var(--motion-duration-fast) var(--motion-easing-standard);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}

button,
input {
  font: inherit;
}

button {
  transition:
    transform var(--motion-duration-fast) var(--motion-easing-standard),
    box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
    background-color var(--motion-duration-fast) var(--motion-easing-standard),
    border-color var(--motion-duration-fast) var(--motion-easing-standard);
}

button:active {
  transform:
    translateY(var(--interaction-active-translate-y))
    scale(var(--interaction-active-scale));
}

button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: var(--interaction-disabled-opacity);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.home-shell {
  display: grid;
  gap: tokens.$space-4;
  margin: 0 auto;
  max-width: tokens.$layout-container-page-max;
  padding: var(--space-4);
}

.home-dashboard-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 28rem);
  gap: tokens.$space-4;
  align-items: end;
  padding-bottom: var(--space-3);
  border-bottom: var(--border-width-default) solid var(--color-border-subtle);
}

.home-brand-copy {
  display: grid;
  gap: var(--space-2);
}

.home-eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-body-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.home-title {
  font-family: var(--font-family-display);
  font-size: var(--font-size-heading-xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--font-letter-spacing-display);
  line-height: var(--font-line-height-tight);
  margin: 0;
}

.home-subtitle {
  color: var(--color-text-muted);
  font-size: var(--font-size-body-md);
  margin: 0;
  max-width: var(--layout-measure-reading);
}

.home-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.home-toolbar input {
  border: var(--border-width-default) solid var(--color-border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  min-width: 16rem;
  background: var(--color-surface-input);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-field);
  transition:
    border-color var(--motion-duration-fast) var(--motion-easing-standard),
    box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
    background-color var(--motion-duration-fast) var(--motion-easing-standard);
}

.home-toolbar input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 var(--border-width-focus) var(--color-focus-ring);
}

.home-toolbar button {
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-5);
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  cursor: pointer;
  box-shadow: var(--shadow-button);
}

.home-toolbar button:hover {
  transform: translateY(var(--interaction-hover-lift));
  box-shadow: var(--shadow-button-hover);
}

.home-status {
  color: var(--color-text-muted);
  font-size: var(--font-size-body-sm);
  margin: 0;
}

.home-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(var(--layout-grid-card-min), 1fr));
}

.home-card {
  border: var(--border-width-default) solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  background: var(--color-surface-panel);
  box-shadow: var(--shadow-card);
  backdrop-filter: var(--effect-surface-backdrop);
  transition:
    transform var(--motion-duration-fast) var(--motion-easing-standard),
    box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
    border-color var(--motion-duration-fast) var(--motion-easing-standard);
}

.home-card:hover {
  transform: translateY(var(--interaction-hover-card-lift));
  box-shadow: var(--shadow-card-hover);
  border-color: var(--color-border-strong);
}

.home-card h2 {
  font-size: var(--font-size-heading-sm);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--space-2);
}

.home-card p {
  color: var(--color-text-muted);
  margin: 0 0 var(--space-3);
}

.home-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.home-tags span,
.quality-list li {
  border-radius: 999px;
  background: var(--color-surface-tag);
  color: var(--color-accent-primary);
  display: inline-block;
  padding: var(--space-1) var(--space-3);
}

.quality-panel {
  display: grid;
  gap: var(--space-3);
  border: var(--border-width-default) solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-card);
  backdrop-filter: var(--effect-surface-backdrop);
}

.quality-list {
  display: grid;
  gap: var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0;
}

.theme-panel {
  display: grid;
  gap: var(--space-4);
  border: var(--border-width-default) solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-card);
  backdrop-filter: var(--effect-surface-backdrop);
}

.theme-panel h2,
.theme-panel p {
  margin: 0;
}

.theme-panel p {
  color: var(--color-text-muted);
}

.theme-control-group {
  display: grid;
  gap: var(--space-2);
}

.theme-control-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.theme-pill {
  border: var(--border-width-default) solid var(--color-border-default);
  border-radius: 999px;
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface-panel);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-field);
}

.theme-pill:hover {
  transform: translateY(var(--interaction-hover-lift));
}

.theme-pill[data-active='true'] {
  border-color: var(--color-border-focus);
  background: var(--color-surface-tag);
  color: var(--color-accent-primary);
}

@media (max-width: 720px) {
  .home-dashboard-header {
    grid-template-columns: 1fr;
  }

  .home-toolbar {
    flex-direction: column;
  }

  .home-toolbar input,
  .home-toolbar button {
    width: 100%;
  }
}
`;
}

export function createUseDisclosure(): string {
  return `import { useState } from 'react';

export function useDisclosure(initialValue = false) {
  const [isOpen, setIsOpen] = useState(initialValue);

  const close = () => setIsOpen(false);
  const open = () => setIsOpen(true);
  const toggle = () => setIsOpen((currentValue) => !currentValue);

  return {
    close,
    isOpen,
    open,
    toggle,
  };
}
`;
}

export function createUseDisclosureTest(): string {
  return `import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDisclosure } from '@/shared/hooks/useDisclosure';

describe('useDisclosure', () => {
  it('supports open, close, and toggle transitions', () => {
    const { result } = renderHook(() => useDisclosure());

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isOpen).toBe(false);
  });
});
`;
}

export function createHomeSchema(): string {
  return `import { z } from 'zod';

export const homeCardSchema = z.object({
  description: z.string(),
  id: z.string(),
  tags: z.array(z.string()).min(1),
  title: z.string(),
});

export const homeCardsSchema = z.array(homeCardSchema);

export type HomeCard = z.infer<typeof homeCardSchema>;

export function getHomeCards(): HomeCard[] {
  return homeCardsSchema.parse([
    {
      id: 'feature-based',
      title: 'Feature-Based Layout',
      description: 'Frontend and API slices are organized by feature instead of technical layers.',
      tags: ['architecture', 'feature'],
    },
    {
      id: 'hooks-preset',
      title: 'Git Hooks Baseline',
      description: 'Pre-commit and pre-push hooks keep docs, tests, and verification aligned.',
      tags: ['hooks', 'quality'],
    },
    {
      id: 'tokens',
      title: 'Style Dictionary Tokens',
      description: 'Design tokens compile to CSS variables and SCSS variables for future system work.',
      tags: ['design', 'scss'],
    },
  ]);
}
`;
}

export function createUseHomeCards(): string {
  return `import { startTransition, useState } from 'react';

import { getHomeCards } from '../schemas/home.schema';

const allCards = getHomeCards();

export function useHomeCards() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const visibleCards = allCards.filter((card) => {
    if (searchTerm.length === 0) {
      return true;
    }

    return card.tags.some((tag) => tag.includes(searchTerm));
  });

  function updateQuery(value: string) {
    setQuery(value);

    startTransition(() => {
      setSearchTerm(value.trim().toLowerCase());
    });
  }

  return {
    query,
    updateQuery,
    visibleCards,
  };
}
`;
}

export function createHomePage(
  config: ScaffoldConfig,
  options: { includeThemeControls?: boolean } = {},
): string {
  const themeImports = options.includeThemeControls
    ? `import { ThemeSwitcher } from '@/shared/theme/ThemeSwitcher';

`
    : '';

  const themePanel = options.includeThemeControls
    ? `
      <ThemeSwitcher />`
    : '';

  return `import { useDeferredValue } from 'react';

import { useDisclosure } from '@/shared/hooks/useDisclosure';
${themeImports}
import { useHomeCards } from '../hooks/useHomeCards';

const qualityGates = [
  '明暗主题和主题色由 Axi Dashboard 统一接入',
  '前端和 API 按 feature 分层组织',
  '关键脚本、文档和质量门禁随项目生成',
  'PRD/TDD 文档先于实现落位',
  'Git hooks 保护文档、测试、覆盖率和 smoke 检查',
];

export function HomePage() {
  const { isOpen, toggle } = useDisclosure(false);
  const { query, updateQuery, visibleCards } = useHomeCards();
  const deferredQuery = useDeferredValue(query);
  return (
    <main className="home-shell">
      <section className="home-dashboard-header">
        <div className="home-brand-copy">
          <p className="home-eyebrow">${config.projectName}</p>
          <h1 className="home-title">项目总览</h1>
        </div>
        <p className="home-subtitle">
          默认项目结构已经接入 Axi Dashboard 视觉骨架，业务代码从 features 开始扩展。
        </p>
      </section>

      <section className="home-toolbar" aria-label="过滤">
        <label>
          <span className="sr-only">按标签过滤</span>
          <input
            aria-label="按标签过滤"
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="输入 hooks、design 或 feature"
            value={query}
          />
        </label>
        <button onClick={toggle} type="button">
          {isOpen ? '隐藏质量门禁' : '查看质量门禁'}
        </button>
      </section>

      <p className="home-status">
        {deferredQuery
          ? \`正在显示 "\${deferredQuery}" 的匹配项\`
          : '显示全部脚手架默认能力。'}
      </p>

      <section className="home-grid">
        {visibleCards.map((card) => (
          <article className="home-card" key={card.id}>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <div className="home-tags">
              {card.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </article>
        ))}
      </section>
${themePanel}

      {isOpen ? (
        <section className="quality-panel">
          <h2>质量门禁</h2>
          <ul className="quality-list">
            {qualityGates.map((gate) => (
              <li key={gate}>{gate}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
`;
}

export function createWebTestSetup(): string {
  return `import '@testing-library/jest-dom/vitest';

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }),
  });
}
`;
}

export function createThemeStylesStub(): string {
  return `:root {
  color-scheme: light;
}
`;
}

export function createTokensTypeDeclaration(config: ScaffoldConfig): string {
  return `declare module '${config.tokensPackageName}/css';
declare module '@axi/tokens/css';
declare module '@axi/core/styles.css';
declare module '@axi/shell/styles.css';
`;
}

export function createHomePageTest(options: { includeThemeControls?: boolean } = {}): string {
  const themeAssertions = options.includeThemeControls
    ? `
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cyberpunk' }));

    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cyberpunk' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Cyberpunk' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.themeMode).toBe('dark');
    expect(document.documentElement.dataset.themePreset).toBe('cyberpunk');
`
    : '';

  return `import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HomePage } from '@/features/home/components/HomePage';

describe('HomePage', () => {
  it('renders the scaffold defaults and filters cards by tag', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: '项目总览' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('按标签过滤'), {
      target: { value: 'hooks' },
    });

    expect(screen.getByText('Git Hooks Baseline')).toBeInTheDocument();
    expect(screen.queryByText('Style Dictionary Tokens')).not.toBeInTheDocument();
${themeAssertions}

    fireEvent.click(screen.getByRole('button', { name: '查看质量门禁' }));

    expect(screen.getByText('Git hooks 保护文档、测试、覆盖率和 smoke 检查')).toBeInTheDocument();
  });
});
`;
}
