/**
 * DisplayApp 共享类型与工具函数
 */
import type { DisplayHistoryEntry } from '../recentHistory';

// 从 PDF URL 下载并返回第一页图片的 dataURL
export async function fetchPdfPreview(pdfUrl: string, apiBaseUrl: string): Promise<string | null> {
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

export interface ShowPdfDetail {
  pdfUrl: string;
  jobName: string;
  pdfPath?: string;
  pdfName?: string;
  category?: string;
  machine?: string;
  process?: string;
}

export interface ShowPagesDetail extends Omit<ShowPdfDetail, 'pdfUrl'> {
  pdfUrl?: string;
  initialPageIndex?: number;
  pages: SearchResult[];
}

export function clampPageIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

export function formatHistoryTime(viewedAt: number): string {
  return new Date(viewedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildHistoryMeta(entry: Pick<DisplayHistoryEntry, 'category' | 'machine' | 'process'>): string {
  return [entry.category, entry.machine, entry.process].filter(Boolean).join(' / ');
}

export function formatBackendSource(source: 'auto_hostname' | 'auto_fixed_ip' | 'auto_scan' | 'manual' | 'none'): string {
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
