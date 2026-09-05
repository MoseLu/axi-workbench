import React from 'react';

// Re-export Ant Design compatibility types
export * from './antd-compat';

// Re-export Zod schemas
export * from './schemas';

/** Menu item definition */
export interface MenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
  path?: string;
  disabled?: boolean;
  hidden?: boolean;
}

/** Tab item definition */
export interface TabItem {
  key: string;
  label: string;
  path: string;
  closable?: boolean;
  icon?: React.ReactNode;
}

/** Breadcrumb item definition */
export interface BreadcrumbItem {
  label: string;
  icon?: React.ReactNode;
  path?: string;
}

/** Icon button config */
export interface IconButtonConfig {
  icon: string | React.ReactNode;
  tooltip?: string;
  badge?: number | string;
  onClick?: () => void;
}

/** User info */
export interface UserInfo {
  name: string;
  avatar?: string;
  role?: string;
}

/** User dropdown menu item */
export interface UserMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

/** Notification / Message item */
export interface NoticeItem {
  id: string;
  title: string;
  description?: string;
  time?: string;
  read?: boolean;
  avatar?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}

/** Layout slot names */
export type LayoutSlot = 'topbar' | 'sidebar' | 'rightSidebar' | 'tabbar' | 'breadcrumb' | 'content';

/** Menu type */
export type MenuType = 'left' | 'left-dual' | 'top';

/** Theme mode */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** Locale */
export type Locale = 'zh-CN' | 'en-US';
