/**
 * API 客户端 - 统一的 HTTP 请求层
 * 支持 JWT 自动附加、错误处理、平台检测
 */

import {
  getInitialApiBaseURL,
  normalizeApiBaseURL,
  rememberSuccessfulApiBaseURL,
  resolveApiBaseURL,
} from './discovery';

const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

const CACHE_PREFIX = 'sop_api_cache:v2:';
const FILTER_OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 2 * 60 * 1000;
const SUGGEST_CACHE_TTL_MS = 10 * 60 * 1000;
const memoryCache = new Map<string, { ts: number; data: unknown }>();

function readLocalCache<T>(key: string): { ts: number; data: T } | null {
  const memory = memoryCache.get(key);
  if (memory) {
    return memory as { ts: number; data: T };
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts?: number; data?: T };
    if (typeof parsed?.ts !== 'number') return null;
    const record = { ts: parsed.ts, data: parsed.data as T };
    memoryCache.set(key, record);
    return record;
  } catch {
    return null;
  }
}

function writeLocalCache<T>(key: string, data: T) {
  const record = { ts: Date.now(), data };
  memoryCache.set(key, record);

  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(record));
  } catch {
    // 忽略 localStorage 容量限制
  }
}

function isFresh(record: { ts: number }, ttlMs: number): boolean {
  return Date.now() - record.ts <= ttlMs;
}

// 创建 axios 实例（兼容无 axios 的环境，使用 fetch）
class APIClient {
  baseURL: string;
  timeout: number;
  baseURLPromise: Promise<string> | null;
  baseURLVerified: boolean;

  constructor() {
    this.baseURL = getInitialApiBaseURL();
    this.timeout = 15000;
    this.baseURLPromise = null;
    this.baseURLVerified = false;
    console.log('[API] 客户端初始化, baseURL:', this.baseURL);
  }

  // 重新加载配置（用于动态更新）
  reloadConfig() {
    this.baseURL = getInitialApiBaseURL();
    this.baseURLPromise = null;
    this.baseURLVerified = false;
    console.log('[API] 配置已重新加载, baseURL:', this.baseURL);
  }

  async ensureReady() {
    if (this.baseURL && this.baseURLVerified) {
      return this.baseURL;
    }
    if (!this.baseURLPromise) {
      this.baseURLPromise = resolveApiBaseURL()
        .then((resolved) => {
          this.baseURL = normalizeApiBaseURL(resolved);
          this.baseURLVerified = true;
          rememberSuccessfulApiBaseURL(this.baseURL);
          console.log('[API] 自动发现后端成功:', this.baseURL);
          return this.baseURL;
        })
        .finally(() => {
          this.baseURLPromise = null;
        });
    }
    return this.baseURLPromise;
  }

  async getResolvedBaseURL() {
    return this.ensureReady();
  }

  applyResolvedBaseURL(baseURL: string) {
    const normalized = normalizeApiBaseURL(baseURL);
    if (!normalized) {
      return;
    }

    this.baseURL = normalized;
    this.baseURLPromise = null;
    this.baseURLVerified = true;
    rememberSuccessfulApiBaseURL(normalized);
    console.log('[API] 已切换到后端地址:', normalized);
  }

  _getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? localStorage.getItem('sop_token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async _request(method: string, endpoint: string, data?: unknown, resolvedBaseURL?: string) {
    const baseURL = resolvedBaseURL || await this.ensureReady();
    const url = `${baseURL}${endpoint}`;
    console.log(`[API] ${method} ${url}`);

    // Honor WebView 兼容性：使用手动 AbortController 超时替代 AbortSignal.timeout()
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[API] 请求超时: ${method} ${url}`);
      controller.abort();
    }, this.timeout);

    const options: RequestInit = {
      method,
      headers: this._getHeaders(),
      signal: controller.signal as AbortSignal,
    };
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const startTime = Date.now();
      const response = await fetch(url, options);
      const duration = Date.now() - startTime;
      clearTimeout(timeoutId);

      this.baseURL = baseURL;
      this.baseURLVerified = true;
      rememberSuccessfulApiBaseURL(baseURL);

      console.log(`[API] ${method} ${url} - ${response.status} (${duration}ms)`);

      const text = await response.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }
      if (!response.ok) {
        const err = json as Record<string, unknown>;
        const errorMsg = (err?.error as string) || `HTTP ${response.status}: ${response.statusText}`;
        console.error(`[API] ${method} ${url} 失败:`, errorMsg);
        throw new Error(errorMsg);
      }
      return json;
    } catch (error) {
      console.error(`[API] ${method} ${url} 异常:`, (error as Error).message);
      throw error;
    }
  }

  get(endpoint: string) { return this._request('GET', endpoint); }
  post(endpoint: string, data?: unknown) { return this._request('POST', endpoint, data); }
  put(endpoint: string, data?: unknown) { return this._request('PUT', endpoint, data); }
  del(endpoint: string) { return this._request('DELETE', endpoint); }

  async cachedGet<T>(
    endpoint: string,
    cacheKey: string,
    ttlMs: number,
    options: { preferCache?: boolean; staleOnError?: boolean } = {}
  ): Promise<T> {
    const baseURL = await this.ensureReady();
    const key = `${baseURL}:${cacheKey}`;
    const cached = readLocalCache<T>(key);
    const preferCache = options.preferCache ?? true;
    const staleOnError = options.staleOnError ?? true;

    if (cached && isFresh(cached, ttlMs) && preferCache) {
      return cached.data;
    }

    try {
      const data = await this._request('GET', endpoint, undefined, baseURL) as T;
      writeLocalCache(key, data);
      return data;
    } catch (error) {
      if (cached && staleOnError) {
        console.warn(`[API] 使用缓存兜底: ${endpoint}`);
        return cached.data;
      }
      throw error;
    }
  }

  // ========== 认证 ==========
  async login(username: string, password: string) {
    return this.post('/api/auth/login', { username, password });
  }

  async getMe() {
    return this.get('/api/auth/me');
  }

  async changePassword(oldPassword: string, newPassword: string) {
    return this.post('/api/auth/change-password', { old_password: oldPassword, new_password: newPassword });
  }

  // ========== 设备 ==========
  async registerDevice(uuid: string, displayName: string, deviceInfo: Record<string, unknown> = {}, oldUuid?: string | null) {
    return this.post('/api/devices/register', {
      uuid,
      display_name: displayName,
      device_info: deviceInfo,
      // APK 升级时传入旧随机 UUID，后端自动合并重复记录
      ...(oldUuid ? { old_uuid: oldUuid } : {}),
    });
  }

  async heartbeatDevice(uuid: string) {
    return this.post('/api/devices/heartbeat', { uuid });
  }

  async createDevice(data: {
    sequence_num: string;
    display_name?: string;
    device_group?: string;
    assigned_job?: string;
    device_password?: string;
  }) {
    return this.post('/api/devices', data);
  }

  async batchCreateDevices(devices: Array<{
    sequence_num: string;
    display_name?: string;
    device_group?: string;
    assigned_job?: string;
    device_password?: string;
  }>) {
    return this.post('/api/devices/batch-create', { devices });
  }

  async getDevices(options: { group?: string; includeOffline?: boolean } = {}) {
    // options.group: 按分组筛选，为空则返回全部分组
    // options.includeOffline: 包含离线设备
    const params = new URLSearchParams();
    if (options.group) params.set('group', options.group);
    if (options.includeOffline) params.set('include_offline', '1');
    const qs = params.toString();
    return this.get(`/api/devices${qs ? '?' + qs : ''}`);
  }

  async getDeviceGroups() {
    return this.get('/api/devices/groups');
  }

  async updateDevice(deviceId: number, data: Record<string, unknown>) {
    return this.put(`/api/devices/${deviceId}`, data);
  }

  async updateDevicePassword(deviceId: number, newPassword: string) {
    return this.put(`/api/devices/${deviceId}/password`, { new_password: newPassword });
  }

  async updateAllDevicesPassword(newPassword: string) {
    return this.put(`/api/devices/password-all`, { new_password: newPassword });
  }

  async deleteDevice(deviceId: number) {
    return this.del(`/api/devices/${deviceId}`);
  }

  // 迁移设备UUID（旧UUID -> 新原生ID）
  async migrateDeviceUuid(oldUuid: string, newUuid: string) {
    return this.post('/api/devices/migrate-uuid', { old_uuid: oldUuid, new_uuid: newUuid });
  }

  async getOnlineDevices() {
    return this.get('/api/devices/online');
  }

  // ========== 命令 ==========
  async sendCommand(deviceUuid: string, commandType: string, payload: Record<string, unknown>) {
    return this.post('/api/command/send', { device_uuid: deviceUuid, type: commandType, payload });
  }

  async sendBatchCommand(deviceUuids: string[], commandType: string, payload: Record<string, unknown>) {
    return this.post('/api/command/send-batch', {
      device_uuids: deviceUuids,
      type: commandType,
      payload,
    });
  }

  async broadcastCommand(commandType: string, payload: Record<string, unknown>) {
    return this.post('/api/command/send-all', { type: commandType, payload });
  }

  async broadcastToGroup(group: string, commandType: string, payload: Record<string, unknown>) {
    return this.post('/api/command/send-to-group', { group, type: commandType, payload });
  }

  async getCommandHistory(deviceId?: number | null, limit = 100): Promise<unknown[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (deviceId) params.set('device_id', String(deviceId));
    return this.get(`/api/command/history?${params}`) as Promise<unknown[]>;
  }

  async getCommandStats(): Promise<unknown> {
    return this.get('/api/command/stats');
  }

  // ========== 检索 ==========
  async getStats() {
    return this.cachedGet('/api/stats', 'stats', SEARCH_CACHE_TTL_MS);
  }

  async suggest(keyword: string, limit = 10): Promise<string[]> {
    const normalizedKeyword = keyword.trim();
    return this.cachedGet(
      `/api/suggest?q=${encodeURIComponent(normalizedKeyword)}&limit=${limit}`,
      `suggest:${normalizedKeyword}:${limit}`,
      SUGGEST_CACHE_TTL_MS
    ) as Promise<string[]>;
  }

  async search(jobName: string, topK = 20) {
    const normalizedJob = jobName.trim();
    return this.cachedGet(
      `/api/search?job=${encodeURIComponent(normalizedJob)}&top_k=${topK}`,
      `search:${normalizedJob}:${topK}`,
      SEARCH_CACHE_TTL_MS
    );
  }

  async searchSemantic(q: string, topK = 10) {
    const normalizedQuery = q.trim();
    return this.cachedGet(
      `/api/semantic?q=${encodeURIComponent(normalizedQuery)}&top_k=${topK}`,
      `semantic:${normalizedQuery}:${topK}`,
      SEARCH_CACHE_TTL_MS
    );
  }

  async searchHybrid(q: string, topK = 10): Promise<SearchResult[]> {
    const normalizedQuery = q.trim();
    return this.cachedGet(
      `/api/search/full?q=${encodeURIComponent(normalizedQuery)}&top_k=${topK}`,
      `search-full:${normalizedQuery}:${topK}`,
      SEARCH_CACHE_TTL_MS
    ) as Promise<SearchResult[]>;
  }

  async getImagesByJob(jobName: string) {
    return this.get(`/api/images/by-job?job=${encodeURIComponent(jobName)}`);
  }

  /** 返回 { categories, sub_categories, processes } */
  async filterOptions(): Promise<FilterOptions> {
    return this.cachedGet(
      '/api/search/filter-options',
      'filter-options:all',
      FILTER_OPTIONS_CACHE_TTL_MS
    ) as Promise<FilterOptions>;
  }

  /** 级联筛选项：根据已选分类/机型，返回下一级选项 */
  async filterOptionsCascade(category: string, machine: string): Promise<FilterOptions> {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (machine)  params.set('machine', machine);
    return this.cachedGet(
      `/api/search/filter-options?${params}`,
      `filter-options:${category}:${machine}`,
      FILTER_OPTIONS_CACHE_TTL_MS
    ) as Promise<FilterOptions>;
  }

  /** 带三维筛选的混合搜索 */
  async searchFilter(q: string, filters: SearchFilters, topK = 20): Promise<SearchResult[]> {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (filters.process) params.set('process', filters.process);
    if (filters.category) params.set('category', filters.category);
    if (filters.machine) params.set('machine', filters.machine);
    params.set('top_k', String(topK));
    return this.cachedGet(
      `/api/search/filter?${params}`,
      `search-filter:${q}:${filters.category || ''}:${filters.machine || ''}:${filters.process || ''}:${topK}`,
      SEARCH_CACHE_TTL_MS
    ) as Promise<SearchResult[]>;
  }

  // ========== SSE 命令订阅 ==========
  createCommandSource(uuid: string, callbacks: {
    onConnect?: (data: unknown) => void;
    onCommand?: (data: SSECommand) => void;
    onHeartbeat?: () => void;
    onDisconnect?: () => void;  // 连接断开/重连前回调（用于更新 connected 状态）
  } = {}) {
    const baseURL = this.baseURL || getInitialApiBaseURL();
    if (!baseURL) {
      throw new Error('后端地址尚未就绪，无法建立 SSE 连接');
    }
    const url = `${baseURL}/api/command/subscribe?uuid=${encodeURIComponent(uuid)}`;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(url);

      es.addEventListener('connected', (e) => {
        console.log('[SSE] 已连接', uuid);
        callbacks.onConnect?.(JSON.parse(e.data));
      });

      es.addEventListener('command', (e) => {
        try {
          const data = JSON.parse(e.data) as SSECommand;
          callbacks.onCommand?.(data);
        } catch (err) {
          console.error('[SSE] 解析命令失败', err);
        }
      });

      es.addEventListener('heartbeat', () => {
        callbacks.onHeartbeat?.();
      });

      es.onerror = () => {
        // 通知 context 连接已断开（UI 状态同步）
        callbacks.onDisconnect?.();
        es?.close();
        es = null;
        // 5 秒后重连
        if (!stopped) {
          console.log(`[SSE] 连接断开，5秒后重连 (uuid=${uuid})`);
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return {
      stop() {
        stopped = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (es) { es.close(); es = null; }
      }
    };
  }

  // ========== 工具 ==========
  async healthCheck() {
    return this.get('/health');
  }

  getImageUrl(imagePath: string) {
    const baseURL = this.baseURL || getInitialApiBaseURL();
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://') ||
        imagePath.startsWith('/api/') || imagePath.startsWith('blob:')) {
      return imagePath.startsWith('/api/') && baseURL ? `${baseURL}${imagePath}` : imagePath;
    }
    const filename = imagePath.split(/[/\\]/).pop() || '';
    return baseURL ? `${baseURL}/api/image/${encodeURIComponent(filename)}` : '';
  }

  // ========== 展示端登录 & 心跳 ==========
  /** 展示端登录：设备编号 + 密码，返回 UUID 和基本信息 */
  async displayLogin(deviceNumber: string, password: string, clientUuid?: string): Promise<DisplayLoginResult> {
    return this.post('/api/display/login', {
      device_number: deviceNumber,
      password,
      ...(clientUuid ? { client_uuid: clientUuid } : {}),
    }) as Promise<DisplayLoginResult>;
  }

  /** 展示端心跳（约30分钟一次）：验证设备仍被中控端管理 */
  async displayHeartbeat(uuid: string, deviceNumber: string): Promise<DisplayHeartbeatResult> {
    return this.post('/api/display/heartbeat', { uuid, device_number: deviceNumber }) as Promise<DisplayHeartbeatResult>;
  }

  /** 获取展示端自身设备信息 */
  async displayDeviceInfo(uuid: string): Promise<DisplayDeviceInfo> {
    return this.get(`/api/display/device?uuid=${encodeURIComponent(uuid)}`) as Promise<DisplayDeviceInfo>;
  }

  // ========== OTA 更新 ==========
  async checkUpdate() {
    return this.cachedGet('/api/update/check', 'update-check', SEARCH_CACHE_TTL_MS);
  }

  getApkDownloadUrl(filename: string) {
    const baseURL = this.baseURL || getInitialApiBaseURL();
    return baseURL ? `${baseURL}/api/update/download/${encodeURIComponent(filename)}` : '';
  }
}

const apiClient = new APIClient();
export default apiClient;
export { isElectron };

// ========== 获取本地 IP（WebRTC ICE gathering） ==========
let cachedLocalIP: string | null = null;

export async function getLocalIP(): Promise<string | null> {
  if (cachedLocalIP) return cachedLocalIP;

  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');

    return new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        pc.close();
        resolve(null);
      }, 3000);

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const cand = e.candidate.candidate ?? '';
        // 格式: a=candidate:1 1 UDP 2113664767 192.168.1.100 49915 typ host ...
        const match = cand.match(/(\d+\.\d+\.\d+\.\d+)/);
        clearTimeout(timeout);
        if (match) {
          cachedLocalIP = match[1];
          resolve(cachedLocalIP);
        }
        pc.close();
      };

      pc.createOffer({}).then((offer) => {
        pc.setLocalDescription(offer);
      }).catch(() => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

// ========== 类型定义 ==========
export interface SearchFilters {
  process?: string;
  category?: string;
  machine?: string;
}

export interface FilterOptions {
  categories: string[];
  sub_categories: string[];
  processes: string[];
  machines: string[];
}

export interface DisplayLoginResult {
  uuid: string;
  device_number: string;
  display_name: string;
  device_group: string;
  assigned_jobs: string;
  status: 'ok' | 'auto_registered';
}

export interface DisplayHeartbeatResult {
  ok: boolean;
  reason?: 'device_not_found' | 'device_number_changed';
  message?: string;
  new_device_number?: string;
}

export interface DisplayDeviceInfo {
  uuid: string;
  device_number: string;
  display_name: string;
  device_group: string;
  assigned_jobs: string;
  status: string;
}
