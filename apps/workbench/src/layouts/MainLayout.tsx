import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  DashboardOutlined,
  ProjectOutlined,
  FileTextOutlined,
  TeamOutlined,
  SettingOutlined,
  MenuOutlined,
  UnorderedListOutlined,
  LogoutOutlined,
  SearchOutlined,
  BellOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {
  AppLayout,
  TopbarIconButton,
  UserDropdown,
} from '@epap/ui';
import type { TabItem } from '@epap/ui';
import Sidebar from '../components/Layout/Sidebar';
import RightSettingsDrawer from '../components/Layout/RightSidebar';
import MobileTopBar from '../components/Layout/MobileTopBar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import WorkbenchTabBar from '../components/Layout/TabBar';
import WorkbenchBreadcrumbBar from '../components/Layout/BreadcrumbBar';
import { useI18n } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import { resolveBreadcrumbs } from '../lib/breadcrumbs';
import {
  HOME_TAB,
  openTab,
  focusTab,
  closeTab,
  closeLeft,
  closeRight,
  closeOther,
  closeAll,
  togglePin,
} from '../lib/tabs';
import { useNavBadges } from '../hooks/useNavBadges';
import '../components/Layout/HeaderBar.css';
import './MainLayout.css';

const menuRouteMap: Record<string, { label: string; icon?: React.ReactNode; parent?: string; parentIcon?: React.ReactNode }> = {
  '/admin/dashboard': { label: '概览', icon: <DashboardOutlined /> },
  '/admin/project': { label: '项目', icon: <ProjectOutlined /> },
  '/admin/task': { label: '工作区', icon: <FileTextOutlined /> },
  '/admin/team': { label: '团队', icon: <TeamOutlined /> },
  '/admin/scan': { label: '扫一扫' },
  '/admin/me': { label: '我的', icon: <UserOutlined /> },
  '/admin/settings/menu': { label: '菜单列表', icon: <MenuOutlined />, parent: '系统设置', parentIcon: <SettingOutlined /> },
  '/admin/settings/user': { label: '我的', icon: <UserOutlined /> },
  '/admin/settings/role': { label: '角色列表', icon: <UnorderedListOutlined />, parent: '系统设置', parentIcon: <SettingOutlined /> },
};

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
};

function pageTitle(pathname: string): string {
  if (pathname.startsWith('/admin/scan')) return '扫一扫';
  if (pathname.startsWith('/admin/search')) return '搜索';
  if (pathname.startsWith('/admin/project')) return '项目';
  if (pathname.startsWith('/admin/task') || pathname.startsWith('/admin/team')) return '工作区';
  if (pathname.startsWith('/admin/me') || pathname.startsWith('/admin/settings')) return '我的';
  // 与底栏「概览」文案完全一致
  if (pathname.startsWith('/admin/dashboard') || pathname === '/' || pathname === '') return '概览';
  return '概览';
}

const MainLayout: React.FC = () => {
  const isMobile = useIsMobile();
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(false);
  const [contentFullscreen, setContentFullscreen] = useState(false);
  const [tabs, setTabs] = useState<TabItem[]>([HOME_TAB]);
  const [activeTab, setActiveTab] = useState<string>(HOME_TAB.key);
  const navigate = useNavigate();
  const location = useLocation();

  // 通知 / 我的角标（与移动端共用 hook，复用 useNavBadges + MobileBottomNav.formatNavBadgeCount）
  const tabBadges = useNavBadges(true);
  const unreadCount = useMemo(() => {
    const acc = (b: { kind: string; value?: number }) =>
      b.kind === 'count' && typeof b.value === 'number' ? b.value : 0;
    return (
      acc(tabBadges.home) +
      acc(tabBadges.projects) +
      acc(tabBadges.workspace) +
      acc(tabBadges.me)
    );
  }, [tabBadges]);

  // 顶栏 "+" 气泡开关
  const [plusOpen, setPlusOpen] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!plusOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) {
        setPlusOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [plusOpen]);

  const displayName = user?.name || t('common.user.admin') || '用户';

  const userMenuItems = useMemo(
    () => [
      {
        key: 'profile',
        label: '个人中心',
        icon: <UserOutlined />,
        onClick: () => navigate('/admin/me'),
      },
      {
        key: 'preferences',
        label: '偏好设置',
        icon: <SettingOutlined />,
        onClick: () => setRightSidebarVisible(true),
      },
      { key: 'divider-1', label: '', divider: true },
      {
        key: 'logout',
        label: '退出登录',
        icon: <LogoutOutlined />,
        danger: true,
        onClick: () => {
          logout();
          navigate('/login');
        },
      },
    ],
    [logout, navigate],
  );

  /* ---------- Desktop: slim topbar (WeChat-inspired density) ---------- */
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    document.body.classList.add('wb-desktop-body');
    return () => {
      document.body.classList.remove('wb-desktop-body');
    };
  }, [isMobile]);

  useEffect(() => {
    const path = location.pathname;
    const routeInfo = menuRouteMap[path];
    if (!routeInfo) {
      setActiveTab(path);
      return;
    }
    let nextActive: string | null = null;
    setTabs((prev) => {
      const result = openTab(prev, {
        key: path,
        label: routeInfo.label,
        path,
      });
      nextActive = result.nextActive;
      return result.tabs;
    });
    if (nextActive !== null) setActiveTab(nextActive);
  }, [location.pathname]);

  const handleTabChange = useCallback(
    (key: string) => {
      const result = focusTab(tabs, key);
      setActiveTab(result.nextActive ?? key);
      navigate(key);
    },
    [navigate, tabs],
  );

  const handleTabClose = useCallback(
    (key: string) => {
      setTabs((prev) => {
        const result = closeTab(prev, key, activeTab);
        if (result.nextActive !== null && result.nextActive !== activeTab) {
          setActiveTab(result.nextActive);
          const last = result.tabs[result.tabs.length - 1];
          if (last && last.key === result.nextActive) navigate(last.path);
        }
        return result.tabs;
      });
    },
    [activeTab, navigate],
  );

  const handleMenuClick = useCallback(
    (path: string) => {
      navigate(path);
      if (isMobile) setCollapsed(true);
    },
    [navigate, isMobile],
  );

  const handleTabNavigate = useCallback(
    (direction: 'back' | 'reload' | 'home') => {
      if (direction === 'home') navigate('/admin/dashboard');
      else if (direction === 'back') window.history.back();
      else window.location.reload();
    },
    [navigate],
  );

  const handleTogglePin = useCallback((key: string) => {
    setTabs((prev) => togglePin(prev, key));
  }, []);

  const handleCloseLeft = useCallback(() => {
    setTabs((prev) => closeLeft(prev, activeTab).tabs);
  }, [activeTab]);

  const handleCloseRight = useCallback(() => {
    setTabs((prev) => closeRight(prev, activeTab).tabs);
  }, [activeTab]);

  const handleCloseOther = useCallback(() => {
    setTabs((prev) => closeOther(prev, activeTab).tabs);
  }, [activeTab]);

  const handleCloseAll = useCallback(() => {
    setTabs((prev) => {
      const result = closeAll(prev);
      if (result.nextActive !== null) {
        setActiveTab(result.nextActive);
        const last = result.tabs[result.tabs.length - 1];
        if (last && last.key === result.nextActive) {
          navigate(last.path ?? last.key);
        }
      }
      return result.tabs;
    });
  }, [navigate]);

  /* ---------- Mobile: WeChat / WorkBench App chrome ---------- */
  if (isMobile) {
    const path = location.pathname;
    const isScan = path.startsWith('/admin/scan');
    const isSearch = path.startsWith('/admin/search');
    const isMeRoot = path === '/admin/me' || path === '/admin/me/';
    const isMeSub =
      (path.startsWith('/admin/me/') && !isMeRoot) || path.startsWith('/admin/settings');
    const isMe = isMeRoot || isMeSub;
    // 我的入口：无壳顶栏、保留底栏；二级页自带顶栏、隐藏底栏
    const hideChromeTopBar = isScan || isSearch || isMe;
    const showBottomNav = !isSearch && !isMeSub;

    return (
      <div className={`wb-mobile-shell ${isScan ? 'is-scan' : ''} ${isMe ? 'is-me' : ''}`}>
        {!hideChromeTopBar && (
          <MobileTopBar
            title={pageTitle(path)}
            onSearchClick={() => navigate('/admin/search')}
            onScanClick={() => navigate('/admin/scan')}
          />
        )}
        <main className={`wb-mobile-shell__content ${isScan ? 'is-scan' : ''} ${isMe ? 'is-me' : ''}`}>
          <Outlet />
        </main>
        {showBottomNav && (
          <MobileBottomNav
            pathname={path}
            onNavigate={(p) => navigate(p)}
          />
        )}
        <RightSettingsDrawer visible={rightSidebarVisible} onClose={() => setRightSidebarVisible(false)} />
      </div>
    );
  }

  /* ---------- Desktop: WeChat-style topbar (48px, 居中标题, 微信线型图标) ---------- */
  const topbarSlot = (
    <header className="wb-desktop-topbar">
      <div className="wb-desktop-topbar__left">
        <TopbarIconButton
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          tooltip="折叠菜单"
          onClick={() => setCollapsed(!collapsed)}
        />
      </div>

      <h1 className="wb-desktop-topbar__title">{pageTitle(location.pathname)}</h1>

      <div className="wb-desktop-topbar__right">
        <TopbarIconButton
          icon={<SearchOutlined />}
          tooltip="搜索"
          onClick={() => navigate('/admin/search')}
        />
        <TopbarIconButton
          icon={<BellOutlined />}
          tooltip="通知"
          badge={unreadCount > 0 ? unreadCount : undefined}
          onClick={() => setRightSidebarVisible(true)}
        />

        <div className="wb-topbar-plus-wrap" ref={plusRef}>
          <TopbarIconButton
            icon={<UserAddOutlined />}
            tooltip="更多"
            onClick={() => setPlusOpen((v) => !v)}
          />
          {plusOpen && (
            <div className="wb-topbar-plus-menu" role="menu">
              <div className="wb-topbar-plus-menu__body">
                <button
                  type="button"
                  className="wb-topbar-plus-menu__item"
                  onClick={() => {
                    setPlusOpen(false);
                    navigate('/admin/scan');
                  }}
                >
                  扫一扫
                </button>
                <button
                  type="button"
                  className="wb-topbar-plus-menu__item"
                  onClick={() => {
                    setPlusOpen(false);
                    setRightSidebarVisible(true);
                  }}
                >
                  偏好设置
                </button>
                <button
                  type="button"
                  className="wb-topbar-plus-menu__item"
                  onClick={() => {
                    setPlusOpen(false);
                    // 占位：发起群聊，待后续团队页接通
                    window.alert('发起群聊');
                  }}
                >
                  发起群聊
                </button>
              </div>
            </div>
          )}
        </div>

        <UserDropdown
          user={{ name: displayName, avatar: undefined }}
          avatarIcon={<UserOutlined />}
          menuItems={userMenuItems}
        />
      </div>
    </header>
  );

  const tabbarSlot = (
    <WorkbenchTabBar
      tabs={tabs}
      activeTab={activeTab}
      isFullscreen={contentFullscreen}
      onTabChange={handleTabChange}
      onTabClose={handleTabClose}
      onNavigate={handleTabNavigate}
      onToggleFullscreen={() => setContentFullscreen((v) => !v)}
      onCloseLeft={handleCloseLeft}
      onCloseRight={handleCloseRight}
      onCloseOther={handleCloseOther}
      onCloseAll={handleCloseAll}
      onTogglePin={handleTogglePin}
    />
  );

  return (
    <>
      <AppLayout
        className="wb-desktop-shell"
        sidebarCollapsed={collapsed}
        isFullscreen={contentFullscreen}
        sidebar={
          <Sidebar collapsed={collapsed} onMenuClick={handleMenuClick} activeKey={location.pathname} />
        }
        topbar={topbarSlot}
        tabbar={tabbarSlot}
        breadcrumb={
          <WorkbenchBreadcrumbBar
            items={resolveBreadcrumbs(location.pathname)}
            onNavigate={(p) => navigate(p)}
          />
        }
      >
        <Outlet />
      </AppLayout>

      <RightSettingsDrawer visible={rightSidebarVisible} onClose={() => setRightSidebarVisible(false)} />
    </>
  );
};

export default MainLayout;
