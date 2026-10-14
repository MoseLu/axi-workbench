/**
 * Dashboard 工具函数 / 类型 / Toast 系统
 * 从原 Dashboard.tsx 中抽离,保持纯逻辑 / 副作用无关的边界。
 */
import React, { useEffect, useState } from 'react';
import apiClient from '../shared/api/client';
import { SopCardResult } from '../shared/components/ImageGrid';

// ========== Toast ==========
export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let _toastId = 0;
let _setToasts: React.Dispatch<React.SetStateAction<ToastItem[]>> | null = null;

export function toast(message: string, type: ToastItem['type'] = 'info') {
  if (!_setToasts) return;
  const id = ++_toastId;
  _setToasts(prev => [...prev, { id, message, type }]);
  setTimeout(() => _setToasts?.(prev => prev.filter(t => t.id !== id)), 3000);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => {
    _setToasts = setToasts;
    return () => {
      _setToasts = null;
    };
  }, []);
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            color: 'white',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            background:
              t.type === 'success'
                ? 'var(--axi-success, #22c55e)'
                : t.type === 'error'
                  ? 'var(--axi-danger, #ef4444)'
                  : 'var(--axi-primary-hover, #3b82f6)',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ========== 推送日志 ==========
export interface PushLogEntry {
  id: number;
  time: string;
  action: string;
  target: string;
  result: string;
  ok: boolean;
}

let _pushLogId = 0;

/**
 * 递增并返回推送日志条目 id。
 * 拆分后计数器仍在模块级维护,通过函数导出避免调用方直接赋值 import 绑定。
 */
export function nextPushLogId(): number {
  return ++_pushLogId;
}

// ========== SVG 图标 ==========
export const IconPush = () => (
  <img
    src={`${process.env.PUBLIC_URL || ''}/assets/push.svg`}
    alt=""
    style={{ width: 16, height: 16 }}
  />
);

export const IconChevron = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="currentColor"
    style={{
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s',
      flexShrink: 0,
    }}
  >
    <path
      d="M4.5 2L8.5 6L4.5 10"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ========== 设备显示名称 ==========
export function buildDeviceNames(devices: Device[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const group of [...new Set(devices.map(d => d.device_group).filter(Boolean))]) {
    const groupDevs = devices.filter(d => d.device_group === group).sort((a, b) => a.id - b.id);
    let seq = 1;
    for (const d of groupDevs) {
      if (d.sequence_num) {
        map.set(d.id, d.sequence_num);
      } else {
        map.set(d.id, `${group}-${seq}`);
        seq++;
      }
    }
  }
  return map;
}

export interface ParsedSequenceNum {
  line: number;
  device: number;
}

export interface RenderableSopPage {
  image_url: string;
  image_path: string;
  page_num: number;
}

export function parseSequenceNum(sequenceNum = ''): ParsedSequenceNum | null {
  const match = sequenceNum.trim().match(/^Line(\d+)-(\d+)$/i);
  if (!match) return null;
  return {
    line: Number(match[1]),
    device: Number(match[2]),
  };
}

export function sortDevicesBySequence(a: Device, b: Device): number {
  const aSeq = parseSequenceNum(a.sequence_num || '');
  const bSeq = parseSequenceNum(b.sequence_num || '');

  if (aSeq && bSeq) {
    if (aSeq.line !== bSeq.line) return aSeq.line - bSeq.line;
    if (aSeq.device !== bSeq.device) return aSeq.device - bSeq.device;
  }

  if ((a.device_group || '') !== (b.device_group || '')) {
    return (a.device_group || '').localeCompare(b.device_group || '', 'zh-CN', { numeric: true });
  }

  return a.id - b.id;
}

export function clampPageIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

export function buildRenderablePages(selectedPdfGroup: SopCardResult | null): RenderableSopPage[] {
  if (!selectedPdfGroup) return [];

  return (selectedPdfGroup.allPages || [])
    .slice()
    .sort((a, b) => (a.page_num || 0) - (b.page_num || 0))
    .map(page => ({
      image_url: page.image_url || apiClient.getImageUrl(page.image_path || ''),
      image_path: page.image_path || '',
      page_num: page.page_num || 0,
    }))
    .filter(page => page.image_url || page.image_path);
}

export function buildSopPayload(
  selectedPdfGroup: SopCardResult,
  renderablePages: RenderableSopPage[],
  initialPageIndex: number
) {
  const safePageIndex = clampPageIndex(initialPageIndex, renderablePages.length);
  const initialPage = renderablePages[safePageIndex] || renderablePages[0];
  const fallbackImageUrl =
    ((selectedPdfGroup as Record<string, unknown>).image_url as string | undefined)
    || apiClient.getImageUrl(selectedPdfGroup.image_path || '');

  return {
    image_url: initialPage?.image_url || fallbackImageUrl || '',
    image_path: initialPage?.image_path || selectedPdfGroup.image_path || '',
    pdf_url: selectedPdfGroup.pdf_url || '',
    pdf_path: selectedPdfGroup.pdf_path || '',
    pdf_name: selectedPdfGroup.pdf_name || '',
    job_name: selectedPdfGroup.job_name || selectedPdfGroup.pdf_name || '',
    category: selectedPdfGroup.category || '',
    machine: selectedPdfGroup.machine || '',
    process: selectedPdfGroup.process || '',
    page_num: initialPage?.page_num ?? selectedPdfGroup.page_num ?? 0,
    initial_page_index: safePageIndex,
    total_pages: renderablePages.length,
    pages: renderablePages,
  };
}

export function getDeviceLabel(device: Device, deviceNames: Map<number, string>): string {
  return (
    deviceNames.get(device.id)
    || device.sequence_num
    || device.display_name
    || device.uuid.slice(0, 8)
  );
}

// ========== 顺推分配 / 执行 ==========
export interface CascadeAssignment {
  device: Device;
  pageIndex: number;
}

export function buildCascadeAssignments(
  devices: Device[],
  baseSequence: ParsedSequenceNum,
  basePageIndex: number,
  totalPages: number
): { sendAssignments: CascadeAssignment[]; skippedAssignments: CascadeAssignment[] } {
  const assignments: CascadeAssignment[] = devices
    .map(device => ({
      device,
      parsed: parseSequenceNum(device.sequence_num || ''),
    }))
    .filter(
      (item): item is { device: Device; parsed: ParsedSequenceNum } =>
        !!item.parsed
        && item.parsed.line === baseSequence.line
        && item.parsed.device >= baseSequence.device
    )
    .sort((a, b) => a.parsed.device - b.parsed.device)
    .map(item => ({
      device: item.device,
      pageIndex: basePageIndex + (item.parsed.device - baseSequence.device),
    }));

  return {
    sendAssignments: assignments.filter(item => item.pageIndex < totalPages),
    skippedAssignments: assignments.filter(item => item.pageIndex >= totalPages),
  };
}

export interface LineCascadeOutcome {
  successCount: number;
  failureCount: number;
  skippedCount: number;
  resultText: string;
  allFailed: boolean;
  firstErrorMessage?: string;
}

export async function executeLineCascadePush(
  sendAssignments: CascadeAssignment[],
  skippedAssignments: CascadeAssignment[],
  selectedPdfGroup: SopCardResult,
  renderablePages: RenderableSopPage[],
  sendCommand: (uuid: string, op: string, payload: unknown) => Promise<unknown>
): Promise<LineCascadeOutcome> {
  const results = await Promise.allSettled(
    sendAssignments.map(item =>
      sendCommand(
        item.device.uuid,
        'show_image',
        buildSopPayload(selectedPdfGroup, renderablePages, item.pageIndex)
      )
    )
  );

  const successCount = results.filter(result => result.status === 'fulfilled').length;
  const failureCount = results.length - successCount;
  const summaryParts = [
    `成功 ${successCount} 台`,
    skippedAssignments.length > 0 ? `超出页数跳过 ${skippedAssignments.length} 台` : '',
    failureCount > 0 ? `失败 ${failureCount} 台` : '',
  ].filter(Boolean);
  const resultText = summaryParts.join('，');

  let firstErrorMessage: string | undefined;
  if (successCount === 0) {
    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    firstErrorMessage =
      firstFailure?.reason instanceof Error ? firstFailure.reason.message : '顺推失败';
  }

  return {
    successCount,
    failureCount,
    skippedCount: skippedAssignments.length,
    resultText,
    allFailed: successCount === 0,
    firstErrorMessage,
  };
}
