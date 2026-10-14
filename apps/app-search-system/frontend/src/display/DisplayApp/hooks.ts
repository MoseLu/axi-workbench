/**
 * DisplayApp 逻辑 hooks：最近查看历史 + SOP 查看器状态
 */
import { startTransition, useCallback, useEffect, useState } from 'react';
import apiClient from '../../shared/api/client';
import {
  clearDisplayHistory,
  hydrateDisplayHistory,
  loadDisplayHistory,
  rememberDisplayHistory,
  type DisplayHistoryEntry,
  type DisplayHistorySeed,
  type DisplayHistorySource,
} from '../recentHistory';
import { clampPageIndex, type ShowPagesDetail, type ShowPdfDetail } from './utils';

/**
 * 最近查看历史（本地缓存 + 同步）
 */
export function useRecentHistory() {
  const [recentHistory, setRecentHistory] = useState<DisplayHistoryEntry[]>(() => loadDisplayHistory());

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

  const handleClearHistory = useCallback(() => {
    if (!window.confirm('确认清空展示端最近查看记录吗？')) {
      return;
    }
    syncRecentHistory(clearDisplayHistory());
  }, [syncRecentHistory]);

  return { recentHistory, rememberViewedItem, handleClearHistory };
}

interface SopViewerOptions {
  isFullscreen: boolean;
  currentImage: string | null;
  showImage: (imagePath: string, jobName?: string) => void;
  exitFullscreen: () => void;
  rememberViewedItem: (seed: DisplayHistorySeed) => void;
}

/**
 * SOP 查看器：PDF/图片全屏状态、多页浏览、推送事件监听
 */
export function useSopViewer({ isFullscreen, currentImage, showImage, exitFullscreen, rememberViewedItem }: SopViewerOptions) {
  const [pdfViewerSrc, setPdfViewerSrc] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  // 多页浏览状态
  const [browseAllPages, setBrowseAllPages] = useState<SearchResult[]>([]);
  const [browsePageIndex, setBrowsePageIndex] = useState(0);

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

  return {
    pdfViewerSrc,
    pdfLoading,
    setPdfLoading,
    setPdfViewerSrc,
    browseAllPages,
    browsePageIndex,
    setBrowsePageIndex,
    openPagedSop,
    exitBrowseFullscreen,
    openPdfPreview,
    openSearchResult,
    openHistoryEntry,
  };
}
