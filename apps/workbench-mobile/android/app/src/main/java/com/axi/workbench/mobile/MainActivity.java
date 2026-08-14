package com.axi.workbench.mobile;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Small native host for the independent Workbench Mobile surface.
 *
 * The web surface remains the owner of routes and UI. The Android package owns
 * the app lifecycle, status/navigation bars, and the WebView container so QA
 * exercises the real installed app instead of a browser tab.
 */
public final class MainActivity extends Activity {
    private static final String DEFAULT_START_PATH = "/home";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(244, 247, 249));
        configureWebView(webView);
        setContentView(webView);

        webView.loadUrl(resolveStartUrl());
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(248, 250, 251));
        window.setNavigationBarColor(Color.rgb(248, 250, 251));
        window.getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        );
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);

        view.setWebViewClient(new WebViewClient());
        view.setWebChromeClient(new WebChromeClient());
    }

    private String resolveStartUrl() {
        String requested = getIntent().getStringExtra("serverUrl");
        if (requested == null || requested.trim().isEmpty()) {
            requested = getString(com.axi.workbench.mobile.R.string.server_url);
        }
        requested = requested.trim();
        if (!requested.endsWith("/")) {
            requested += "/";
        }
        if (requested.endsWith("/")) {
            requested = requested.substring(0, requested.length() - 1);
        }
        String path = getIntent().getStringExtra("startPath");
        if (path == null || path.trim().isEmpty() || !path.startsWith("/")) {
            path = DEFAULT_START_PATH;
        }
        return requested + path.trim();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
