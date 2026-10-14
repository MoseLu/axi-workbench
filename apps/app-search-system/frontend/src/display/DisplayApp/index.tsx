/**
 * 展示端 - 自动登录 + 全屏展示 + PDF 浏览
 */
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { DisplayProvider, useDisplay } from '../../shared/context/DisplayContext';
import LoginPage from '../LoginPage';
import ConnectionSettingsPage from '../ConnectionSettingsPage';
import { useSearch } from '../../shared/hooks';
import { getLocalIP } from '../../shared/api/client';
import PdfFullscreen from './_components/PdfFullscreen';
import ImageFullscreen from './_components/ImageFullscreen';
import BrowseView from './_components/BrowseView';
import PushHistoryView from './_components/PushHistoryView';
import IdleHomeView from './_components/IdleHomeView';
import { useRecentHistory, useSopViewer } from './hooks';
import { formatBackendSource } from './utils';

function DisplayContent() {
  const {
    connected,
    currentImage,
    currentJob,
    isFullscreen,
    showImage,
    exitFullscreen,
    uuid,
    pendingUpdate,
    setPendingUpdate,
    apiError,
    backendBaseURL,
    backendDiscovery,
    isLoggedIn,
    loginData,
    onLogin,
    logout,
  } = useDisplay();
  const { query, setQuery, results, loading, suggestions, showSuggestions, selectSuggestion } = useSearch();
  const [mode, setMode] = useState<'idle' | 'browse' | 'pushHistory' | 'settings'>('idle');
  const [localIP, setLocalIP] = useState<string | null>(null);
  useEffect(() => { void getLocalIP().then(setLocalIP); }, []);
  const backendInfoText = backendBaseURL || backendDiscovery.baseURL || '未握手';
  const backendModeText = backendDiscovery.autoResolved
    ? `自动 · ${formatBackendSource(backendDiscovery.source)}`
    : backendDiscovery.source === 'manual'
      ? '手动兜底'
      : backendDiscovery.phase === 'probing'
        ? '握手中'
        : '未握手';

  const { recentHistory, rememberViewedItem, handleClearHistory } = useRecentHistory();
  const {
    pdfViewerSrc,
    pdfLoading,
    setPdfLoading,
    setPdfViewerSrc,
    browseAllPages,
    browsePageIndex,
    setBrowsePageIndex,
    openPagedSop,
    exitBrowseFullscreen,
    openSearchResult,
    openHistoryEntry,
  } = useSopViewer({
    isFullscreen,
    currentImage,
    showImage,
    exitFullscreen,
    rememberViewedItem,
  });

  const handleQuit = () => {
    if (Capacitor.isNativePlatform()) {
      void App.exitApp();
    } else if ((window as unknown as { cordova?: { plugins?: { backbutton?: { exitApp?: () => void } } } }).cordova?.plugins?.backbutton?.exitApp) {
      void ((window as unknown as { cordova: { plugins: { backbutton: { exitApp: () => void } } } }).cordova.plugins.backbutton.exitApp());
    } else if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  };

  // PDF 全屏展示（推送的 SOP）
  if (isFullscreen && pdfViewerSrc) {
    return (
      <PdfFullscreen
        src={pdfViewerSrc}
        loading={pdfLoading}
        jobName={currentJob}
        onLoaded={() => setPdfLoading(false)}
        onDismiss={() => {
          setPdfViewerSrc(null);
          exitFullscreen();
        }}
      />
    );
  }

  // 图片全屏展示（浏览模式预览，支持多页翻页）
  if (isFullscreen && currentImage) {
    return (
      <ImageFullscreen
        currentImage={currentImage}
        jobName={currentJob}
        pages={browseAllPages}
        pageIndex={browsePageIndex}
        setPageIndex={setBrowsePageIndex}
        onExit={exitBrowseFullscreen}
      />
    );
  }

  if (mode === 'browse') {
    return (
      <BrowseView
        query={query}
        onQueryChange={setQuery}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        onSelectSuggestion={selectSuggestion}
        loading={loading}
        results={results}
        recentHistory={recentHistory}
        onClearHistory={handleClearHistory}
        onOpenHistoryEntry={openHistoryEntry}
        onOpenSearchResult={openSearchResult}
        onOpenPagedSop={openPagedSop}
        onBack={() => setMode('idle')}
      />
    );
  }

  if (mode === 'settings') {
    return <ConnectionSettingsPage onBack={() => setMode('idle')} />;
  }

  // 未登录 → 显示登录页
  if (!isLoggedIn) {
    return <LoginPage onLogin={onLogin} onOpenSettings={() => setMode('settings')} />;
  }

  // 推送历史页面
  if (mode === 'pushHistory') {
    const pushHistoryEntries = recentHistory.filter(e => e.source === 'push');

    return (
      <PushHistoryView
        entries={pushHistoryEntries}
        onBack={() => setMode('idle')}
        onOpenHistoryEntry={openHistoryEntry}
      />
    );
  }

  return (
    <IdleHomeView
      isLoggedIn={isLoggedIn}
      loginData={loginData}
      localIP={localIP}
      connected={connected}
      backendBaseURL={backendBaseURL}
      backendInfoText={backendInfoText}
      apiError={apiError}
      pendingUpdate={pendingUpdate}
      onDismissUpdate={() => setPendingUpdate(null)}
      onLogout={logout}
      onOpenSettings={() => setMode('settings')}
      onOpenBrowse={() => setMode('browse')}
      onOpenPushHistory={() => setMode('pushHistory')}
      pushHistoryCount={recentHistory.filter(e => e.source === 'push').length}
      onQuit={handleQuit}
    />
  );
}

export default function DisplayApp() {
  return (
    <DisplayProvider>
      <DisplayContent />
    </DisplayProvider>
  );
}
