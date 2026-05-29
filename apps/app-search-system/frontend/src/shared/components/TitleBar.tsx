/**
 * 自定义标题栏组件（用于 frameless Electron 窗口）
 * 使用 CSS -webkit-app-region: drag 使整个栏可拖动
 */
import React, { useState, useEffect } from 'react';

type ExtendedCSSProps = React.CSSProperties & { webkitAppRegion?: 'drag' | 'no-drag' };

const styles: Record<string, ExtendedCSSProps> = {
  bar: {
    height: 36,
    background: 'var(--bg-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0',
    webkitAppRegion: 'drag',
    userSelect: 'none',
    flexShrink: 0,
    borderBottom: '1px solid var(--border)',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  logo: {
    width: 20,
    height: 20,
    borderRadius: 4,
    objectFit: 'contain' as const,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    webkitAppRegion: 'no-drag',
    paddingRight: 0,
  },
  windowControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  btn: {
    width: 46,
    height: 36,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    transition: 'background 0.15s',
    background: 'transparent',
    color: 'var(--text-primary)',
    padding: 0,
  },
};

interface TitleBarProps {
  title?: string;
  onSettingsClick?: () => void;
}

export default function TitleBar({ title = 'Axi Docs Control', onSettingsClick }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (window.electronAPI?.isMaximized) {
        setMaximized(await window.electronAPI.isMaximized());
      }
    };
    check();
    const interval = setInterval(check, 500);

    const removeListener = window.electronAPI?.onMaximizeChange?.((isMax: boolean) => {
      setMaximized(isMax);
    });

    return () => {
      clearInterval(interval);
      removeListener?.();
    };
  }, []);

  const minimize = () => window.electronAPI?.minimizeWindow?.();
  const toggleMax = async () => {
    await window.electronAPI?.maximizeWindow?.();
    if (window.electronAPI?.isMaximized) {
      setMaximized(await window.electronAPI.isMaximized());
    }
  };
  const close = () => window.electronAPI?.closeWindow?.();

  return (
    <div style={styles.bar}>
      <div style={styles.logoArea}>
        <img
          src={`${process.env.PUBLIC_URL || ''}/assets/logo-24x24.png`}
          alt="SOP"
          style={styles.logo}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--title-text)', letterSpacing: '0.5px' }}>{title}</span>
      </div>
      <div style={styles.controls}>
        <button
          type="button"
          className="title-bar-btn"
          onClick={onSettingsClick}
          title="设置"
          style={styles.btn}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <div style={styles.windowControls}>
          <button type="button" className="title-bar-btn" onClick={minimize} title="最小化" style={styles.btn}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1" y="5.5" width="10" height="1" />
            </svg>
          </button>
          <button type="button" className="title-bar-btn" onClick={toggleMax} title={maximized ? '还原' : '最大化'} style={styles.btn}>
            {maximized ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 1h8v8h-2v2H1V3h2V1zm1 1v1h5v5h1V2H4zm-2 3v5h5V5H2z" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="1.5" y="1.5" width="9" height="9" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="title-bar-btn title-bar-btn-close"
            onClick={close}
            title="关闭"
            style={styles.btn}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
