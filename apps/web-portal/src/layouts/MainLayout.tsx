import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  ProjectOutlined,
  ApartmentOutlined,
  BookOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  LoginOutlined,
  ControlOutlined,
} from '@ant-design/icons';
import { AppLayout, Topbar, SidebarMenu } from '@epap/ui';
import type { MenuItem } from '@epap/ui';
import { useAuth } from '../contexts/AuthContext';

// Menu items for the sidebar
const menuItems: MenuItem[] = [
  { key: '/', icon: <HomeOutlined />, label: 'Home' },
  { key: '/command-center', icon: <ControlOutlined />, label: 'Command Center' },
  { key: '/projects', icon: <ProjectOutlined />, label: 'Projects' },
  { key: '/workflows', icon: <ApartmentOutlined />, label: 'Workflows' },
  { key: '/knowledge', icon: <BookOutlined />, label: 'Knowledge Base' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
];

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();

  const handleMenuClick = (key: string, _item: MenuItem) => {
    navigate(key);
  };

  const handleAuthClick = () => {
    if (isAuthenticated) {
      logout();
      navigate('/login');
    } else {
      navigate('/login');
    }
  };

  const topbarSlot = (
    <Topbar
      left={
        <div style={{ fontWeight: 600, fontSize: 16, paddingLeft: 16 }}>
          Axi Workstation
        </div>
      }
      right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isAuthenticated && user ? (
            <>
              <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.65)' }}>
                {user.name}
              </span>
              <UserOutlined style={{ fontSize: 18 }} />
              <LogoutOutlined 
                style={{ fontSize: 18, cursor: 'pointer' }} 
                onClick={handleAuthClick}
              />
            </>
          ) : (
            <button
              onClick={handleAuthClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 500,
                color: '#fff',
                background: 'rgba(24, 144, 255, 0.8)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <LoginOutlined />
              Sign In
            </button>
          )}
        </div>
      }
    />
  );

  return (
    <AppLayout
      sidebar={
        isAuthenticated ? (
          <div style={{ padding: '8px 0' }}>
            <SidebarMenu
              items={menuItems}
              activeKey={location.pathname}
              onSelect={handleMenuClick}
            />
          </div>
        ) : undefined
      }
      topbar={topbarSlot}
    >
      <Outlet />
    </AppLayout>
  );
};

export default MainLayout;
