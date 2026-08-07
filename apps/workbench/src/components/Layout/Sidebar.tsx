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
import { Logo, SidebarMenu, Icon } from '@epap/ui';
import type { MenuItem } from '@epap/ui';
import logoImg from '../../assets/logo.png';
import ScanIcon from './ScanIcon';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  onMenuClick: (path: string) => void;
  activeKey: string;
}

/** Desktop sidebar — same IA as mobile bottom tabs + secondary settings */
const menuData: MenuItem[] = [
  {
    key: '/admin/dashboard',
    icon: <DashboardOutlined />,
    label: '概览',
    path: '/admin/dashboard',
  },
  {
    key: '/admin/project',
    icon: <ProjectOutlined />,
    label: '项目',
    path: '/admin/project',
  },
  {
    key: '/admin/task',
    icon: <FileTextOutlined />,
    label: '工作区',
    path: '/admin/task',
  },
  {
    key: '/admin/team',
    icon: <TeamOutlined />,
    label: '团队',
    path: '/admin/team',
  },
  {
    key: '/admin/scan',
    icon: <ScanIcon size={16} color="currentColor" />,
    label: '扫一扫',
    path: '/admin/scan',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '我的',
    children: [
      {
        key: '/admin/me',
        icon: <UserOutlined />,
        label: '个人中心',
        path: '/admin/me',
      },
      {
        key: '/admin/settings/role',
        icon: <UnorderedListOutlined />,
        label: '角色权限',
        path: '/admin/settings/role',
      },
      {
        key: '/admin/settings/menu',
        icon: <MenuOutlined />,
        label: '菜单配置',
        path: '/admin/settings/menu',
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
        icon={<img src={logoImg} alt="Axi" style={{ width: 22, height: 22 }} />}
        text="WorkBench"
        collapsed={collapsed}
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
