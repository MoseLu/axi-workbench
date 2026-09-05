/**
 * 展示端 - 自动登录 + 全屏展示 + PDF 浏览
 */
import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { DisplayProvider, useDisplay } from '../shared/context/DisplayContext';
import LoginPage from './LoginPage';
import ConnectionSettingsPage from './ConnectionSettingsPage';
import { useSearch } from '../shared/hooks';
import apiClient from '../shared/api/client';
import { getLocalIP } from '../shared/api/client';
import { downloadAndInstall, formatSize } from '../services/ota.service';
import SearchBox from '../shared/components/SearchBox';
import DisplayImageGrid from '../shared/components/DisplayImageGrid';
import {
  clearDisplayHistory,
  hydrateDisplayHistory,
  loadDisplayHistory,
  rememberDisplayHistory,
  type DisplayHistoryEntry,
  type DisplayHistorySeed,
  type DisplayHistorySource,
} from './recentHistory';

// SVG 图标组件
const IconPush = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </svg>
);

const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M11.5 11.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconExit = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
    <path d="M7 3H4a1 1 0 00-1 1v10a1 1 0 001 1h3M13 5l4 4-4 4M9 9h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-.33-1 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.33H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1-.33 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .33 1 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.3.47.65.6 1 .08.32.11.66.09 1 0 .34-.03.68-.09 1-.13.35-.34.7-.6 1z"/>
  </svg>
);
const IconPrev = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconNext = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconClipboard = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="8" y="6" width="32" height="36" rx="4"/>
    <path d="M16 6V12a8 8 0 0116 0V6"/>
    <path d="M24 22v10M19 27h10" strokeLinecap="round"/>
  </svg>
);
const IconPdf = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--axi-text-muted, #94a3b8)" strokeWidth="1.5">
    <rect x="6" y="2" width="22" height="30" rx="3"/>
    <path d="M6 8h22M12 14h10M12 20h8" strokeLinecap="round"/>
    <path d="M28 24l6 6v8a2 2 0 01-2 2H10a2 2 0 01-2-2V8a2 2 0 012-2h16" strokeLinecap="round"/>
  </svg>
);

// 从 PDF URL 下载并返回第一页图片的 dataURL
async function fetchPdfPreview(pdfUrl: string, apiBaseUrl: string): Promise<string | null> {
  try {
    // 如果是相对路径，拼上 API 基础地址
    const fullUrl = pdfUrl.startsWith('http') ? pdfUrl : `${apiBaseUrl}${pdfUrl.startsWith('/') ? '' : '/'}${pdfUrl}`;
    const resp = await fetch(fullUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    // 返回 blob URL（WebView 会直接渲染 PDF）
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

interface ShowPdfDetail {
  pdfUrl: string;
  jobName: string;
  pdfPath?: string;
  pdfName?: string;
  category?: string;
  machine?: string;
  process?: string;
}

interface ShowPagesDetail extends Omit<ShowPdfDetail, 'pdfUrl'> {
  pdfUrl?: string;
  initialPageIndex?: number;
  pages: SearchResult[];
}

function clampPageIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

function formatHistoryTime(viewedAt: number): string {
  return new Date(viewedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildHistoryMeta(entry: Pick<DisplayHistoryEntry, 'category' | 'machine' | 'process'>): string {
  return [entry.category, entry.machine, entry.process].filter(Boolean).join(' / ');
}

function formatBackendSource(source: 'auto_hostname' | 'auto_fixed_ip' | 'auto_scan' | 'manual' | 'none'): string {
  switch (source) {
    case 'auto_hostname':
      return 'dxu';
    case 'auto_fixed_ip':
      return '固定 IP';
    case 'auto_scan':
      return '扫描命中';
    case 'manual':
      return '手动兜底';
    default:
      return '未握手';
  }
}

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
  const [pdfViewerSrc, setPdfViewerSrc] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  // 多页浏览状态
  const [browseAllPages, setBrowseAllPages] = useState<SearchResult[]>([]);
  const [browsePageIndex, setBrowsePageIndex] = useState(0);
  const [recentHistory, setRecentHistory] = useState<DisplayHistoryEntry[]>(() => loadDisplayHistory());
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

  // 全屏图片触摸状态：竖向滑动翻页，同时拦截浏览器默认拖拽/平移
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);
  const suppressNextFullscreenClick = useRef(false);
  const SWIPE_THRESHOLD = 50;

  const syncRecentHistory = useCallback((nextHistory: DisplayHistoryEntry[]) => {
    startTransition(() => {
      setRecentHistory(nextHistory);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void hydrateDisplayHistory().then((entries) => {
      if (cancelled) {
        return;
      }
      syncRecentHistory(entries);
    });

    return () => {
      cancelled = true;
    };
  }, [syncRecentHistory]);

  const rememberViewedItem = useCallback((seed: DisplayHistorySeed) => {
    syncRecentHistory(rememberDisplayHistory(seed));
  }, [syncRecentHistory]);

  const openPagedSop = useCallback((
    pages: SearchResult[],
    options: {
      jobName?: string;
      pdfUrl?: string;
      pdfPath?: string;
      pdfName?: string;
      category?: string;
      machine?: string;
      process?: string;
      source?: DisplayHistorySource;
    } = {}
  ) => {
    const normalizedPages = (pages || [])
      .filter(page => page.image_url || page.image_path)
      .slice()
      .sort((a, b) => (a.page_num || 0) - (b.page_num || 0));

    if (normalizedPages.length === 0) {
      return false;
    }

    const firstPage = normalizedPages[0];
    const jobName = options.jobName
      || normalizedPages.find(page => page.job_name)?.job_name
      || firstPage.job_name
      || options.pdfName
      || '';

    setPdfViewerSrc(null);
    showImage(firstPage.image_url || firstPage.image_path || '', jobName);
    setBrowseAllPages(normalizedPages);
    setBrowsePageIndex(0);

    rememberViewedItem({
      source: options.source || 'browse',
      jobName,
      pdfUrl: options.pdfUrl,
      pdfPath: options.pdfPath,
      pdfName: options.pdfName,
      category: options.category,
      machine: options.machine,
      process: options.process,
      pages: normalizedPages,
    });

    return true;
  }, [rememberViewedItem, showImage]);

  // 退出全屏浏览（同时清理多页状态）
  const exitBrowseFullscreen = () => {
    console.log('[Display] 退出全屏, currentImage:', currentImage);
    setBrowseAllPages([]);
    setBrowsePageIndex(0);
    exitFullscreen();
  };

  // 键盘翻页支持（仅在全屏浏览模式有效）
  useEffect(() => {
    if (!isFullscreen || !currentImage || browseAllPages.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setBrowsePageIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setBrowsePageIndex(i => Math.min(browseAllPages.length - 1, i + 1));
      } else if (e.key === 'Escape') {
        exitBrowseFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, currentImage, browseAllPages]);

  // 监听来自 DisplayContext 的 PDF 推送事件（带超时和重试）
  useEffect(() => {
    const handler = async (e: Event) => {
      const { pdfUrl, jobName, pdfPath, pdfName, category, machine, process } = (e as CustomEvent<ShowPdfDetail>).detail;
      setPdfLoading(true);
      setPdfViewerSrc(null);

      // 带 10 秒超时的 fetch
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10000);

      let srcToSet: string | null = null;
      try {
        const resp = await fetch(pdfUrl, { signal: ctrl.signal as AbortSignal });
        clearTimeout(timeout);
        if (resp.ok) {
          const blob = await resp.blob();
          srcToSet = URL.createObjectURL(blob);
        } else {
          console.error('[PDF] 下载失败 HTTP', resp.status, pdfUrl);
        }
      } catch (err) {
        clearTimeout(timeout);
        console.error('[PDF] 下载异常', (err as Error).message, pdfUrl);
      }

      if (srcToSet) {
        setPdfViewerSrc(srcToSet);
      } else {
        // 下载失败：降级为直接用 URL 加载（由 iframe 自己处理网络请求）
        setPdfViewerSrc(pdfUrl);
      }
      setPdfLoading(false);
      rememberViewedItem({
        source: 'push',
        jobName,
        pdfUrl,
        pdfPath,
        pdfName,
        category,
        machine,
        process,
      });
    };
    window.addEventListener('sop:showPdf', handler);
    return () => window.removeEventListener('sop:showPdf', handler);
  }, [rememberViewedItem]);

  useEffect(() => {
    const handler = (e: Event) => {
      const {
        pages,
        initialPageIndex,
        jobName,
        pdfUrl,
        pdfPath,
        pdfName,
        category,
        machine,
        process,
      } = (e as CustomEvent<ShowPagesDetail>).detail;
      const normalizedPages = (pages || []).slice().sort((a, b) => (a.page_num || 0) - (b.page_num || 0));
      const safeInitialPageIndex = clampPageIndex(initialPageIndex ?? 0, normalizedPages.length);
      setPdfViewerSrc(null);
      setBrowseAllPages(normalizedPages);
      setBrowsePageIndex(safeInitialPageIndex);
      rememberViewedItem({
        source: 'push',
        jobName,
        pdfUrl,
        pdfPath,
        pdfName,
        category,
        machine,
        process,
        pages: normalizedPages,
      });
    };
    window.addEventListener('sop:showPages', handler);
    return () => window.removeEventListener('sop:showPages', handler);
  }, [rememberViewedItem]);

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

  const openPdfPreview = useCallback(async (
    pdfUrl: string,
    jobName = '',
    options: {
      pdfPath?: string;
      pdfName?: string;
      category?: string;
      machine?: string;
      process?: string;
      source?: DisplayHistorySource;
      record?: boolean;
    } = {}
  ) => {
    const baseURL = await apiClient.getResolvedBaseURL();
    const fullUrl = pdfUrl.startsWith('http')
      ? pdfUrl
      : `${baseURL}${pdfUrl.startsWith('/') ? '' : '/'}${pdfUrl}`;
    setPdfLoading(true);
    setPdfViewerSrc(fullUrl);
    setBrowseAllPages([]);
    setBrowsePageIndex(0);
    showImage('', jobName);
    if (options.record !== false) {
      rememberViewedItem({
        source: options.source || 'browse',
        jobName,
        pdfUrl: fullUrl,
        pdfPath: options.pdfPath,
        pdfName: options.pdfName,
        category: options.category,
        machine: options.machine,
        process: options.process,
      });
    }
  }, [rememberViewedItem, showImage]);

  const openSearchResult = useCallback(async (
    result: SearchResult,
    source: DisplayHistorySource = 'browse'
  ) => {
    const renderablePages = (result.allPages || []).filter(page => page.image_url || page.image_path);
    if (renderablePages.length > 0) {
      openPagedSop(renderablePages, {
        source,
        jobName: result.job_name || result.pdf_name || '',
        pdfUrl: result.pdf_url,
        pdfPath: result.pdf_path,
        pdfName: result.pdf_name,
        category: result.category,
        machine: result.machine,
        process: result.process,
      });
      return;
    }

    if (result.image_url || result.image_path) {
      openPagedSop([result], {
        source,
        jobName: result.job_name || result.pdf_name || '',
        pdfUrl: result.pdf_url,
        pdfPath: result.pdf_path,
        pdfName: result.pdf_name,
        category: result.category,
        machine: result.machine,
        process: result.process,
      });
      return;
    }

    if (result.pdf_url) {
      await openPdfPreview(result.pdf_url, result.job_name || result.pdf_name || '', {
        source,
        pdfPath: result.pdf_path,
        pdfName: result.pdf_name,
        category: result.category,
        machine: result.machine,
        process: result.process,
      });
    }
  }, [openPagedSop, openPdfPreview]);

  const openHistoryEntry = useCallback(async (entry: DisplayHistoryEntry) => {
    if (entry.pages.length > 0) {
      openPagedSop(entry.pages, {
        source: 'history',
        jobName: entry.jobName,
        pdfUrl: entry.pdfUrl,
        pdfPath: entry.pdfPath,
        pdfName: entry.pdfName,
        category: entry.category,
        machine: entry.machine,
        process: entry.process,
      });
      return;
    }

    if (entry.pdfUrl) {
      await openPdfPreview(entry.pdfUrl, entry.jobName || entry.pdfName || '', {
        source: 'history',
        pdfPath: entry.pdfPath,
        pdfName: entry.pdfName,
        category: entry.category,
        machine: entry.machine,
        process: entry.process,
      });
      return;
    }

    if (entry.previewPath) {
      openPagedSop([{
        image_url: entry.previewPath,
        image_path: '',
        page_num: 0,
      }], {
        source: 'history',
        jobName: entry.jobName,
        pdfUrl: entry.pdfUrl,
        pdfPath: entry.pdfPath,
        pdfName: entry.pdfName,
        category: entry.category,
        machine: entry.machine,
        process: entry.process,
      });
      return;
    }

    // entry 没有可展示内容时提示
    window.alert(`无法重新展示「${entry.jobName || entry.pdfName || '未知'}」，推送数据已过期`);
  }, [openPagedSop, openPdfPreview]);

  const handleClearHistory = useCallback(() => {
    if (!window.confirm('确认清空展示端最近查看记录吗？')) {
      return;
    }
    syncRecentHistory(clearDisplayHistory());
  }, [syncRecentHistory]);

  const consumeSuppressedFullscreenClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!suppressNextFullscreenClick.current) return false;
    suppressNextFullscreenClick.current = false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  };

  // PDF 全屏展示（推送的 SOP）
  if (isFullscreen && pdfViewerSrc) {
    return (
      <div
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100vw', height: '100vh',
          background: 'var(--axi-text, #000)',
          cursor: 'pointer', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => {
          if (pdfViewerSrc.startsWith('blob:')) URL.revokeObjectURL(pdfViewerSrc);
          setPdfViewerSrc(null);
          exitFullscreen();
        }}
      >
        {/* 加载遮罩：fetch 期间显示 */}
        {pdfLoading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', zIndex: 10, flexDirection: 'column', gap: 12,
          }}>
            <div style={{ color: 'white', fontSize: 18 }}>正在加载 SOP...</div>
            <div style={{ color: 'var(--axi-text-muted, #64748b)', fontSize: 13 }}>{currentJob}</div>
          </div>
        )}
        <iframe
          src={pdfViewerSrc}
          title={currentJob || 'SOP'}
          style={{ width: '100%', height: '100%', border: 'none', zIndex: 1 }}
          onLoad={() => setPdfLoading(false)}
          onError={() => { setPdfLoading(false); console.error('[PDF] iframe 加载失败'); }}
        />
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)', color: 'white', padding: '8px 20px', borderRadius: 20,
          fontSize: 14, pointerEvents: 'none',
        }}>
          {currentJob || 'Axi Docs Display'} · 点击或按 ESC 退出
        </div>
      </div>
    );
  }

  // 图片全屏展示（浏览模式预览，支持多页翻页）
  if (isFullscreen && currentImage) {
    const isMultiPage = browseAllPages.length > 1;
    const currentPage = browseAllPages[browsePageIndex] || null;
    const imgSrc = apiClient.getImageUrl(
      currentPage?.image_url || currentPage?.image_path || currentImage
    );

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="SOP 预览"
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100vw', height: '100vh',
          background: 'var(--axi-text, #000)', cursor: 'pointer', zIndex: 9999,
          userSelect: 'none',
          overflow: 'hidden',
          overscrollBehavior: 'none',
          touchAction: 'none',
        }}
        onClick={isMultiPage ? undefined : exitBrowseFullscreen}
        onTouchStart={(e) => {
          if (e.touches.length === 0) return;
          const touch = e.touches[0];
          touchStartPoint.current = { x: touch.clientX, y: touch.clientY };
          suppressNextFullscreenClick.current = false;
        }}
        onTouchMove={(e) => {
          if (!touchStartPoint.current) return;
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchEnd={(e) => {
          if (!touchStartPoint.current) return;
          const { x, y } = touchStartPoint.current;
          const touch = e.changedTouches[0];
          const deltaX = touch.clientX - x;
          const deltaY = y - touch.clientY;
          touchStartPoint.current = null;
          const hasMoved = Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10;
          if (hasMoved) {
            suppressNextFullscreenClick.current = true;
            e.preventDefault();
            e.stopPropagation();
          }
          if (!isMultiPage || Math.abs(deltaY) <= SWIPE_THRESHOLD || Math.abs(deltaY) <= Math.abs(deltaX)) return;
          if (deltaY > 0) {
            // 向上滑 → 下一页
            setBrowsePageIndex(i => Math.min(browseAllPages.length - 1, i + 1));
          } else if (deltaY < -SWIPE_THRESHOLD) {
            // 向下滑 → 上一页
            setBrowsePageIndex(i => Math.max(0, i - 1));
          }
        }}
        onTouchCancel={() => {
          touchStartPoint.current = null;
          suppressNextFullscreenClick.current = false;
        }}
      >
        {/* 图片区域：点击边缘区域翻页 */}
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => {
            if (consumeSuppressedFullscreenClick(e)) return;
            if (!isMultiPage) {
              exitBrowseFullscreen();
            }
          }}
        >
          <img
            src={imgSrc}
            alt={currentJob || 'SOP 预览'}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              if (consumeSuppressedFullscreenClick(e)) return;
              if (!isMultiPage) {
                exitBrowseFullscreen();
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              objectFit: 'fill',
              objectPosition: 'center',
              cursor: 'pointer',
              touchAction: 'none',
              userSelect: 'none',
            }}
          />
        </div>

        {/* 页码指示器 */}
        {isMultiPage && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)', color: 'white',
            padding: '6px 20px', borderRadius: 20,
            fontSize: 14, zIndex: 10001,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); setBrowsePageIndex(i => i - 1); }}
              disabled={browsePageIndex === 0}
              style={{
                background: 'rgba(255,255,255,0.15)', color: 'white',
                border: 'none', borderRadius: '50%', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: browsePageIndex === 0 ? 'default' : 'pointer', opacity: browsePageIndex === 0 ? 0.3 : 1,
              }}
            >
              <IconPrev />
            </button>
            <span style={{ minWidth: 80, textAlign: 'center' }}>
              {browsePageIndex + 1} / {browseAllPages.length}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setBrowsePageIndex(i => i + 1); }}
              disabled={browsePageIndex === browseAllPages.length - 1}
              style={{
                background: 'rgba(255,255,255,0.15)', color: 'white',
                border: 'none', borderRadius: '50%', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: browsePageIndex === browseAllPages.length - 1 ? 'default' : 'pointer', opacity: browsePageIndex === browseAllPages.length - 1 ? 0.3 : 1,
              }}
            >
              <IconNext />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'browse') {
    const shouldShowRecentHistory = !query.trim() || (!loading && results.length === 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: 'var(--axi-bg-page, #0d1117)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 24px',
          background: 'var(--axi-text, #1e293b)', flexShrink: 0,
        }}>
          <button
            onClick={() => setMode('idle')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              height: 40, padding: '0 16px', cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
              background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 14,
              flexShrink: 0,
            }}
          >
            <IconBack /> 返回
          </button>
          <div style={{ flex: 1 }}>
            <SearchBox
              query={query}
              onChange={setQuery}
              suggestions={suggestions}
              showSuggestions={showSuggestions}
              onSelectSuggestion={async (s) => {
                  const searchResults = await selectSuggestion(s);
                  if (searchResults && searchResults.length > 0) {
                    const first = searchResults[0];
                    const groupedResults = first?.pdf_path
                      ? searchResults.filter(item => item.pdf_path === first.pdf_path)
                      : searchResults;

                    if (groupedResults.some(item => item.image_url || item.image_path)) {
                      openPagedSop(groupedResults, {
                        jobName: first?.job_name || first?.pdf_name || s,
                        pdfUrl: first?.pdf_url,
                        pdfPath: first?.pdf_path,
                        pdfName: first?.pdf_name,
                        category: first?.category,
                        machine: first?.machine,
                        process: first?.process,
                      });
                    } else if (first) {
                      await openSearchResult(first);
                    }
                  }
              }}
              onClearSuggestions={() => {}}
              onShowSuggestionsChange={() => {}}
              loading={loading}
              enableVoice={true}
              asrPort={8766}
              showClear={true}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {shouldShowRecentHistory && recentHistory.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <div>
                  <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>最近查看</div>
                  <div style={{ color: 'var(--axi-text-muted, #64748b)', fontSize: 13, marginTop: 4 }}>
                    直接重开之前显示过的 SOP，不用重新搜索
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  style={{
                    padding: '8px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--axi-text-secondary, #cbd5e1)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  清空记录
                </button>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 16,
              }}>
                {recentHistory.map(entry => {
                  const metaText = buildHistoryMeta(entry);
                  const previewSrc = entry.previewPath ? apiClient.getImageUrl(entry.previewPath) : '';
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => { void openHistoryEntry(entry); }}
                      style={{
                        padding: 0,
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 14,
                        overflow: 'hidden',
                        background: 'rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{
                        position: 'relative',
                        aspectRatio: '3 / 4',
                        background: 'var(--axi-text, #111827)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {previewSrc ? (
                          <img
                            src={previewSrc}
                            alt={entry.jobName || entry.pdfName || 'SOP'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <IconPdf />
                        )}
                        <div style={{
                          position: 'absolute',
                          top: 10,
                          left: 10,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: 'rgba(15,23,42,0.78)',
                          color: 'white',
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          {entry.pageCount > 0 ? `共 ${entry.pageCount} 页` : 'PDF'}
                        </div>
                      </div>
                      <div style={{ padding: '14px 14px 12px' }}>
                        <div style={{
                          color: 'white',
                          fontSize: 15,
                          fontWeight: 600,
                          lineHeight: 1.35,
                          minHeight: 40,
                          marginBottom: 8,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {entry.jobName || entry.pdfName || '未命名 SOP'}
                        </div>
                        <div style={{
                          color: 'var(--axi-text-muted, #94a3b8)',
                          fontSize: 12,
                          minHeight: 18,
                          marginBottom: 10,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {metaText || '历史缓存记录'}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          color: 'var(--axi-text-muted, #64748b)',
                          fontSize: 12,
                        }}>
                          <span>{formatHistoryTime(entry.viewedAt)}</span>
                          <span>
                            {entry.source === 'push' ? '中控推送' : entry.source === 'history' ? '最近打开' : '手动浏览'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {results.length > 0 ? (
            <>
              <div style={{ color: 'var(--axi-text-muted, #64748b)', marginBottom: 20, fontSize: 14 }}>
                找到 <strong style={{ color: 'var(--axi-text-muted, #94a3b8)' }}>{results.length}</strong> 个页面，
                按 PDF 合并为 <strong style={{ color: 'var(--axi-text-muted, #94a3b8)' }}>
                  {[...new Set(results.map(r => r.pdf_path || r.image_path))].length}
                </strong> 个 SOP
              </div>
              <DisplayImageGrid
                results={results}
                onSelect={(r) => { void openSearchResult(r); }}
              />
            </>
          ) : !loading && query ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '60vh', color: 'var(--axi-text-muted, #94a3b8)', textAlign: 'center',
            }}>
              <div style={{ opacity: 0.4, marginBottom: 16 }}><IconClipboard /></div>
              <p style={{ fontSize: 16 }}>未找到匹配结果</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>尝试其他关键词</p>
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '60vh', color: 'var(--axi-text-muted, #94a3b8)', textAlign: 'center',
            }}>
              <div style={{ opacity: 0.4, marginBottom: 16 }}><IconClipboard /></div>
              <p style={{ fontSize: 16 }}>输入关键词搜索 SOP</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>支持作业名、序号等关键词</p>
            </div>
          )}
        </div>
      </div>
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
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100vh',
        background: 'var(--axi-bg-page, #0d1117)', color: 'white', fontFamily: 'system-ui, sans-serif',
      }}>
        {/* 顶部导航栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 24px', background: 'var(--axi-text, #1e293b)', flexShrink: 0,
        }}>
          <button
            onClick={() => setMode('idle')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              height: 40, padding: '0 16px', cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
              background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 14,
              flexShrink: 0,
            }}
          >
            <IconBack /> 返回
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconPush />
            <span style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>推送历史</span>
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {pushHistoryEntries.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '60vh', color: 'var(--axi-text-muted, #64748b)',
            }}>
              <IconPush />
              <div style={{ fontSize: 16, marginTop: 16 }}>暂无推送历史</div>
              <div style={{ fontSize: 13, marginTop: 8, color: 'var(--axi-text-secondary, #475569)' }}>
                中控端推送的 SOP 会显示在这里
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 15, color: 'var(--axi-text-muted, #94a3b8)' }}>
                  共 {pushHistoryEntries.length} 条推送记录
                </div>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 16,
              }}>
                {pushHistoryEntries.map(entry => {
                  const metaText = buildHistoryMeta(entry);
                  const previewSrc = entry.previewPath ? apiClient.getImageUrl(entry.previewPath) : '';
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => { void openHistoryEntry(entry); }}
                      style={{
                        padding: 0,
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        overflow: 'hidden',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      {previewSrc ? (
                        <img
                          src={previewSrc}
                          alt={entry.jobName}
                          style={{
                            width: '100%', height: 160, objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%', height: 160,
                          background: 'rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconClipboard size={48} />
                        </div>
                      )}
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{
                          fontSize: 14, fontWeight: 600, color: 'white',
                          marginBottom: 6,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {entry.jobName || entry.pdfName || '无标题'}
                        </div>
                        {metaText && (
                          <div style={{
                            fontSize: 12, color: 'var(--axi-text-muted, #94a3b8)', marginBottom: 6,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {metaText}
                          </div>
                        )}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          color: 'var(--axi-text-muted, #64748b)', fontSize: 12,
                        }}>
                          <span>{formatHistoryTime(entry.viewedAt)}</span>
                          <span style={{
                            padding: '2px 8px',
                            background: 'rgba(34,197,94,0.15)',
                            color: 'var(--axi-success, #4ade80)',
                            borderRadius: 4, fontSize: 11,
                          }}>
                            推送
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh',
      background: 'var(--axi-bg-page, #0d1117)',
      color: 'white', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Axi Docs Display</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isLoggedIn && loginData ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, fontSize: 12, color: 'var(--axi-text-muted, #94a3b8)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--axi-warning, #fbbf24)' }}>{loginData.deviceNumber}</span>
                {localIP && (
                  <>
                    <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{ fontFamily: 'monospace', color: 'var(--axi-text, #e2e8f0)' }}>{localIP}</span>
                    <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: !backendBaseURL ? 'var(--axi-danger, #ef4444)' : !connected ? 'var(--axi-warning, #f59e0b)' : 'var(--axi-success, #22c55e)',
                      flexShrink: 0,
                    }} />
                  </>
                )}
                <span style={{ fontFamily: 'monospace', color: 'var(--axi-text-muted, #94a3b8)', fontSize: 11 }}>{backendInfoText}</span>
              </div>
              {apiError && !connected && (
                <div style={{ fontSize: 11, color: 'var(--axi-danger, #fca5a5)' }}>
                  {apiError}
                </div>
              )}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setMode('settings')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 12px',
              background: 'rgba(255,255,255,0.08)', color: 'var(--axi-text, #e2e8f0)',
              border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6,
              fontSize: 12, cursor: 'pointer',
            }}
            title="连接设置"
          >
            <IconSettings /> 连接设置
          </button>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={logout}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 12px',
                background: 'rgba(239,68,68,0.2)', color: 'var(--axi-danger, #fca5a5)',
                border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6,
                fontSize: 12, cursor: 'pointer',
              }}
              title="退出登录"
            >
              <IconExit /> 退出登录
            </button>
          ) : (
            <button
              type="button"
              className="quit-btn"
              onClick={handleQuit}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 12px',
                background: 'rgba(239,68,68,0.2)', color: 'var(--axi-danger, #fca5a5)',
                border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6,
                fontSize: 12, cursor: 'pointer',
              }}
              title="退出应用"
            >
              <IconExit /> 退出
            </button>
          )}
        </div>
      </div>

      {pendingUpdate && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 24px', flexShrink: 0,
          background: 'rgba(34,197,94,0.15)',
          borderBottom: '1px solid rgba(34,197,94,0.3)',
          color: 'var(--axi-success, #86efac)', fontSize: 13,
        }}>
          <span style={{ flex: 1 }}>
            发现新版本 <strong>{pendingUpdate.displayVersion || pendingUpdate.version}</strong>
            {pendingUpdate.size ? ` (${formatSize(pendingUpdate.size)})` : ''}
            {pendingUpdate.note ? ` — ${pendingUpdate.note}` : ''}
          </span>
          <button
            type="button"
            onClick={async () => {
              // 立即清除 pendingUpdate，避免重复弹窗
              setPendingUpdate(null);
              try {
                // 传入服务器版本号，downloadAndInstall 会保存到 localStorage
                await downloadAndInstall(pendingUpdate.downloadUrl, pendingUpdate.version);
              } catch (e) {
                console.error('[OTA] 安装失败', e);
              }
            }}
            style={{
              padding: '4px 16px',
              background: 'var(--axi-success, #22c55e)', color: 'white',
              border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            }}
          >
            更新
          </button>
          <button
            type="button"
            onClick={() => setPendingUpdate(null)}
            style={{
              padding: '4px 8px',
              background: 'transparent', color: 'var(--axi-success, #86efac)',
              border: '1px solid rgba(134,239,172,0.4)', borderRadius: 6,
              fontSize: 12, cursor: 'pointer',
            }}
          >
            忽略
          </button>
        </div>
      )}

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <img
          src={`${process.env.PUBLIC_URL || ''}/assets/hero-display.png`}
          alt=""
          style={{ width: 400, height: 'auto', marginBottom: 28, opacity: 0.9 }}
        />
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 12px', color: 'white' }}>Axi Docs Display</h1>
        <p style={{ color: 'var(--axi-text-muted, #94a3b8)', marginBottom: 28, fontSize: 15 }}>
          等待中控端推送指令，或手动搜索浏览
        </p>

        <button
          type="button"
          className="browse-btn"
          onClick={() => setMode('browse')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '14px 40px', minWidth: 240,
            background: 'rgba(255,255,255,0.08)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12, fontSize: 16, cursor: 'pointer',
            marginBottom: 16,
            transition: 'background 0.2s',
          }}
        >
          <IconSearch /> 浏览 SOP
        </button>
        {recentHistory.filter(e => e.source === 'push').length > 0 && (
          <button
            type="button"
            onClick={() => setMode('pushHistory')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px 40px', minWidth: 240,
              background: 'rgba(34,197,94,0.1)',
              color: 'var(--axi-success, #4ade80)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 12, fontSize: 16, cursor: 'pointer',
              marginBottom: 16,
              transition: 'background 0.2s',
            }}
          >
            <IconPush /> 推送历史
            <span style={{
              padding: '2px 8px',
              background: 'var(--axi-success, #22c55e)', color: 'white',
              borderRadius: 10, fontSize: 12,
            }}>
              {recentHistory.filter(e => e.source === 'push').length}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function DisplayApp() {
  return (
    <DisplayProvider>
      <DisplayContent />
    </DisplayProvider>
  );
}
