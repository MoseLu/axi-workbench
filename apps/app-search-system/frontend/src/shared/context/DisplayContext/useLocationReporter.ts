/**
 * GPS 获取与周期上报。
 *
 * 原 DisplayProvider 内的 getLocation / reportLocation 抽到本文件；
 * 上报逻辑使用 mutable ref 同步保存 UUID，避免 React state 批处理带来的时序问题。
 */
import type { MutableRefObject } from 'react';

import apiClient from '../../api/client';

/** 获取 GPS 坐标（优先自定义原生插件，调用 Android LocationManager） */
export async function getLocation(): Promise<{ lat: number; lng: number } | null> {
  const { getCurrentPosition } = await import('../../../native/getCurrentPosition');
  const pos = await getCurrentPosition();
  if (pos) {
    console.log('[GPS] 获取成功:', pos.latitude, pos.longitude);
    return { lat: pos.latitude, lng: pos.longitude };
  }
  console.warn('[GPS] 所有 GPS 方式均不可用');
  return null;
}

/** 上报 GPS 坐标到后端 */
export async function reportLocation(
  lat: number,
  lng: number,
  activeUuidRef: MutableRefObject<string>,
): Promise<void> {
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