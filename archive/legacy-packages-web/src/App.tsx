import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { IconProvider } from '@epap/ui';
import { iconPathMap } from '@/assets/icons';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/admin/DashboardPage';
import TaskPage from './pages/admin/TaskPage';
import MenuListPage from './pages/admin/MenuListPage';
import PlaceholderPage from './pages/admin/PlaceholderPage';

/** Resolve icon names to SVG paths using the web project's icon registry */
const iconResolver = (name: string): string => {
  return (iconPathMap as Record<string, string>)[name] ?? '';
};

const App: React.FC = () => {
  return (
    <IconProvider resolver={iconResolver}>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#4165d7',
          borderRadius: 6,
          fontSize: 13,
          colorBgContainer: '#141414',
          colorBgElevated: '#1d1d1d',
          colorBorderSecondary: '#2b2b2c',
        },
        components: {
          Card: {
            colorBgContainer: '#141414',
          },
          Table: {
            colorBgContainer: '#141414',
            headerBg: '#1d1d1d',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
          },
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          {/* Main layout with nested routes */}
          <Route path="/admin" element={<MainLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="task" element={<TaskPage />} />
            <Route path="project" element={<PlaceholderPage title="项目管理" description="项目列表与管理功能开发中..." />} />
            <Route path="team" element={<PlaceholderPage title="团队管理" description="团队成员管理功能开发中..." />} />
            <Route path="settings/menu" element={<MenuListPage />} />
            <Route path="settings/user" element={<PlaceholderPage title="用户列表" description="用户管理功能开发中..." />} />
            <Route path="settings/role" element={<PlaceholderPage title="角色列表" description="角色管理功能开发中..." />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
    </IconProvider>
  );
};

export default App;
