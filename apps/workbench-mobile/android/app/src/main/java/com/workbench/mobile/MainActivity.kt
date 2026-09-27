package com.workbench.mobile

import android.graphics.PixelFormat
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import android.window.SplashScreenView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.annotation.RequiresApi
import androidx.core.view.WindowCompat
import com.workbench.mobile.data.network.GatewayEndpointStore
import com.workbench.mobile.ui.startup.BrandLoadingView
import com.workbench.mobile.ui.startup.WorkBenchStartupGate
import com.workbench.mobile.ui.theme.WorkBenchTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject
    lateinit var gatewayEndpointStore: GatewayEndpointStore

    private lateinit var startupRoot: FrameLayout
    private lateinit var startupLoadingView: BrandLoadingView

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

        // 先用不依赖 Compose 的原生 View 绘制完整品牌 Loading，让系统 Splash
        // 结束后立即进入同一页；Compose 工作区在首帧之后挂载到它的下方。
        showNativeStartup()
    }

    private fun showNativeStartup() {
        startupLoadingView = BrandLoadingView(this)
        startupRoot = FrameLayout(this).apply {
            setBackgroundColor(getColor(R.color.wechat_chrome_bg))
            addView(
                startupLoadingView,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
        }
        setContentView(startupRoot)

        // 让原生品牌页先完成一次真实绘制，随后再启动 Compose，避免冷启动时
        // Compose 首次组合把系统图标层独占在屏幕上约一秒。
        startupRoot.postOnAnimation { mountComposeContent() }
    }

    private fun mountComposeContent() {
        if (isFinishing || isDestroyed) return

        val composeView = ComposeView(this).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        // Compose 工作区在底层渲染，原生品牌 Loading 保持在最上层直到 ready。
        startupRoot.addView(composeView, 0)
        composeView.setContent {
            WorkBenchTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    WorkBenchStartupGate(
                        onStartup = gatewayEndpointStore::hydrate,
                        onReady = ::dismissNativeStartup
                    )
                }
            }
        }
    }

    private fun dismissNativeStartup() {
        if (::startupLoadingView.isInitialized && startupLoadingView.parent != null) {
            startupRoot.removeView(startupLoadingView)
        }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private fun removePlatformSplashExitAnimation() {
        getSplashScreen().setOnExitAnimationListener { splashScreenView: SplashScreenView ->
            splashScreenView.remove()
        }
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
