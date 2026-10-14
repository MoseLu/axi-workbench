/**
 * 工作台登录页 — 拆分后共享的纯类型。
 *
 * 被 index.tsx、_hooks/* 与 _components/* 共同引用；单独成文件是为了
 * 避免 hooks 之间为了拿类型而互相 import 形成环。
 */

/** 登录页三种呈现面：一键登录 / 扫码 / 账号表单。 */
export type LoginSurface = 'quick' | 'qr' | 'account';

/** 账号面内部的两种登录方式。 */
export type LoginMode = 'password' | 'email';

/** 邮箱验证码流程阶段；verifying 仅参与错误横幅判定。 */
export type Phase = 'email' | 'code' | 'verifying';

/** 与 useI18n().t 相同的签名。 */
export type Translate = (key: string, fallback?: string) => string;
