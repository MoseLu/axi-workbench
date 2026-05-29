/**
 * 设置弹窗 - 个人中心 + 主题切换 + 设备管理（无左侧菜单栏）
 */
import React, { useState, useEffect } from 'react';
import { useTheme, Theme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import DeviceManagement from '../../control/DeviceManagement';

type MenuKey = 'profile' | 'devices' | 'theme';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const IconMaximize = () => (
  <img src="assets/window-maximize.svg" alt="最大化" style={{ width: 18, height: 18 }} />
);
const IconRestore = () => (
  <img src="assets/window-restore.svg" alt="还原" style={{ width: 18, height: 18 }} />
);
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M1 1l12 12M13 1L1 13" />
  </svg>
);
const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M9 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h6" />
    <path d="M12 10l3-3-3-3" />
    <path d="M15 7H6" />
  </svg>
);

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [activeMenu, setActiveMenu] = useState<MenuKey>('devices');
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const toggleMaximize = () => setMaximized(m => !m);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = maximized ? vw : Math.round(vw * 0.6);
  const height = maximized ? vh : Math.round(vh * 0.6);
  const top = maximized ? 0 : Math.round((vh - height) / 2);
  const left = maximized ? 0 : Math.round((vw - width) / 2);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', width, height, top, left,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: maximized ? 0 : 10, boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* 标题栏 */}
        <div style={{
          height: 44, padding: '0 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-tertiary)', flexShrink: 0, userSelect: 'none',
          // @ts-expect-error webkitAppRegion not in CSSProperties
          WebkitAppRegion: 'drag',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>设置</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, // @ts-expect-error
          WebkitAppRegion: 'no-drag' }}>
            <button onClick={toggleMaximize} title={maximized ? '还原' : '最大化'}
              style={{ width: 36, height: 36, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {maximized ? <IconRestore /> : <IconMaximize />}
            </button>
            <button onClick={onClose} title="关闭"
              style={{ width: 36, height: 36, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconClose />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 左侧菜单 */}
          <div style={{
            width: 180, borderRight: '1px solid var(--border)',
            background: 'var(--bg-secondary)', flexShrink: 0, overflow: 'hidden',
            display: 'flex', flexDirection: 'column', padding: 0,
          }}>
            {([
              { key: 'profile' as MenuKey, label: '个人中心' },
              { key: 'devices' as MenuKey, label: '设备管理' },
              { key: 'theme' as MenuKey, label: '主题设置' },
            ]).map(item => (
              <button key={item.key} onClick={() => setActiveMenu(item.key)}
                style={{
                  padding: '10px 16px', cursor: 'pointer', border: 'none', width: '100%',
                  background: activeMenu === item.key ? 'var(--accent)' : 'transparent',
                  color: activeMenu === item.key ? 'white' : 'var(--text-secondary)',
                  fontSize: 14, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                {item.label}
              </button>
            ))}
          </div>

          {/* 右侧内容 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* 个人中心 */}
            {activeMenu === 'profile' && (
              <div style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'var(--text-primary)' }}>个人中心</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <img
                    src="assets/logo-128x128.png"
                    alt="头像"
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'contain' }}
                  />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.username ?? '管理员'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>管理员</div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <button
                    onClick={logout}
                    style={{
                      padding: '10px 20px', border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.06)',
                      color: '#ef4444', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <IconLogout /> 退出登录
                  </button>
                </div>
              </div>
            )}

            {/* 主题设置 */}
            {activeMenu === 'theme' && (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                <div style={{ display: 'flex', gap: 32, justifyContent: 'center', alignItems: 'center' }}>
                  {([
                    { key: 'light' as Theme, label: '浅色', iconSrc: 'assets/color-mode-light.svg' },
                    { key: 'system' as Theme, label: '跟随系统', iconSrc: theme === 'system' ? 'assets/color-mode-auto.svg' : 'assets/color-mode-auto-unselected.svg' },
                    { key: 'dark' as Theme, label: '深色', iconSrc: 'assets/color-mode-dark.svg' },
                  ]).map(opt => (
                    <div key={opt.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <img
                        src={opt.iconSrc}
                        alt={opt.label}
                        onClick={() => setTheme(opt.key)}
                        style={{
                          cursor: 'pointer',
                          border: `2px solid ${theme === opt.key ? '#3B82F6' : 'transparent'}`,
                          borderRadius: 14,
                          transition: 'all 0.15s',
                        }}
                      />
                      <span style={{ fontSize: 12, color: theme === opt.key ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: theme === opt.key ? 600 : 400 }}>
                        {opt.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 设备管理 */}
            {activeMenu === 'devices' && (
              <div style={{ height: '100%' }}>
                <DeviceManagement maximized={maximized} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
