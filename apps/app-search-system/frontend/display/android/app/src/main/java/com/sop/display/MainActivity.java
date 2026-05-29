package com.sop.display;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebSettings;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private static final int REQUEST_MICROPHONE = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 1. 注册原生插件（必须在 super.onCreate 之前）
        registerPlugin(BundleUpdaterPlugin.class);
        registerPlugin(com.sop.display.geolocation.NativeGeolocationPlugin.class);

        // 2. 调用父类（创建 Bridge + 加载 WebView）
        super.onCreate(savedInstanceState);

        // 3. 如果存在已下载的 bundle，立即切换到它
        String savedPath = BundleUpdaterPlugin.getSavedBundlePath(this);
        if (savedPath != null) {
            Log.i(TAG, "[BundleOTA] 启动时加载已保存 bundle: " + savedPath);
            getBridge().setServerBasePath(savedPath);
        } else {
            Log.i(TAG, "[BundleOTA] 无已保存 bundle，使用内置资源");
        }

        // 4. 配置 WebView 权限和音频设置
        setupWebViewPermissions();
        setupAudioSettings();
    }

    private void setupWebViewPermissions() {
        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(@NonNull PermissionRequest request) {
                    Log.i(TAG, "[Permission] WebView 请求权限: " + java.util.Arrays.toString(request.getResources()));
                    request.grant(request.getResources());
                }
            });

            // 配置 WebView 设置
            WebSettings settings = webView.getSettings();
            if (settings != null) {
                // 允许音频和视频自动播放
                settings.setMediaPlaybackRequiresUserGesture(false);
                Log.i(TAG, "[WebView] 媒体播放设置已配置");
            }

            Log.i(TAG, "[WebView] 权限配置已设置");
        }
    }

    private void setupAudioSettings() {
        try {
            // 请求音频焦点，确保麦克风可以被独占访问
            AudioManager audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
            if (audioManager != null) {
                int result = audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                );
                Log.i(TAG, "[Audio] 音频焦点请求结果: " + result);
            }
        } catch (Exception e) {
            Log.e(TAG, "[Audio] 音频焦点请求失败", e);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_MICROPHONE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.i(TAG, "[Permission] 麦克风权限已授予");
            } else {
                Log.w(TAG, "[Permission] 麦克风权限被拒绝");
            }
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // 返回键 / ESC：先退出全屏，再退出 app
        if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_ESCAPE) {
            if (getWindow().getDecorView().getSystemUiVisibility() != 0) {
                getWindow().getDecorView().setSystemUiVisibility(0);
                return true;
            }
            finish();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
