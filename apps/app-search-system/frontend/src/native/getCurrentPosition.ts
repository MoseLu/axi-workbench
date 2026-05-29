/**
 * 原生 GPS 插件 JS 包装器
 * 优先使用自定义 NativeGeolocationPlugin（调用 Android LocationManager，不需要 Google Play Services）
 * 降级到 @capacitor/geolocation
 */
interface NativePosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: string;
}

interface NativePositionResult {
  // 自定义 NativeGeolocationPlugin 直接返回坐标（无 coords 嵌套）
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: string;
}

export async function getCurrentPosition(): Promise<NativePosition | null> {
  // 1. 优先：自定义原生插件（Android LocationManager，不需要 Google Play Services）
  try {
    const { NativeGeolocation } = await import('./native-geolocation');
    const result = await NativeGeolocation.getCurrentPosition() as NativePositionResult;
    if (result?.latitude != null) {
      console.log('[GPS] 原生插件成功:', result.latitude, result.longitude);
      return {
        latitude: result.latitude,
        longitude: result.longitude,
      };
    }
  } catch (e) {
    console.warn('[GPS] 原生插件不可用:', e);
  }

  // 2. 降级：Capacitor Geolocation（需要 Google Play Services）
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const pos = await Geolocation.getCurrentPosition();
    console.log('[GPS] Capacitor GPS 成功:', pos.coords.latitude, pos.coords.longitude);
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch (e) {
    console.warn('[GPS] Capacitor Geolocation 失败:', (e as Error).message || e);
  }

  return null;
}
