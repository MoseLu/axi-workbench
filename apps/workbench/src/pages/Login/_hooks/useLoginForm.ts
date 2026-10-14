/**
 * 工作台登录页 — 登录表单控制器（组合层）。
 *
 * useLoginFormState（状态/校验）+ useLoginSubmit（提交动作）合成页面唯一的
 * LoginFormController，index.tsx 与 _components/* 只依赖这一个入口。
 * 渲染与行为与拆分前逐行一致。
 */
import type { FormEvent, MutableRefObject } from 'react';
import type { EmailSuffix } from '../_components/EmailSuffixSelect';
import type { EmailCodeButtonState } from '../_components/EmailCodeLoginForm';
import { useLoginFormState } from './useLoginFormState';
import { useLoginSubmit, type UseLoginSubmitOptions } from './useLoginSubmit';
import type { LoginMode, Phase } from './types';

export type UseLoginFormOptions = UseLoginSubmitOptions;

export interface LoginFormController {
  // 方式与阶段
  loginMode: LoginMode;
  phase: Phase;
  handleLoginModeChange: (mode: LoginMode) => void;
  // 字段
  emailLocalPart: string;
  emailSuffix: EmailSuffix;
  password: string;
  passwordVisible: boolean;
  code: string;
  rememberLogin: boolean;
  codeInputRef: MutableRefObject<HTMLInputElement | null>;
  // 校验态
  emailIsValid: boolean;
  emailFieldIsInvalid: boolean;
  passwordFieldIsInvalid: boolean;
  codeFieldIsInvalid: boolean;
  // 邮箱验证码流程
  sentTo: string;
  showingEmailCodeForm: boolean;
  canResend: boolean;
  canRequestCode: boolean;
  canVerify: boolean;
  isEmailCodeCoolingDown: boolean;
  emailCodeSubmitting: boolean;
  emailCodeButtonState: EmailCodeButtonState;
  resendCountdownLabel: string;
  // 提交态与反馈
  submitting: boolean;
  passwordSubmitting: boolean;
  sessionLoading: boolean;
  error: string | null;
  clearFeedback: () => void;
  // 同意条款
  agreedToTerms: boolean;
  showAgreeHint: boolean;
  handleAgreedChange: (checked: boolean) => void;
  // 字段与动作
  handleEmailLocalPartChange: (value: string) => void;
  handleEmailSuffixChange: (value: EmailSuffix) => void;
  handleCodeInputChange: (value: readonly string[] | string) => void;
  handlePasswordChange: (value: string) => void;
  togglePasswordVisible: () => void;
  handleRememberLoginChange: (checked: boolean) => void;
  handlePasswordLogin: (event: FormEvent<HTMLFormElement>) => void;
  handleEmailCodeFormSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleResend: () => Promise<void>;
  handleChangeEmail: () => void;
  handleQuickLogin: () => Promise<void>;
  openOtherMethods: () => void;
}

export function useLoginForm(options: UseLoginFormOptions): LoginFormController {
  const state = useLoginFormState(options.t, options.sessionLoading);
  const actions = useLoginSubmit(state, options);

  return {
    loginMode: state.loginMode,
    phase: state.phase,
    handleLoginModeChange: state.handleLoginModeChange,
    emailLocalPart: state.emailLocalPart,
    emailSuffix: state.emailSuffix,
    password: state.password,
    passwordVisible: state.passwordVisible,
    code: state.code,
    rememberLogin: state.rememberLogin,
    codeInputRef: state.codeInputRef,
    emailIsValid: state.emailIsValid,
    emailFieldIsInvalid: state.emailFieldIsInvalid,
    passwordFieldIsInvalid: state.passwordFieldIsInvalid,
    codeFieldIsInvalid: state.codeFieldIsInvalid,
    sentTo: state.sentTo,
    showingEmailCodeForm: state.showingEmailCodeForm,
    canResend: state.canResend,
    canRequestCode: state.canRequestCode,
    canVerify: state.canVerify,
    isEmailCodeCoolingDown: state.isEmailCodeCoolingDown,
    emailCodeSubmitting: state.emailCodeSubmitting,
    emailCodeButtonState: state.emailCodeButtonState,
    resendCountdownLabel: state.resendCountdownLabel,
    submitting: state.submitting,
    passwordSubmitting: state.passwordSubmitting,
    sessionLoading: options.sessionLoading,
    error: state.error,
    clearFeedback: state.clearFeedback,
    agreedToTerms: state.agreedToTerms,
    showAgreeHint: state.showAgreeHint,
    handleAgreedChange: state.handleAgreedChange,
    handleEmailLocalPartChange: state.handleEmailLocalPartChange,
    handleEmailSuffixChange: state.handleEmailSuffixChange,
    handleCodeInputChange: state.handleCodeInputChange,
    handlePasswordChange: state.handlePasswordChange,
    togglePasswordVisible: state.togglePasswordVisible,
    handleRememberLoginChange: state.handleRememberLoginChange,
    handlePasswordLogin: actions.handlePasswordLogin,
    handleEmailCodeFormSubmit: actions.handleEmailCodeFormSubmit,
    handleResend: actions.handleResend,
    handleChangeEmail: state.handleChangeEmail,
    handleQuickLogin: actions.handleQuickLogin,
    openOtherMethods: actions.openOtherMethods,
  };
}
