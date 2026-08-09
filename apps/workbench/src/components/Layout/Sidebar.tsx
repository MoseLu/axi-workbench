import React from 'react';
import { AxiLogoMark } from '@axi/core';
import { Logo, SidebarMenu } from '@epap/ui';
import type { MenuItem } from '@epap/ui';
import { WorkbenchIcon } from '../WorkbenchIcon';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  onMenuClick: (path: string) => void;
  activeKey: string;
}

/** 旧版桌面侧栏：沿用当前控制中心的信息架构，不复制移动端导航。 */
const menuData: MenuItem[] = [
  {
    key: '/admin/dashboard',
    icon: <WorkbenchIcon name="overview" />,
    label: '工作台概览',
    path: '/admin/dashboard',
  },
  {
    key: '/admin/operations',
    icon: <WorkbenchIcon name="laptop" />,
    label: '运行状态',
    path: '/admin/operations',
  },
  {
    key: '/admin/project',
    icon: <WorkbenchIcon name="project" />,
    label: '项目组合',
    path: '/admin/project',
  },
  {
    key: '/admin/task',
    icon: <WorkbenchIcon name="workspace" />,
    label: '工作项',
    path: '/admin/task',
  },
  {
    key: '/admin/team',
    icon: <WorkbenchIcon name="team" />,
    label: '团队',
    path: '/admin/team',
  },
  {
    key: 'settings',
    icon: <WorkbenchIcon name="settings" />,
    label: '我的',
    children: [
      {
        key: '/admin/me',
        icon: <WorkbenchIcon name="account" />,
        label: '个人中心',
        path: '/admin/me',
      },
      {
        key: '/admin/settings/role',
        icon: <WorkbenchIcon name="roles" />,
        label: '角色权限',
        path: '/admin/settings/role',
      },
      {
        key: '/admin/settings/menu',
        icon: <WorkbenchIcon name="menu" />,
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
        icon={<AxiLogoMark size={22} />}
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
