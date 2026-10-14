/**
 * 展示端 Context - 管理设备UUID、当前显示内容
 *
 * 业务实现拆到：
 *   - ./handleCommand.ts   handleCommand 命令分发
 *   - ./sessionActions.ts  注册 / 登出 / showImage / exitFullscreen
 *   - ./useLocationReporter.ts GPS 周期上报
 */
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import apiClient from '../../api/client';
import {
  DISCOVERY_STATE_EVENT,
  getBackendDiscoveryState,
  type BackendDiscoveryState,
} from '../../api/discovery';
import { startBundleChecker } from '../../../services/ota.service';
import { getDisplayDeviceInfo } from '../../deviceIdentity';

import { dispatchCommand } from './handleCommand';
import { startCommandStream } from './connectSSE';
import {
  buildRegister,
  buildShowImage,
  buildExitFullscreen,
  buildOnLogin,
  buildLogout,
  buildReportStatus,
} from './sessionActions';
import { getLocation, reportLocation } from './useLocationReporter';

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
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // logout ref（用于 interval 回调中调用，避免循环依赖）
  const logoutRef = useRef<(() => void) | null>(null);

  const commandSourceRef = useRef<{ stop: () => void } | null>(null);
  /**
   * activeUuidRef：保存实际使用的 UUID（同步更新，不受 React state 批处理延迟影响）
   */
  const activeUuidRef = useRef<string>('');

  /**
   * currentImageRef / currentJobRef：SSE 订阅只在会话建立时创建一次，
   * dispatch 通过 ref 读取最新的 image/job，避免闭包捕获登录时的旧值。
   */
  const currentImageRef = useRef<string | null>(null);
  const currentJobRef = useRef<string | null>(null);

  useEffect(() => {
    currentImageRef.current = currentImage;
    currentJobRef.current = currentJob;
  }, [currentImage, currentJob]);

  const reportStatus = buildReportStatus(activeUuidRef);
  const register = buildRegister({ setDevice, setApiError });
  const showImage = buildShowImage({ setCurrentImage, setCurrentJob, setIsFullscreen, reportStatus });
  const exitFullscreen = buildExitFullscreen({ setIsFullscreen, setCurrentImage, setCurrentJob, reportStatus });
  const onLogin = buildOnLogin({ setLoginData, setIsLoggedIn });
  const logout = buildLogout({
    activeUuidRef,
    commandSourceRef,
    heartbeatIntervalRef,
    locationIntervalRef,
    setIsLoggedIn,
    setLoginData,
    setUuid,
    setConnected,
    setCurrentImage,
    setCurrentJob,
    setIsFullscreen,
  });

  const refreshBackendConnection = async (reloadConfig = false) => {
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
  };

  // 命令分发：依赖 reportStatus 与当前 image/job（经 ref 读取，保持最新值）
  const dispatch = (cmd: SSECommand) => {
    dispatchCommand({
      cmd,
      currentImage: currentImageRef.current,
      currentJob: currentJobRef.current,
      setCurrentImage,
      setCurrentJob,
      setIsFullscreen,
      reportStatus,
      setPendingUpdate,
    });
  };

  /**
   * connectSSE - 建立 SSE 命令订阅
   *
   * @param targetUuid 明确传入要使用的 UUID，不从 React state 读取，
   *                   避免 state 异步更新时序导致 UUID 不一致的问题。
   */
  const connectSSE = (targetUuid: string) => {
    startCommandStream({
      targetUuid,
      commandSourceRef,
      setConnected,
      setApiError,
      dispatch,
    });
  };

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
  }, []);

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
        reportLocation(loc.lat, loc.lng, activeUuidRef);
      }

      // 每 10 分钟重新获取并上报 GPS
      locationIntervalRef.current = setInterval(async () => {
        if (cancelled) return;
        const l = await getLocation();
        if (l) reportLocation(l.lat, l.lng, activeUuidRef);
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
  }, [isLoggedIn, loginData]);

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

// Re-export for downstream callers that need the device fingerprint helper.
export { getDisplayDeviceInfo };