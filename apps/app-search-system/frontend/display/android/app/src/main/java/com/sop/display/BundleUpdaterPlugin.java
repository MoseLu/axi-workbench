package com.sop.display;

import android.content.Context;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * BundleUpdaterPlugin - Web Bundle 热更新插件
 *
 * 工作原理：
 *   1. 从后端下载 React build 的 ZIP 包（不含 APK，只有 HTML/JS/CSS）
 *   2. 解压到 app 内部存储 (filesDir/sop_bundle/v_{version}/)
 *   3. 调用 bridge.setServerBasePath() 让 WebView 从新目录加载
 *   4. 整个过程无需重装 APK，用户无感知
 *
 * 版本信息保存在 filesDir/sop_bundle/current_version.txt:
 *   第一行: 版本号 (hash 字符串)
 *   第二行: 已解压目录的绝对路径
 */
@CapacitorPlugin(name = "BundleUpdater")
public class BundleUpdaterPlugin extends Plugin {

    private static final String TAG = "BundleUpdater";
    static final String BUNDLE_DIR_NAME = "sop_bundle";
    static final String VERSION_FILE_NAME = "current_version.txt";

    // ─────────────────────────────────────────
    //  JS 可调用方法
    // ─────────────────────────────────────────

    /**
     * 下载并应用新 bundle
     * 参数: { url: string, version: string }
     */
    @PluginMethod
    public void downloadAndApply(final PluginCall call) {
        final String url     = call.getString("url", "");
        final String version = call.getString("version", "");

        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        if (version == null || version.isEmpty()) {
            call.reject("version is required");
            return;
        }

        // 在后台线程执行（下载 + 解压可能耗时）
        new Thread(() -> {
            try {
                Context ctx         = getContext();
                File   bundleRoot   = new File(ctx.getFilesDir(), BUNDLE_DIR_NAME);
                File   versionDir   = new File(bundleRoot, "v_" + version);
                File   zipTmp       = new File(bundleRoot, "bundle_" + version + ".zip");

                bundleRoot.mkdirs();

                // 1. 下载 ZIP
                Log.i(TAG, "下载 bundle: " + url);
                downloadFile(url, zipTmp);

                // 2. 解压
                Log.i(TAG, "解压 bundle 到: " + versionDir.getAbsolutePath());
                if (versionDir.exists()) deleteRecursive(versionDir);
                versionDir.mkdirs();
                extractZip(zipTmp, versionDir);
                zipTmp.delete();

                // 3. 校验 index.html 存在
                if (!new File(versionDir, "index.html").exists()) {
                    deleteRecursive(versionDir);
                    call.reject("bundle 无效：缺少 index.html");
                    return;
                }

                // 4. 保存版本信息
                writeVersionFile(ctx, version, versionDir.getAbsolutePath());

                // 5. 切换 WebView 到新 bundle（在主线程执行）
                final String newPath = versionDir.getAbsolutePath();
                Log.i(TAG, "切换 WebView 到新 bundle: " + newPath);
                getBridge().executeOnMainThread(() ->
                    getBridge().setServerBasePath(newPath)
                );

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("version", version);
                result.put("path", newPath);
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Bundle 更新失败: " + e.getMessage(), e);
                call.reject("Bundle 更新失败: " + e.getMessage());
            }
        }).start();
    }

    /**
     * 获取当前已应用的 bundle 版本
     * 返回: { version: string|null, path: string|null, isNative: boolean }
     */
    @PluginMethod
    public void getCurrentVersion(PluginCall call) {
        try {
            String[] info = readVersionFile(getContext());
            JSObject result = new JSObject();
            if (info != null) {
                result.put("version", info[0]);
                result.put("path",    info[1]);
                result.put("isNative", false);
            } else {
                result.put("version",  (Object) null);
                result.put("path",     (Object) null);
                result.put("isNative", true);
            }
            call.resolve(result);
        } catch (Exception e) {
            call.reject("读取版本失败: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────
    //  供 MainActivity 调用的静态工具
    // ─────────────────────────────────────────

    /**
     * 读取已保存的 bundle 路径（启动时使用）
     * 如果目录有效返回路径，否则返回 null。
     */
    public static String getSavedBundlePath(Context context) {
        try {
            String[] info = readVersionFile(context);
            if (info == null) return null;
            String path = info[1];
            // 确认目录和 index.html 仍然存在（防止被清除）
            File dir = new File(path);
            if (dir.isDirectory() && new File(dir, "index.html").exists()) {
                return path;
            }
            return null;
        } catch (Exception e) {
            Log.w(TAG, "读取已保存 bundle 路径失败: " + e.getMessage());
            return null;
        }
    }

    // ─────────────────────────────────────────
    //  私有工具方法
    // ─────────────────────────────────────────

    /** 写版本文件：version\npath */
    private static void writeVersionFile(Context ctx, String version, String path) throws IOException {
        File f = new File(new File(ctx.getFilesDir(), BUNDLE_DIR_NAME), VERSION_FILE_NAME);
        try (FileOutputStream fos = new FileOutputStream(f)) {
            fos.write((version + "\n" + path).getBytes("UTF-8"));
        }
    }

    /**
     * 读版本文件，返回 [version, path]，文件不存在或格式错误返回 null
     */
    private static String[] readVersionFile(Context ctx) throws IOException {
        File f = new File(new File(ctx.getFilesDir(), BUNDLE_DIR_NAME), VERSION_FILE_NAME);
        if (!f.exists()) return null;

        StringBuilder sb = new StringBuilder();
        try (FileInputStream fis = new FileInputStream(f)) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = fis.read(buf)) != -1) sb.append(new String(buf, 0, n, "UTF-8"));
        }
        String[] parts = sb.toString().trim().split("\n", 2);
        if (parts.length < 2) return null;
        return new String[]{parts[0].trim(), parts[1].trim()};
    }

    /** HTTP 下载到本地文件 */
    private void downloadFile(String urlString, File dest) throws IOException {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(30_000);
        conn.setReadTimeout(120_000);
        conn.connect();

        if (conn.getResponseCode() != 200) {
            throw new IOException("下载失败，HTTP " + conn.getResponseCode());
        }

        try (InputStream in  = new BufferedInputStream(conn.getInputStream());
             FileOutputStream out = new FileOutputStream(dest)) {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        } finally {
            conn.disconnect();
        }
    }

    /** 解压 ZIP 到目标目录（防 Zip Slip） */
    private void extractZip(File zipFile, File destDir) throws IOException {
        String destCanonical = destDir.getCanonicalPath() + File.separator;
        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zipFile))) {
            ZipEntry entry;
            byte[] buf = new byte[65536];
            while ((entry = zis.getNextEntry()) != null) {
                File target = new File(destDir, entry.getName());
                // Zip Slip 防护
                if (!target.getCanonicalPath().startsWith(destCanonical)) {
                    throw new IOException("非法路径: " + entry.getName());
                }
                if (entry.isDirectory()) {
                    target.mkdirs();
                } else {
                    target.getParentFile().mkdirs();
                    try (FileOutputStream fos = new FileOutputStream(target)) {
                        int n;
                        while ((n = zis.read(buf)) != -1) fos.write(buf, 0, n);
                    }
                }
                zis.closeEntry();
            }
        }
    }

    /** 递归删除目录 */
    private void deleteRecursive(File f) {
        if (f.isDirectory()) {
            File[] children = f.listFiles();
            if (children != null) for (File c : children) deleteRecursive(c);
        }
        f.delete();
    }
}
