/** 浏览器端个人信息本地存储（localStorage） */

export type UserProfile = {
  nickname: string;
  email: string;
  phone: string;
  /** data URL 或空 */
  avatarDataUrl: string;
  workbenchId: string;
  registeredAt: string;
  status: string;
};

const KEY = 'wb_user_profile_v1';

const DEFAULT_PROFILE: UserProfile = {
  nickname: '张三',
  email: 'zhangsan@workbench.dev',
  phone: '',
  avatarDataUrl: '',
  workbenchId: 'wb_zhangsan',
  registeredAt: '2026-03-12',
  status: '正常',
};

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(patch: Partial<UserProfile>): UserProfile {
  const next = { ...loadProfile(), ...patch };
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
