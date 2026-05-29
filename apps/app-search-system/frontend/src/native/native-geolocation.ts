/**
 * 自定义原生 GPS 插件定义
 * 对应 Android: NativeGeolocationPlugin.java
 *
 * Capacitor 8 模式：使用 @capacitor/synapse 注册，与 @capacitor/geolocation 相同
 */
import { registerPlugin } from '@capacitor/core';
import '@capacitor/synapse';

export interface NativeGeolocationPluginResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: string;
}

const NativeGeolocation = registerPlugin<{ getCurrentPosition: () => Promise<NativeGeolocationPluginResult> }>(
  'NativeGeolocation',
  { web: () => Promise.resolve(new Proxy({}, { get: () => () => Promise.reject('Not available on web') })) as any },
);

export { NativeGeolocation };
