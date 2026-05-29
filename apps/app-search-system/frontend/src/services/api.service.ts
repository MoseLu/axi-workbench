/**
 * API服务层 - 统一Electron IPC和HTTP请求接口
 */

import { isElectron, getConfig } from '../config/api.config';
import { getInitialApiBaseURL } from '../shared/api/discovery';

/**
 * 统一API客户端
 * 自动检测运行环境并选择合适的通信方式
 */
class APIClient {
  config: { baseURL: string; timeout: number };

  constructor() {
    this.config = getConfig();
    if (!this.config.baseURL) {
      this.config.baseURL = getInitialApiBaseURL() || 'http://127.0.0.1:8765';
    }
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    if (isElectron) {
      // Electron模式：使用IPC
      return await window.electronAPI?.getStats?.();
    }
    // Capacitor模式：HTTP请求
    return await this.httpGet('/api/stats');
  }

  /**
   * 混合搜索
   */
  async searchHybrid(query: string) {
    if (isElectron) {
      return await window.electronAPI?.searchHybrid?.(query);
    }
    return await this.httpGet(`/api/search/hybrid?q=${encodeURIComponent(query)}`);
  }

  /**
   * 联想搜索
   */
  async suggest(query: string, limit = 10) {
    if (isElectron) {
      return await window.electronAPI?.suggest?.(query, limit);
    }
    return await this.httpGet(`/api/suggest?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  /**
   * 设置主题颜色（仅Electron支持）
   */
  setThemeColor(color: string) {
    if (isElectron && window.electronAPI?.setThemeColor) {
      window.electronAPI.setThemeColor(color);
    }
    // Capacitor模式下忽略此操作
  }

  /**
   * 最小化窗口（仅Electron支持）
   */
  minimizeWindow() {
    if (isElectron && window.electronAPI?.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    }
    // Capacitor模式下忽略此操作
  }

  /**
   * 最大化窗口（仅Electron支持）
   */
  async maximizeWindow() {
    if (isElectron && window.electronAPI?.maximizeWindow) {
      return await window.electronAPI.maximizeWindow();
    }
    // Capacitor模式下返回false
    return false;
  }

  /**
   * 关闭窗口（仅Electron支持）
   */
  closeWindow() {
    if (isElectron && window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    }
    // Capacitor模式下忽略此操作
  }

  /**
   * HTTP GET请求（Capacitor模式使用）
   */
  async httpGet(endpoint: string) {
    if (!this.config.baseURL) {
      this.config.baseURL = getInitialApiBaseURL() || 'http://127.0.0.1:8765';
    }
    const url = `${this.config.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API请求失败:', error);
      throw error;
    }
  }

  /**
   * 检查后端连接状态
   */
  async checkConnection() {
    try {
      await this.getStats();
      return true;
    } catch (error) {
      console.error('后端连接失败:', error);
      return false;
    }
  }

  /**
   * 获取图片URL
   * Electron: file:/// 路径
   * Capacitor: HTTP URL
   */
  getImageUrl(imagePath: string) {
    if (!imagePath) return '';

    if (isElectron) {
      // Electron: 转换Windows路径为file URL
      return 'file:///' + imagePath.replace(/\\/g, '/');
    }

    // Capacitor: 通过后端API获取图片
    // 假设后端提供图片服务接口
    const encodedPath = encodeURIComponent(imagePath.replace(/\\/g, '/'));
    return `${this.config.baseURL}/api/image?path=${encodedPath}`;
  }
}

// 导出单例
const apiClient = new APIClient();
export default apiClient;

// 同时导出类以便测试
export { APIClient };
