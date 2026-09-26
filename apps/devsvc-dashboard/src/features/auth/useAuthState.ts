import { useEffect, useState } from "react";

import { authStorageKey, clearStoredAuth, getDeviceKey, listDevLoginAccounts, readStoredAuth, resolveRoleForUsername, validateLoginCredentials, writeStoredAuth, type AuthUser, type UserRole } from "./auth";

export function useAuthState() {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredAuth());

  // Re-read auth when localStorage changes in another tab, after a manual
  // localStorage edit (devtools), or after a storage event. Without this
  // hook the AuthUser in React state stays stale even when localStorage
  // is updated, which breaks role-aware routing after WFB-QA-001 hand-tests.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function sync() {
      const next = readStoredAuth();
      setUser((current) => {
        if (current?.loginAt === next?.loginAt && current?.role === next?.role && current?.username === next?.username) {
          return current;
        }
        return next;
      });
    }
    window.addEventListener("storage", sync);
    window.addEventListener("axi-auth-sync", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("axi-auth-sync", sync);
    };
  }, []);

  /**
   * Validate credentials against the dev login table (admin / developer /
   * user). Returns `null` on success (caller updates state via returned
   * tuple) and a localized error message on failure.
   */
  function login(username: string, password: string): { ok: true; user: AuthUser } | { ok: false; error: string } {
    const trimmed = username.trim();
    const role = validateLoginCredentials(trimmed, password);
    if (!role) {
      return { ok: false, error: "用户名或密码不正确" };
    }
    const accounts = listDevLoginAccounts();
    const account = accounts.find((a) => a.username === trimmed);
    const nextUser: AuthUser = {
      username: trimmed,
      displayName: account?.displayName ?? trimmed,
      deviceKey: getDeviceKey(),
      loginAt: Date.now(),
      role
    };
    writeStoredAuth(nextUser);
    setUser(nextUser);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("axi-auth-sync"));
    }
    return { ok: true, user: nextUser };
  }

  function logout() {
    clearStoredAuth();
    setUser(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("axi-auth-sync"));
    }
  }

  function updateAvatar(avatarDataUrl: string) {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      const nextUser: AuthUser = { ...currentUser, avatarDataUrl };
      writeStoredAuth(nextUser);
      return nextUser;
    });
  }

  return { user, login, logout, updateAvatar };
}

export type { UserRole };
void resolveRoleForUsername;
void authStorageKey;
