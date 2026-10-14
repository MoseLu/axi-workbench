/**
 * 工作台登录页 — 一键登录面板（快速复用最近登录账号）。
 *
 * 渲染逻辑与原 Login.tsx 内联块一致：品牌头 + 已缓存账号 + 同意勾选 + 备用入口。
 * 同意勾选与主表单共用同一 handler（onAgreedChange），因此本组件不再触碰 ref。
 */
import React from 'react';
import { Link } from 'react-router-dom';
import type { LastAccount } from '../../../lib/lastAccount';
import type { Translate } from '../_hooks/types';

export interface QuickLoginPanelProps {
  appName: string;
  quickAccount: LastAccount | null;
  agreedToTerms: boolean;
  showAgreeHint: boolean;
  submitting: boolean;
  sessionLoading: boolean;
  t: Translate;
  onAgreedChange: (checked: boolean) => void;
  onQuickLogin: () => void;
  onOpenOtherMethods: () => void;
}

function QuickLoginPanel({
  appName,
  quickAccount,
  agreedToTerms,
  showAgreeHint,
  submitting,
  sessionLoading,
  t,
  onAgreedChange,
  onQuickLogin,
  onOpenOtherMethods,
}: QuickLoginPanelProps) {
  return (
    <section className="axi-login-quick" aria-label={t('auth.login.quickLogin')}>
      <div className="axi-login-quick-brand" aria-label={appName}>
        <span className="axi-login-quick-mark">
          <img src="/apple-touch-icon.png" alt="" aria-hidden="true" />
        </span>
        <h1 id="axi-login-title">{appName}</h1>
      </div>
      <div className="axi-login-quick-dock">
        <div className="axi-login-quick-account">
          <img
            className="axi-login-quick-avatar"
            src="/login-default-avatar.jpg"
            alt=""
            aria-hidden="true"
          />
          <span className="axi-login-quick-meta">
            <strong>{quickAccount?.name || t('auth.login.quickAccountFallbackName')}</strong>
            <em>{quickAccount?.emailMasked || quickAccount?.email || t('auth.login.quickAccountFallbackHint')}</em>
          </span>
          <button
            type="button"
            className="axi-login-quick-submit"
            onClick={onQuickLogin}
            disabled={submitting || sessionLoading}
          >
            {submitting ? t('auth.login.verifying') : t('auth.signin')}
          </button>
        </div>
        <div className="axi-login-consent axi-login-consent--quick">
          <label>
            <span className="axi-login-consent-box">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(event) => onAgreedChange(event.target.checked)}
              />
              {showAgreeHint ? (
                <span className="axi-login-consent-tooltip" role="alert">
                  {t('auth.login.agreeHint')}
                </span>
              ) : null}
            </span>
            <span className="axi-login-consent-copy">{t('auth.login.agreePrefixQuick')}<Link
              to="/legal/terms"
            >{t('auth.login.terms')}</Link><Link
              to="/legal/privacy"
            >{t('auth.login.privacy')}</Link></span>
          </label>
        </div>
        <div className="axi-login-quick-links">
          <span>{t('auth.login.loginHelp')}？</span>
          <button type="button" onClick={onOpenOtherMethods}>{t('auth.login.otherMethods')}</button>
        </div>
      </div>
    </section>
  );
}

export default QuickLoginPanel;
