/** 浏览器端个人信息本地存储（localStorage） */

import defaultAvatarSrc from '../../../assets/avatar-me.jpg';

export type UserProfile = {
  nickname: string;
  email: string;
  phone: string;
  /** 用户自定义 data URL；空则 UI 使用 DEFAULT_AVATAR_SRC */
  avatarDataUrl: string;
  workbenchId: string;
  registeredAt: string;
  status: string;
};

export type ProfileIdentity = {
  email?: string;
  id?: string;
  name?: string;
  status?: string;
};

const KEY = 'wb_user_profile_v1';

/** 产品默认头像（侧栏 / 个人中心 / 账号页统一回退） */
export const DEFAULT_AVATAR_SRC: string = defaultAvatarSrc;

/**
 * 解析展示用头像地址：优先用户上传的 data URL，否则回退默认头像。
 * 不把默认图写入 localStorage，避免与用户清空自定义头像语义混淆。
 */
export function resolveAvatarSrc(avatarDataUrl?: string | null): string {
  const custom = avatarDataUrl?.trim();
  return custom || DEFAULT_AVATAR_SRC;
}

const DEFAULT_PROFILE: UserProfile = {
  nickname: '',
  email: '',
  phone: '',
  avatarDataUrl: '',
  workbenchId: '',
  registeredAt: '',
  status: '',
};

function displayName(identity?: ProfileIdentity | null): string {
  return identity?.name?.trim() || identity?.email?.split('@')[0] || identity?.id || '用户';
}

export function profileFallbackFromIdentity(identity?: ProfileIdentity | null): Partial<UserProfile> {
  if (!identity) return {};
  return {
    email: identity.email || '',
    nickname: displayName(identity),
    status: identity.status === 'active' ? '正常' : identity.status || '',
    workbenchId: identity.id || '',
  };
}

/**
 * 使用认证会话填充未设置的资料，并把旧版写入的演示昵称和邮箱迁移出去。
 * 用户主动保存过的值仍会优先保留。
 */
export function loadProfile(identity?: ProfileIdentity | null): UserProfile {
  const fallback = profileFallbackFromIdentity(identity);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROFILE, ...fallback };
    const stored = JSON.parse(raw) as Partial<UserProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...fallback,
      ...stored,
      email: stored.email === 'zhangsan@workbench.dev' && fallback.email ? fallback.email : stored.email || fallback.email || '',
      nickname: stored.nickname === '张三' && fallback.nickname ? fallback.nickname : stored.nickname || fallback.nickname || '用户',
      status: stored.status === '正常' && fallback.status ? fallback.status : stored.status || fallback.status || '',
      workbenchId: stored.workbenchId || fallback.workbenchId || '',
    };
  } catch {
    return { ...DEFAULT_PROFILE, ...fallback };
  }
}

export function saveProfile(patch: Partial<UserProfile>, identity?: ProfileIdentity | null): UserProfile {
  const next = { ...loadProfile(identity), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('wb-profile-changed', { detail: next }));
  return next;
}

export function phoneDisplay(phone: string): string {
  return phone.trim() ? phone.trim() : '未绑定';
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
