/**
 * APK 安装器 - 原生 Android 插件包装
 * 使用 DownloadManager 下载 APK，然后触发系统安装界面
 */
import { registerPlugin } from '@capacitor/core';

interface ApkInstallerPlugin {
  downloadAndInstall(options: { url: string; filename: string }): Promise<{ success: boolean; message: string }>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller', {
  web: {
    downloadAndInstall: async ({ url }) => {
      // Web 端不支持，直接报错
      throw new Error('APK 安装仅支持 Android 原生应用');
    },
  },
});

/**
 * 下载 APK 并触发安装
 * @param {string} downloadUrl - APK 下载地址
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function downloadAndInstallApk(downloadUrl: string) {
  const filename = 'sop-update-' + Date.now() + '.apk';
  return ApkInstaller.downloadAndInstall({ url: downloadUrl, filename });
}

export default ApkInstaller;
