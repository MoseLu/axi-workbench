import React from 'react';
import {
  DashboardOutlined,
  ProjectOutlined,
  FileTextOutlined,
  TeamOutlined,
  SettingOutlined,
  UserOutlined,
  MenuOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Logo, SidebarMenu, MenuSearch, Icon } from '@epap/ui';
import type { MenuItem } from '@epap/ui';
import logoImg from '../../assets/logo.png';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  onMenuClick: (path: string) => void;
  activeKey: string;
}

const menuData: MenuItem[] = [
  {
    key: '/admin/dashboard',
    icon: <DashboardOutlined />,
    label: '仪表盘',
    path: '/admin/dashboard',
  },
  {
    key: '/admin/project',
    icon: <ProjectOutlined />,
    label: '项目管理',
    path: '/admin/project',
  },
  {
    key: '/admin/task',
    icon: <FileTextOutlined />,
    label: '任务管理',
    path: '/admin/task',
  },
  {
    key: '/admin/team',
    icon: <TeamOutlined />,
    label: '团队管理',
    path: '/admin/team',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '系统设置',
    children: [
      {
        key: '/admin/settings/menu',
        icon: <MenuOutlined />,
        label: '菜单列表',
        path: '/admin/settings/menu',
      },
      {
        key: '/admin/settings/user',
        icon: <UserOutlined />,
        label: '用户列表',
        path: '/admin/settings/user',
      },
      {
        key: '/admin/settings/role',
        icon: <UnorderedListOutlined />,
        label: '角色列表',
        path: '/admin/settings/role',
      },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onMenuClick, activeKey }) => {
  const handleMenuSelect = (_key: string, item: MenuItem) => {
    if (item.path) {
      onMenuClick(item.path);
    }
  };

  return (
    <div className="sidebar">
      <Logo
        icon={<img src={logoImg} alt="MPMS" style={{ width: 32, height: 32 }} />}
        title="MPMS"
        collapsed={collapsed}
      />

      <MenuSearch
        items={menuData}
        collapsed={collapsed}
        placeholder="搜索菜单..."
        searchIcon={<Icon name="actions-search" size={14} />}
        onSelect={handleMenuSelect}
      />

      <div className="sidebar__menu">
        <SidebarMenu
          items={menuData}
          activeKey={activeKey}
          collapsed={collapsed}
          onSelect={handleMenuSelect}
        />
      </div>
    </div>
  );
};

export default Sidebar;
