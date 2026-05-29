/**
 * 展示端 Context - 管理设备UUID、当前显示内容
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import apiClient from '../api/client';
import {
  DISCOVERY_STATE_EVENT,
  getBackendDiscoveryState,
  type BackendDiscoveryState,
} from '../api/discovery';
import { startBundleChecker, downloadAndApplyBundle } from '../../services/ota.service';
import { getDisplayDeviceInfo } from '../deviceIdentity';

export interface LoginData {
  uuid: string;
  deviceNumber: string;
  displayName: string;
  deviceGroup: string;
  assignedJobs: string;
}

interface DisplayValue {
  uuid: string;
  device: unknown;
  connected: boolean;
  currentImage: string | null;
  currentJob: string | null;
  isFullscreen: boolean;
  apiError: string | null;
  backendBaseURL: string;
  backendDiscovery: BackendDiscoveryState;
  showImage: (imagePath: string, jobName?: string) => void;
  exitFullscreen: () => void;
  register: (deviceUuid: string, oldUuid?: string | null, retries?: number, delay?: number) => Promise<unknown>;
  refreshBackendConnection: (reloadConfig?: boolean) => Promise<string>;
  pendingUpdate: OtaUpdate | null;
  setPendingUpdate: (update: OtaUpdate | null) => void;
  // 登录状态
  isLoggedIn: boolean;
  loginData: LoginData | null;
  onLogin: (data: LoginData) => void;
  logout: () => void;
}

const DisplayContext = createContext<DisplayValue | null>(null);

interface DisplayProviderProps {
  children: ReactNode;
}

export function DisplayProvider({ children }: DisplayProviderProps) {
  const [uuid, setUuid] = useState('');
  const [device, setDevice] = useState<unknown>(null);
  const [connected, setConnected] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [backendBaseURL, setBackendBaseURL] = useState(() => apiClient.baseURL);
  const [backendDiscovery, setBackendDiscovery] = useState<BackendDiscoveryState>(() => getBackendDiscoveryState());
  const [pendingUpdate, setPendingUpdate] = useState<OtaUpdate | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 登录状态（尝试从 localStorage 恢复会话，避免 bundle reload 后丢失登录状态）
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!(localStorage.getItem('sop_device_uuid') && localStorage.getItem('sop_device_number'));
  });
  const [loginData, setLoginData] = useState<LoginData | null>(() => {
    const uuid = localStorage.getItem('sop_device_uuid');
    const deviceNumber = localStorage.getItem('sop_device_number');
    if (!uuid || !deviceNumber) return null;
    return {
      uuid,
      deviceNumber,
      displayName: localStorage.getItem('sop_device_display_name') || '',
      deviceGroup: localStorage.getItem('sop_device_group') || '',
      assignedJobs: '',
    };
  });
  // 心跳定时器
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // logout ref（用于 interval 回调中调用，避免循环依赖）
  const logoutRef = useRef<(() => void) | null>(null);

  const commandSourceRef = useRef<{ stop: () => void } | null>(null);

  /**
   * activeUuidRef：保存实际使用的 UUID（同步更新，不受 React state 批处理延迟影响）
   */
  const activeUuidRef = useRef<string>('');

  const register = useCallback(async (deviceUuid: string, oldUuid: string | null = null, retries = 5, delay = 2000) => {
    const info = getDisplayDeviceInfo();
    await apiClient.ensureReady();

    console.log('[Display] 开始注册设备');
    console.log('[Display] UUID:', deviceUuid);
    console.log('[Display] Old UUID:', oldUuid);
    console.log('[Display] API Base URL:', apiClient.baseURL);

    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[Display] 注册尝试 ${i + 1}/${retries}`);
        const d = await apiClient.registerDevice(deviceUuid, '', info, oldUuid);
        setDevice(d);
        setApiError(null);
        console.log('[Display] 注册成功:', d);
        return d;
      } catch (err) {
        const error = err as Error;
        console.error(`[Display] 注册失败 (${i + 1}/${retries})`, error.message);
        setApiError(error.message);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    console.error('[Display] 所有重试均失败');
    return null;
  }, []);

  const refreshBackendConnection = useCallback(async (reloadConfig = false) => {
    if (reloadConfig) {
      apiClient.reloadConfig();
    }

    try {
      const resolvedBaseURL = await apiClient.ensureReady();
      setBackendBaseURL(resolvedBaseURL);
      setBackendDiscovery(getBackendDiscoveryState());
      return resolvedBaseURL;
    } catch (error) {
      setBackendBaseURL('');
      setBackendDiscovery(getBackendDiscoveryState());
      throw error;
    }
  }, []);

  // 通知后端设备状态变化
  const reportStatus = useCallback(async (isFullscreen: boolean, imagePath = '', jobName = '') => {
    try {
      const baseURL = apiClient.baseURL;
      await fetch(`${baseURL}/api/devices/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: activeUuidRef.current,
          is_fullscreen: isFullscreen,
          current_image: imagePath,
          current_job: jobName,
        }),
      });
    } catch (err) {
      console.warn('[Display] 通知后端失败:', err);
    }
  }, []);

  // 获取 GPS 坐标（优先自定义原生插件，调用 Android LocationManager）
  async function getLocation(): Promise<{ lat: number; lng: number } | null> {
    const { getCurrentPosition } = await import('../../native/getCurrentPosition');
    const pos = await getCurrentPosition();
    if (pos) {
      console.log('[GPS] 获取成功:', pos.latitude, pos.longitude);
      return { lat: pos.latitude, lng: pos.longitude };
    }
    console.warn('[GPS] 所有 GPS 方式均不可用');
    return null;
  }

  // 上报 GPS 坐标到后端
  async function reportLocation(lat: number, lng: number) {
    try {
      const baseURL = apiClient.baseURL;
      console.log(`[GPS] 上报坐标到 ${baseURL}/api/devices/location`);
      const resp = await fetch(`${baseURL}/api/devices/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: activeUuidRef.current, latitude: lat, longitude: lng }),
      });
      const result = await resp.json();
      console.log('[GPS] 上报结果:', resp.status, result);
    } catch (err) {
      console.warn('[GPS] 上报失败:', err);
    }
  }

  const handleCommand = useCallback((cmd: SSECommand) => {
    console.log('[Display] handleCommand:', cmd.type, cmd.payload);
    switch (cmd.type) {
      case 'show_image':
        // 如果当前已有图片在显示（用户正在浏览），忽略 restore 命令避免覆盖
        if (!cmd.payload?.image_url && !cmd.payload?.pdf_url && !cmd.payload?.image_path) {
          // 空命令 → 只有在当前无显示时才做 restore
          if (!currentImage && !currentJob) break;
        }
        const hasRenderablePages = !!cmd.payload?.pages?.some(page => page.image_url || page.image_path);
        if (cmd.payload?.pages && cmd.payload.pages.length > 0 && hasRenderablePages) {
          const jobName: string = cmd.payload.job_name || '';
          const pages = cmd.payload.pages.map(page => ({
            image_url: page.image_url || '',
            image_path: page.image_path || '',
            page_num: page.page_num || 0,
          }));
          const requestedInitialPageIndex = typeof cmd.payload.initial_page_index === 'number'
            ? cmd.payload.initial_page_index
            : 0;
          const initialPageIndex = Math.min(Math.max(requestedInitialPageIndex, 0), pages.length - 1);
          const initialPage = pages[initialPageIndex] || pages[0];
          const initialImage = initialPage.image_url || initialPage.image_path || cmd.payload.image_url || cmd.payload.image_path || '';
          console.log('[Display] 收到多页 SOP 推送:', jobName, pages.length);
          setCurrentImage(initialImage);
          setCurrentJob(jobName);
          setIsFullscreen(true);
          document.documentElement.requestFullscreen?.().catch(() => {});
          reportStatus(true, initialImage, jobName);
          window.dispatchEvent(new CustomEvent('sop:showPages', {
            detail: {
              pages,
              initialPageIndex,
              jobName,
              pdfUrl: cmd.payload.pdf_url || '',
              pdfPath: cmd.payload.pdf_path || '',
              pdfName: cmd.payload.pdf_name || '',
              category: cmd.payload.category || '',
              machine: cmd.payload.machine || '',
              process: cmd.payload.process || '',
            }
          }));
        } else if (cmd.payload?.image_url) {
          // 图片推送（image_url 为完整相对路径，如 /api/image-file?...）
          const imgUrl: string = cmd.payload.image_url;
          const jobName: string = cmd.payload.job_name || '';
          console.log('[Display] 收到图片推送:', imgUrl, jobName);
          setCurrentImage(imgUrl);
          setCurrentJob(jobName);
          setIsFullscreen(true);
          document.documentElement.requestFullscreen?.().catch(() => {});
          reportStatus(true, imgUrl, jobName);
        } else if (cmd.payload?.pdf_url) {
          // PDF 兜底：下载后用 blob URL 在 iframe 中全屏展示
          const pdfUrl: string = cmd.payload.pdf_url;
          const jobName: string = cmd.payload.job_name || '';
          const baseURL = apiClient.baseURL;
          const fullUrl = pdfUrl.startsWith('http')
            ? pdfUrl
            : `${baseURL}${pdfUrl.startsWith('/') ? '' : '/'}${pdfUrl}`;
          setCurrentJob(jobName);
          setCurrentImage(null);
          setIsFullscreen(true);
          document.documentElement.requestFullscreen?.().catch(() => {});
          reportStatus(true, '', jobName);
          // 通知 DisplayApp 显示 PDF 全屏
          window.dispatchEvent(new CustomEvent('sop:showPdf', {
            detail: {
              pdfUrl: fullUrl,
              jobName,
              pdfPath: cmd.payload.pdf_path || '',
              pdfName: cmd.payload.pdf_name || '',
              category: cmd.payload.category || '',
              machine: cmd.payload.machine || '',
              process: cmd.payload.process || '',
            }
          }));
        } else if (cmd.payload?.image_path) {
          setCurrentImage(cmd.payload.image_path);
          setCurrentJob(cmd.payload.job_name || '');
          setIsFullscreen(true);
          document.documentElement.requestFullscreen?.().catch(() => {});
          reportStatus(true, cmd.payload.image_path, cmd.payload.job_name || '');
        }
        break;
      case 'show_job':
        if (cmd.payload?.job_name) {
          setCurrentJob(cmd.payload.job_name);
          setCurrentImage(null);
          reportStatus(true, '', cmd.payload.job_name);
        }
        break;
      case 'set_fullscreen':
        setIsFullscreen(true);
        document.documentElement.requestFullscreen?.().catch(() => {});
        reportStatus(true, currentImage || '', currentJob || '');
        break;
      case 'exit_fullscreen':
        setIsFullscreen(false);
        setCurrentImage(null);
        setCurrentJob(null);
        document.exitFullscreen?.().catch(() => {});
        reportStatus(false, '', '');
        break;
      case 'clear':
        setCurrentImage(null);
        setCurrentJob(null);
        setIsFullscreen(false);
        reportStatus(false, '', '');
        break;

      case 'bundle_update': {
        // 收到服务器广播的热更新命令：自动下载并应用新 bundle，无需用户确认
        const bundlePayload = cmd.payload as { version?: string; displayVersion?: string; downloadUrl?: string } | undefined;
        if (bundlePayload?.version && bundlePayload?.downloadUrl) {
          const fullUrl = bundlePayload.downloadUrl.startsWith('http')
            ? bundlePayload.downloadUrl
            : `${apiClient.baseURL}${bundlePayload.downloadUrl}`;
          const displayVer = bundlePayload.displayVersion || bundlePayload.version;
          console.log(`[BundleOTA] 收到 bundle_update 命令，显示版本: ${displayVer}`);
          // 保存版本到 localStorage，reload 后 getLocalBundleVersion 可读到正确版本
          localStorage.setItem('__bundle_version__', bundlePayload.version);
          // 异步下载应用，不阻塞当前渲染；成功/失败后均清除 pendingUpdate 避免重复弹窗
          downloadAndApplyBundle(fullUrl, bundlePayload.version)
            .then(() => {
              setPendingUpdate(null);
              console.log('[BundleOTA] bundle_update 命令执行完成，pendingUpdate 已清除');
            })
            .catch(e => {
              console.error('[BundleOTA] 自动应用失败:', e);
            });
        }
        break;
      }

      default:
        break;
    }
  }, [reportStatus, currentImage, currentJob]);

/**
   * connectSSE - 建立 SSE 命令订阅
   *
   * @param targetUuid 明确传入要使用的 UUID，不从 React state 读取，
   *                   避免 state 异步更新时序导致 UUID 不一致的问题。
   */
  const connectSSE = useCallback((targetUuid: string) => {
    if (commandSourceRef.current) {
      commandSourceRef.current.stop();
      commandSourceRef.current = null;
    }

    console.log('[Display] 建立 SSE 连接, uuid:', targetUuid);
    const src = apiClient.createCommandSource(targetUuid, {
      onConnect: (data) => {
        setConnected(true);
        setApiError(null);
        console.log('[Display] SSE已连接', data);
      },
      onCommand: (data) => {
        console.log('[Display] 收到命令', data);
        handleCommand(data);
      },
      onHeartbeat: () => {},
      onDisconnect: () => {
        // SSE 断开时立即更新连接状态，让 UI 如实反映
        setConnected(false);
        console.log('[Display] SSE连接断开，等待重连...');
      },
    });
    commandSourceRef.current = src;
  }, [handleCommand]);

  useEffect(() => {
    const syncDiscoveryState = (nextState: BackendDiscoveryState) => {
      setBackendDiscovery(nextState);
      setBackendBaseURL(nextState.baseURL || apiClient.baseURL || '');
    };

    syncDiscoveryState(getBackendDiscoveryState());

    const handleDiscoveryChange = (event: Event) => {
      syncDiscoveryState((event as CustomEvent<BackendDiscoveryState>).detail);
    };

    window.addEventListener(DISCOVERY_STATE_EVENT, handleDiscoveryChange as EventListener);
    return () => {
      window.removeEventListener(DISCOVERY_STATE_EVENT, handleDiscoveryChange as EventListener);
    };
  }, []);

  useEffect(() => {
    let stopUpdate: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        await refreshBackendConnection();
        if (cancelled) return;

        // 启动 bundle 版本轮询（display 端不自动 reload：reload 会导致登录状态丢失）
        stopUpdate = startBundleChecker(apiClient.baseURL, (update) => {
          console.log('[BundleOTA] 发现新版本:', update);
          setPendingUpdate(update);
        }, false /* 不自动应用，避免 reload */);
      } catch (err) {
        console.warn('[BundleOTA] 初始化轮询失败:', err);
      }
    })();

    return () => {
      cancelled = true;
      stopUpdate?.();
    };
  }, [refreshBackendConnection]);

  /**
   * 已登录会话初始化：连接 SSE + GPS 上报
   * 仅在 isLoggedIn=true && loginData 存在时调用
   */
  useEffect(() => {
    if (!isLoggedIn || !loginData) return;

    let cancelled = false;
    activeUuidRef.current = loginData.uuid;
    setUuid(loginData.uuid);

    async function startSession() {
      // 重新加载 API 配置（Capacitor 启动时 URL 参数已注入）
      await refreshBackendConnection(true);
      console.log('[Display] 会话初始化, uuid:', loginData.uuid, 'baseURL:', apiClient.baseURL);

      // 连接 SSE
      if (!cancelled) {
        connectSSE(loginData.uuid);
      }

      // 获取并上报 GPS 坐标
      const loc = await getLocation();
      if (loc && !cancelled) {
        console.log('[Display] GPS 坐标:', loc);
        reportLocation(loc.lat, loc.lng);
      }

      // 每 10 分钟重新获取并上报 GPS
      locationIntervalRef.current = setInterval(async () => {
        if (cancelled) return;
        const l = await getLocation();
        if (l) reportLocation(l.lat, l.lng);
      }, 10 * 60 * 1000);
    }

    startSession();

    // 启动 30 分钟心跳（通过 ref 调用 logout，避免循环依赖）
    heartbeatIntervalRef.current = setInterval(async () => {
      if (cancelled || !loginData) return;
      try {
        const result = await apiClient.displayHeartbeat(loginData.uuid, loginData.deviceNumber);
        if (!result.ok) {
          console.warn('[Display] 心跳失败:', result.reason, result.message);
          // 设备被移除或编号变更 → 自动登出
          logoutRef.current?.();
        }
      } catch (err) {
        console.warn('[Display] 心跳异常:', err);
      }
    }, 30 * 60 * 1000); // 30 分钟

    return () => {
      cancelled = true;
      if (commandSourceRef.current) {
        commandSourceRef.current.stop();
        commandSourceRef.current = null;
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [isLoggedIn, loginData, connectSSE, refreshBackendConnection]);

  const showImage = useCallback((imagePath: string, jobName = '') => {
    setCurrentImage(imagePath);
    setCurrentJob(jobName);
    setIsFullscreen(true);
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
    reportStatus(true, imagePath, jobName);
  }, [reportStatus]);

  const exitFullscreen = useCallback(() => {
    document.exitFullscreen?.().catch(() => {});
    setIsFullscreen(false);
    setCurrentImage(null);
    setCurrentJob(null);
    reportStatus(false, '', '');
  }, [reportStatus]);

  /** 登录成功时调用（由 LoginPage 触发）：启动会话 */
  const onLogin = useCallback((data: LoginData) => {
    setLoginData(data);
    setIsLoggedIn(true);
  }, []);

  /** 登出：清理会话，返回登录页 */
  const logout = useCallback(() => {
    // 通知后端清除登录状态（不等待）
    const uuid = activeUuidRef.current;
    if (uuid) {
      fetch(`${apiClient.baseURL}/api/display/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
      }).catch(() => {});
    }
    // 停止 SSE
    if (commandSourceRef.current) {
      commandSourceRef.current.stop();
      commandSourceRef.current = null;
    }
    // 停止心跳
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    // 停止 GPS 上报
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    // 清理会话数据
    localStorage.removeItem('sop_device_uuid');
    localStorage.removeItem('sop_device_number');
    localStorage.removeItem('sop_device_display_name');
    localStorage.removeItem('sop_device_group');
    setIsLoggedIn(false);
    setLoginData(null);
    setUuid('');
    setConnected(false);
    setCurrentImage(null);
    setCurrentJob(null);
    setIsFullscreen(false);
    document.exitFullscreen?.().catch(() => {});
  }, []);

  // 保持 logoutRef 同步（logout 在 interval 回调中通过 ref 调用）
  logoutRef.current = logout;

  return (
    <DisplayContext.Provider value={{
      uuid,
      device,
      connected,
      currentImage,
      currentJob,
      isFullscreen,
      apiError,
      backendBaseURL,
      backendDiscovery,
      showImage,
      exitFullscreen,
      register,
      refreshBackendConnection,
      pendingUpdate,
      setPendingUpdate,
      isLoggedIn,
      loginData,
      onLogin,
      logout,
    }}>
      {children}
    </DisplayContext.Provider>
  );
}

export function useDisplay() {
  const ctx = useContext(DisplayContext);
  if (!ctx) throw new Error('useDisplay must be used within DisplayProvider');
  return ctx;
}
