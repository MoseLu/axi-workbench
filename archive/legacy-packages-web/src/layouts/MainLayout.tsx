import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  DownOutlined,
  HomeOutlined,
  DashboardOutlined,
  ProjectOutlined,
  FileTextOutlined,
  TeamOutlined,
  SettingOutlined,
  MenuOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  AppLayout,
  Topbar,
  TabBar,
  BreadcrumbBar,
  RightSidebar,
  RightSidebarIcon,
  Icon,
  IconButton,
} from '@epap/ui';
import type { TabItem, BreadcrumbItem } from '@epap/ui';
import Sidebar from '../components/Layout/Sidebar';
import RightSettingsDrawer from '../components/Layout/RightSidebar';
import '../components/Layout/HeaderBar.css';
import './MainLayout.css';

// Menu route mapping
const menuRouteMap: Record<string, { label: string; icon?: React.ReactNode; parent?: string; parentIcon?: React.ReactNode }> = {
  '/admin/dashboard': { label: '仪表盘', icon: <DashboardOutlined /> },
  '/admin/project': { label: '项目管理', icon: <ProjectOutlined /> },
  '/admin/task': { label: '任务列表', icon: <FileTextOutlined />, parent: '任务管理', parentIcon: <FileTextOutlined /> },
  '/admin/team': { label: '团队管理', icon: <TeamOutlined /> },
  '/admin/settings/menu': { label: '菜单列表', icon: <MenuOutlined />, parent: '系统设置', parentIcon: <SettingOutlined /> },
  '/admin/settings/user': { label: '用户列表', icon: <UserOutlined />, parent: '系统设置', parentIcon: <SettingOutlined /> },
  '/admin/settings/role': { label: '角色列表', icon: <UnorderedListOutlined />, parent: '系统设置', parentIcon: <SettingOutlined /> },
};

// Responsive hook
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
};

const MainLayout: React.FC = () => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);
  useEffect(() => { setCollapsed(isMobile); }, [isMobile]);

  const [rightSidebarVisible, setRightSidebarVisible] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const [tabs, setTabs] = useState<TabItem[]>([
    { key: '/admin/dashboard', label: '仪表盘', path: '/admin/dashboard', closable: false },
  ]);
  const [activeTab, setActiveTab] = useState('/admin/dashboard');
  const navigate = useNavigate();
  const location = useLocation();

  // Sync active tab with location
  useEffect(() => {
    const path = location.pathname;
    setActiveTab(path);
    const routeInfo = menuRouteMap[path];
    if (routeInfo) {
      setTabs(prev => {
        if (prev.find(t => t.key === path)) return prev;
        return [...prev, { key: path, label: routeInfo.label, path, closable: true }];
      });
    }
  }, [location.pathname]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
    navigate(key);
  }, [navigate]);

  const handleTabClose = useCallback((key: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.key !== key);
      if (activeTab === key && newTabs.length > 0) {
        const lastTab = newTabs[newTabs.length - 1];
        setActiveTab(lastTab.key);
        navigate(lastTab.path);
      }
      return newTabs;
    });
  }, [activeTab, navigate]);

  const handleMenuClick = useCallback((path: string) => {
    navigate(path);
    if (isMobile) setCollapsed(true);
  }, [navigate, isMobile]);

  const handleTabNavigate = useCallback((direction: 'back' | 'reload' | 'home') => {
    if (direction === 'home') navigate('/admin/dashboard');
    else if (direction === 'back') window.history.back();
    else window.location.reload();
  }, [navigate]);

  const handleTogglePin = useCallback((key: string) => {
    setTabs(prev => prev.map(t =>
      t.key === key ? { ...t, closable: t.closable === false ? true : false } : t
    ));
  }, []);

  const handleCloseLeft = useCallback(() => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.key === activeTab);
      return prev.filter((t, i) => i >= idx || t.closable === false);
    });
  }, [activeTab]);

  const handleCloseRight = useCallback(() => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.key === activeTab);
      return prev.filter((t, i) => i <= idx || t.closable === false);
    });
  }, [activeTab]);

  const handleCloseOther = useCallback(() => {
    setTabs(prev => prev.filter(t => t.key === activeTab || t.closable === false));
  }, [activeTab]);

  const handleCloseAll = useCallback(() => {
    setTabs(prev => {
      const pinned = prev.filter(t => t.closable === false);
      if (pinned.length > 0) {
        const last = pinned[pinned.length - 1];
        setActiveTab(last.key);
        navigate(last.path);
      }
      return pinned;
    });
  }, [navigate]);

  // Build breadcrumb
  const getBreadcrumb = (): BreadcrumbItem[] => {
    const path = location.pathname;
    const routeInfo = menuRouteMap[path];
    if (!routeInfo) return [{ label: '首页', icon: <HomeOutlined /> }];
    const crumbs: BreadcrumbItem[] = [{ label: '首页', icon: <HomeOutlined /> }];
    if (routeInfo.parent) crumbs.push({ label: routeInfo.parent, icon: routeInfo.parentIcon });
    crumbs.push({ label: routeInfo.label, icon: routeInfo.icon });
    return crumbs;
  };

  // ---- Render slots ----

  const topbarSlot = (
    <Topbar
      left={
        <IconButton
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          tooltip="折叠菜单"
          onClick={() => setCollapsed(!collapsed)}
        />
      }
      right={
        <div className="app-topbar__tools">
          <IconButton icon={<Icon name="system-github" size={16} />} tooltip="GitHub" />
          <IconButton icon={<Icon name="system-lang" size={16} />} tooltip="国际化" />
          <IconButton icon={<Icon name="status-notice" size={16} />} tooltip="通知" badge={3} />
          <IconButton icon={<Icon name="status-msg" size={16} />} tooltip="消息" />
          <IconButton
            icon={<Icon name="system-theme" size={16} />}
            tooltip="偏好设置"
            onClick={() => setRightSidebarVisible(!rightSidebarVisible)}
          />
          <IconButton icon={<Icon name="system-dark" size={16} />} tooltip="主题切换" />
          <div className="app-topbar__user">
            <div className="app-topbar__avatar"><UserOutlined /></div>
            <span className="app-topbar__username">管理员</span>
            <DownOutlined className="app-topbar__user-arrow" />
          </div>
        </div>
      }
    />
  );

  const tabbarSlot = (
    <TabBar
      tabs={tabs}
      activeTab={activeTab}
      isFullscreen={contentFullscreen}
      backIcon={<Icon name="navigation-back" size={14} />}
      refreshIcon={<Icon name="actions-refresh" size={14} />}
      homeIcon={<Icon name="navigation-home" size={14} />}
      menuIcon={<Icon name="navigation-tabbar-menu" size={14} />}
      fullscreenIcon={<Icon name="actions-screen-full" size={14} />}
      exitFullscreenIcon={<Icon name="actions-screen-normal" size={14} />}
      closeIcon={<Icon name="actions-close" size={12} />}
      pinIcon={<Icon name="actions-pin" size={12} />}
      closeLeftIcon={<Icon name="navigation-left" size={12} />}
      closeRightIcon={<Icon name="navigation-right" size={12} />}
      closeOtherIcon={<Icon name="actions-close" size={12} />}
      closeAllIcon={<Icon name="actions-close-border" size={12} />}
      onTabChange={handleTabChange}
      onTabClose={handleTabClose}
      onNavigate={handleTabNavigate}
      onToggleFullscreen={() => {
        const next = !contentFullscreen;
        setContentFullscreen(next);
        if (next) setRightSidebarCollapsed(true);
      }}
      onCloseLeft={handleCloseLeft}
      onCloseRight={handleCloseRight}
      onCloseOther={handleCloseOther}
      onCloseAll={handleCloseAll}
      onTogglePin={handleTogglePin}
    />
  );

  const rightSidebarSlot = (
    <RightSidebar
      collapsed={rightSidebarCollapsed}
      onToggleCollapse={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
      collapseIcon={<Icon name="navigation-right" size={14} />}
      expandIcon={<Icon name="navigation-left" size={14} />}
    >
      <RightSidebarIcon icon={<Icon name="status-notice" size={14} />} tooltip="通知" />
      <RightSidebarIcon icon={<Icon name="actions-quick" size={14} />} tooltip="快捷操作" />
      <RightSidebarIcon
        icon={<Icon name="legacy-setting" size={14} />}
        tooltip="设置"
        onClick={() => setRightSidebarVisible(!rightSidebarVisible)}
      />
      <RightSidebarIcon icon={<Icon name="legacy-help" size={14} />} tooltip="帮助" />
      <RightSidebarIcon icon={<Icon name="status-warning" size={14} />} tooltip="反馈" />
    </RightSidebar>
  );

  return (
    <>
      {/* Mobile mask */}
      {!collapsed && !contentFullscreen && (
        <div className="app-layout__mask" onClick={() => setCollapsed(true)} />
      )}

      <AppLayout
        sidebarCollapsed={collapsed}
        isFullscreen={contentFullscreen}
        sidebar={
          <Sidebar
            collapsed={collapsed}
            onMenuClick={handleMenuClick}
            activeKey={location.pathname}
          />
        }
        topbar={topbarSlot}
        tabbar={tabbarSlot}
        breadcrumb={<BreadcrumbBar items={getBreadcrumb()} />}
        rightSidebar={rightSidebarSlot}
      >
        <Outlet />
      </AppLayout>

      {/* Right settings drawer */}
      <RightSettingsDrawer
        visible={rightSidebarVisible}
        onClose={() => setRightSidebarVisible(false)}
      />
    </>
  );
};

export default MainLayout;
