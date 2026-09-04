package com.workbench.mobile

import android.app.Activity
import android.graphics.PixelFormat
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.view.WindowCompat
import com.workbench.mobile.data.network.GatewayEndpointStore
import com.workbench.mobile.ui.startup.WorkBenchStartupGate
import com.workbench.mobile.ui.theme.WorkBenchTheme
import dagger.hilt.android.AndroidEntryPoint
import java.lang.reflect.Proxy
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject
    lateinit var gatewayEndpointStore: GatewayEndpointStore

    override fun onCreate(savedInstanceState: Bundle?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Compose 的不透明品牌加载层已在系统 Splash 下方挂载；系统层不再做
            // 默认淡化动画，直接移除，避免出现一帧低透明度的重复 Logo。
            removePlatformSplashExitAnimation()
        }
        super.onCreate(savedInstanceState)
        // Edge-to-edge 只负责系统栏 inset；窗口本身保持不透明，
        // 否则 ActivityRecord.translucent=true，深色会被叠浅（截图对照根因）。
        enableEdgeToEdge()
        enforceOpaqueWindow()

        // 立即挂载唯一可见的品牌 Loading，让 Android 12 系统 Splash
        // 无缝交给 Compose；网关恢复在 Loading 内完成，避免系统 Logo 停留过久。
        setContent {
            WorkBenchTheme {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background),
                    color = MaterialTheme.colorScheme.background
                ) {
                    WorkBenchStartupGate(
                        onStartup = gatewayEndpointStore::hydrate
                    )
                }
            }
        }
    }

    @Suppress("PrivateApi")
    private fun removePlatformSplashExitAnimation() {
        val splashScreen = Activity::class.java.getMethod("getSplashScreen").invoke(this)
        val listenerClass = Class.forName("android.window.SplashScreen\$OnExitAnimationListener")
        val listener = Proxy.newProxyInstance(
            listenerClass.classLoader,
            arrayOf(listenerClass)
        ) { _, method, args ->
            if (method.name == "onSplashScreenExit") {
                val splashView = args?.firstOrNull() as? View
                splashView?.javaClass?.getMethod("remove")?.invoke(splashView)
            }
            null
        }
        splashScreen.javaClass
            .getMethod("setOnExitAnimationListener", listenerClass)
            .invoke(splashScreen, listener)
    }

    private fun enforceOpaqueWindow() {
        // 清掉半透明 system bar 遗留 flag，改用绘制 system bar 背景
        window.clearFlags(
            WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS or
                WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION
        )
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        // 像素格式强制 OPAQUE，避免与下层壁纸混合
        window.setFormat(PixelFormat.OPAQUE)
        @Suppress("DEPRECATION")
        window.statusBarColor = getColor(R.color.wechat_chrome_bg)
        @Suppress("DEPRECATION")
        window.navigationBarColor = getColor(R.color.wechat_chrome_bg)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
            window.isStatusBarContrastEnforced = false
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.decorView.isForceDarkAllowed = false
        }
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }
    }
}
