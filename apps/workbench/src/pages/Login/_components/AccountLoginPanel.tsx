/**
 * 工作台登录页 — 账号登录面（密码 / 邮箱验证码两种方式）。
 *
 * 从原 Login.tsx 内联块搬出：右侧表单槽 + 错误横幅 + 社交占位 + 同意条款。
 * 表单本身在 PasswordLoginForm / EmailCodeLoginForm 中，这里只负责把
 * useLoginForm 控制器字段映射成子组件 props，渲染与拆分前一致。
 * 社交占位按钮仅此处使用，故与面板同文件。
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AxiBanner } from '@axi/widgets';
import wechatBrandIconUrl from '../../../assets/icons/communication/wechat-brand.svg';
import qqBrandIconUrl from '../../../assets/icons/communication/qq-brand.svg';
import type { LoginFormController } from '../_hooks/useLoginForm';
import type { Translate } from '../_hooks/types';
import PasswordLoginForm from './PasswordLoginForm';
import EmailCodeLoginForm from './EmailCodeLoginForm';

interface SocialLoginPlaceholderProps {
  provider: 'wechat' | 'qq';
  label: string;
  comingSoon: string;
}

function SocialLoginPlaceholder({
  provider,
  label,
  comingSoon,
}: SocialLoginPlaceholderProps) {
  return (
    <button
      type="button"
      className={`axi-login-social-placeholder axi-login-social-placeholder--${provider}`}
      aria-label={`${label}（${comingSoon}）`}
      title={comingSoon}
      disabled
    >
      <span className="axi-login-social-icon" aria-hidden="true">
        <img src={provider === 'wechat' ? wechatBrandIconUrl : qqBrandIconUrl} alt="" />
      </span>
    </button>
  );
}

export interface AccountLoginPanelProps {
  form: LoginFormController;
  banner: string | null;
  t: Translate;
}

function AccountLoginPanel({ form, banner, t }: AccountLoginPanelProps) {
  return (
    <section className="axi-login-account" id="axi-login-account-panel" aria-label={t('auth.login.accountLogin')}>
      <div className={`axi-login-right__body is-${form.loginMode}`}>
        <div className="axi-login-form-slot">
          {form.loginMode === 'password' && (
            <PasswordLoginForm
              emailLocalPart={form.emailLocalPart}
              emailSuffix={form.emailSuffix}
              password={form.password}
              passwordVisible={form.passwordVisible}
              passwordSubmitting={form.passwordSubmitting}
              rememberLogin={form.rememberLogin}
              sessionLoading={form.sessionLoading}
              emailFieldIsInvalid={form.emailFieldIsInvalid}
              passwordFieldIsInvalid={form.passwordFieldIsInvalid}
              emailIsValid={form.emailIsValid}
              emailLabel={t('auth.email')}
              emailPlaceholder={t('auth.email.localPartPlaceholder')}
              suffixAriaLabel={t('auth.email.suffixLabel')}
              passwordLabel="密码"
              passwordPlaceholder="请输入密码"
              showPasswordLabel={t('auth.login.showPassword')}
              hidePasswordLabel={t('auth.login.hidePassword')}
              autoLoginLabel={t('auth.login.autoLogin')}
              rememberTooltip="十天内免登录"
              codeLoginLabel={t('auth.login.codeLogin')}
              submitLabel="登录"
              submittingLabel="登录中…"
              onEmailLocalPartChange={form.handleEmailLocalPartChange}
              onEmailSuffixChange={form.handleEmailSuffixChange}
              onPasswordChange={form.handlePasswordChange}
              onToggleVisible={form.togglePasswordVisible}
              onRememberChange={form.handleRememberLoginChange}
              onSwitchMode={() => form.handleLoginModeChange('email')}
              onSubmit={form.handlePasswordLogin}
            />
          )}

          {form.loginMode === 'email' && (
            <EmailCodeLoginForm
              emailLocalPart={form.emailLocalPart}
              emailSuffix={form.emailSuffix}
              submitting={form.submitting}
              emailFieldIsInvalid={form.emailFieldIsInvalid}
              emailIsValid={form.emailIsValid}
              rememberLogin={form.rememberLogin}
              showingEmailCodeForm={form.showingEmailCodeForm}
              code={form.code}
              codeFieldIsInvalid={form.codeFieldIsInvalid}
              codeInputRef={form.codeInputRef}
              canResend={form.canResend}
              canRequestCode={form.canRequestCode}
              canVerify={form.canVerify}
              isEmailCodeCoolingDown={form.isEmailCodeCoolingDown}
              emailCodeSubmitting={form.emailCodeSubmitting}
              emailCodeButtonState={form.emailCodeButtonState}
              resendCountdownLabel={form.resendCountdownLabel}
              sentTo={form.sentTo}
              submittingText={t('auth.login.verifying')}
              signInText={t('auth.signin')}
              codeLoginDisabledHint={t('auth.login.codeLoginDisabledHint')}
              emailLabel={t('auth.email')}
              emailPlaceholder={t('auth.email.localPartPlaceholder')}
              suffixLabel={t('auth.email.suffixLabel')}
              rememberTooltip="十天内免登录"
              autoLoginLabel={t('auth.login.autoLogin')}
              passwordLoginLabel={t('auth.login.passwordLogin')}
              codeLoginLabel={t('auth.login.codeLogin')}
              sendingLabel={t('auth.login.sending')}
              resendLabel={t('auth.login.resendCode')}
              codeLabel={t('auth.login.codeLabel')}
              codeSentShortTemplate={t('auth.login.codeSentShort')}
              changeEmailLabel={t('auth.login.changeEmail')}
              onEmailLocalPartChange={form.handleEmailLocalPartChange}
              onEmailSuffixChange={form.handleEmailSuffixChange}
              onCodeChange={form.handleCodeInputChange}
              onSubmit={form.handleEmailCodeFormSubmit}
              onResend={form.handleResend}
              onChangeEmail={form.handleChangeEmail}
              onSwitchToPassword={() => form.handleLoginModeChange('password')}
              onRememberChange={form.handleRememberLoginChange}
            />
          )}
        </div>
        <div className="axi-login-banner-slot" aria-live="polite">
          {banner && <AxiBanner compact icon={false} tone="danger" role="alert" className="axi-login-banner axi-login-banner--error">{banner}</AxiBanner>}
        </div>
        <div className="axi-login-social-placeholders" aria-label={t('auth.login.socialLogin')}>
          <SocialLoginPlaceholder
            provider="wechat"
            label={t('auth.login.wechatLogin')}
            comingSoon={t('auth.login.socialComingSoon')}
          />
          <SocialLoginPlaceholder
            provider="qq"
            label={t('auth.login.qqLogin')}
            comingSoon={t('auth.login.socialComingSoon')}
          />
        </div>
        <div className="axi-login-consent">
          <label>
            <span className="axi-login-consent-box">
              <input
                type="checkbox"
                checked={form.agreedToTerms}
                onChange={(event) => form.handleAgreedChange(event.target.checked)}
              />
              {form.showAgreeHint ? (
                <span className="axi-login-consent-tooltip" role="alert">
                  {t('auth.login.agreeHint')}
                </span>
              ) : null}
            </span>
            <span>{t('auth.login.agreePrefix')}</span>
            <Link to="/legal/terms">
              {t('auth.login.terms')}
            </Link>
            <span>{t('auth.login.and')}</span>
            <Link to="/legal/privacy">
              {t('auth.login.privacy')}
            </Link>
          </label>
        </div>
      </div>
    </section>
  );
}

export default AccountLoginPanel;
