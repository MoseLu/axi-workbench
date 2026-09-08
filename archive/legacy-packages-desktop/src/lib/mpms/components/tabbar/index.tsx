import React, { useRef, useState, useEffect } from 'react';
import type { TabItem } from '../../types';
import TabbarIcon from '../atoms/layout-specific/tabbar-icon';
import './style.css';

export interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  isFullscreen?: boolean;
  /** Navigation icons — rendered in left op area */
  backIcon?: React.ReactNode;
  refreshIcon?: React.ReactNode;
  homeIcon?: React.ReactNode;
  /** Right action icons */
  menuIcon?: React.ReactNode;
  fullscreenIcon?: React.ReactNode;
  exitFullscreenIcon?: React.ReactNode;
  closeIcon?: React.ReactNode;
  /** Tab dropdown menu items */
  pinIcon?: React.ReactNode;
  closeLeftIcon?: React.ReactNode;
  closeRightIcon?: React.ReactNode;
  closeOtherIcon?: React.ReactNode;
  closeAllIcon?: React.ReactNode;
  /** Callbacks */
  onTabChange?: (key: string) => void;
  onTabClose?: (key: string) => void;
  onNavigate?: (direction: 'back' | 'reload' | 'home') => void;
  onToggleFullscreen?: () => void;
  onCloseLeft?: () => void;
  onCloseRight?: () => void;
  onCloseOther?: () => void;
  onCloseAll?: () => void;
  onTogglePin?: (key: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs, activeTab, isFullscreen = false,
  backIcon, refreshIcon, homeIcon,
  menuIcon, fullscreenIcon, exitFullscreenIcon, closeIcon,
  pinIcon, closeLeftIcon, closeRightIcon, closeOtherIcon, closeAllIcon,
  onTabChange, onTabClose, onNavigate, onToggleFullscreen,
  onCloseLeft, onCloseRight, onCloseOther, onCloseAll, onTogglePin,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const activeTabItem = tabs.find(t => t.key === activeTab);
  const isPinned = activeTabItem?.closable === false;

  return (
    <div className="mpms-tabbar">
      <div className="mpms-tabbar__op">
        <TabbarIcon
          icon={backIcon}
          tooltip="后退"
          onClick={() => onNavigate?.('back')}
        />
        <TabbarIcon
          icon={refreshIcon}
          tooltip="刷新"
          onClick={() => onNavigate?.('reload')}
        />
        <TabbarIcon
          icon={homeIcon}
          tooltip="首页"
          onClick={() => onNavigate?.('home')}
        />
      </div>

      <div className="mpms-tabbar__container">
        <div className="mpms-tabbar__scroller">
          {tabs.map(tab => (
            <div
              key={tab.key}
              className={`mpms-tabbar__item ${activeTab === tab.key ? 'is-active' : ''}`}
              onClick={() => onTabChange?.(tab.key)}
              title={tab.label}
            >
              <span className="mpms-tabbar__item-label">{tab.label}</span>
              {tab.closable !== false && (
                <TabbarIcon
                  icon={closeIcon}
                  tooltip="关闭"
                  onClick={(e) => { e?.stopPropagation(); onTabClose?.(tab.key); }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mpms-tabbar__op mpms-tabbar__op--right">
        <div className="mpms-tabbar__dropdown-wrap" ref={menuRef}>
          <TabbarIcon
            icon={menuIcon}
            tooltip="标签操作"
            onClick={() => setMenuOpen(!menuOpen)}
          />
          {menuOpen && (
            <div className="mpms-tabbar__dropdown">
              <div className="mpms-tabbar__dropdown-item" onClick={() => { onTogglePin?.(activeTab); setMenuOpen(false); }}>
                {pinIcon}<span>{isPinned ? '取消固定' : '固定标签'}</span>
              </div>
              <div className="mpms-tabbar__dropdown-item" onClick={() => { onCloseLeft?.(); setMenuOpen(false); }}>
                {closeLeftIcon}<span>关闭左侧</span>
              </div>
              <div className="mpms-tabbar__dropdown-item" onClick={() => { onCloseRight?.(); setMenuOpen(false); }}>
                {closeRightIcon}<span>关闭右侧</span>
              </div>
              <div className="mpms-tabbar__dropdown-item" onClick={() => { onCloseOther?.(); setMenuOpen(false); }}>
                {closeOtherIcon}<span>关闭其他</span>
              </div>
              <div className="mpms-tabbar__dropdown-item" onClick={() => { onCloseAll?.(); setMenuOpen(false); }}>
                {closeAllIcon}<span>关闭全部</span>
              </div>
            </div>
          )}
        </div>
        <TabbarIcon
          icon={isFullscreen ? exitFullscreenIcon : fullscreenIcon}
          tooltip={isFullscreen ? '退出全屏' : '内容全屏'}
          onClick={onToggleFullscreen}
        />
      </div>
    </div>
  );
};

export default TabBar;
