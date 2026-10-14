import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider, Spin, theme as antdTheme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import {
  AxiLocaleProvider,
  AxiThemeProvider,
  createAxiAntdTheme,
  useAxiTheme,
} from '@axi/core';
import { axiCrudLocaleContribution } from '@axi/crud';
import { axiSettingsLocaleContribution } from '@axi/settings';
import { axiShellLocaleContribution } from '@axi/shell';
import { WorkbenchLocaleProvider, useWorkbenchLocale } from '@axi/workbench-foundation';
import MainLayout from './layouts/MainLayout';
import OfflineBanner from './components/OfflineBanner';
import './styles/not-found.css';
import RequireSession from './components/Auth/RequireSession';
import SessionLoading from './components/Auth/SessionLoading';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './i18n';
import { getShellWindowLabel, isTauriShell, listenShell, showLoginWindow } from './lib/shell';
import { SHELL_EVENTS } from '@axi/workbench-foundation/shell-contracts';

// 路由级代码分割：每个页面只在用户真正访问时下载。
// /login 之前一次性下载了所有 23 个 page + antd 全文 + 7MB 图标数据，
// 现在每个 page 形成独立的 Vite 动态 chunk，首屏只拉 Login + Layout。
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const AuthCallback = React.lazy(() => import('./pages/AuthCallback'));
const LegalDocument = React.lazy(() => import('./pages/LegalDocument'));
const PersonalOsToday = React.lazy(() =>
  import('./pages/personal-os/PersonalOs').then((m) => ({ default: m.PersonalOsToday })),
);
const PersonalOsWorkbench = React.lazy(() =>
  import('./pages/personal-os/PersonalOs').then((m) => ({ default: m.PersonalOsWorkbench })),
);
const Dashboard = React.lazy(() => import('./pages/admin/Dashboard'));
const Operations = React.lazy(() => import('./pages/admin/Operations'));
const EpsAudit = React.lazy(() => import('./pages/admin/EpsAudit'));
const CommitLedgerPage = React.lazy(() => import('./pages/commit-ledger/CommitLedgerPage'));
const Observability = React.lazy(() => import('./pages/admin/Observability'));
const Projects = React.lazy(() => import('./pages/Projects'));
const ProjectDetail = React.lazy(() => import('./pages/ProjectDetail'));
const Team = React.lazy(() => import('./pages/admin/Team'));
const Workspace = React.lazy(() => import('./pages/admin/Workspace'));
const CommandCenter = React.lazy(() => import('./pages/CommandCenter'));
const Handoff = React.lazy(() => import('./pages/admin/Handoff'));
const HandoffCreate = React.lazy(() => import('./pages/admin/HandoffCreate'));
const MenuList = React.lazy(() => import('./pages/admin/MenuList'));
const RoleList = React.lazy(() => import('./pages/admin/RoleList'));
const Devices = React.lazy(() => import('./pages/admin/me/Devices'));
const NotificationsPage = React.lazy(() => import('./pages/admin/me/Notifications'));
const ThemePage = React.lazy(() => import('./pages/admin/me/Theme'));
const SearchPage = React.lazy(() => import('./pages/admin/Search'));

/** 路由级 Suspense 边界：每个 lazy 页面在加载时显示 antd Spin，避免空白闪烁。 */
const RouteSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <React.Suspense
    fallback={
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          width: '100%',
        }}
      >
        <Spin size="large">
          <div style={{ minHeight: 64, minWidth: 240 }} />
        </Spin>
      </div>
    }
  >
    {children}
  </React.Suspense>
);

/**
 * 全局 QueryClient 默认值。
 *
 * 选型依据：
 * - `staleTime: 5min` — 普通读请求 5 分钟内复用缓存，跳过重复网络往返。
 * - `gcTime: 30min` — 缓存保留 30 分钟，避免来回切页面时被踢出。
 *   短于 30 分钟会导致 navigation 之间重新 fetch，明显拖慢体感。
 * - `refetchOnWindowFocus: false` — 用户没要求刷新。Dashboard 类页面
 *   默认按 staleTime 走即可，避免焦点切回 tab 时每个 query 一起抖动。
 *   例外：Notifications.tsx 在 query 上显式开启 refetchOnWindowFocus。
 * - `refetchOnReconnect: true` — 网络从断开恢复时重新拉取，配合
 *   OfflineBanner 让用户看到「刚刚离线 → 数据可能过期」的语义一致体验。
 * - `retry: 3 + retryDelay: exponential backoff` — 1xx 抖动自动重试，
 *   退避上限 30s 防止雪崩。session 查询走 `retry: false` 的本地 override。
 * - `networkMode: 'offlineFirst'` — 命中缓存即返回，offline 时不抛错，
 *   让 OfflineBanner 接管提示；reconnect 后由 refetchOnReconnect 触发回填。
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      networkMode: 'offlineFirst',
    },
  },
});

/** 用户友好的 404：不再把内部工程术语暴露给最终用户，必须有至少 3 个返回操作。 */
const AxiUiContractNotFound: React.FC = () => {
  const navigate = useNavigate();
  const handleHome = React.useCallback(() => navigate('/admin/dashboard', { replace: true }), [navigate]);
  const handleBack = React.useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else navigate('/login', { replace: true });
  }, [navigate]);
  const handleReload = React.useCallback(() => window.location.reload(), []);
  const handleSearch = React.useCallback(() => navigate('/admin/search', { replace: true }), [navigate]);
  return (
    <div className="workbench-not-found" role="alert" aria-live="polite">
      <div className="workbench-not-found__inner">
        <p className="workbench-not-found__code" aria-hidden="true">404</p>
        <h1 className="workbench-not-found__title">找不到您访问的页面</h1>
        <p className="workbench-not-found__subtitle">
          链接可能已过期或地址输入有误。请使用下方按钮继续，或在全局搜索中查找。
        </p>
        <div className="workbench-not-found__actions">
          <button type="button" className="workbench-not-found__btn workbench-not-found__btn--primary" onClick={handleHome}>
            返回工作台首页
          </button>
          <button type="button" className="workbench-not-found__btn" onClick={handleBack}>
            返回上一页
          </button>
          <button type="button" className="workbench-not-found__btn" onClick={handleSearch}>
            全局搜索
          </button>
          <button type="button" className="workbench-not-found__btn workbench-not-found__btn--ghost" onClick={handleReload}>
            重新加载
          </button>
        </div>
      </div>
    </div>
  );
};

/** 主窗启动页：只在 1280×800 主窗显示，登录卡永远留在独立小窗。 */
const DesktopStartupLoading: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const redirectedRef = React.useRef(false);

  React.useEffect(() => {
    if (isLoading || redirectedRef.current) return;
    if (isAuthenticated) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    if (isTauriShell() && getShellWindowLabel() === 'main') {
      redirectedRef.current = true;
      void showLoginWindow();
    } else {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return <SessionLoading />;
};

const WorkbenchSurface: React.FC = () => {
  const { mode, preset } = useAxiTheme();
  const { locale } = useWorkbenchLocale();
  React.useEffect(() => {
    if (!isTauriShell() || typeof document === 'undefined') return undefined;
    // Defer the body-class toggle past first paint. The `axi-tauri-shell`
    // class only adjusts cosmetic chrome for the Tauri desktop window and is
    // irrelevant to LCP / FCP. Doing it inside requestIdleCallback keeps the
    // initial React commit short and avoids touching the DOM during the
    // browser's paint flush.
    const applyClass = () => document.body.classList.add('axi-tauri-shell');
    let cleanup = () => document.body.classList.remove('axi-tauri-shell');
    const idleId =
      typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(() => {
            applyClass();
          })
        : window.setTimeout(applyClass, 0);
    return () => {
      if (
        typeof window !== 'undefined' &&
        typeof window.cancelIdleCallback === 'function' &&
        typeof idleId === 'number'
      ) {
        window.cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId as number);
      }
      cleanup();
    };
  }, []);

  const antdThemeConfig = React.useMemo(
    () => ({
      algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      ...createAxiAntdTheme(mode, preset, { borderRadius: 6 }),
    }),
    [mode, preset],
  );

  return (
    <AxiLocaleProvider
      contributions={[axiShellLocaleContribution, axiSettingsLocaleContribution, axiCrudLocaleContribution]}
      fallbackLocale="zh-CN"
      locale={locale}
    >
      <ConfigProvider locale={locale === 'zh-CN' ? zhCN : enUS} theme={antdThemeConfig}>
        <AntdApp>
        <I18nProvider>
          <BrowserRouter>
            <ShellSessionBridge />
            <OfflineBanner />
            <RouteSuspense>
              <Routes>
                  <Route path="/loading" element={<DesktopStartupLoading />} />
                  {/* Web 与移动端拥有独立 UI；登录协议统一通过 Axi Identity OIDC。 */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/legal/terms" element={<LegalDocument kind="terms" />} />
                  <Route path="/legal/privacy" element={<LegalDocument kind="privacy" />} />

                  {/* Web 管理端专属壳：Axi Dashboard Chrome。 */}
                  <Route path="/" element={<RequireSession><MainLayout /></RequireSession>}>
                    <Route index element={<Navigate to="admin/dashboard" replace />} />
                    <Route path="admin/dashboard" element={<Dashboard />} />
                    <Route path="admin/personal-os/today" element={<PersonalOsToday />} />
                    <Route path="admin/personal-os/workbench" element={<PersonalOsWorkbench />} />
                    <Route path="admin/operations" element={<Operations />} />
                    <Route path="admin/operations/eps" element={<EpsAudit />} />
                    <Route path="admin/operations/commit-ledger" element={<CommitLedgerPage />} />
                    <Route path="admin/operations/observability" element={<Observability />} />
                    <Route path="admin/project" element={<Projects />} />
                    <Route path="admin/project/:id" element={<ProjectDetail />} />
                    <Route path="admin/task" element={<AxiUiContractNotFound />} />
                    <Route path="admin/team" element={<Team />} />
                    <Route path="admin/workspace" element={<Workspace />} />
                    <Route path="admin/command-center" element={<CommandCenter />} />
                    {/* 历史扫码链接不再打开桌面摄像头工具，回到控制中心。 */}
                    <Route path="admin/scan" element={<Navigate to="/admin/dashboard" replace />} />
                    <Route path="admin/handoff" element={<Handoff />} />
                    <Route path="admin/handoff/:id" element={<HandoffCreate />} />
                    {/* 全局联想搜索二级页 */}
                    <Route path="admin/search" element={<SearchPage />} />
                    {/* 我的：入口 + 二级页 */}
                    {/* Cool Admin personal center is the canonical account form. */}
                    <Route path="admin/me" element={<AxiUiContractNotFound />} />
                    {/* Preserve old account bookmarks without a second account page. */}
                    <Route path="admin/me/account" element={<Navigate to="/admin/me" replace />} />
                    <Route path="admin/me/devices" element={<Devices />} />
                    <Route path="admin/me/notifications" element={<NotificationsPage />} />
                    <Route path="admin/me/theme" element={<ThemePage />} />
                    {/* Retired settings table: preserve old bookmarks without rendering a duplicate settings page. */}
                    <Route path="admin/me/settings" element={<Navigate to="/admin/me/theme" replace />} />
                    <Route path="admin/settings/menu" element={<MenuList />} />
                    <Route path="admin/settings/user" element={<Navigate to="/admin/me/theme" replace />} />
                    <Route path="admin/settings/role" element={<RoleList />} />

                    {/* 历史路径别名：保留外部文档/邮件/书签中的旧链接可访问 */}
                    <Route path="projects" element={<Navigate to="/admin/project" replace />} />
                    <Route path="projects/:id" element={<Navigate to="/admin/project/:id" replace />} />
                    <Route path="command-center" element={<Navigate to="/admin/command-center" replace />} />
                    <Route path="personal-os/today" element={<Navigate to="/admin/personal-os/today" replace />} />
                    <Route path="personal-os/workbench" element={<Navigate to="/admin/personal-os/workbench" replace />} />
                    <Route path="admin/eps-audit" element={<Navigate to="/admin/operations/eps" replace />} />
                    <Route path="admin/observability" element={<Navigate to="/admin/operations/observability" replace />} />
                    <Route path="admin/menu-list" element={<Navigate to="/admin/settings/menu" replace />} />
                    <Route path="admin/role-list" element={<Navigate to="/admin/settings/role" replace />} />
                    <Route path="admin/handoff/create" element={<Navigate to="/admin/handoff" replace />} />
                  </Route>

                  <Route path="*" element={<AxiUiContractNotFound />} />
                </Routes>
              </RouteSuspense>
              </BrowserRouter>
            </I18nProvider>
          </AntdApp>
      </ConfigProvider>
    </AxiLocaleProvider>
  );
};

/**
 * 登录窗完成认证后，主窗仍可能停留在它启动时的 /login 路由。
 * 主窗只负责接收成功事件、刷新自己的 HttpOnly 会话并进入工作台。
 */
const ShellSessionBridge: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  React.useEffect(() => {
    if (!isTauriShell() || getShellWindowLabel() !== 'main') return undefined;

    // Defer the Tauri event subscription until first paint settles. The
    // bridge only matters after the login window completes OIDC, which is
    // a multi-second user gesture, not part of the first frame.
    let cancelled = false;
    let unsubscribe: () => void = () => undefined;
    const subscribe = () => {
      void listenShell(SHELL_EVENTS.LOGIN_SUCCESS, () => {
        void refreshSession().then((authenticated) => {
          if (!cancelled && authenticated) {
            navigate('/admin/dashboard', { replace: true });
          }
        });
      }).then((off) => {
        if (cancelled) off();
        else unsubscribe = off;
      });
    };
    const idleId =
      typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(subscribe)
        : window.setTimeout(subscribe, 0);

    return () => {
      cancelled = true;
      if (
        typeof window !== 'undefined' &&
        typeof window.cancelIdleCallback === 'function' &&
        typeof idleId === 'number'
      ) {
        window.cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId as number);
      }
      unsubscribe();
    };
  }, [navigate, refreshSession]);

  return null;
};

/**
 * App-level provider order:
 * - `AxiThemeProvider` (theme tokens, dark/light/style)
 * - `QueryClientProvider` (single client for the whole tree; must wrap
 *   `AuthProvider` because the provider's session probe is a `useQuery`)
 * - `AuthProvider` (uses `useQuery({ staleTime: Infinity })` for the session)
 * - `WorkbenchLocaleProvider` (translations, consumer of `useAuth`)
 * - `WorkbenchSurface` (antd ConfigProvider + Router)
 */
const App: React.FC = () => (
  <AxiThemeProvider
    defaultPreference="dark"
    defaultStylePreset="black-gold"
    storageNamespace="axi.workbench"
  >
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <WorkbenchSurface />
        </WorkbenchLocaleProvider>
      </AuthProvider>
    </QueryClientProvider>
  </AxiThemeProvider>
);

export default App;
