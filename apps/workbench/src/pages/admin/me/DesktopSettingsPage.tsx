import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiCrudLayout, AxiFilterGroup, AxiMasterList, type AxiMasterListItem } from '@axi/crud';
import '../DesktopCrudFrame.css';
import './DesktopSettingsPage.css';

const settingsItems: AxiMasterListItem[] = [
  { key: '/admin/me/theme', label: '主题外观', description: '界面显示偏好' },
  { key: '/admin/me/devices', label: '设备管理', description: '登录设备会话' },
];

type DesktopSettingsPageProps = {
  activeKey: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  title: string;
};

/**
 * Workbench preference workspace. Profile and notification pages deliberately
 * do not use this component: they are topbar special pages, not settings-menu
 * children.
 */
export function DesktopSettingsPage({ activeKey, actions, children, title }: DesktopSettingsPageProps) {
  const navigate = useNavigate();

  return (
    <main aria-labelledby="wb-settings-page-title" className="wb-settings-page wb-crud-page">
      <AxiCrudLayout className="wb-settings-page__layout">
        <AxiFilterGroup
          className="wb-settings-page__workspace"
          filters={(
            <AxiMasterList
              activeKey={activeKey}
              items={settingsItems}
              title="系统设置"
              onSelect={(key) => navigate(key)}
            />
          )}
        >
          <section className="wb-settings-page__content">
            <header className="wb-settings-page__header">
              <h1 id="wb-settings-page-title">{title}</h1>
              {actions ? <div className="wb-settings-page__actions">{actions}</div> : null}
            </header>
            <div className="wb-settings-page__body">{children}</div>
          </section>
        </AxiFilterGroup>
      </AxiCrudLayout>
    </main>
  );
}
