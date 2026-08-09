import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme as antdTheme } from 'antd';
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
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/admin/Dashboard';
import Workspace from './pages/admin/Workspace';
import Team from './pages/admin/Team';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import MenuList from './pages/admin/MenuList';
import UserList from './pages/admin/UserList';
import RoleList from './pages/admin/RoleList';
import Scan from './pages/admin/Scan';
import Handoff from './pages/admin/Handoff';
import Search from './pages/admin/Search';
import AccountInfo from './pages/admin/me/AccountInfo';
import Devices from './pages/admin/me/Devices';
import Notifications from './pages/admin/me/Notifications';
import Theme from './pages/admin/me/Theme';
import MeSettings from './pages/admin/me/Settings';
import AuthCallback from './pages/AuthCallback';
import RequireSession from './components/Auth/RequireSession';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const WorkbenchSurface: React.FC = () => {
  const { mode, preset } = useAxiTheme();
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
      locale="zh-CN"
    >
      <ConfigProvider locale={zhCN} theme={antdThemeConfig}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <I18nProvider>
              <BrowserRouter>
                <Routes>
                  {/* Web 与移动端拥有独立 UI；登录协议统一通过 Axi Identity OIDC。 */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />

                  {/* Web 管理端专属壳：Axi Dashboard Chrome。 */}
                  <Route path="/" element={<RequireSession><MainLayout /></RequireSession>}>
                    <Route index element={<Navigate to="admin/dashboard" replace />} />
                    <Route path="admin/dashboard" element={<Dashboard />} />
                    <Route path="admin/project" element={<Projects />} />
                    <Route path="admin/project/:id" element={<ProjectDetail />} />
                    <Route path="admin/task" element={<Workspace />} />
                    <Route path="admin/team" element={<Team />} />
                    {/* 扫一扫：壳内 Tab，选中态保留在底栏 */}
                    <Route path="admin/scan" element={<Scan />} />
                    <Route path="admin/handoff/:id" element={<Handoff />} />
                    {/* 全局联想搜索二级页 */}
                    <Route path="admin/search" element={<Search />} />
                    {/* 我的：入口 + 二级页 */}
                    <Route path="admin/me" element={<UserList />} />
                    <Route path="admin/me/account" element={<AccountInfo />} />
                    <Route path="admin/me/devices" element={<Devices />} />
                    <Route path="admin/me/notifications" element={<Notifications />} />
                    <Route path="admin/me/theme" element={<Theme />} />
                    <Route path="admin/me/settings" element={<MeSettings />} />
                    <Route path="admin/settings/menu" element={<MenuList />} />
                    <Route path="admin/settings/user" element={<Navigate to="/admin/me" replace />} />
                    <Route path="admin/settings/role" element={<RoleList />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </I18nProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ConfigProvider>
    </AxiLocaleProvider>
  );
};

const App: React.FC = () => (
  <AxiThemeProvider
    defaultPreference="dark"
    defaultPresetName="default"
    storageNamespace="axi.workbench"
  >
    <WorkbenchSurface />
  </AxiThemeProvider>
);

export default App;
