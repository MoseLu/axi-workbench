/**
 * API配置 - 支持Electron和Capacitor双平台
 */

import { getInitialApiBaseURL } from '../shared/api/discovery';

// 检测运行环境
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

const initialBaseURL = getInitialApiBaseURL();

// API基础URL配置
const API_CONFIG = {
  // Electron 模式：优先使用已解析地址，否则回环地址用于本机后端
  electron: {
    baseURL: initialBaseURL || 'http://127.0.0.1:8765',
    timeout: 30000
  },
  // Capacitor 模式：优先使用外部注入/缓存地址，首次配对由 shared/api/discovery 自动发现
  capacitor: {
    baseURL: initialBaseURL,
    timeout: 30000
  }
};

// 获取当前环境的配置
function getConfig() {
  if (isElectron) {
    return API_CONFIG.electron;
  }
  return API_CONFIG.capacitor;
}

// 导出环境检测和配置
export { isElectron, isCapacitor, getConfig };
export default getConfig();
