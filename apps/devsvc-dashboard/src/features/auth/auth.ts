import i18n from "../../i18n";

const authStorageKey = "devsvc-dashboard-auth";
const deviceSeedStorageKey = "devsvc-dashboard-device-seed";
const themeStorageKey = "devsvc-dashboard-theme";
const themeModeStorageKey = "devsvc-dashboard-theme-mode";
export const adminUsername = "admin";
export const adminPassword = "admin";

export type UserRole = 'user' | 'developer' | 'admin';

export type AuthUser = {
  username: string;
  displayName: string;
  deviceKey: string;
  loginAt: number;
  avatarDataUrl?: string;
  role: UserRole;
};

/**
 * Resolve the role for a username. The login UI knows the username, so
 * resolving here keeps `AuthUser.role` mandatory and prevents the Shell
 * from falling back to `developer` when role is missing.
 *
 * @returns User role. Defaults to `developer` for unknown usernames.
 */
export function resolveRoleForUsername(username: string): UserRole {
  if (username === adminUsername) return 'admin';
  return 'developer';
}

/**
 * Get user role from multiple sources with the following priority:
 * 1. AuthUser.role (if available)
 * 2. window.__APP_CONFIG__.userRole (if available)
 * 3. VITE_USER_ROLE environment variable (fallback)
 *
 * @returns User role, defaults to 'developer'
 */
export function getUserRole(): UserRole {
  // Priority 1: Already stored in AuthUser
  const storedAuth = readStoredAuth();
  if (storedAuth?.role) return storedAuth.role;

  // Priority 2: From window.__APP_CONFIG__
  const appConfig = (window as { __APP_CONFIG__?: { userRole?: UserRole } }).__APP_CONFIG__;
  if (appConfig?.userRole) return appConfig.userRole;

  // Priority 3: From VITE_USER_ROLE environment variable
  const envRole = (import.meta as { env?: { VITE_USER_ROLE?: UserRole } }).env?.VITE_USER_ROLE;
  if (envRole && ['user', 'developer', 'admin'].includes(envRole)) {
    return envRole;
  }

  // Default fallback
  return 'developer';
}


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
      const nextUser: AuthUser = {
        username: parsed.username,
        displayName: parsed.displayName || parsed.username,
        deviceKey: getDeviceKey(),
        loginAt: parsed.loginAt || Date.now(),
        avatarDataUrl: parsed.avatarDataUrl,
        role: parsed.role ?? resolveRoleForUsername(parsed.username)
      };
      if (parsed.deviceKey !== nextUser.deviceKey || parsed.role == null) {
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
