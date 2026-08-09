import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiThemeProvider } from '@axi/core';
import { AuthProvider, WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import MobileShell from './layouts/MobileShell';
import HomePage from './pages/HomePage';
import ProjectsPage from './pages/ProjectsPage';
import WorkspacePage from './pages/FocusPage';
import InboxPage from './pages/InboxPage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
import LoginPage from './pages/LoginPage';
import ScanPage from './pages/ScanPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import WebLoginConfirmPage from './pages/WebLoginConfirmPage';
import RequireSession from './components/RequireSession';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

/**
 * 独立移动端应用。它与 Web 管理端共享的是 auth / locale / API / tokens
 * 基础能力，路由、页面与壳层均在本应用内拥有。
 */
const MobileSurface: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WorkbenchLocaleProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/confirm-web" element={<RequireSession><WebLoginConfirmPage /></RequireSession>} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/" element={<RequireSession><MobileShell /></RequireSession>}>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<HomePage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="workspace" element={<WorkspacePage />} />
              <Route path="focus" element={<Navigate to="/workspace" replace />} />
              <Route path="scan" element={<ScanPage />} />
              <Route path="inbox" element={<InboxPage />} />
              <Route path="me" element={<ProfilePage />} />
              <Route path="search" element={<SearchPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </BrowserRouter>
      </WorkbenchLocaleProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default function App() {
  return (
    <AxiThemeProvider defaultPreference="light" defaultPresetName="default" storageNamespace="axi.workbench.mobile">
      <MobileSurface />
    </AxiThemeProvider>
  );
}
