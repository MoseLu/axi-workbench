/**
 * OTA 更新服务 - Web Bundle 热更新（无需重装 APK）
 *
 * 工作原理：
 *   - 后端每次打包后通过 publish_bundle.py 生成 bundle.zip 并广播 SSE bundle_update 命令
 *   - 设备收到命令后调用 BundleUpdaterPlugin（Android Java 插件）
 *   - 插件下载 bundle.zip，解压到内部存储，调用 bridge.setServerBasePath() 热替换 WebView 内容
 *   - 全程无需重装 APK，用户无感知
 *
 * 两种触发方式：
 *   1. SSE 推送（主动）：服务器打包后立即广播，设备自动应用
 *   2. 轮询（保底）：每 5 分钟检查一次版本，如有新版本自动下载应用
 */
import { Capacitor } from '@capacitor/core';

const BUNDLE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟轮询间隔
const LOCALSTORAGE_KEY = '__bundle_version__';
let _bundleCheckTimer: ReturnType<typeof setInterval> | null = null;

// BundleUpdater Java 插件接口
interface BundleUpdaterPlugin {
  downloadAndApply(options: { url: string; version: string }): Promise<{ success: boolean; version: string; path: string }>;
  getCurrentVersion(): Promise<{ version: string | null; path: string | null; isNative: boolean }>;
}

function getBundleUpdaterPlugin(): BundleUpdaterPlugin | null {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { registerPlugin } = require('@capacitor/core') as typeof import('@capacitor/core');
    return registerPlugin<BundleUpdaterPlugin>('BundleUpdater', {
      web: {
        downloadAndApply: async () => { throw new Error('仅支持 Android'); },
        getCurrentVersion: async () => ({ version: null, path: null, isNative: true }),
      },
    });
  } catch {
    return null;
  }
}

/**
 * 获取本机当前已应用的 bundle 版本
 * 优先级：native 插件返回值 > localStorage（热更新后 reload 前保存的版本）
 */
export async function getLocalBundleVersion(): Promise<string | null> {
  const plugin = getBundleUpdaterPlugin();
  if (plugin) {
    try {
      const info = await plugin.getCurrentVersion();
      if (info.version) return info.version;
    } catch {
      // ignore
    }
  }
  // 兜底：热更新 reload 后，native 可能尚未写入版本文件，读 localStorage
  return localStorage.getItem(LOCALSTORAGE_KEY);
}

/**
 * 检查服务器上是否有新 bundle（版本不同即为"有更新"）
 */
export async function checkBundleUpdate(apiBaseUrl: string): Promise<BundleUpdateInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const res = await fetch(`${apiBaseUrl}/api/update/bundle/version`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = await res.json() as {
      hasBundle?: boolean; version?: string; displayVersion?: string;
      size?: number; note?: string; downloadUrl?: string;
    };
    if (!data.hasBundle || !data.version) return null;

    const localVersion = await getLocalBundleVersion();
    if (data.version === localVersion) {
      // 版本一致（已是最新），通知上层清除可能残留的 pendingUpdate
      return null; // 已是最新
    }

    return {
      version:        data.version,
      displayVersion: data.displayVersion || data.version,
      size:           data.size,
      note:           data.note ?? '',
      downloadUrl:    `${apiBaseUrl}${data.downloadUrl}`,
    };
  } catch (e) {
    console.warn('[BundleOTA] 检查更新失败:', e);
    return null;
  }
}

/**
 * 下载并应用新 bundle（调用 Android Java 插件）
 * 成功后 WebView 会自动 reload，用户无感知
 */
export async function downloadAndApplyBundle(downloadUrl: string, version: string): Promise<void> {
  const plugin = getBundleUpdaterPlugin();
  if (!plugin) throw new Error('BundleUpdater 插件不可用（仅支持 Android）');

  // 保存版本到 localStorage，reload 后 getLocalBundleVersion 可读到
  localStorage.setItem(LOCALSTORAGE_KEY, version);

  console.log(`[BundleOTA] 开始下载 bundle v${version}: ${downloadUrl}`);
  const result = await plugin.downloadAndApply({ url: downloadUrl, version });
  if (!result.success) throw new Error('bundle 应用失败');
  console.log(`[BundleOTA] bundle v${version} 已应用，WebView 即将 reload`);
}

/**
 * 启动定期 bundle 版本检查（每 5 分钟）
 * 返回一个停止函数。
 *
 * @param autoApply 为 true 时自动下载并应用，无需用户确认（推荐）
 */
export function startBundleChecker(
  apiBaseUrl: string,
  onUpdateAvailable: (update: BundleUpdateInfo) => void,
  autoApply = true,
): (() => void) | undefined {
  if (!Capacitor.isNativePlatform()) return undefined;

  const doCheck = async () => {
    try {
      const update = await checkBundleUpdate(apiBaseUrl);
      if (!update) return;

      if (autoApply) {
        console.log(`[BundleOTA] 自动应用新版本: ${update.version}`);
        await downloadAndApplyBundle(update.downloadUrl, update.version);
      } else {
        onUpdateAvailable(update);
      }
    } catch (e) {
      console.warn('[BundleOTA] 检查/应用失败:', e);
    }
  };

  // 启动后 15 秒进行首次检查（等待网络稳定）
  const initialTimer = setTimeout(doCheck, 15_000);

  if (_bundleCheckTimer) clearInterval(_bundleCheckTimer);
  _bundleCheckTimer = setInterval(doCheck, BUNDLE_CHECK_INTERVAL);

  return () => {
    clearTimeout(initialTimer);
    if (_bundleCheckTimer) { clearInterval(_bundleCheckTimer); _bundleCheckTimer = null; }
  };
}

export function stopBundleChecker() {
  if (_bundleCheckTimer) { clearInterval(_bundleCheckTimer); _bundleCheckTimer = null; }
}

// ──────────────────────────────────────────────────────────────────
//  兼容旧接口（DisplayContext 中仍引用 startUpdateChecker）
// ──────────────────────────────────────────────────────────────────

export async function downloadAndInstall(downloadUrl: string, version?: string) {
  // 使用服务器版本号（从 pendingUpdate 或 SSE payload 传入）
  // 不再使用 Date.now() 生成假版本号
  const v = version || 'unknown';
  return downloadAndApplyBundle(downloadUrl, v);
}

export function startUpdateChecker(
  apiBaseUrl: string,
  onUpdateAvailable: (update: OtaUpdate) => void,
): (() => void) | undefined {
  // autoApply=false：保留 UI 提示，与旧逻辑一致
  return startBundleChecker(apiBaseUrl, (bundle) => {
    onUpdateAvailable({
      version:        bundle.version,
      displayVersion: bundle.displayVersion,
      size:           bundle.size,
      note:           bundle.note,
      downloadUrl:    bundle.downloadUrl,
    });
  }, false);
}

export function stopUpdateChecker() {
  stopBundleChecker();
}

export function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ──────────────────────────────────────────────────────────────────
//  类型
// ──────────────────────────────────────────────────────────────────

export interface BundleUpdateInfo {
  version: string;        // hash，用于版本比对
  displayVersion?: string; // 人类可读版本号
  size?: number;
  note?: string;
  downloadUrl: string;
}
