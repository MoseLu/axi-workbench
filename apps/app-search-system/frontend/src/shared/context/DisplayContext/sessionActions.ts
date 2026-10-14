/**
 * 会话相关操作（注册 / 登出 / 全屏 / 状态上报）。
 *
 * 原 DisplayProvider 内的 register / showImage / exitFullscreen / onLogin / logout /
 * reportStatus 抽到本文件，所有 setState / refs 通过参数注入，避免修改业务逻辑。
 */
import type { MutableRefObject } from 'react';

import apiClient from '../../api/client';
import { getDisplayDeviceInfo } from '../../deviceIdentity';

import type { LoginData } from './index';

export function buildReportStatus(activeUuidRef: MutableRefObject<string>) {
  return async (isFullscreen: boolean, imagePath = '', jobName = '') => {
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
  };
}

export function buildRegister({
  setDevice,
  setApiError,
}: {
  setDevice: (value: unknown) => void;
  setApiError: (value: string | null) => void;
}) {
  return async (deviceUuid: string, oldUuid: string | null = null, retries = 5, delay = 2000) => {
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
  };
}

export function buildShowImage({
  setCurrentImage,
  setCurrentJob,
  setIsFullscreen,
  reportStatus,
}: {
  setCurrentImage: (value: string | null) => void;
  setCurrentJob: (value: string | null) => void;
  setIsFullscreen: (value: boolean) => void;
  reportStatus: (isFullscreen: boolean, imagePath?: string, jobName?: string) => Promise<void>;
}) {
  return (imagePath: string, jobName = '') => {
    setCurrentImage(imagePath);
    setCurrentJob(jobName);
    setIsFullscreen(true);
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
    reportStatus(true, imagePath, jobName);
  };
}

export function buildExitFullscreen({
  setIsFullscreen,
  setCurrentImage,
  setCurrentJob,
  reportStatus,
}: {
  setIsFullscreen: (value: boolean) => void;
  setCurrentImage: (value: string | null) => void;
  setCurrentJob: (value: string | null) => void;
  reportStatus: (isFullscreen: boolean, imagePath?: string, jobName?: string) => Promise<void>;
}) {
  return () => {
    document.exitFullscreen?.().catch(() => {});
    setIsFullscreen(false);
    setCurrentImage(null);
    setCurrentJob(null);
    reportStatus(false, '', '');
  };
}

export function buildOnLogin({
  setLoginData,
  setIsLoggedIn,
}: {
  setLoginData: (value: LoginData | null) => void;
  setIsLoggedIn: (value: boolean) => void;
}) {
  return (data: LoginData) => {
    setLoginData(data);
    setIsLoggedIn(true);
  };
}

export function buildLogout({
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
}: {
  activeUuidRef: MutableRefObject<string>;
  commandSourceRef: MutableRefObject<{ stop: () => void } | null>;
  heartbeatIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  locationIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  setIsLoggedIn: (value: boolean) => void;
  setLoginData: (value: LoginData | null) => void;
  setUuid: (value: string) => void;
  setConnected: (value: boolean) => void;
  setCurrentImage: (value: string | null) => void;
  setCurrentJob: (value: string | null) => void;
  setIsFullscreen: (value: boolean) => void;
}) {
  return () => {
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
  };
}