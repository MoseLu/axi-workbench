/**
 * SystemSettingsPanel 类型与静态数据：
 *   - SystemSettingsSectionId / SystemSettingsTab
 *   - systemSettingsSections 导航分类
 *   - systemSettingsTabs 各分类下的页签
 *
 * 不放 React 组件，仅做类型与数据集中导出。
 */
import type { AxiIconName } from "@axi/icons";
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import type { AxiSettingsPanelTheme } from '@axi/settings';
import type { AxiAdminSettings, AxiAdminStylePresetOption, AxiAdminSettingsChangeHandler } from '@axi/settings';

export type SystemSettingsSectionId =
  | 'general'
  | 'appearance'
  | 'account'
  | 'devices'
  | 'notifications'
  | 'shortcuts'
  | 'about';

export type SystemSettingsTab = {
  id: string;
  zh: string;
  en: string;
  descriptionZh: string;
  descriptionEn: string;
};

export type SystemSettingsPanelProps = {
  activeStylePreset: AxiAdminSettings['stylePreset'];
  locale: 'zh-CN' | 'en-US';
  onChange: AxiAdminSettingsChangeHandler;
  onNavigate: (path: string) => void;
  onOpenChange: (open: boolean) => void;
  onStylePresetChange: (id: AxiAdminSettings['stylePreset']) => void;
  onThemePreferenceChange: (value: AxiSettingsPanelTheme) => void;
  open: boolean;
  settings: AxiAdminSettings;
  stylePresetOptions: AxiAdminStylePresetOption[];
  themePreference: AxiSettingsPanelTheme;
};

export const systemSettingsSections: ReadonlyArray<{
  id: SystemSettingsSectionId;
  iconName: AxiIconName;
  zh: string;
  en: string;
  descriptionZh: string;
  descriptionEn: string;
}> = [
  {
    id: 'general',
    iconName: axiWorkbenchIconMap.overview,
    zh: '通用',
    en: 'General',
    descriptionZh: '管理工作台的基础行为与启动方式。',
    descriptionEn: 'Manage the workbench basics and startup behavior.',
  },
  {
    id: 'appearance',
    iconName: axiWorkbenchIconMap.preferences,
    zh: '外观与布局',
    en: 'Appearance',
    descriptionZh: '调整主题、样式预设和页面结构。',
    descriptionEn: 'Tune themes, style presets, and page composition.',
  },
  {
    id: 'account',
    iconName: axiWorkbenchIconMap.account,
    zh: '账号与安全',
    en: 'Account',
    descriptionZh: '管理个人资料与当前登录身份。',
    descriptionEn: 'Manage your profile and current identity.',
  },
  {
    id: 'devices',
    iconName: axiWorkbenchIconMap.mobile,
    zh: '设备与会话',
    en: 'Devices',
    descriptionZh: '查看已配对设备与跨端会话。',
    descriptionEn: 'Review paired devices and cross-device sessions.',
  },
  {
    id: 'notifications',
    iconName: axiWorkbenchIconMap.notification,
    zh: '通知与消息',
    en: 'Notifications',
    descriptionZh: '查看提醒中心并管理通知偏好。',
    descriptionEn: 'Review the inbox and notification preferences.',
  },
  {
    id: 'shortcuts',
    iconName: axiWorkbenchIconMap.preferences,
    zh: '快捷键',
    en: 'Shortcuts',
    descriptionZh: '快速查看工作台的常用键位。',
    descriptionEn: 'Review the workbench keyboard shortcuts.',
  },
  {
    id: 'about',
    iconName: axiWorkbenchIconMap.info,
    zh: '关于工作台',
    en: 'About',
    descriptionZh: '查看产品版本与运行环境信息。',
    descriptionEn: 'View product version and runtime information.',
  },
];

export const systemSettingsTabs: Record<SystemSettingsSectionId, readonly SystemSettingsTab[]> = {
  general: [
    { id: 'workspace', zh: '工作区', en: 'Workspace', descriptionZh: '决定页面如何打开、恢复和组织。', descriptionEn: 'Decide how pages open, restore, and organize.' },
    { id: 'behavior', zh: '界面行为', en: 'Behavior', descriptionZh: '控制面包屑、刷新反馈和辅助显示。', descriptionEn: 'Control breadcrumbs, refresh feedback, and assistive display.' },
  ],
  appearance: [
    { id: 'theme', zh: '主题与样式', en: 'Theme & style', descriptionZh: '选择主题模式与样式预设，实时预览结果。', descriptionEn: 'Choose a theme mode and style preset with live previews.' },
    { id: 'layout', zh: '页面布局', en: 'Page layout', descriptionZh: '调整菜单、标签页和容器的组织方式。', descriptionEn: 'Adjust the menu, tabs, and content container.' },
  ],
  account: [
    { id: 'profile', zh: '个人资料', en: 'Profile', descriptionZh: '查看和编辑当前工作台身份资料。', descriptionEn: 'View and edit the current workbench profile.' },
    { id: 'security', zh: '登录安全', en: 'Security', descriptionZh: '确认当前身份边界和登录策略。', descriptionEn: 'Review identity boundaries and sign-in policy.' },
  ],
  devices: [
    { id: 'paired', zh: '已配对设备', en: 'Paired devices', descriptionZh: '管理手机端配对与访问确认。', descriptionEn: 'Manage mobile pairing and access approval.' },
    { id: 'sessions', zh: '登录会话', en: 'Sessions', descriptionZh: '查看当前工作台保留的会话信息。', descriptionEn: 'Review the sessions retained by this workbench.' },
  ],
  notifications: [
    { id: 'inbox', zh: '通知中心', en: 'Notification inbox', descriptionZh: '集中处理工作台产生的提醒。', descriptionEn: 'Handle workbench alerts in one place.' },
    { id: 'delivery', zh: '投递偏好', en: 'Delivery', descriptionZh: '了解当前通知通道与可用范围。', descriptionEn: 'Review available notification channels and scope.' },
  ],
  shortcuts: [
    { id: 'global', zh: '全局操作', en: 'Global actions', descriptionZh: '搜索、返回和面板控制的快捷键。', descriptionEn: 'Shortcuts for search, navigation, and panels.' },
    { id: 'workspace', zh: '工作区操作', en: 'Workspace actions', descriptionZh: '标签页与侧栏的常用操作。', descriptionEn: 'Common tab and sidebar actions.' },
  ],
  about: [
    { id: 'product', zh: '产品信息', en: 'Product', descriptionZh: '查看 Axi 工作台的产品身份。', descriptionEn: 'View the Axi Workbench product identity.' },
    { id: 'runtime', zh: '运行环境', en: 'Runtime', descriptionZh: '查看当前浏览器和工作台运行状态。', descriptionEn: 'View the current browser and workbench runtime.' },
  ],
};