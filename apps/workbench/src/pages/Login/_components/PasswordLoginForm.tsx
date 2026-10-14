/**
 * 工作台登录页 — 账号密码登录表单（含密码可见性切换按钮）。
 *
 * 渲染逻辑与原 Login.tsx 内联块一致：邮箱输入 + 后缀下拉 + 密码框 + 可见性切换 +
 * 记住登录 + 切换到邮箱码登录按钮。所有回调与状态由父组件注入。
 * 可见性切换按钮只被本表单使用，因此与表单同文件，保持 _components 数量收敛。
 */
import React from 'react';
import {
  EMAIL_LOCAL_PART_MAX_LENGTH,
  EMAIL_LOCAL_PART_PATTERN,
} from '../../../lib/emailValidation';
import EmailSuffixSelect from './EmailSuffixSelect';
import type { EmailSuffix } from './EmailSuffixSelect';

interface PasswordVisibilityToggleProps {
  visible: boolean;
  disabled?: boolean;
  showLabel: string;
  hideLabel: string;
  onToggle: () => void;
}

function PasswordVisibilityToggle({
  visible,
  disabled,
  showLabel,
  hideLabel,
  onToggle,
}: PasswordVisibilityToggleProps) {
  return (
    <button
      type="button"
      className={`axi-login-password-toggle${visible ? ' is-visible' : ''}`}
      aria-label={visible ? hideLabel : showLabel}
      aria-pressed={visible}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3.2 3.2 L20.8 20.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M9.6 9.7 A3.2 3.2 0 0 0 14.3 14.4 M7.1 7.3 C4.6 8.8 2.6 12 2.6 12 S6.4 19 12 19 c1.7 0 3.2-.4 4.5-1.1 M16.8 16.5 C19.4 14.9 21.4 12 21.4 12 S17.6 5 12 5 c-.8 0-1.6.1-2.3.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M2.6 12 S6.4 5 12 5 s9.4 7 9.4 7-3.8 7-9.4 7-9.4-7-9.4-7Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )}
    </button>
  );
}

export interface PasswordLoginFormProps {
  emailLocalPart: string;
  emailSuffix: EmailSuffix;
  password: string;
  passwordVisible: boolean;
  passwordSubmitting: boolean;
  rememberLogin: boolean;
  sessionLoading: boolean;
  emailFieldIsInvalid: boolean;
  passwordFieldIsInvalid: boolean;
  emailIsValid: boolean;
  emailLabel: string;
  emailPlaceholder: string;
  suffixAriaLabel: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  autoLoginLabel: string;
  rememberTooltip: string;
  codeLoginLabel: string;
  submitLabel: string;
  submittingLabel: string;
  onEmailLocalPartChange: (value: string) => void;
  onEmailSuffixChange: (value: EmailSuffix) => void;
  onPasswordChange: (value: string) => void;
  onToggleVisible: () => void;
  onRememberChange: (checked: boolean) => void;
  onSwitchMode: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

function PasswordLoginForm({
  emailLocalPart,
  emailSuffix,
  password,
  passwordVisible,
  passwordSubmitting,
  rememberLogin,
  sessionLoading,
  emailFieldIsInvalid,
  passwordFieldIsInvalid,
  emailIsValid,
  emailLabel,
  emailPlaceholder,
  suffixAriaLabel,
  passwordLabel,
  passwordPlaceholder,
  showPasswordLabel,
  hidePasswordLabel,
  autoLoginLabel,
  rememberTooltip,
  codeLoginLabel,
  submitLabel,
  submittingLabel,
  onEmailLocalPartChange,
  onEmailSuffixChange,
  onPasswordChange,
  onToggleVisible,
  onRememberChange,
  onSwitchMode,
  onSubmit,
}: PasswordLoginFormProps) {
  return (
    <form className="axi-login-form axi-login-form--password" onSubmit={onSubmit} noValidate>
      <label htmlFor="axi-login-password-email">{emailLabel}</label>
      <div
        className={`axi-login-form__row axi-login-form__row--email axi-login-form__row--password-email${
          emailFieldIsInvalid ? ' is-invalid' : ''
        }`}
      >
        <input
          id="axi-login-password-email"
          name="email-local-part"
          type="text"
          inputMode="email"
          autoComplete="off"
          required
          value={emailLocalPart}
          onChange={(event) => onEmailLocalPartChange(event.target.value)}
          placeholder={emailPlaceholder}
          maxLength={EMAIL_LOCAL_PART_MAX_LENGTH}
          pattern={EMAIL_LOCAL_PART_PATTERN.source}
          aria-invalid={emailFieldIsInvalid}
          spellCheck={false}
          disabled={passwordSubmitting}
        />
        <EmailSuffixSelect
          id="axi-login-password-email-suffix"
          value={emailSuffix}
          disabled={passwordSubmitting}
          label={suffixAriaLabel}
          onChange={onEmailSuffixChange}
        />
      </div>
      <label htmlFor="axi-login-password">{passwordLabel}</label>
      <div
        className={`axi-login-form__row axi-login-form__row--input${
          passwordFieldIsInvalid ? ' is-invalid' : ''
        }`}
      >
        <input
          id="axi-login-password"
          className="axi-login-password-input"
          name="password"
          type={passwordVisible ? 'text' : 'password'}
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder={passwordPlaceholder}
          aria-invalid={passwordFieldIsInvalid}
          disabled={passwordSubmitting}
        />
        <PasswordVisibilityToggle
          visible={passwordVisible}
          disabled={passwordSubmitting}
          showLabel={showPasswordLabel}
          hideLabel={hidePasswordLabel}
          onToggle={onToggleVisible}
        />
      </div>
      <div className="axi-login-form-options">
        <label className="axi-login-remember-option">
          <span className="axi-login-remember-box">
            <input
              type="checkbox"
              checked={rememberLogin}
              onChange={(event) => onRememberChange(event.target.checked)}
            />
            <span className="axi-login-remember-tooltip">{rememberTooltip}</span>
          </span>
          <span>{autoLoginLabel}</span>
        </label>
        <button type="button" className="axi-login-form-switch" onClick={onSwitchMode}>
          {codeLoginLabel}
        </button>
      </div>
      <button
        className="axi-login-button axi-login-button--primary"
        type="submit"
        disabled={passwordSubmitting || sessionLoading || !emailIsValid || !password}
      >
        {passwordSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}

export default PasswordLoginForm;
