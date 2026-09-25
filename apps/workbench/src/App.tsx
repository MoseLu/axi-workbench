import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme as antdTheme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import {
  AxiLocaleProvider,
  AxiThemeProvider,
  createAxiAntdTheme,
  useAxiTheme,
} from '@axi/core';
import { AxiExceptionPage, axiCrudLocaleContribution } from '@axi/crud';
import { axiSettingsLocaleContribution } from '@axi/settings';
import { axiShellLocaleContribution } from '@axi/shell';
import { WorkbenchLocaleProvider, useWorkbenchLocale } from '@axi/workbench-foundation';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/admin/Dashboard';
import AuthCallback from './pages/AuthCallback';
import LegalDocument from './pages/LegalDocument';
import { PersonalOsToday, PersonalOsWorkbench } from './pages/personal-os/PersonalOs';
import CommitLedgerPage from './pages/commit-ledger/CommitLedgerPage';
import MenuList from './pages/admin/MenuList';
import RoleList from './pages/admin/RoleList';
import Handoff from './pages/admin/Handoff';
import HandoffCreate from './pages/admin/HandoffCreate';
import Operations from './pages/admin/Operations';
import EpsAudit from './pages/admin/EpsAudit';
import Observability from './pages/admin/Observability';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Team from './pages/admin/Team';
import SearchPage from './pages/admin/Search';
import Devices from './pages/admin/me/Devices';
import NotificationsPage from './pages/admin/me/Notifications';
import ThemePage from './pages/admin/me/Theme';
import Workspace from './pages/admin/Workspace';
import CommandCenter from './pages/CommandCenter';
import RequireSession from './components/Auth/RequireSession';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './i18n';
import { getShellWindowLabel, isTauriShell, listenShell } from './lib/shell';
import { SHELL_EVENTS } from '@axi/workbench-foundation/shell-contracts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

/** 非 AXI UI 页面不再进入第二套页面体系，统一按 404 处理。 */
const AxiUiContractNotFound: React.FC = () => (
  <AxiExceptionPage
    className="workbench-axi-contract-not-found"
    status="404"
    subTitle="该页面尚未通过 AXI UI 页面契约审核。"
    title="页面暂不可用"
  />
);

const WorkbenchSurface: React.FC = () => {
  const { mode, preset } = useAxiTheme();
  const { locale } = useWorkbenchLocale();
  React.useEffect(() => {
    if (!isTauriShell() || typeof document === 'undefined') return undefined;
    document.body.classList.add('axi-tauri-shell');
    return () => document.body.classList.remove('axi-tauri-shell');
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
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <BrowserRouter>
              <ShellSessionBridge />
              <Routes>
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
                    <Route path="admin/settings/user" element={<Navigate to="/admin/me" replace />} />
                    <Route path="admin/settings/role" element={<RoleList />} />
                  </Route>

                  <Route path="*" element={<AxiUiContractNotFound />} />
              </Routes>
            </BrowserRouter>
          </I18nProvider>
        </QueryClientProvider>
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

    let cancelled = false;
    let unsubscribe: () => void = () => undefined;
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

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigate, refreshSession]);

  return null;
};

const App: React.FC = () => (
  <AxiThemeProvider
    defaultPreference="dark"
    defaultStylePreset="black-gold"
    storageNamespace="axi.workbench"
  >
    <AuthProvider>
      <WorkbenchLocaleProvider>
        <WorkbenchSurface />
      </WorkbenchLocaleProvider>
    </AuthProvider>
  </AxiThemeProvider>
);

export default App;
