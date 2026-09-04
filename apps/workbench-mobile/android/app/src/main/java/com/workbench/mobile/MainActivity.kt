package com.workbench.mobile

import android.graphics.PixelFormat
import android.os.Build
import android.os.Bundle
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
import androidx.lifecycle.lifecycleScope
import com.workbench.mobile.data.network.GatewayEndpointStore
import com.workbench.mobile.ui.navigation.WorkBenchNavHost
import com.workbench.mobile.ui.theme.WorkBenchTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject
    lateinit var gatewayEndpointStore: GatewayEndpointStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Edge-to-edge 只负责系统栏 inset；窗口本身保持不透明，
        // 否则 ActivityRecord.translucent=true，深色会被叠浅（截图对照根因）。
        enableEdgeToEdge()
        enforceOpaqueWindow()

        // Android 12+ 系统 Splash 直接承担唯一的品牌开屏；首帧前恢复网关，
        // 避免首个请求与本地配置读取并发，完成后直接进入工作区。
        lifecycleScope.launch {
            gatewayEndpointStore.hydrate()
            setContent {
                WorkBenchTheme {
                    Surface(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(MaterialTheme.colorScheme.background),
                        color = MaterialTheme.colorScheme.background
                    ) {
                        WorkBenchNavHost()
                    }
                }
            }
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
