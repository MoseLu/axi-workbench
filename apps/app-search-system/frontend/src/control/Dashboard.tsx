/**
 * 命令推送页面 - 水平分栏布局
 * 左侧(30%): 产线树状菜单
 * 右侧(70%): 搜索 + SOP 网格 + 推送按钮
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDevices, useDeviceCommands } from '../shared/hooks';
import ImageGrid, { SopCardResult } from '../shared/components/ImageGrid';
import apiClient from '../shared/api/client';
import { isDeviceConnected } from '../shared/deviceStatus';

import GroupTree from './Dashboard.GroupTree';
import SearchFilters, { FilterOptions } from './Dashboard.SearchFilters';
import PushBar, { PushBarHandle } from './Dashboard.PushBar';
import {
  ToastContainer,
  toast,
  buildDeviceNames,
  parseSequenceNum,
  sortDevicesBySequence,
  clampPageIndex,
  buildRenderablePages,
  buildSopPayload,
  getDeviceLabel,
  buildCascadeAssignments,
  executeLineCascadePush,
} from './Dashboard.utils';

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
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    processes: [],
    categories: [],
    machines: [],
  });
  const [selectedStartPageIndex, setSelectedStartPageIndex] = useState(0);
  const [lineCascadeEnabled, setLineCascadeEnabled] = useState(false);

  const filterWrapRef = useRef<HTMLDivElement>(null);
  const pushBarRef = useRef<PushBarHandle>(null);

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

  const addPushLog = useCallback(
    (action: string, target: string, result: string, ok: boolean) => {
      pushBarRef.current?.addPushLog(action, target, result, ok);
    },
    []
  );

  const deviceNames = React.useMemo(() => buildDeviceNames(devices), [devices]);
  const selectedDevices = React.useMemo(
    () =>
      devices.filter(d => selectedUuids.has(d.uuid)).slice().sort(sortDevicesBySequence),
    [devices, selectedUuids]
  );
  const selectedBaseDevice = selectedDevices.length === 1 ? selectedDevices[0] : null;
  const selectedBaseSequence = selectedBaseDevice
    ? parseSequenceNum(selectedBaseDevice.sequence_num || '')
    : null;
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
  const triggerSearch = useCallback(
    (searchQ: string) => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      setSearchLoading(true);
      searchTimerRef.current = setTimeout(async () => {
        try {
          const data = await apiClient.searchFilter(searchQ, filters, searchQ ? 30 : 200);
          setResults(data || []);
        } catch {
          setResults([]);
        }
        setSearchLoading(false);
      }, 400);
    },
    [filters]
  );

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

        const { sendAssignments, skippedAssignments } = buildCascadeAssignments(
          devices,
          selectedBaseSequence,
          basePageIndex,
          renderablePages.length
        );

        if (sendAssignments.length === 0) {
          throw new Error('基准页之后没有足够的图片页可顺推');
        }

        const outcome = await executeLineCascadePush(
          sendAssignments,
          skippedAssignments,
          selectedPdfGroup,
          renderablePages,
          sendCommand
        );

        if (outcome.allFailed) {
          throw new Error(outcome.firstErrorMessage || '顺推失败');
        }

        toast(
          `产线顺推完成：${outcome.resultText}`,
          outcome.failureCount > 0 || outcome.skippedCount > 0 ? 'info' : 'success'
        );
        addPushLog(
          '产线顺推',
          `${getDeviceLabel(selectedBaseDevice, deviceNames)} -> Line${selectedBaseSequence.line}`,
          `${selectedPdfGroup.job_name || ''} · 从第 ${basePageIndex + 1} 张起 · ${outcome.resultText}`,
          outcome.failureCount === 0
        );
      } else if (uuids.length === 1) {
        await sendCommand(
          uuids[0],
          'show_image',
          buildSopPayload(selectedPdfGroup, renderablePages, basePageIndex)
        );
        toast(`已推送到 1 台设备（第 ${basePageIndex + 1} 张）`, 'success');
        addPushLog('推送SOP', '单台设备', `${selectedPdfGroup.job_name || ''} · 第 ${basePageIndex + 1} 张`, true);
      } else {
        const payload = buildSopPayload(selectedPdfGroup, renderablePages, basePageIndex);
        const result = (await sendBatchCommand(uuids, 'show_image', payload)) as {
          sent_count?: number;
          queued_count?: number;
          missing_count?: number;
        };
        const sentCount = result?.sent_count ?? 0;
        const queuedCount = result?.queued_count ?? 0;
        const missingCount = result?.missing_count ?? 0;
        const summary =
          `第 ${basePageIndex + 1} 张起，已发送 ${sentCount} 台` +
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

  const selectedConnectedCount = devices.filter(
    d => selectedUuids.has(d.uuid) && isDeviceConnected(d.status)
  ).length;
  const totalConnected = devices.filter(d => isDeviceConnected(d.status)).length;
  const canEnableLineCascade =
    selectedDevices.length === 1 && !!selectedBaseSequence && renderablePages.length > 0;
  const cascadeHint =
    lineCascadeEnabled && selectedBaseDevice && selectedBaseSequence
      ? `以 ${getDeviceLabel(selectedBaseDevice, deviceNames)} 为基准，后续设备按编号自动偏移图片页`
      : selectedDevices.length === 1 && !selectedBaseSequence
        ? '顺推模式要求设备编号格式为 Line1-1'
        : selectedDevices.length > 1
          ? '顺推模式仅支持单选 1 台基准设备'
          : '';

  // 加载筛选项（开机一次，获取全量选项）
  useEffect(() => {
    apiClient
      .filterOptions()
      .then(opts => {
        setFilterOptions(opts);
      })
      .catch(() => {});
  }, []);

  // 级联加载：当分类或机型变化时，从后端获取级联后的下级选项
  const loadCascadeOptions = useCallback(async (category: string, machine: string) => {
    try {
      const opts = await apiClient.filterOptionsCascade(category, machine);
      setFilterOptions(prev => ({
        ...prev,
        machines: opts.machines ?? prev.machines,
        processes: opts.processes ?? prev.processes,
      }));
    } catch {
      /* 静默 */
    }
  }, []);

  // 分类变化 → 重置机型和工序，重新加载级联选项
  const handleCategoryChange = useCallback(
    (cat: string) => {
      setFilters(f => ({ ...f, category: cat, machine: '', process: '' }));
      loadCascadeOptions(cat, '');
    },
    [loadCascadeOptions]
  );

  // 机型变化 → 重置工序，重新加载级联选项
  const handleMachineChange = useCallback(
    (mach: string) => {
      setFilters(f => ({ ...f, machine: mach, process: '' }));
      loadCascadeOptions(filters.category, mach);
    },
    [loadCascadeOptions, filters.category]
  );

  const handleProcessChange = useCallback((proc: string) => {
    setFilters(f => ({ ...f, process: proc }));
  }, []);

  const canPush = !!selectedPdfGroup && selectedUuids.size > 0 && renderablePages.length > 0;
  const pushBtnLabel = selectedPdfGroup
    ? lineCascadeEnabled && selectedBaseDevice
      ? `顺推${getDeviceLabel(selectedBaseDevice, deviceNames)}所在产线`
      : `推送${selectedUuids.size > 0 ? `已选(${selectedUuids.size}台)` : ''}`
    : '请先选择 SOP';

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <ToastContainer />

      {/* 水平分栏 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧：产线树状菜单 */}
        <div
          style={{
            width: '30%',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-primary)',
          }}
        >
          {/* 工具栏 */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              已选 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selectedUuids.size}</span> 台
              （已连接{' '}
              <span style={{ color: 'var(--axi-success, #22c55e)', fontWeight: 600 }}>
                {selectedConnectedCount}
              </span>{' '}
              / 共 {totalConnected} 台）
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
        <div
          style={{
            width: '70%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 搜索栏 */}
          <SearchFilters
            filters={filters}
            filterOptions={filterOptions}
            query={query}
            searchLoading={searchLoading}
            filterWrapRef={filterWrapRef}
            onCategoryChange={handleCategoryChange}
            onMachineChange={handleMachineChange}
            onProcessChange={handleProcessChange}
            onQueryChange={handleQueryChange}
          />

          {/* SOP 网格 */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {searchLoading ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 40,
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                }}
              >
                搜索中...
              </div>
            ) : results.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 40,
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                }}
              >
                {query || filters.process || filters.category || filters.machine
                  ? '无匹配结果'
                  : '请输入关键词或选择筛选条件'}
              </div>
            ) : (
              <ImageGrid
                results={pdfGroups}
                onSelect={setSelectedPdfGroup}
                selectable
                selected={selectedPdfGroup}
                previewOnSelect={false}
              />
            )}
          </div>

          {/* 推送按钮栏 + 日志 */}
          <PushBar
            ref={pushBarRef}
            selectedPdfGroup={selectedPdfGroup}
            renderablePages={renderablePages}
            selectedStartPageIndex={selectedStartPageIndex}
            onStartPageIndexChange={setSelectedStartPageIndex}
            lineCascadeEnabled={lineCascadeEnabled}
            canEnableLineCascade={canEnableLineCascade}
            onToggleLineCascade={setLineCascadeEnabled}
            cascadeHint={cascadeHint}
            pushBtnLabel={pushBtnLabel}
            canPush={canPush}
            sending={sending}
            onPush={doPush}
          />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
