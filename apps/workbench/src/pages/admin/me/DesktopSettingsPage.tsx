import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiCrudLayout, AxiFilterGroup, AxiMasterList, type AxiMasterListItem } from '@axi/crud';
import '../DesktopCrudFrame.css';
import './DesktopSettingsPage.css';

const settingsItems: AxiMasterListItem[] = [
  { key: '/admin/me', label: '个人中心', description: '账户概览与常用设置' },
  { key: '/admin/me/account', label: '账号资料', description: '头像、昵称与联系方式' },
  { key: '/admin/me/notifications', label: '通知中心', description: '查看并处理工作台提醒' },
  { key: '/admin/me/theme', label: '主题外观', description: '界面显示偏好' },
  { key: '/admin/me/settings', label: '设置入口', description: '账号与外观设置' },
  { key: '/admin/me/devices', label: '设备管理', description: '登录设备会话' },
];

type DesktopSettingsPageProps = {
  activeKey: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  title: string;
};

/** 桌面端账户与设置工作区：左侧目录，右侧承载当前设置，而不是手机式二级页。 */
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
              title="账号与设置"
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
