/**
 * 共享 hooks
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/client';
import { normalizeDeviceStatus } from '../deviceStatus';

/**
 * 搜索 hook
 */
export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState<{ process: string; category: string; machine: string }>({
    process: '',
    category: '',
    machine: '',
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipDebounceRef = useRef(false);

  // 搜索（含筛选）
  useEffect(() => {
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      return;
    }
    if (!query.trim() && !filters.category && !filters.process) {
      setResults([]);
      return;
    }
    setLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const hasFilter = filters.process || filters.category || filters.machine;
        let data: SearchResult[];
        if (hasFilter) {
          data = await apiClient.searchFilter(query, filters, 30);
        } else {
          data = await apiClient.searchHybrid(query, 30);
        }
        setResults(data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, filters]);

  // 联想
  useEffect(() => {
    if (query.length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.suggest(query, 10);
        setSuggestions(data || []);
        setShowSuggestions((data || []).length > 1);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => { if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current); };
  }, [query]);

  const selectSuggestion = useCallback((suggestion: string): Promise<SearchResult[]> => {
    skipDebounceRef.current = true;
    setQuery(suggestion);
    setShowSuggestions(false);
    return (async () => {
      try {
        const hasFilter = filters.process || filters.category || filters.machine;
        let data: SearchResult[];
        if (hasFilter) {
          data = await apiClient.searchFilter(suggestion, filters, 30);
        } else {
          data = await apiClient.searchHybrid(suggestion, 30);
        }
        setResults(data || []);
        return data || [];
      } catch {
        setResults([]);
        return [];
      }
    })();
  }, [filters]);

  return { query, setQuery, results, loading, suggestions, showSuggestions, setShowSuggestions, selectSuggestion, filters, setFilters };
}

/**
 * 设备列表 hook
 */
export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState(''); // '' = 全部分组

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const opts: { group?: string; includeOffline?: boolean } = {};
      if (groupFilter) opts.group = groupFilter;
      const devs = await apiClient.getDevices(opts) as Device[];
      setDevices(devs || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [groupFilter]);

  const fetchGroups = useCallback(async () => {
    try {
      const gs = await apiClient.getDeviceGroups() as string[];
      setGroups(gs || []);
    } catch { /* 静默 */ }
  }, []);

  // 直接使用设备自身的 status 字段（后端心跳维护）
  const getDeviceStatus = useCallback((uuid: string) => {
    const d = devices.find(d => d.uuid === uuid);
    return normalizeDeviceStatus(d?.status);
  }, [devices]);

  // 定期刷新设备列表（10秒轮询，确保状态实时）
  useEffect(() => {
    fetchDevices();
    fetchGroups();
  }, [fetchDevices, fetchGroups]);

  // 用 ref 保存稳定的 fetchDevices 引用，避免 interval 依赖变化
  const fetchDevicesRef = useRef(fetchDevices);
  useEffect(() => { fetchDevicesRef.current = fetchDevices; }, [fetchDevices]);

  useEffect(() => {
    const interval = setInterval(() => { fetchDevicesRef.current(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  return { devices, groups, loading, error, fetchDevices, fetchGroups, getDeviceStatus, groupFilter, setGroupFilter };
}

/**
 * 设备命令 hook
 */
export function useDeviceCommands() {
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<unknown[]>([]);
  const [stats, setStats] = useState<unknown>(null);
  const pendingCountRef = useRef(0);

  const beginSending = useCallback(() => {
    pendingCountRef.current += 1;
    setSending(true);
  }, []);

  const endSending = useCallback(() => {
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
    if (pendingCountRef.current === 0) {
      setSending(false);
    }
  }, []);

  const sendCommand = useCallback(async (deviceUuid: string, commandType: string, payload: Record<string, unknown>) => {
    beginSending();
    try {
      const result = await apiClient.sendCommand(deviceUuid, commandType, payload);
      return result;
    } finally {
      endSending();
    }
  }, [beginSending, endSending]);

  const sendBatchCommand = useCallback(async (deviceUuids: string[], commandType: string, payload: Record<string, unknown>) => {
    beginSending();
    try {
      return await apiClient.sendBatchCommand(deviceUuids, commandType, payload);
    } finally {
      endSending();
    }
  }, [beginSending, endSending]);

  const sendToAll = useCallback(async (commandType: string, payload: Record<string, unknown>) => {
    beginSending();
    try {
      return await apiClient.broadcastCommand(commandType, payload);
    } finally {
      endSending();
    }
  }, [beginSending, endSending]);

  const sendToGroup = useCallback(async (group: string, commandType: string, payload: Record<string, unknown>) => {
    beginSending();
    try {
      return await apiClient.broadcastToGroup(group, commandType, payload);
    } finally {
      endSending();
    }
  }, [beginSending, endSending]);

  const fetchHistory = useCallback(async (deviceId?: number | null) => {
    const data = await apiClient.getCommandHistory(deviceId);
    setHistory(data || []);
    return data;
  }, []);

  const fetchStats = useCallback(async () => {
    const data = await apiClient.getCommandStats();
    setStats(data);
    return data;
  }, []);

  return { sending, history, stats, sendCommand, sendBatchCommand, sendToAll, sendToGroup, fetchHistory, fetchStats };
}
