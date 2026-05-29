import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Shell } from "./app-shell/Shell";
import { LoginPage } from "./features/auth/LoginPage";
import { useAuthState } from "./features/auth/useAuthState";

export function AppRouter() {
  const location = useLocation();
  const auth = useAuthState();
  if (!auth.user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={auth.login} />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/overview" replace />} />
      <Route path="/*" element={<Shell user={auth.user} onAvatarChange={auth.updateAvatar} onLogout={auth.logout} />} />
    </Routes>
  );
}
