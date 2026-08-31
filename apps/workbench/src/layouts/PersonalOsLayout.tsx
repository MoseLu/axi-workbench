import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AxiLogoMark, AxiSvgIcon } from '@axi/core';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import { useI18n } from '../i18n';
import './PersonalOsLayout.css';

type PersonalOsLayoutProps = {
  displayName: string;
  email?: string;
  onGlobalSearch: () => void;
  onLogout: () => void;
};

const navItems = [
  { path: '/admin/personal-os/today', labelKey: 'personalOs.nav.today', iconName: axiWorkbenchIconMap.overview },
  { path: '/admin/personal-os/workbench', labelKey: 'personalOs.nav.workbench', iconName: axiWorkbenchIconMap.project },
] as const;

const PersonalOsLayout: React.FC<PersonalOsLayoutProps> = ({ displayName, email, onGlobalSearch, onLogout }) => {
  const { t } = useI18n();
  const location = useLocation();
  const activeItem = navItems.find((item) => location.pathname.startsWith(item.path)) ?? navItems[0];

  return (
    <div className="personal-os-shell">
      <aside className="personal-os-shell__sidebar" aria-label={t('personalOs.shell.navigationLabel')}>
        <div className="personal-os-shell__brand">
          <AxiLogoMark className="personal-os-shell__brand-mark" size={28} />
          <div>
            <strong>{t('personalOs.shell.brand')}</strong>
            <span>{t('personalOs.shell.subtitle')}</span>
          </div>
        </div>

        <nav className="personal-os-shell__nav">
          <span className="personal-os-shell__section-label">{t('personalOs.shell.section')}</span>
          {navItems.map((item) => {
            const active = activeItem.path === item.path;
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={`personal-os-shell__nav-item${active ? ' is-active' : ''}`}
                key={item.path}
                to={item.path}
              >
                <AxiSvgIcon name={item.iconName} size={18} />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="personal-os-shell__sidebar-foot">
          <span>{t('personalOs.shell.localFirst')}</span>
          <span>{t('personalOs.shell.ownerOnly')}</span>
        </div>
      </aside>

      <div className="personal-os-shell__body">
        <header className="personal-os-shell__topbar">
          <div className="personal-os-shell__title-group">
            <span className="personal-os-shell__eyebrow">{t('personalOs.shell.eyebrow')}</span>
            <h1>{t(activeItem.labelKey)}</h1>
          </div>
          <div className="personal-os-shell__actions">
            <button
              aria-label={t('personalOs.shell.search')}
              className="personal-os-shell__search"
              onClick={onGlobalSearch}
              type="button"
            >
              <AxiSvgIcon name={axiWorkbenchIconMap.search} size={16} />
              <span className="personal-os-shell__search-label">{t('personalOs.shell.search')}</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="personal-os-shell__identity">
              <span className="personal-os-shell__avatar" aria-hidden="true">
                <AxiSvgIcon name={axiWorkbenchIconMap.account} size={16} />
              </span>
              <span className="personal-os-shell__identity-copy">
                <strong>{displayName}</strong>
                {email ? <span>{email}</span> : null}
              </span>
              <button
                aria-label={t('personalOs.shell.logout')}
                className="personal-os-shell__logout"
                onClick={onLogout}
                type="button"
              >
                <AxiSvgIcon name={axiWorkbenchIconMap.logout} size={16} />
              </button>
            </div>
          </div>
        </header>
        <div className="personal-os-shell__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default PersonalOsLayout;
