/**
 * 命令推送页面 - 水平分栏布局
 * 左侧(30%): 产线树状菜单
 * 右侧(70%): 搜索 + SOP 网格 + 推送按钮
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDevices, useDeviceCommands } from '../shared/hooks';
import SearchBox from '../shared/components/SearchBox';
import ImageGrid, { SopCardResult } from '../shared/components/ImageGrid';
import apiClient from '../shared/api/client';
import { getDeviceStatusMeta, isDeviceConnected } from '../shared/deviceStatus';

// ========== Toast ==========
interface ToastItem { id: number; message: string; type: 'success' | 'error' | 'info'; }
let _toastId = 0;
let _setToasts: React.Dispatch<React.SetStateAction<ToastItem[]>> | null = null;
function toast(message: string, type: ToastItem['type'] = 'info') {
  if (!_setToasts) return;
  const id = ++_toastId;
  _setToasts(prev => [...prev, { id, message, type }]);
  setTimeout(() => _setToasts?.(prev => prev.filter(t => t.id !== id)), 3000);
}
function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => { _setToasts = setToasts; return () => { _setToasts = null; }; }, []);
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 500,
          color: 'white', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          background: t.type === 'success' ? 'var(--axi-success, #22c55e)' : t.type === 'error' ? 'var(--axi-danger, #ef4444)' : 'var(--axi-primary-hover, #3b82f6)',
        }}>{t.message}</div>
      ))}
    </div>
  );
}

// ========== 推送日志 ==========
interface PushLogEntry { id: number; time: string; action: string; target: string; result: string; ok: boolean; }
let _pushLogId = 0;

// ========== SVG 图标 ==========
const IconPush = () => <img src={`${process.env.PUBLIC_URL || ''}/assets/push.svg`} alt="" style={{ width: 16, height: 16 }} />;
const IconChevron = ({ expanded }: { expanded: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"
    style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
    <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ========== 设备显示名称 ==========
function buildDeviceNames(devices: Device[]): Map<number, string> {
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

interface ParsedSequenceNum {
  line: number;
  device: number;
}

interface RenderableSopPage {
  image_url: string;
  image_path: string;
  page_num: number;
}

function parseSequenceNum(sequenceNum = ''): ParsedSequenceNum | null {
  const match = sequenceNum.trim().match(/^Line(\d+)-(\d+)$/i);
  if (!match) return null;
  return {
    line: Number(match[1]),
    device: Number(match[2]),
  };
}

function sortDevicesBySequence(a: Device, b: Device): number {
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

function clampPageIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

function buildRenderablePages(selectedPdfGroup: SopCardResult | null): RenderableSopPage[] {
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

function buildSopPayload(
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

function getDeviceLabel(device: Device, deviceNames: Map<number, string>): string {
  return deviceNames.get(device.id)
    || device.sequence_num
    || device.display_name
    || device.uuid.slice(0, 8);
}

// ========== 产线树状菜单 ==========
function GroupTree({
  groups, devices, deviceNames, selectedUuids, onToggle, onToggleGroup
}: {
  groups: string[];
  devices: Device[];
  deviceNames: Map<number, string>;
  selectedUuids: Set<string>;
  onToggle: (uuid: string) => void;
  onToggleGroup: (group: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (g: string) => setExpanded(e => ({ ...e, [g]: !e[g] }));

  const getGroupChecked = (group: string): boolean | null => {
    const devs = devices.filter(d => d.device_group === group);
    if (devs.length === 0) return false;
    const selected = devs.filter(d => selectedUuids.has(d.uuid));
    if (selected.length === 0) return false;
    if (selected.length === devs.length) return true;
    return null;
  };

  if (groups.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>暂无产线</div>;
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {groups.map(group => {
        const devs = devices.filter(d => d.device_group === group);
        const checked = getGroupChecked(group);
        const isExpanded = expanded[group] !== false;
        const connectedCount = devs.filter(d => isDeviceConnected(d.status)).length;

        return (
          <div key={group}>
            {/* 父级行 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px', cursor: 'pointer',
              background: 'var(--bg-secondary)',
            }}
              onClick={() => toggleExpand(group)}
            >
              <IconChevron expanded={isExpanded} />
              <input
                type="checkbox"
                checked={checked === true}
                ref={el => { if (el) el.indeterminate = checked === null; }}
                onChange={e => { e.stopPropagation(); onToggleGroup(group); }}
                style={{ cursor: 'pointer', width: 15, height: 15, flexShrink: 0 }}
                onClick={e => e.stopPropagation()}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{group}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{connectedCount}/{devs.length}台</span>
            </div>

            {/* 子级列表 */}
            {isExpanded && devs.map(d => {
              const isConnected = isDeviceConnected(d.status);
              const statusMeta = getDeviceStatusMeta(d.status);
              const isChecked = selectedUuids.has(d.uuid);
              return (
                <div
                  key={d.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px 4px 32px',
                    background: isChecked ? 'var(--accent-light)' : 'transparent',
                    opacity: isConnected ? 1 : 0.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(d.uuid)}
                    style={{ cursor: 'pointer', width: 14, height: 14, flexShrink: 0 }}
                  />
                  <span style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {deviceNames.get(d.id) || d.uuid.slice(0, 8)}
                  </span>
                  <span style={{ fontSize: 11, color: statusMeta.color, fontWeight: 600, flexShrink: 0 }}>
                    {statusMeta.label}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ========== 主组件 ==========
export default function Dashboard() {
  const { devices, groups, fetchDevices } = useDevices();
  const { sending, sendCommand, sendBatchCommand } = useDeviceCommands();

  // 推送设备（从树状菜单选择）
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());

  // 搜索状态
  const [filters, setFilters] = useState({ process: '', category: '', machine: '' });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPdfGroup, setSelectedPdfGroup] = useState<SopCardResult | null>(null);
  const [filterOptions, setFilterOptions] = useState<{ processes: string[]; categories: string[]; machines: string[] }>({ processes: [], categories: [], machines: [] });
  const [selectedStartPageIndex, setSelectedStartPageIndex] = useState(0);
  const [lineCascadeEnabled, setLineCascadeEnabled] = useState(false);

  // 三个筛选框的下拉展开状态
  const [catOpen, setCatOpen] = useState(false);
  const [machOpen, setMachOpen] = useState(false);
  const [procOpen, setProcOpen] = useState(false);
  const catInputRef = useRef<HTMLInputElement>(null);
  const machInputRef = useRef<HTMLInputElement>(null);
  const procInputRef = useRef<HTMLInputElement>(null);
  const filterWrapRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭所有下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target as Node)) {
        setCatOpen(false); setMachOpen(false); setProcOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 推送日志
  const [pushLog, setPushLog] = useState<PushLogEntry[]>([]);

  // 按 PDF 分组：将搜索结果按 pdf_path 分组，每组视为一个 SOP
  const pdfGroups = React.useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const key = r.pdf_path || r.image_path || String(r.id);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const groups: SopCardResult[] = [];
    for (const group of map.values()) {
      const sorted = [...group].sort((a, b) => (a.page_num || 0) - (b.page_num || 0));
      const startPage = sorted[0];
      const lastPage = sorted[sorted.length - 1];
      groups.push({
        ...startPage,
        page_num: startPage.page_num,
        page_range: `${(startPage.page_num || 0) + 1}${lastPage !== startPage ? `-${(lastPage.page_num || 0) + 1}` : ''}`,
        total_pages: sorted.length,
        allPages: sorted as unknown as SopCardResult[],
      } as unknown as SopCardResult);
    }
    return groups;
  }, [results]);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addPushLog = useCallback((action: string, target: string, result: string, ok: boolean) => {
    const entry: PushLogEntry = {
      id: ++_pushLogId,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action, target, result, ok,
    };
    setPushLog(prev => [entry, ...prev].slice(0, 15));
  }, []);

  const deviceNames = React.useMemo(() => buildDeviceNames(devices), [devices]);
  const selectedDevices = React.useMemo(() => (
    devices
      .filter(d => selectedUuids.has(d.uuid))
      .slice()
      .sort(sortDevicesBySequence)
  ), [devices, selectedUuids]);
  const selectedBaseDevice = selectedDevices.length === 1 ? selectedDevices[0] : null;
  const selectedBaseSequence = selectedBaseDevice ? parseSequenceNum(selectedBaseDevice.sequence_num || '') : null;
  const renderablePages = React.useMemo(() => buildRenderablePages(selectedPdfGroup), [selectedPdfGroup]);

  useEffect(() => {
    setSelectedStartPageIndex(0);
    setLineCascadeEnabled(false);
  }, [selectedPdfGroup?.pdf_path, selectedPdfGroup?.id]);

  useEffect(() => {
    setSelectedStartPageIndex(prev => clampPageIndex(prev, renderablePages.length));
  }, [renderablePages.length]);

  useEffect(() => {
    if (selectedDevices.length !== 1 || !selectedBaseSequence) {
      setLineCascadeEnabled(false);
    }
  }, [selectedDevices.length, selectedBaseSequence]);

  // 搜索（带防抖，机型/工序/关键词任一变化自动触发）
  const triggerSearch = useCallback((searchQ: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.searchFilter(searchQ, filters, searchQ ? 30 : 200);
        setResults(data || []);
      } catch { setResults([]); }
      setSearchLoading(false);
    }, 400);
  }, [filters]);

  // 关键词输入时自动搜索
  const handleQueryChange = (q: string) => {
    setQuery(q);
    void triggerSearch(q);
  };

  // 机型/工序变化时自动搜索（用当前关键词）
  useEffect(() => {
    void triggerSearch(query);
  }, [filters, triggerSearch, query]);

  // 树状菜单切换
  const toggleDevice = (uuid: string) => {
    setSelectedUuids(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    const groupDevices = devices.filter(d => d.device_group === group);
    const allSelected = groupDevices.every(d => selectedUuids.has(d.uuid));
    setSelectedUuids(prev => {
      const next = new Set(prev);
      if (allSelected) {
        groupDevices.forEach(d => next.delete(d.uuid));
      } else {
        groupDevices.forEach(d => next.add(d.uuid));
      }
      return next;
    });
  };

  // 推送 SOP
  const doPush = useCallback(async () => {
    if (!selectedPdfGroup) return;
    if (renderablePages.length === 0) {
      toast('当前 SOP 没有可推送的图片页', 'error');
      return;
    }

    const basePageIndex = clampPageIndex(selectedStartPageIndex, renderablePages.length);
    const uuids = [...selectedUuids];

    try {
      if (lineCascadeEnabled) {
        if (!selectedBaseDevice || !selectedBaseSequence) {
          throw new Error('顺推模式仅支持单选且设备编号需为 LineX-Y');
        }

        const assignments = devices
          .map(device => ({
            device,
            parsed: parseSequenceNum(device.sequence_num || ''),
          }))
          .filter((item): item is { device: Device; parsed: ParsedSequenceNum } => (
            !!item.parsed
            && item.parsed.line === selectedBaseSequence.line
            && item.parsed.device >= selectedBaseSequence.device
          ))
          .sort((a, b) => a.parsed.device - b.parsed.device)
          .map(item => ({
            device: item.device,
            pageIndex: basePageIndex + (item.parsed.device - selectedBaseSequence.device),
          }));

        const sendAssignments = assignments.filter(item => item.pageIndex < renderablePages.length);
        const skippedAssignments = assignments.filter(item => item.pageIndex >= renderablePages.length);

        if (sendAssignments.length === 0) {
          throw new Error('基准页之后没有足够的图片页可顺推');
        }

        const results = await Promise.allSettled(
          sendAssignments.map(item => (
            sendCommand(
              item.device.uuid,
              'show_image',
              buildSopPayload(selectedPdfGroup, renderablePages, item.pageIndex)
            )
          ))
        );

        const successCount = results.filter(result => result.status === 'fulfilled').length;
        const failureCount = results.length - successCount;
        const summaryParts = [
          `成功 ${successCount} 台`,
          skippedAssignments.length > 0 ? `超出页数跳过 ${skippedAssignments.length} 台` : '',
          failureCount > 0 ? `失败 ${failureCount} 台` : '',
        ].filter(Boolean);
        const resultText = summaryParts.join('，');

        if (successCount === 0) {
          const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
          throw new Error(firstFailure?.reason instanceof Error ? firstFailure.reason.message : '顺推失败');
        }

        toast(`产线顺推完成：${resultText}`, failureCount > 0 || skippedAssignments.length > 0 ? 'info' : 'success');
        addPushLog(
          '产线顺推',
          `${getDeviceLabel(selectedBaseDevice, deviceNames)} -> Line${selectedBaseSequence.line}`,
          `${selectedPdfGroup.job_name || ''} · 从第 ${basePageIndex + 1} 张起 · ${resultText}`,
          failureCount === 0
        );
      } else if (uuids.length === 1) {
        await sendCommand(uuids[0], 'show_image', buildSopPayload(selectedPdfGroup, renderablePages, basePageIndex));
        toast(`已推送到 1 台设备（第 ${basePageIndex + 1} 张）`, 'success');
        addPushLog('推送SOP', '单台设备', `${selectedPdfGroup.job_name || ''} · 第 ${basePageIndex + 1} 张`, true);
      } else {
        const payload = buildSopPayload(selectedPdfGroup, renderablePages, basePageIndex);
        const result = await sendBatchCommand(uuids, 'show_image', payload) as {
          sent_count?: number;
          queued_count?: number;
          missing_count?: number;
        };
        const sentCount = result?.sent_count ?? 0;
        const queuedCount = result?.queued_count ?? 0;
        const missingCount = result?.missing_count ?? 0;
        const summary = `第 ${basePageIndex + 1} 张起，已发送 ${sentCount} 台` +
          (queuedCount > 0 ? `，排队 ${queuedCount} 台` : '') +
          (missingCount > 0 ? `，缺失 ${missingCount} 台` : '');
        toast(summary, queuedCount > 0 || missingCount > 0 ? 'info' : 'success');
        addPushLog('批量推送', `已选 ${uuids.length} 台`, `${selectedPdfGroup.job_name || ''} · ${summary}`, true);
      }
    } catch (e) {
      toast(`推送失败: ${(e as Error).message}`, 'error');
      addPushLog(lineCascadeEnabled ? '产线顺推' : '推送SOP', `已选 ${uuids.length} 台`, '推送失败', false);
    }
    void fetchDevices();
  }, [
    addPushLog,
    deviceNames,
    devices,
    fetchDevices,
    lineCascadeEnabled,
    renderablePages,
    selectedBaseDevice,
    selectedBaseSequence,
    selectedPdfGroup,
    selectedStartPageIndex,
    selectedUuids,
    sendBatchCommand,
    sendCommand,
  ]);

  const selectedConnectedCount = devices.filter(d => selectedUuids.has(d.uuid) && isDeviceConnected(d.status)).length;
  const totalConnected = devices.filter(d => isDeviceConnected(d.status)).length;
  const canEnableLineCascade = selectedDevices.length === 1 && !!selectedBaseSequence && renderablePages.length > 0;
  const cascadeHint = lineCascadeEnabled && selectedBaseDevice && selectedBaseSequence
    ? `以 ${getDeviceLabel(selectedBaseDevice, deviceNames)} 为基准，后续设备按编号自动偏移图片页`
    : selectedDevices.length === 1 && !selectedBaseSequence
      ? '顺推模式要求设备编号格式为 Line1-1'
      : selectedDevices.length > 1
        ? '顺推模式仅支持单选 1 台基准设备'
        : '';

  // 加载筛选项（开机一次，获取全量选项）
  useEffect(() => {
    apiClient.filterOptions().then(opts => {
      setFilterOptions(opts);
    }).catch(() => {});
  }, []);

  // 级联加载：当分类或机型变化时，从后端获取级联后的下级选项
  const loadCascadeOptions = useCallback(async (category: string, machine: string) => {
    try {
      const opts = await apiClient.filterOptionsCascade(category, machine);
      setFilterOptions(prev => ({
        ...prev,
        machines:   opts.machines   ?? prev.machines,
        processes:  opts.processes  ?? prev.processes,
      }));
    } catch { /* 静默 */ }
  }, []);

  // 分类变化 → 重置机型和工序，重新加载级联选项
  const handleCategoryChange = useCallback((cat: string) => {
    setFilters(f => ({ ...f, category: cat, machine: '', process: '' }));
    loadCascadeOptions(cat, '');
  }, [loadCascadeOptions]);

  // 机型变化 → 重置工序，重新加载级联选项
  const handleMachineChange = useCallback((mach: string) => {
    setFilters(f => ({ ...f, machine: mach, process: '' }));
    loadCascadeOptions(filters.category, mach);
  }, [loadCascadeOptions, filters.category]);

  const canPush = !!selectedPdfGroup && selectedUuids.size > 0 && renderablePages.length > 0;
  const pushBtnLabel = selectedPdfGroup
    ? lineCascadeEnabled && selectedBaseDevice
      ? `顺推${getDeviceLabel(selectedBaseDevice, deviceNames)}所在产线`
      : `推送${selectedUuids.size > 0 ? `已选(${selectedUuids.size}台)` : ''}`
    : '请先选择 SOP';

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', overflow: 'hidden', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <ToastContainer />

      {/* 水平分栏 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* 左侧：产线树状菜单 */}
        <div style={{ width: '30%', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
          {/* 工具栏 */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              已选 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selectedUuids.size}</span> 台
              （已连接 <span style={{ color: 'var(--axi-success, #22c55e)', fontWeight: 600 }}>{selectedConnectedCount}</span> / 共 {totalConnected} 台）
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {groups.length} 个产线
            </div>
          </div>
          {/* 树状内容 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <GroupTree
              groups={groups}
              devices={devices}
              deviceNames={deviceNames}
              selectedUuids={selectedUuids}
              onToggle={toggleDevice}
              onToggleGroup={toggleGroup}
            />
          </div>
        </div>

        {/* 右侧：搜索 + 网格 + 推送按钮 */}
        <div style={{ width: '70%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* 搜索栏：一行内 分类 | 机型 | 工序 | 关键词 */}
          <div
            ref={filterWrapRef}
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>

            {/* ComboBox 通用样式 */}
            {(() => {
              const comboStyle: React.CSSProperties = {
                position: 'relative',
                flexShrink: 0,
              };
              const inputStyle: React.CSSProperties = {
                height: 36,
                padding: '0 32px 0 10px',
                fontSize: 13,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
                minWidth: 110,
              };
              const arrowStyle: React.CSSProperties = {
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 10,
              };
              const dropStyle: React.CSSProperties = {
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 8, boxShadow: '0 8px 24px var(--shadow)',
                zIndex: 200, maxHeight: 240, overflowY: 'auto',
              };
              const itemStyle: React.CSSProperties = {
                padding: '8px 10px', cursor: 'pointer', fontSize: 13,
                color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
              };

              // ComboBox 工厂函数
              const ComboBox = ({
                value, onChange, options, placeholder, open, setOpen, inputRef, extraStyle,
              }: {
                value: string; onChange: (v: string) => void;
                options: string[]; placeholder: string;
                open: boolean; setOpen: (v: boolean) => void;
                inputRef: React.RefObject<HTMLInputElement>; extraStyle?: React.CSSProperties;
              }) => {
                const [text, setText] = useState(value);
                useEffect(() => { setText(value); }, [value]);
                const filtered = text.trim()
                  ? options.filter(o => o.toLowerCase().includes(text.toLowerCase()))
                  : options;
                return (
                  <div style={{ ...comboStyle, ...(extraStyle || {}) }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={inputRef}
                        value={text}
                        onChange={e => { setText(e.target.value); setOpen(true); }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => { setOpen(false); setText(value); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { setOpen(false); onChange(text); }
                          if (e.key === 'Escape') { setOpen(false); setText(value); }
                          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); }
                        }}
                        placeholder={placeholder}
                        style={{ ...inputStyle, cursor: 'text', width: extraStyle?.minWidth as number || 110 }}
                      />
                      <span style={arrowStyle}>▼</span>
                    </div>
                    {open && filtered.length > 0 && (
                      <div style={dropStyle} onMouseDown={e => e.preventDefault()}>
                        {filtered.map(o => (
                          <div
                            key={o}
                            onClick={() => { onChange(o); setText(o); setOpen(false); }}
                            style={itemStyle}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                          >
                            {o}
                          </div>
                        ))}
                      </div>
                    )}
                    {open && text.trim() && filtered.length === 0 && (
                      <div style={{ ...dropStyle, padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)' }}>
                        无匹配
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <>
                  {/* 分类（一级） */}
                  <ComboBox
                    value={filters.category}
                    onChange={v => { handleCategoryChange(v); }}
                    options={filterOptions.categories || []}
                    placeholder="分类"
                    open={catOpen} setOpen={setCatOpen}
                    inputRef={catInputRef}
                    extraStyle={{ minWidth: 110 }}
                  />

                  {/* 机型（二级） */}
                  <ComboBox
                    value={filters.machine}
                    onChange={v => { handleMachineChange(v); }}
                    options={filterOptions.machines || []}
                    placeholder="机型"
                    open={machOpen} setOpen={setMachOpen}
                    inputRef={machInputRef}
                    extraStyle={{ minWidth: 130 }}
                  />

                  {/* 工序（三级） */}
                  <ComboBox
                    value={filters.process}
                    onChange={v => { setFilters(f => ({ ...f, process: v })); }}
                    options={filterOptions.processes || []}
                    placeholder="工序"
                    open={procOpen} setOpen={setProcOpen}
                    inputRef={procInputRef}
                    extraStyle={{ minWidth: 110 }}
                  />
                </>
              );
            })()}

            {/* 关键词 */}
            <input
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder="搜索关键词"
              style={{
                flex: 1,
                height: 36,
                padding: '0 10px',
                fontSize: 13,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />

            {/* 搜索加载指示器 */}
            {searchLoading && (
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }} />
            )}
          </div>

          {/* SOP 网格 */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {searchLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 14 }}>搜索中...</div>
            ) : results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 14 }}>
                {query || filters.process || filters.category || filters.machine ? '无匹配结果' : '请输入关键词或选择筛选条件'}
              </div>
            ) : (
              <ImageGrid results={pdfGroups} onSelect={setSelectedPdfGroup} selectable selected={selectedPdfGroup} previewOnSelect={false} />
            )}
          </div>

          {/* 推送按钮栏 */}
          <div style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}>
            {/* 已选 SOP 提示 */}
            {selectedPdfGroup ? (
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                已选: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedPdfGroup.job_name || '未知作业'}</span>
                {' '}
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  （{selectedPdfGroup.page_range || ''}页）
                </span>
              </div>
            ) : (
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>请从上方选择要推送的 SOP</div>
            )}

            {renderablePages.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
                <span>起始图</span>
                <select
                  value={selectedStartPageIndex}
                  onChange={(e) => setSelectedStartPageIndex(Number(e.target.value))}
                  style={{
                    height: 32,
                    minWidth: 152,
                    padding: '0 10px',
                    fontSize: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                >
                  {renderablePages.map((page, index) => (
                    <option key={`${page.page_num}-${index}`} value={index}>
                      {`第 ${index + 1} 张（PDF 第 ${page.page_num + 1} 页）`}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: canEnableLineCascade ? 'var(--text-secondary)' : 'var(--text-muted)',
              flexShrink: 0,
              cursor: canEnableLineCascade ? 'pointer' : 'not-allowed',
            }}>
              <input
                type="checkbox"
                checked={lineCascadeEnabled}
                disabled={!canEnableLineCascade}
                onChange={(e) => setLineCascadeEnabled(e.target.checked)}
                style={{ cursor: canEnableLineCascade ? 'pointer' : 'not-allowed' }}
              />
              <span>按产线顺推</span>
            </label>

            {cascadeHint && (
              <div style={{
                fontSize: 12,
                color: lineCascadeEnabled ? 'var(--accent)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {cascadeHint}
              </div>
            )}

            {/* 推送按钮 */}
            <button
              onClick={canPush ? doPush : undefined}
              disabled={!canPush || sending}
              style={{
                padding: '7px 20px',
                background: canPush && !sending ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: canPush && !sending ? 'white' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 6,
                cursor: canPush && !sending ? 'pointer' : 'not-allowed',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: sending ? 0.7 : 1,
                flexShrink: 0,
              }}
            >
              {canPush && !sending && <IconPush />}
              {sending ? '推送中...' : pushBtnLabel}
            </button>
          </div>

          {/* 推送日志 */}
          {pushLog.length > 0 && (
            <div style={{
              borderTop: '1px solid var(--border)',
              padding: '6px 16px',
              background: 'var(--bg-secondary)',
              maxHeight: 120,
              overflow: 'auto',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>推送记录</span>
                <button onClick={() => setPushLog([])} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>清空</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {pushLog.map(entry => (
                  <div key={entry.id} style={{ display: 'flex', gap: 8, fontSize: 11, padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: entry.ok ? 'var(--accent)' : 'var(--axi-danger, #ef4444)', fontWeight: 600, minWidth: 60 }}>{entry.action}</span>
                    <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{entry.target} · {entry.result}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{entry.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
