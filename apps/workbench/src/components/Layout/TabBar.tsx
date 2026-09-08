import React, { useRef, useState } from 'react';
import Icon from '../Icon';
import { IconButton } from '@epap/ui';
import type { TabItem } from '@epap/ui';
import { useI18n } from '../../i18n';
import './TabBar.css';

interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  isFullscreen: boolean;
  onTabChange: (key: string) => void;
  onTabClose: (key: string) => void;
  onNavigate: (direction: 'back' | 'reload' | 'home') => void;
  onToggleFullscreen: () => void;
  onCloseLeft: () => void;
  onCloseRight: () => void;
  onCloseOther: () => void;
  onCloseAll: () => void;
  onTogglePin: (key: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  isFullscreen,
  onTabChange,
  onTabClose,
  onNavigate,
  onToggleFullscreen,
  onCloseLeft,
  onCloseRight,
  onCloseOther,
  onCloseAll,
  onTogglePin,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  // Close menu on outside click
  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const activeTabItem = tabs.find(t => t.key === activeTab);
  const isPinned = activeTabItem?.closable === false;

  return (
    <div className="app-process">
      {/* Left navigation buttons */}
      <div className="app-process__op">
        <IconButton
          icon={<Icon name="navigation-back" size={16} />}
          tooltip={t('tabbar.nav.back')}
          onClick={() => onNavigate('back')}
        />
        <IconButton
          icon={<Icon name="actions-refresh" size={16} />}
          tooltip={t('tabbar.nav.reload')}
          onClick={() => onNavigate('reload')}
        />
        <IconButton
          icon={<Icon name="navigation-home" size={16} />}
          tooltip={t('tabbar.nav.home')}
          onClick={() => onNavigate('home')}
        />
      </div>

      {/* Tab items container */}
      <div className="app-process__container" ref={containerRef}>
        <div className="app-process__scroller">
          {tabs.map(tab => (
            <div
              key={tab.key}
              className={`app-process__item ${activeTab === tab.key ? 'is-active' : ''}`}
              onClick={() => onTabChange(tab.key)}
              title={tab.label}
            >
              <span className="app-process__item-label">{tab.label}</span>
              {tab.closable !== false && (
                <span
                  className="app-process__item-close"
                  onClick={e => {
                    e.stopPropagation();
                    onTabClose(tab.key);
                  }}
                >
                  <Icon name="actions-close" size={12} />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right action buttons */}
      <div className="app-process__op app-process__op--right">
        {/* Tab operations dropdown */}
        <div className="app-process__dropdown-wrap" ref={menuRef}>
          <IconButton
            icon={<Icon name="navigation-tabbar-menu" size={16} />}
            tooltip={t('tabbar.menu.tooltip')}
            onClick={() => setMenuOpen(!menuOpen)}
          />
          {menuOpen && (
            <div className="app-process__dropdown">
              <div
                className="app-process__dropdown-item"
                onClick={() => { onTogglePin(activeTab); setMenuOpen(false); }}
              >
                <Icon name="actions-pin" size={14} />
                <span>{isPinned ? t('tabbar.menu.unpin') : t('tabbar.menu.pin')}</span>
              </div>
              <div
                className="app-process__dropdown-item"
                onClick={() => { onCloseLeft(); setMenuOpen(false); }}
              >
                <Icon name="navigation-left" size={14} />
                <span>{t('tabbar.menu.closeLeft')}</span>
              </div>
              <div
                className="app-process__dropdown-item"
                onClick={() => { onCloseRight(); setMenuOpen(false); }}
              >
                <Icon name="navigation-right" size={14} />
                <span>{t('tabbar.menu.closeRight')}</span>
              </div>
              <div
                className="app-process__dropdown-item"
                onClick={() => { onCloseOther(); setMenuOpen(false); }}
              >
                <Icon name="actions-close" size={14} />
                <span>{t('tabbar.menu.closeOther')}</span>
              </div>
              <div
                className="app-process__dropdown-item"
                onClick={() => { onCloseAll(); setMenuOpen(false); }}
              >
                <Icon name="actions-close-border" size={14} />
                <span>{t('tabbar.menu.closeAll')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Fullscreen toggle */}
        <IconButton
          icon={<Icon name={isFullscreen ? 'actions-screen-normal' : 'actions-screen-full'} size={16} />}
          tooltip={isFullscreen ? t('tabbar.fullscreen.exit') : t('tabbar.fullscreen.enter')}
          onClick={onToggleFullscreen}
        />
      </div>
    </div>
  );
};

export default TabBar;
