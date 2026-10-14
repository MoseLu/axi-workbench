/**
 * 待机主页视图（登录状态栏 + OTA 更新提示 + 入口按钮）
 */
import { downloadAndInstall, formatSize } from '../../../services/ota.service';
import { IconPush, IconSearch, IconExit, IconSettings } from './icons';

interface IdleHomeViewProps {
  isLoggedIn: boolean;
  loginData: { deviceNumber?: string } | null;
  localIP: string | null;
  connected: boolean;
  backendBaseURL: string;
  backendInfoText: string;
  apiError: string | null;
  pendingUpdate: OtaUpdate | null;
  onDismissUpdate: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenBrowse: () => void;
  onOpenPushHistory: () => void;
  pushHistoryCount: number;
  onQuit: () => void;
}

export default function IdleHomeView({
  isLoggedIn,
  loginData,
  localIP,
  connected,
  backendBaseURL,
  backendInfoText,
  apiError,
  pendingUpdate,
  onDismissUpdate,
  onLogout,
  onOpenSettings,
  onOpenBrowse,
  onOpenPushHistory,
  pushHistoryCount,
  onQuit,
}: IdleHomeViewProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh',
      background: 'var(--axi-bg-page, #0d1117)',
      color: 'white', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Axi Docs Display</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isLoggedIn && loginData ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, fontSize: 12, color: 'var(--axi-text-muted, #94a3b8)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--axi-warning, #fbbf24)' }}>{loginData.deviceNumber}</span>
                {localIP && (
                  <>
                    <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{ fontFamily: 'monospace', color: 'var(--axi-text, #e2e8f0)' }}>{localIP}</span>
                    <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: !backendBaseURL ? 'var(--axi-danger, #ef4444)' : !connected ? 'var(--axi-warning, #f59e0b)' : 'var(--axi-success, #22c55e)',
                      flexShrink: 0,
                    }} />
                  </>
                )}
                <span style={{ fontFamily: 'monospace', color: 'var(--axi-text-muted, #94a3b8)', fontSize: 11 }}>{backendInfoText}</span>
              </div>
              {apiError && !connected && (
                <div style={{ fontSize: 11, color: 'var(--axi-danger, #fca5a5)' }}>
                  {apiError}
                </div>
              )}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 12px',
              background: 'rgba(255,255,255,0.08)', color: 'var(--axi-text, #e2e8f0)',
              border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6,
              fontSize: 12, cursor: 'pointer',
            }}
            title="连接设置"
          >
            <IconSettings /> 连接设置
          </button>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={onLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 12px',
                background: 'rgba(239,68,68,0.2)', color: 'var(--axi-danger, #fca5a5)',
                border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6,
                fontSize: 12, cursor: 'pointer',
              }}
              title="退出登录"
            >
              <IconExit /> 退出登录
            </button>
          ) : (
            <button
              type="button"
              className="quit-btn"
              onClick={onQuit}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 12px',
                background: 'rgba(239,68,68,0.2)', color: 'var(--axi-danger, #fca5a5)',
                border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6,
                fontSize: 12, cursor: 'pointer',
              }}
              title="退出应用"
            >
              <IconExit /> 退出
            </button>
          )}
        </div>
      </div>

      {pendingUpdate && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 24px', flexShrink: 0,
          background: 'rgba(34,197,94,0.15)',
          borderBottom: '1px solid rgba(34,197,94,0.3)',
          color: 'var(--axi-success, #86efac)', fontSize: 13,
        }}>
          <span style={{ flex: 1 }}>
            发现新版本 <strong>{pendingUpdate.displayVersion || pendingUpdate.version}</strong>
            {pendingUpdate.size ? ` (${formatSize(pendingUpdate.size)})` : ''}
            {pendingUpdate.note ? ` — ${pendingUpdate.note}` : ''}
          </span>
          <button
            type="button"
            onClick={async () => {
              // 立即清除 pendingUpdate，避免重复弹窗
              onDismissUpdate();
              try {
                // 传入服务器版本号，downloadAndInstall 会保存到 localStorage
                await downloadAndInstall(pendingUpdate.downloadUrl, pendingUpdate.version);
              } catch (e) {
                console.error('[OTA] 安装失败', e);
              }
            }}
            style={{
              padding: '4px 16px',
              background: 'var(--axi-success, #22c55e)', color: 'white',
              border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            }}
          >
            更新
          </button>
          <button
            type="button"
            onClick={onDismissUpdate}
            style={{
              padding: '4px 8px',
              background: 'transparent', color: 'var(--axi-success, #86efac)',
              border: '1px solid rgba(134,239,172,0.4)', borderRadius: 6,
              fontSize: 12, cursor: 'pointer',
            }}
          >
            忽略
          </button>
        </div>
      )}

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <img
          src={`${process.env.PUBLIC_URL || ''}/assets/hero-display.png`}
          alt=""
          style={{ width: 400, height: 'auto', marginBottom: 28, opacity: 0.9 }}
        />
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 12px', color: 'white' }}>Axi Docs Display</h1>
        <p style={{ color: 'var(--axi-text-muted, #94a3b8)', marginBottom: 28, fontSize: 15 }}>
          等待中控端推送指令，或手动搜索浏览
        </p>

        <button
          type="button"
          className="browse-btn"
          onClick={onOpenBrowse}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '14px 40px', minWidth: 240,
            background: 'rgba(255,255,255,0.08)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12, fontSize: 16, cursor: 'pointer',
            marginBottom: 16,
            transition: 'background 0.2s',
          }}
        >
          <IconSearch /> 浏览 SOP
        </button>
        {pushHistoryCount > 0 && (
          <button
            type="button"
            onClick={onOpenPushHistory}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px 40px', minWidth: 240,
              background: 'rgba(34,197,94,0.1)',
              color: 'var(--axi-success, #4ade80)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 12, fontSize: 16, cursor: 'pointer',
              marginBottom: 16,
              transition: 'background 0.2s',
            }}
          >
            <IconPush /> 推送历史
            <span style={{
              padding: '2px 8px',
              background: 'var(--axi-success, #22c55e)', color: 'white',
              borderRadius: 10, fontSize: 12,
            }}>
              {pushHistoryCount}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
