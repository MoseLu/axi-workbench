import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// 账号创建、邮箱验证和安全策略由 Axi Identity/ZITADEL 统一拥有，避免
// Web 管理端另存一套密码与验证令牌。
const Register: React.FC = () => {
  const { beginLogin, isLoading } = useAuth();

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, var(--color-tabbar-dark) 0%, var(--color-login-bg) 100%)', padding: 20 }}>
      <section style={{ width: '100%', maxWidth: 400, padding: 40, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.06)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, color: 'var(--color-bg-card)', margin: '0 0 12px' }}>创建 Axi 账户</h1>
        <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.56)', lineHeight: 1.7, margin: '0 0 28px' }}>
          继续后将在 Axi Identity 中完成注册和邮箱验证；Web 管理端不会保存密码或验证令牌。
        </p>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => beginLogin('/admin/dashboard')}
          style={{ width: '100%', padding: '14px 24px', border: 0, borderRadius: 8, background: 'var(--color-info-antd)', color: 'var(--color-bg-card)', cursor: isLoading ? 'wait' : 'pointer', fontWeight: 600 }}
        >
          前往 Axi Identity
        </button>
        <p style={{ marginTop: 24, fontSize: 13, color: 'rgba(255, 255, 255, 0.5)' }}>
          已有账户？ <Link to="/login" style={{ color: 'var(--color-info-antd)' }}>返回登录</Link>
        </p>
      </section>
    </main>
  );
};

export default Register;
