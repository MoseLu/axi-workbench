/**
 * SystemSettingsPanel — 系统设置主面板。
 *
 * 只承载：
 *   - 当前 section / tab 的状态机
 *   - aside（左侧导航）与 detail（右侧内容）布局
 *
 * 子模块：
 *   - ./types.ts     类型 + sections/tabs 静态数据
 *   - ./widgets.tsx  设置项基础控件
 *   - ./content.tsx  各 section/tab 对应的设置详情面板
 */
import React, { useEffect, useMemo, useState } from 'react';

import { AxiSvgIcon } from "@axi/icons";
import { AxiDialogGroup } from '@axi/crud';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';

import '../SystemSettingsPanel.css';

import { copy } from './widgets';
import { SystemSettingsContent } from './content';
import { systemSettingsSections, systemSettingsTabs, type SystemSettingsPanelProps, type SystemSettingsSectionId } from './types';

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
export type { SystemSettingsPanelProps, SystemSettingsSectionId };