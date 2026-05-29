import { useState } from "react";

import { adminPassword, adminUsername, clearStoredAuth, getDeviceKey, readStoredAuth, writeStoredAuth, type AuthUser } from "./auth";

export function useAuthState() {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredAuth());

  function login(username: string, password: string) {
    if (username !== adminUsername || password !== adminPassword) return false;
    const nextUser = {
      username: adminUsername,
      displayName: adminUsername,
      deviceKey: getDeviceKey(),
      loginAt: Date.now()
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
      const nextUser = { ...currentUser, avatarDataUrl };
      writeStoredAuth(nextUser);
      return nextUser;
    });
  }

  return { user, login, logout, updateAvatar };
}
