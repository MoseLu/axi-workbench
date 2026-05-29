import i18n from "../../i18n";

const authStorageKey = "devsvc-dashboard-auth";
const deviceSeedStorageKey = "devsvc-dashboard-device-seed";
const themeStorageKey = "devsvc-dashboard-theme";
const themeModeStorageKey = "devsvc-dashboard-theme-mode";
export const adminUsername = "admin";
export const adminPassword = "admin";

export type AuthUser = {
  username: string;
  displayName: string;
  deviceKey: string;
  loginAt: number;
  avatarDataUrl?: string;
};


export function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function readDeviceSeed() {
  if (typeof window === "undefined") return "server";
  const stored = window.localStorage.getItem(deviceSeedStorageKey);
  if (stored) return stored;
  const nextSeed = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(deviceSeedStorageKey, nextSeed);
  return nextSeed;
}

export function getDeviceKey() {
  if (typeof window === "undefined") return "unknown-device";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const parts = [
    readDeviceSeed(),
    window.navigator.userAgent,
    window.navigator.language,
    window.navigator.platform,
    timezone
  ];
  return hashText(parts.join("|"));
}

export function readStoredAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(authStorageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as AuthUser;
    if (parsed?.username === adminUsername && parsed.loginAt) {
      const nextUser = {
        username: parsed.username,
        displayName: parsed.displayName || parsed.username,
        deviceKey: getDeviceKey(),
        loginAt: parsed.loginAt || Date.now(),
        avatarDataUrl: parsed.avatarDataUrl
      };
      if (parsed.deviceKey !== nextUser.deviceKey) {
        writeStoredAuth(nextUser);
      }
      return nextUser;
    }
    window.localStorage.removeItem(authStorageKey);
  } catch {
    window.localStorage.removeItem(authStorageKey);
  }
  return null;
}

export function writeStoredAuth(user: AuthUser) {
  window.localStorage.setItem(authStorageKey, JSON.stringify(user));
}

export function clearStoredAuth() {
  window.localStorage.removeItem(authStorageKey);
}

export function readAvatarFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error(i18n.t("请选择图片文件")));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error(i18n.t("头像图片不能超过 2MB")));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error(i18n.t("头像读取失败")));
    };
    reader.onerror = () => reject(new Error(i18n.t("头像读取失败")));
    reader.readAsDataURL(file);
  });
}
