/**
 * 展示端登录页面
 * - 设备编号 + 设备密码登录
 * - UUID + 设备编号双重验证
 */
import React, { useState } from 'react';
import apiClient from '../shared/api/client';
import { getOrCreateDisplayClientUuid } from '../shared/deviceIdentity';

interface LoginPageProps {
  onLogin: (data: {
    uuid: string;
    deviceNumber: string;
    displayName: string;
    deviceGroup: string;
    assignedJobs: string;
  }) => void;
  onOpenSettings: () => void;
}

export default function LoginPage({ onLogin, onOpenSettings }: LoginPageProps) {
  // 从 localStorage 恢复上次登录的设备编号，实现免输入
  const [deviceNumber, setDeviceNumber] = useState(() => localStorage.getItem('sop_device_number') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientUuid] = useState(() => getOrCreateDisplayClientUuid());

  const handleLogin = async () => {
    if (!deviceNumber.trim()) return;
    setError('');
    setLoading(true);

    try {
      const result = await apiClient.displayLogin(deviceNumber.trim(), password, clientUuid);
      console.log('[Display Login] 登录成功:', result);

      // UUID 双重验证：防止更换设备（如果 localStorage 有记录，必须 UUID 也对得上）
      if (result.uuid !== clientUuid) {
        console.warn('[Display Login] UUID 不匹配，拒绝登录。设备:', clientUuid, '实际:', result.uuid);
        setError('当前设备与该编号未绑定，请在中控端重新分配后再登录');
        setLoading(false);
        return;
      }

      // 登录成功：保存会话信息
      localStorage.setItem('sop_device_uuid', result.uuid);
      localStorage.setItem('sop_device_number', result.device_number);
      localStorage.setItem('sop_device_display_name', result.display_name);
      localStorage.setItem('sop_device_group', result.device_group || '');

      onLogin({
        uuid: result.uuid,
        deviceNumber: result.device_number,
        displayName: result.display_name,
        deviceGroup: result.device_group || '',
        assignedJobs: result.assigned_jobs || '',
      });
    } catch (err) {
      const e = err as Error;
      console.error('[Display Login] 登录失败:', e.message);
      setError(e.message || '登录失败，请检查设备编号和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--axi-bg-page, #0d1117)',
      fontFamily: 'system-ui, sans-serif',
      color: 'white',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 40 }}>
        <img
          src={`${process.env.PUBLIC_URL || ''}/assets/hero-display.png`}
          alt=""
          style={{ width: 280, height: 'auto', opacity: 0.8 }}
        />
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px', color: 'white' }}>
        Axi Docs Display
      </h1>
      <p style={{ color: 'var(--axi-text-muted, #64748b)', fontSize: 14, margin: '0 0 36px' }}>
        请输入中控端分配的设备编号登录
      </p>

      <form
        id="login-form"
        onSubmit={e => { e.preventDefault(); handleLogin(); }}
        style={{
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* 设备编号 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, color: 'var(--axi-text-muted, #94a3b8)', fontWeight: 500 }}>
            设备编号
          </label>
          <input
             type="text"
             value={deviceNumber}
             onChange={e => setDeviceNumber(e.target.value)}
             placeholder="如 Line1-01"
            required
            autoFocus={!deviceNumber}
            style={{
              padding: '12px 16px',
              fontSize: 16,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: 'white',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          />
        </div>

         {/* 密码 */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
           <label style={{ fontSize: 13, color: 'var(--axi-text-muted, #94a3b8)', fontWeight: 500 }}>
             密码
           </label>
           <input
             type="password"
             value={password}
             onChange={e => setPassword(e.target.value)}
             placeholder="输入设备密码"
             required
             style={{
               padding: '12px 16px',
               fontSize: 16,
               borderRadius: 8,
               border: `1px solid ${error ? 'var(--axi-danger, #ef4444)' : 'rgba(255,255,255,0.15)'}`,
               background: 'rgba(255,255,255,0.06)',
               color: 'white',
               outline: 'none',
             }}
           />
        </div>

        {/* 错误提示 */}
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 8,
            color: 'var(--axi-danger, #fca5a5)',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !deviceNumber.trim() || !password.trim()}
          style={{
            padding: '14px',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: loading ? 'rgba(59,130,246,0.5)' : 'var(--axi-primary-hover, #3b82f6)',
            color: 'white',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            marginTop: 4,
          }}
        >
          {loading ? '登录中...' : '登录'}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            padding: '12px 14px',
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--axi-text-secondary, #cbd5e1)',
            cursor: 'pointer',
          }}
        >
          连接设置
        </button>
      </form>

      <p style={{ marginTop: 32, fontSize: 12, color: 'var(--axi-text-secondary, #475569)', textAlign: 'center', lineHeight: 1.6 }}>
        设备编号和密码由中控端管理员分配；若三轮自动回退都未命中，可进入连接设置手动输入后端地址
      </p>
    </div>
  );
}
