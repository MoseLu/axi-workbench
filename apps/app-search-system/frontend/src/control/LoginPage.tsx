/**
 * 中控端 - 登录页
 */
import React, { useState } from 'react';
import { useAuth } from '../shared/context/AuthContext';

interface LoginPageProps {
  onSuccess?: (result: LoginResult) => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setMsg('请输入用户名和密码'); return; }
    try {
      const result = await login(username, password);
      if (result.user?.must_change_password) {
        setMsg('首次登录，请修改密码');
      }
      onSuccess?.(result);
    } catch (err) {
      setMsg((err as Error).message || '登录失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleSubmit(e as unknown as React.FormEvent);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 16, padding: '40px 36px',
        width: 360, boxShadow: '0 4px 24px var(--shadow)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <img
            src={`${process.env.PUBLIC_URL || ''}/assets/logo-48x48.png`}
            alt="logo"
            style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }}
          />
          <h2 style={{ textAlign: 'center', margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: 20 }}>Axi Docs Control</h2>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 28, fontSize: 14 }}>请登录以管理展示设备</p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-secondary)' }}>用户名</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 15,
                border: '1px solid var(--border)', borderRadius: 8,
                boxSizing: 'border-box', outline: 'none',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                transition: 'border-color 0.2s',
              }}
              autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-secondary)' }}>密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 15,
                border: '1px solid var(--border)', borderRadius: 8,
                boxSizing: 'border-box', outline: 'none',
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                transition: 'border-color 0.2s',
              }}
              onKeyDown={handleKeyDown} />
          </div>
          {(msg || error) && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--error-light)', color: 'var(--error)', borderRadius: 8,
              marginBottom: 16, fontSize: 14, border: '1px solid var(--error)',
            }}>
              {msg || error}
            </div>
          )}
          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '12px', background: 'var(--accent)', color: 'var(--text-inverse)',
              border: 'none', borderRadius: 8, fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, fontWeight: 600,
            }}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
          管理员账号：admin，密码以服务初始化生成或当前配置为准
        </div>
      </div>
    </div>
  );
}
