/**
 * SOP 应用入口
 */
import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './shared/context/ThemeContext';
import { AuthProvider, useAuth } from './shared/context/AuthContext';
import TitleBar from './shared/components/TitleBar';
import SettingsModal from './shared/components/SettingsModal';
import LoginPage from './control/LoginPage';
import Dashboard from './control/Dashboard';
import DisplayApp from './display/DisplayApp';

function getAppMode(): 'control' | 'display' {
  if (typeof window !== 'undefined') {
    if (window.Capacitor?.isNativePlatform?.()) return 'display';
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    if (urlMode === 'control' || urlMode === 'display') return urlMode;
    const stored = localStorage.getItem('sop_app_mode');
    if (stored === 'control' || stored === 'display') return stored;
  }
  return 'display';
}

function ControlApp({ showSettings, onSettingsChange }: { showSettings: boolean; onSettingsChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>加载中...</div>;
  if (!user) return <LoginPage />;
  return (
    <>
      <Dashboard />
      <SettingsModal open={showSettings} onClose={() => onSettingsChange(false)} />
    </>
  );
}

export default function App() {
  const [mode, setMode] = useState<'control' | 'display'>('display');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const m = getAppMode();
    setMode(m);
    if (m !== 'display') localStorage.setItem('sop_app_mode', m);
  }, []);

  if (mode === 'control') {
    return (
      <ThemeProvider>
        <AuthProvider>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            <TitleBar title="Axi Docs Control" onSettingsClick={() => setShowSettings(true)} />
            <div style={{ flex: 1, overflow: 'auto' }}>
              <ControlApp showSettings={showSettings} onSettingsChange={setShowSettings} />
            </div>
          </div>
        </AuthProvider>
      </ThemeProvider>
    );
  }

  return <DisplayApp />;
}
