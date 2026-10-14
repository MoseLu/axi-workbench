/**
 * SystemSettingsContent — 各 section / tab 对应的设置详情面板。
 *
 * 完整保留原 SystemSettingsContent 内部的所有分支（外观主题 / 布局 / 通用工作区
 * / 通用行为 / 账号 / 设备 / 通知 / 快捷键 / 关于）；只把内部 import 与 copy 函
 * 数替换为本地命名空间 import。
 */
import React from 'react';

import { AxiAdminSettingsContent } from '@axi/settings';
import type { AxiAdminSettings } from '@axi/settings';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';

import {
  ActionButton,
  OptionGroup,
  SettingRow,
  ShortcutList,
  Toggle,
  copy,
} from './widgets';
import type { SystemSettingsPanelProps, SystemSettingsSectionId } from './types';

export function SystemSettingsContent({
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