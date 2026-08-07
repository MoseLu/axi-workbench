import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { IconProvider } from '@epap/ui';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/admin/Dashboard';
import Placeholder from './pages/admin/Placeholder';
import MenuList from './pages/admin/MenuList';
import UserList from './pages/admin/UserList';
import RoleList from './pages/admin/RoleList';
import Scan from './pages/admin/Scan';
import Search from './pages/admin/Search';
import AccountInfo from './pages/admin/me/AccountInfo';
import Devices from './pages/admin/me/Devices';
import Notifications from './pages/admin/me/Notifications';
import Theme from './pages/admin/me/Theme';
import MeSettings from './pages/admin/me/Settings';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './i18n';
import { iconPathMap } from './assets/icons';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const iconResolver = (name: string): string => {
  return (iconPathMap as Record<string, string>)[name] ?? '';
};

/** 旧 /mobile-login 统一并入 /login?mode=qr */
function MobileLoginRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('mode', 'qr');
  return <Navigate to={`/login?${params.toString()}`} replace />;
}

const App: React.FC = () => {
  return (
    <IconProvider resolver={iconResolver}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: 'var(--mpms-primary-color)',
            borderRadius: 6,
            fontSize: 14,
            colorBgContainer: 'var(--mpms-content-elevated)',
            colorBgLayout: 'var(--mpms-layout-bg)',
            colorBgElevated: 'var(--mpms-content-elevated)',
            colorBorder: 'var(--mpms-border-color)',
            colorBorderSecondary: 'var(--mpms-border-color)',
            colorText: 'var(--mpms-text-primary)',
            colorTextSecondary: 'var(--mpms-text-secondary)',
            colorTextTertiary: 'var(--mpms-text-tertiary)',
            colorTextDescription: 'var(--mpms-text-secondary)',
          },
          components: {
            Card: { colorBgContainer: 'var(--mpms-content-elevated)' },
            Table: {
              colorBgContainer: 'var(--mpms-content-elevated)',
              headerBg: 'var(--mpms-layout-bg)',
              colorText: 'var(--mpms-text-primary)',
            },
            Tag: {
              defaultBg: 'var(--mpms-content-bg)',
              defaultColor: 'var(--mpms-text-primary)',
            },
            Menu: {
              itemBg: 'var(--mpms-sidebar-bg)',
              subMenuItemBg: 'var(--mpms-sidebar-bg)',
              itemColor: 'var(--mpms-sidebar-text-secondary)',
              itemHoverColor: 'var(--mpms-sidebar-text-primary)',
              itemHoverBg: 'var(--mpms-sidebar-hover-bg)',
              itemSelectedColor: '#ffffff',
              itemSelectedBg: 'var(--mpms-primary-color)',
              darkItemBg: 'var(--mpms-sidebar-bg)',
              darkItemColor: 'var(--mpms-sidebar-text-secondary)',
            },
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <I18nProvider>
              <BrowserRouter>
                <Routes>
                  {/* 统一登录：密码 + 扫码；Web / 移动同一入口 */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/mobile-login" element={<MobileLoginRedirect />} />

                  {/* 工作台壳（响应式：宽屏侧栏 / 窄屏折叠） */}
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<Navigate to="admin/dashboard" replace />} />
                    <Route path="admin/dashboard" element={<Dashboard />} />
                    <Route
                      path="admin/project"
                      element={<Placeholder title="项目" description="项目列表与进度（与底栏「项目」对应）" />}
                    />
                    <Route
                      path="admin/task"
                      element={<Placeholder title="工作区" description="任务与工作区（与底栏「工作区」对应）" />}
                    />
                    <Route
                      path="admin/team"
                      element={<Placeholder title="团队" description="团队成员管理" />}
                    />
                    {/* 扫一扫：壳内 Tab，选中态保留在底栏 */}
                    <Route path="admin/scan" element={<Scan />} />
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
    </IconProvider>
  );
};

export default App;
