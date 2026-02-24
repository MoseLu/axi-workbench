// ========== Styles ==========
import './styles/variables.css';

// ========== Types ==========
export type {
  MenuItem, TabItem, BreadcrumbItem, IconButtonConfig,
  UserInfo, UserMenuItem, NoticeItem,
  LayoutSlot, MenuType, ThemeMode, Locale,
} from './types';

// Ant Design Type Compatibility
export type {
  MpmsComponentProps,
  MpmsEventHandler,
  MpmsFocusEventHandler,
  Variant,
  Size,
  Shape,
  Loading,
  Disabled,
  Readonly,
  FormItemProps,
  ModalProps,
  DropdownProps,
} from './types/antd-compat';

// ========== Composables ==========
export { useToggle } from './composables/useToggle';
export { useFullscreen } from './composables/useFullscreen';
export { useTabs } from './composables/useTabs';
export { useBreakpoint } from './composables/useBreakpoint';

// ========== Design Tokens ==========
export * from './styles/tokens';

// ========== Atoms ==========
// Universal atoms — consistent styling across all usage contexts
export { default as Icon, IconProvider, IconContext } from './components/atoms/universal/icon';
export type { IconProps, IconProviderProps } from './components/atoms/universal/icon';

export { default as IconButton } from './components/atoms/universal/icon-button';
export type { IconButtonProps } from './components/atoms/universal/icon-button';

export { default as Logo } from './components/atoms/universal/logo';
export type { LogoProps } from './components/atoms/universal/logo';

// Layout-specific atoms — customized styling for specific layout contexts
export { default as SidebarIconButton } from './components/atoms/layout-specific/sidebar-icon-button';
export type { SidebarIconButtonProps } from './components/atoms/layout-specific/sidebar-icon-button';

export { default as TopbarIconButton } from './components/atoms/layout-specific/topbar-icon-button';
export type { TopbarIconButtonProps } from './components/atoms/layout-specific/topbar-icon-button';

export { default as TabbarIcon } from './components/atoms/layout-specific/tabbar-icon';
export type { TabbarIconProps } from './components/atoms/layout-specific/tabbar-icon';

export { default as RightSidebarIcon } from './components/atoms/layout-specific/right-sidebar-icon';
export type { RightSidebarIconProps } from './components/atoms/layout-specific/right-sidebar-icon';

// ========== Sidebar (Menu) ==========
export { SidebarMenu, DualMenu, TopMenu } from './components/sidebar';
export type { SidebarMenuProps, DualMenuProps, TopMenuProps } from './components/sidebar';

export { default as MenuSearch } from './components/menu-search';
export type { MenuSearchProps } from './components/menu-search';

// ========== Topbar ==========
export { default as Topbar } from './components/topbar';
export type { TopbarProps } from './components/topbar';

export { default as GithubButton } from './components/topbar/github-button';
export type { GithubButtonProps } from './components/topbar/github-button';

export { default as LocaleSwitcher } from './components/topbar/locale-switcher';
export type { LocaleSwitcherProps } from './components/topbar/locale-switcher';

export { default as NotificationIcon } from './components/topbar/notification-icon';
export type { NotificationIconProps } from './components/topbar/notification-icon';

export { default as MessageIcon } from './components/topbar/message-icon';
export type { MessageIconProps } from './components/topbar/message-icon';

export { default as PreferencesDrawer } from './components/topbar/preferences-drawer';
export type { PreferencesDrawerProps } from './components/topbar/preferences-drawer';

export { default as ThemeSwitcher } from './components/topbar/theme-switcher';
export type { ThemeSwitcherProps } from './components/topbar/theme-switcher';

export { default as UserDropdown } from './components/topbar/user-dropdown';
export type { UserDropdownProps } from './components/topbar/user-dropdown';

// ========== Global Search ==========
export { default as GlobalSearch } from './components/global-search';
export type { GlobalSearchProps } from './components/global-search';

// ========== TabBar ==========
export { default as TabBar } from './components/tabbar';
export type { TabBarProps } from './components/tabbar';

// ========== Breadcrumb ==========
export { default as BreadcrumbBar } from './components/breadcrumb';
export type { BreadcrumbBarProps } from './components/breadcrumb';

// ========== Right Sidebar ==========
export { default as RightSidebar } from './components/right-sidebar';
export type { RightSidebarProps } from './components/right-sidebar';

// ========== App Layout ==========
export { default as AppLayout } from './components/app-layout';
export type { AppLayoutProps } from './components/app-layout';
