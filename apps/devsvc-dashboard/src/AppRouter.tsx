import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { LoginPage } from "./features/auth/LoginPage";
import { useAuthState } from "./features/auth/useAuthState";

const Shell = lazy(() =>
  import("./app-shell/Shell").then((m) => ({ default: m.Shell }))
);

function RouteFallback() {
  return (
    <div style={{ padding: 24, color: "var(--axi-color-text-secondary, #888)" }}>
      Loading workspace…
    </div>
  );
}

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
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Navigate to="/overview" replace />} />
        <Route path="/*" element={<Shell user={auth.user} onAvatarChange={auth.updateAvatar} onLogout={auth.logout} />} />
      </Routes>
    </Suspense>
  );
}
