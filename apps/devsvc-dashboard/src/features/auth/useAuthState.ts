import { useState } from "react";

import { adminPassword, adminUsername, clearStoredAuth, getDeviceKey, readStoredAuth, resolveRoleForUsername, writeStoredAuth, type AuthUser } from "./auth";

export function useAuthState() {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredAuth());

  function login(username: string, password: string) {
    if (username !== adminUsername || password !== adminPassword) return false;
    const nextUser: AuthUser = {
      username: adminUsername,
      displayName: adminUsername,
      deviceKey: getDeviceKey(),
      loginAt: Date.now(),
      role: resolveRoleForUsername(adminUsername)
    };
    writeStoredAuth(nextUser);
    setUser(nextUser);
    return true;
  }

  function logout() {
    clearStoredAuth();
    setUser(null);
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
