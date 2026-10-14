/**
 * 工作台登录页 — 邮箱验证码登录表单。
 *
 * 三种状态的同一个 form：
 *  - 未请求验证码：邮箱 + 后缀 + 同意 + 发送按钮
 *  - 已发送验证码：OneTimeCodeInput + 倒计时重发 + 验证按钮 + 切换回密码按钮
 *  - 倒计时中的「请求码」按钮：同一按钮切换文案
 *
 * 表单 onSubmit 会根据是否已发送验证码决定触发 handleSendCode 还是 handleVerifyCode，
 * 由父组件决定如何分配。所有 props 由父组件注入（pure 渲染，不持有任何 state）。
 * codeInputRef 同样由父组件注入：父级 assertCodeField 需要直接聚焦首个输入格。
 */
import React from 'react';
import { OneTimeCodeInput } from '../../../components/OneTimeCodeInput';
import {
  EMAIL_LOCAL_PART_MAX_LENGTH,
  EMAIL_LOCAL_PART_PATTERN,
} from '../../../lib/emailValidation';
import EmailSuffixSelect from './EmailSuffixSelect';
import type { EmailSuffix } from './EmailSuffixSelect';

export type EmailCodeButtonState =
  | 'sending'
  | 'cooldown'
  | 'resend'
  | 'request'
  | 'disabled';

export interface EmailCodeLoginFormProps {
  emailLocalPart: string;
  emailSuffix: EmailSuffix;
  submitting: boolean;
  emailFieldIsInvalid: boolean;
  emailIsValid: boolean;
  rememberLogin: boolean;
  showingEmailCodeForm: boolean;
  code: string;
  codeFieldIsInvalid: boolean;
  codeInputRef: React.MutableRefObject<HTMLInputElement | null>;
  canResend: boolean;
  canRequestCode: boolean;
  canVerify: boolean;
  isEmailCodeCoolingDown: boolean;
  emailCodeSubmitting: boolean;
  emailCodeButtonState: EmailCodeButtonState;
  resendCountdownLabel: string;
  sentTo: string;
  submittingText: string;
  signInText: string;
  codeLoginDisabledHint?: string;
  emailLabel: string;
  emailPlaceholder: string;
  suffixLabel: string;
  rememberTooltip: string;
  autoLoginLabel: string;
  passwordLoginLabel: string;
  codeLoginLabel: string;
  sendingLabel: string;
  resendLabel: string;
  codeLabel: string;
  codeSentShortTemplate: string;
  changeEmailLabel: string;
  onEmailLocalPartChange: (value: string) => void;
  onEmailSuffixChange: (value: EmailSuffix) => void;
  onCodeChange: (value: readonly string[] | string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onResend: () => void;
  onChangeEmail: () => void;
  onSwitchToPassword: () => void;
  onRememberChange: (checked: boolean) => void;
}

function EmailCodeLoginForm({
  emailLocalPart,
  emailSuffix,
  submitting,
  emailFieldIsInvalid,
  emailIsValid,
  rememberLogin,
  showingEmailCodeForm,
  code,
  codeFieldIsInvalid,
  codeInputRef,
  canResend,
  canRequestCode,
  canVerify,
  isEmailCodeCoolingDown,
  emailCodeSubmitting,
  emailCodeButtonState,
  resendCountdownLabel,
  sentTo,
  submittingText,
  signInText,
  codeLoginDisabledHint,
  emailLabel,
  emailPlaceholder,
  suffixLabel,
  rememberTooltip,
  autoLoginLabel,
  passwordLoginLabel,
  codeLoginLabel,
  sendingLabel,
  resendLabel,
  codeLabel,
  codeSentShortTemplate,
  changeEmailLabel,
  onEmailLocalPartChange,
  onEmailSuffixChange,
  onCodeChange,
  onSubmit,
  onResend,
  onChangeEmail,
  onSwitchToPassword,
  onRememberChange,
}: EmailCodeLoginFormProps) {
  return (
    <form
      className={`axi-login-form axi-login-form--email${showingEmailCodeForm ? ' is-code' : ''}`}
      onSubmit={onSubmit}
      noValidate
    >
      {!showingEmailCodeForm && (
        <>
          <label htmlFor="axi-login-email">{emailLabel}</label>
          <div
            className={`axi-login-form__row axi-login-form__row--email${
              emailFieldIsInvalid ? ' is-invalid' : ''
            }`}
          >
            <input
              id="axi-login-email"
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
              disabled={submitting}
            />
            <EmailSuffixSelect
              id="axi-login-email-suffix"
              value={emailSuffix}
              disabled={submitting}
              label={suffixLabel}
              onChange={onEmailSuffixChange}
            />
          </div>
        </>
      )}

      {showingEmailCodeForm ? (
        <>
          <div
            id="axi-login-email-code"
            className={`axi-login-email-code-row axi-login-form__row--code${
              codeFieldIsInvalid ? ' is-invalid' : ''
            }`}
          >
            <OneTimeCodeInput
              value={code}
              onChange={onCodeChange}
              firstInputRef={codeInputRef}
              ariaLabelledBy="axi-login-email-code-label"
              ariaInvalid={codeFieldIsInvalid}
              disabled={submitting}
            />
            <span id="axi-login-email-code-label" className="axi-visually-hidden">
              {codeLabel}
            </span>
            <button
              type="button"
              className={`axi-login-email-code-resend axi-login-text-button--send${
                canResend ? ' is-resend' : ''
              }`}
              onClick={canResend ? onResend : undefined}
              disabled={!canResend}
              aria-live="polite"
              aria-atomic="true"
              data-email-code-state={emailCodeButtonState}
            >
              {emailCodeSubmitting
                ? sendingLabel
                : isEmailCodeCoolingDown
                  ? resendCountdownLabel
                  : resendLabel}
            </button>
          </div>
          <div className="axi-login-email-code-meta">
            <span>{codeSentShortTemplate.replace('{email}', sentTo)}</span>
            <button type="button" onClick={onChangeEmail}>
              {changeEmailLabel}
            </button>
            <button type="button" onClick={onSwitchToPassword}>
              {passwordLoginLabel}
            </button>
          </div>
          <button
            className="axi-login-button axi-login-button--primary"
            type="submit"
            disabled={!canVerify}
          >
            {submitting ? submittingText : signInText}
          </button>
        </>
      ) : (
        <>
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
            <button type="button" className="axi-login-form-switch" onClick={onSwitchToPassword}>
              {passwordLoginLabel}
            </button>
          </div>
          <button
            className="axi-login-button axi-login-button--primary axi-login-button--code-login"
            type="submit"
            disabled={!canRequestCode}
            data-email-code-state={emailCodeButtonState}
            aria-live="polite"
            title={
              !emailIsValid
                ? codeLoginDisabledHint
                : isEmailCodeCoolingDown
                  ? resendCountdownLabel
                  : undefined
            }
            aria-disabled={!canRequestCode}
          >
            {emailCodeSubmitting ? sendingLabel : codeLoginLabel}
          </button>
        </>
      )}
    </form>
  );
}

export default EmailCodeLoginForm;
