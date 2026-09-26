import React, { useEffect, useMemo, useState } from 'react';
import { AxiSvgIcon, type AxiIconName } from '@axi/core';
import { AxiDialogGroup } from '@axi/crud';
import {
  AxiAdminSettingsContent,
  type AxiAdminSettings,
  type AxiAdminSettingsChangeHandler,
  type AxiAdminStylePresetOption,
  type AxiSettingsPanelTheme,
} from '@axi/settings';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import './SystemSettingsPanel.css';

type SystemSettingsSectionId =
  | 'general'
  | 'appearance'
  | 'account'
  | 'devices'
  | 'notifications'
  | 'shortcuts'
  | 'about';

type SystemSettingsTab = {
  id: string;
  zh: string;
  en: string;
  descriptionZh: string;
  descriptionEn: string;
};

type SystemSettingsPanelProps = {
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

const systemSettingsSections: ReadonlyArray<{
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

const systemSettingsTabs: Record<SystemSettingsSectionId, readonly SystemSettingsTab[]> = {
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

function copy(locale: SystemSettingsPanelProps['locale'], zh: string, en: string) {
  return locale === 'zh-CN' ? zh : en;
}

function SettingRow({ control, description, label }: { control: React.ReactNode; description: string; label: string }) {
  return (
    <div className="wb-system-settings__row">
      <div className="wb-system-settings__row-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
      <div className="wb-system-settings__row-control">{control}</div>
    </div>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`wb-system-settings__toggle${checked ? ' is-on' : ''}`}
      role="switch"
      type="button"
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function OptionGroup({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div aria-label={ariaLabel} className="wb-system-settings__options" role="radiogroup">
      {options.map((option) => (
        <button
          aria-checked={value === option.value}
          className={value === option.value ? 'is-active' : ''}
          key={option.value}
          role="radio"
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ActionButton({ iconName, label, onClick }: { iconName: AxiIconName; label: string; onClick: () => void }) {
  return (
    <button className="wb-system-settings__action" type="button" onClick={onClick}>
      <span>{label}</span>
      <AxiSvgIcon name={iconName} size={15} />
    </button>
  );
}

function ShortcutList({ rows }: { rows: ReadonlyArray<{ description: string; label: string; shortcut: string }> }) {
  return (
    <div className="wb-system-settings__shortcut-list">
      {rows.map(({ description, label, shortcut }) => (
        <SettingRow
          control={<kbd>{shortcut}</kbd>}
          description={description}
          key={label}
          label={label}
        />
      ))}
    </div>
  );
}

function SystemSettingsContent({
  activeTabId,
  activeSectionId,
  locale,
  onChange,
  onNavigate,
  onStylePresetChange,
  onThemePreferenceChange,
  settings,
  stylePresetOptions,
  themePreference,
  activeStylePreset,
}: SystemSettingsPanelProps & { activeSectionId: SystemSettingsSectionId; activeTabId: string }) {
  if (activeSectionId === 'appearance' && activeTabId === 'theme') {
    return (
      <div className="wb-system-settings__appearance-content">
        <AxiAdminSettingsContent
          appearanceOnly
          activeStylePreset={activeStylePreset}
          onChange={onChange}
          onStylePresetChange={onStylePresetChange}
          onThemePreferenceChange={onThemePreferenceChange}
          stylePresetOptions={stylePresetOptions}
          themePreference={themePreference}
          value={settings}
        />
      </div>
    );
  }

  if (activeSectionId === 'appearance' && activeTabId === 'layout') {
    return (
      <div className="wb-system-settings__page">
        <span className="wb-system-settings__section-label">{copy(locale, '页面结构', 'Page composition')}</span>
        <div className="wb-system-settings__list">
          <SettingRow
            control={(
              <OptionGroup
                ariaLabel={copy(locale, '菜单布局', 'Menu layout')}
                options={[
                  { value: 'vertical', label: copy(locale, '侧边', 'Side') },
                  { value: 'horizontal', label: copy(locale, '顶部', 'Top') },
                  { value: 'mixed', label: copy(locale, '混合', 'Mixed') },
                  { value: 'dual', label: copy(locale, '双栏', 'Dual') },
                ]}
                value={settings.menuLayout}
                onChange={(value) => onChange('menuLayout', value as AxiAdminSettings['menuLayout'])}
              />
            )}
            description={copy(locale, '决定主导航和页面入口的组织方式。', 'Choose how primary navigation and page entry points are organized.')}
            label={copy(locale, '菜单布局', 'Menu layout')}
          />
          <SettingRow
            control={(
              <OptionGroup
                ariaLabel={copy(locale, '标签页样式', 'Tab style')}
                options={[
                  { value: 'default', label: copy(locale, '默认', 'Default') },
                  { value: 'card', label: copy(locale, '卡片', 'Card') },
                  { value: 'google', label: 'Google' },
                ]}
                value={settings.tabStyle}
                onChange={(value) => onChange('tabStyle', value as AxiAdminSettings['tabStyle'])}
              />
            )}
            description={copy(locale, '控制顶部路由标签的密度和层次。', 'Control the density and hierarchy of route tabs.')}
            label={copy(locale, '标签页样式', 'Tab style')}
          />
          <SettingRow
            control={(
              <OptionGroup
                ariaLabel={copy(locale, '容器宽度', 'Container width')}
                options={[
                  { value: 'full', label: copy(locale, '铺满', 'Full') },
                  { value: 'fixed', label: copy(locale, '固定', 'Fixed') },
                ]}
                value={settings.containerWidth}
                onChange={(value) => onChange('containerWidth', value as AxiAdminSettings['containerWidth'])}
              />
            )}
            description={copy(locale, '控制内容画布是否保留固定阅读宽度。', 'Choose between a full-width or fixed reading canvas.')}
            label={copy(locale, '内容宽度', 'Content width')}
          />
        </div>
      </div>
    );
  }

  if (activeSectionId === 'general' && activeTabId === 'workspace') {
    return (
      <div className="wb-system-settings__page">
        <span className="wb-system-settings__section-label">{copy(locale, '工作区行为', 'Workspace behavior')}</span>
        <div className="wb-system-settings__list">
          <SettingRow
            control={<Toggle checked={settings.multiTab} label={copy(locale, '多标签页', 'Multiple tabs')} onChange={(value) => onChange('multiTab', value)} />}
            description={copy(locale, '在顶部保留多个已打开页面，便于在任务之间切换。', 'Keep multiple pages open in the top bar for fast task switching.')}
            label={copy(locale, '多标签页', 'Multiple tabs')}
          />
          <SettingRow
            control={<Toggle checked={settings.breadcrumb} label={copy(locale, '显示面包屑', 'Show breadcrumbs')} onChange={(value) => onChange('breadcrumb', value)} />}
            description={copy(locale, '在内容区上方显示当前页面的层级位置。', 'Show the current page hierarchy above the content area.')}
            label={copy(locale, '显示面包屑', 'Show breadcrumbs')}
          />
        </div>
      </div>
    );
  }

  if (activeSectionId === 'general' && activeTabId === 'behavior') {
    return (
      <div className="wb-system-settings__page">
        <span className="wb-system-settings__section-label">{copy(locale, '反馈与辅助', 'Feedback & assistance')}</span>
        <div className="wb-system-settings__list">
          <SettingRow
            control={<Toggle checked={settings.reloadButton} label={copy(locale, '显示刷新动作', 'Show reload action')} onChange={(value) => onChange('reloadButton', value)} />}
            description={copy(locale, '在顶栏保留显式刷新入口，适合本地开发与长时间工作。', 'Keep an explicit reload action for local development and long sessions.')}
            label={copy(locale, '刷新动作', 'Reload action')}
          />
          <SettingRow
            control={<Toggle checked={settings.progressBar} label={copy(locale, '显示进度条', 'Show progress bar')} onChange={(value) => onChange('progressBar', value)} />}
            description={copy(locale, '页面切换或加载时显示轻量进度反馈。', 'Show lightweight progress feedback while pages load or change.')}
            label={copy(locale, '加载进度', 'Loading progress')}
          />
          <SettingRow
            control={<Toggle checked={settings.watermark} label={copy(locale, '显示工作台标记', 'Show workbench mark')} onChange={(value) => onChange('watermark', value)} />}
            description={copy(locale, '在工作区角落保留产品标识，便于区分多个环境。', 'Keep a product mark in the workspace to distinguish environments.')}
            label={copy(locale, '工作台标记', 'Workbench mark')}
          />
        </div>
      </div>
    );
  }

  if (activeSectionId === 'account') {
    if (activeTabId === 'profile') {
      return (
        <div className="wb-system-settings__page">
          <span className="wb-system-settings__section-label">{copy(locale, '当前身份', 'Current identity')}</span>
          <div className="wb-system-settings__list">
            <SettingRow
              control={<ActionButton iconName={axiWorkbenchIconMap.forward} label={copy(locale, '打开个人资料', 'Open profile')} onClick={() => onNavigate('/admin/me')} />}
              description={copy(locale, '编辑昵称、头像和个人工作台资料。', 'Edit your nickname, avatar, and workbench profile.')}
              label={copy(locale, '个人资料', 'Profile')}
            />
            <SettingRow
              control={<span className="wb-system-settings__status is-ready">{copy(locale, '当前用户', 'Current user')}</span>}
              description={copy(locale, '账号数据由当前身份服务和工作台会话共同管理。', 'Account data is managed by the identity service and this workbench session.')}
              label={copy(locale, '会话身份', 'Session identity')}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="wb-system-settings__page">
        <span className="wb-system-settings__section-label">{copy(locale, '安全边界', 'Security boundary')}</span>
        <div className="wb-system-settings__list">
          <SettingRow
            control={<span className="wb-system-settings__status">{copy(locale, '受控', 'Managed')}</span>}
            description={copy(locale, '危险操作与跨端访问仍由对应业务页面和控制面确认。', 'Destructive actions and cross-device access remain confirmed by their owning surfaces.')}
            label={copy(locale, '操作确认', 'Action confirmation')}
          />
          <SettingRow
            control={<span className="wb-system-settings__status">OIDC</span>}
            description={copy(locale, '登录身份由 Workbench 的统一身份边界提供。', 'Sign-in identity is provided by the Workbench identity boundary.')}
            label={copy(locale, '登录方式', 'Sign-in')}
          />
        </div>
      </div>
    );
  }

  if (activeSectionId === 'devices') {
    if (activeTabId === 'paired') {
      return (
        <div className="wb-system-settings__page">
          <span className="wb-system-settings__section-label">{copy(locale, '跨端访问', 'Cross-device access')}</span>
          <div className="wb-system-settings__list">
            <SettingRow
              control={<ActionButton iconName={axiWorkbenchIconMap.forward} label={copy(locale, '管理设备', 'Manage devices')} onClick={() => onNavigate('/admin/me/devices')} />}
              description={copy(locale, '生成二维码、确认手机扫码并查看配对状态。', 'Generate a QR code, approve scans, and review pairing status.')}
              label={copy(locale, '手机配对', 'Mobile pairing')}
            />
            <SettingRow
              control={<span className="wb-system-settings__status">{copy(locale, '按需确认', 'Approval required')}</span>}
              description={copy(locale, '扫码只登记待确认设备，批准后手机才会取得访问权限。', 'Scanning only registers a pending device; access starts after approval.')}
              label={copy(locale, '访问策略', 'Access policy')}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="wb-system-settings__page">
        <span className="wb-system-settings__section-label">{copy(locale, '会话状态', 'Session status')}</span>
        <div className="wb-system-settings__list">
          <SettingRow
            control={<span className="wb-system-settings__status is-ready">{copy(locale, '当前浏览器', 'This browser')}</span>}
            description={copy(locale, '当前会话由已登录的 Web 工作台持有。', 'This session is held by the signed-in Web Workbench.')}
            label={copy(locale, '当前会话', 'Current session')}
          />
          <SettingRow
            control={<span className="wb-system-settings__status">{copy(locale, '受控', 'Managed')}</span>}
            description={copy(locale, '真实设备列表以设备管理页和身份服务返回为准。', 'The device page and identity service remain the source of truth for device lists.')}
            label={copy(locale, '设备来源', 'Device source')}
          />
        </div>
      </div>
    );
  }

  if (activeSectionId === 'notifications') {
    if (activeTabId === 'inbox') {
      return (
        <div className="wb-system-settings__page">
          <span className="wb-system-settings__section-label">{copy(locale, '提醒中心', 'Notification inbox')}</span>
          <div className="wb-system-settings__list">
            <SettingRow
              control={<ActionButton iconName={axiWorkbenchIconMap.forward} label={copy(locale, '打开通知中心', 'Open inbox')} onClick={() => onNavigate('/admin/me/notifications')} />}
              description={copy(locale, '查看、标记和处理工作台产生的系统提醒。', 'Review, mark, and handle system alerts from the workbench.')}
              label={copy(locale, '系统通知', 'System notifications')}
            />
            <SettingRow
              control={<span className="wb-system-settings__status">{copy(locale, '顶栏角标', 'Topbar badge')}</span>}
              description={copy(locale, '未读数量会同步到顶栏通知入口和桌面壳。', 'Unread counts appear in the topbar and desktop shell.')}
              label={copy(locale, '未读提醒', 'Unread alerts')}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="wb-system-settings__page">
        <span className="wb-system-settings__section-label">{copy(locale, '投递范围', 'Delivery scope')}</span>
        <div className="wb-system-settings__list">
          <SettingRow
            control={<span className="wb-system-settings__status is-ready">{copy(locale, '当前工作区', 'Current workspace')}</span>}
            description={copy(locale, '当前版本默认保留工作台内的提醒，不主动扩大到外部渠道。', 'The current version keeps alerts inside the workbench by default.')}
            label={copy(locale, '默认范围', 'Default scope')}
          />
          <SettingRow
            control={<span className="wb-system-settings__status">{copy(locale, '按需接入', 'On demand')}</span>}
            description={copy(locale, '桌面推送和消息通道将在对应能力接入后开放配置。', 'Desktop push and message channels become configurable when connected.')}
            label={copy(locale, '外部通道', 'External channels')}
          />
        </div>
      </div>
    );
  }

  if (activeSectionId === 'shortcuts') {
    const rows = activeTabId === 'global'
      ? [
          { label: copy(locale, '全局搜索', 'Global search'), description: copy(locale, '搜索页面、项目和工作项。', 'Search pages, projects, and work items.'), shortcut: '⌘ K' },
          { label: copy(locale, '返回上一页', 'Go back'), description: copy(locale, '回到最近访问的工作区页面。', 'Return to the last workspace page.'), shortcut: '⌘ [' },
          { label: copy(locale, '关闭面板', 'Close panel'), description: copy(locale, '关闭当前设置或详情面板。', 'Close the current settings or detail panel.'), shortcut: 'Esc' },
        ]
      : [
          { label: copy(locale, '收起侧栏', 'Collapse sidebar'), description: copy(locale, '切换主导航的展开状态。', 'Toggle the primary navigation.'), shortcut: '⌘ /' },
          { label: copy(locale, '刷新页面', 'Reload page'), description: copy(locale, '重新加载当前工作台页面。', 'Reload the current workbench page.'), shortcut: '⌘ R' },
          { label: copy(locale, '标签页菜单', 'Tab menu'), description: copy(locale, '管理已打开页面和标签。', 'Manage open pages and tabs.'), shortcut: '⌘ ⇧ P' },
        ];
    return (
      <div className="wb-system-settings__page">
        <span className="wb-system-settings__section-label">{copy(locale, '当前键位', 'Current bindings')}</span>
        <ShortcutList rows={rows} />
      </div>
    );
  }

  if (activeSectionId === 'about') {
    const runtimeTab = activeTabId === 'runtime';
    return (
      <div className="wb-system-settings__page">
        <span className="wb-system-settings__section-label">{runtimeTab ? copy(locale, '运行状态', 'Runtime status') : copy(locale, '产品身份', 'Product identity')}</span>
        <div className="wb-system-settings__list">
          <SettingRow
            control={<span className="wb-system-settings__value">{runtimeTab ? 'Web / Vite' : 'Axi Workbench'}</span>}
            description={runtimeTab ? copy(locale, '当前浏览器中的独立 Web 管理控制中心。', 'The independent Web administration center in this browser.') : copy(locale, '以第一性原则构建可验证工作世界的管理入口。', 'The management entry point for a verifiable working world.')}
            label={runtimeTab ? copy(locale, '运行面', 'Surface') : copy(locale, '产品', 'Product')}
          />
          <SettingRow
            control={<span className="wb-system-settings__status is-ready">{runtimeTab ? copy(locale, '本地会话', 'Local session') : 'v1.0'}</span>}
            description={runtimeTab ? copy(locale, '设置只改变当前用户的界面偏好，不直接修改业务数据。', "Settings change this user's interface preferences, not business data.") : copy(locale, '当前 Web 工作台的产品版本标识。', 'The current Web Workbench product version.')}
            label={runtimeTab ? copy(locale, '环境', 'Environment') : copy(locale, '版本', 'Version')}
          />
        </div>
      </div>
    );
  }

  return null;
}

export function SystemSettingsPanel(props: SystemSettingsPanelProps) {
  const [activeSectionId, setActiveSectionId] = useState<SystemSettingsSectionId>('general');
  const [activeTabId, setActiveTabId] = useState(systemSettingsTabs.general[0].id);
  const activeSection = useMemo(
    () => systemSettingsSections.find((section) => section.id === activeSectionId) || systemSettingsSections[0],
    [activeSectionId],
  );
  const activeTabs = systemSettingsTabs[activeSectionId];
  const activeTab = activeTabs.find((tab) => tab.id === activeTabId) || activeTabs[0];

  useEffect(() => {
    if (!props.open) return;
    setActiveSectionId('general');
    setActiveTabId(systemSettingsTabs.general[0].id);
  }, [props.open]);

  const selectSection = (sectionId: SystemSettingsSectionId) => {
    setActiveSectionId(sectionId);
    setActiveTabId(systemSettingsTabs[sectionId][0].id);
  };

  const title = copy(props.locale, '系统设置', 'System settings');
  const titleNode = (
    <span className="workbench-system-settings-title">
      <AxiSvgIcon name={axiWorkbenchIconMap.settings} size={17} />
      <span>{title}</span>
    </span>
  );

  return (
    <AxiDialogGroup
      aside={(
        <nav aria-label={copy(props.locale, '系统设置类别', 'System setting categories')} className="wb-system-settings__sections" role="tablist">
          {systemSettingsSections.map((section) => {
            const active = section.id === activeSectionId;
            return (
              <button
                aria-controls={`wb-system-settings-panel-${section.id}`}
                aria-current={active ? 'page' : undefined}
                aria-selected={active}
                className={active ? 'is-active' : ''}
                key={section.id}
                role="tab"
                tabIndex={active ? 0 : -1}
                type="button"
                onClick={() => selectSection(section.id)}
              >
                <AxiSvgIcon name={section.iconName} size={17} />
                <span>{copy(props.locale, section.zh, section.en)}</span>
              </button>
            );
          })}
        </nav>
      )}
      asideAriaLabel={copy(props.locale, '系统设置类别', 'System setting categories')}
      asideRatio={0.2}
      asideTitle={title}
      className="workbench-system-settings-dialog"
      closeLabel={copy(props.locale, '关闭系统设置', 'Close system settings')}
      controls={['fullscreen', 'close']}
      detailDescription={copy(props.locale, activeTab.descriptionZh, activeTab.descriptionEn)}
      detailTitle={copy(props.locale, activeSection.zh, activeSection.en)}
      footer={null}
      fullscreenLabel={copy(props.locale, '切换全屏', 'Toggle fullscreen')}
      height="min(760px, calc(100vh - 72px))"
      open={props.open}
      title={titleNode}
      width="min(1160px, calc(100vw - 32px))"
      onClose={() => props.onOpenChange(false)}
      onOpenChange={props.onOpenChange}
    >
      <div className="wb-system-settings__detail" id={`wb-system-settings-panel-${activeSection.id}`}>
        <nav aria-label={copy(props.locale, '当前设置页签', 'Current settings tabs')} className="wb-system-settings__tabs" role="tablist">
          {activeTabs.map((tab) => {
            const active = tab.id === activeTab.id;
            return (
              <button
                aria-controls={`wb-system-settings-tabpanel-${activeSection.id}`}
                aria-selected={active}
                className={active ? 'is-active' : ''}
                id={`wb-system-settings-tab-${activeSection.id}-${tab.id}`}
                key={tab.id}
                role="tab"
                tabIndex={active ? 0 : -1}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
              >
                {copy(props.locale, tab.zh, tab.en)}
              </button>
            );
          })}
        </nav>
        <div
          aria-labelledby={`wb-system-settings-tab-${activeSection.id}-${activeTab.id}`}
          className="wb-system-settings__tabpanel"
          id={`wb-system-settings-tabpanel-${activeSection.id}`}
          role="tabpanel"
        >
          <SystemSettingsContent {...props} activeSectionId={activeSection.id} activeTabId={activeTab.id} />
        </div>
      </div>
    </AxiDialogGroup>
  );
}

export { systemSettingsSections, systemSettingsTabs };
