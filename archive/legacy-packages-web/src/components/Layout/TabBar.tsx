import React, { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { IconButton } from '@epap/ui';
import type { TabItem } from '@epap/ui';
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
          tooltip="后退"
          onClick={() => onNavigate('back')}
        />
        <IconButton
          icon={<Icon name="actions-refresh" size={16} />}
          tooltip="刷新"
          onClick={() => onNavigate('reload')}
        />
        <IconButton
          icon={<Icon name="navigation-home" size={16} />}
          tooltip="首页"
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
            tooltip="标签操作"
            onClick={() => setMenuOpen(!menuOpen)}
          />
          {menuOpen && (
            <div className="app-process__dropdown">
              <div
                className="app-process__dropdown-item"
                onClick={() => { onTogglePin(activeTab); setMenuOpen(false); }}
              >
                <Icon name="actions-pin" size={14} />
                <span>{isPinned ? '取消固定' : '固定标签'}</span>
              </div>
              <div
                className="app-process__dropdown-item"
                onClick={() => { onCloseLeft(); setMenuOpen(false); }}
              >
                <Icon name="navigation-left" size={14} />
                <span>关闭左侧</span>
              </div>
              <div
                className="app-process__dropdown-item"
                onClick={() => { onCloseRight(); setMenuOpen(false); }}
              >
                <Icon name="navigation-right" size={14} />
                <span>关闭右侧</span>
              </div>
              <div
                className="app-process__dropdown-item"
                onClick={() => { onCloseOther(); setMenuOpen(false); }}
              >
                <Icon name="actions-close" size={14} />
                <span>关闭其他</span>
              </div>
              <div
                className="app-process__dropdown-item"
                onClick={() => { onCloseAll(); setMenuOpen(false); }}
              >
                <Icon name="actions-close-border" size={14} />
                <span>关闭全部</span>
              </div>
            </div>
          )}
        </div>

        {/* Fullscreen toggle */}
        <IconButton
          icon={<Icon name={isFullscreen ? 'actions-screen-normal' : 'actions-screen-full'} size={16} />}
          tooltip={isFullscreen ? '退出全屏' : '内容全屏'}
          onClick={onToggleFullscreen}
        />
      </div>
    </div>
  );
};

export default TabBar;
