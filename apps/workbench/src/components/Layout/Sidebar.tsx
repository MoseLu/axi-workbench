import React from 'react';
import { AxiLogoMark } from '@axi/core';
import { Logo, SidebarMenu } from '@epap/ui';
import type { MenuItem } from '@epap/ui';
import { useI18n } from '../../i18n';
import { WorkbenchIcon } from '../WorkbenchIcon';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  onMenuClick: (path: string) => void;
  activeKey: string;
}

/** 旧版桌面侧栏：沿用当前控制中心的信息架构，不复制移动端导航。 */
const Sidebar: React.FC<SidebarProps> = ({ collapsed, onMenuClick, activeKey }) => {
  const { t } = useI18n();

  const menuData: MenuItem[] = [
    {
      key: '/admin/dashboard',
      icon: <WorkbenchIcon name="overview" />,
      label: t('nav.dashboard'),
      path: '/admin/dashboard',
    },
    {
      key: '/admin/operations',
      icon: <WorkbenchIcon name="laptop" />,
      label: t('nav.operations'),
      path: '/admin/operations',
    },
    {
      key: '/admin/project',
      icon: <WorkbenchIcon name="project" />,
      label: t('nav.projects'),
      path: '/admin/project',
    },
    {
      key: '/admin/task',
      icon: <WorkbenchIcon name="workspace" />,
      label: t('nav.tasks'),
      path: '/admin/task',
    },
    {
      key: '/admin/team',
      icon: <WorkbenchIcon name="team" />,
      label: t('nav.team'),
      path: '/admin/team',
    },
    {
      key: 'settings',
      icon: <WorkbenchIcon name="settings" />,
      label: t('nav.crumb.account'),
      children: [
        {
          key: '/admin/me',
          icon: <WorkbenchIcon name="account" />,
          label: t('nav.crumb.profile'),
          path: '/admin/me',
        },
        {
          key: '/admin/settings/role',
          icon: <WorkbenchIcon name="roles" />,
          label: t('nav.settings.role.permission'),
          path: '/admin/settings/role',
        },
        {
          key: '/admin/settings/menu',
          icon: <WorkbenchIcon name="menu" />,
          label: t('nav.settings.menu.configure'),
          path: '/admin/settings/menu',
        },
      ],
    },
  ];

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
