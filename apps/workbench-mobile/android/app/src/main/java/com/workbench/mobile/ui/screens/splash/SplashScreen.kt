package com.workbench.mobile.ui.screens.splash

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.font.FontWeight
import com.workbench.mobile.BuildConfig
import com.workbench.mobile.data.network.GatewayEndpointStore
import com.workbench.mobile.ui.theme.Spacing
import dagger.hilt.android.EntryPointAccessors
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.delay
import com.workbench.mobile.ui.theme.Size

/**
 * 启动页：品牌曝光 + 检查登录态
 *
 * 真机不再持有或申请 Web 用户登录态。启动后直接进入工作区：
 *   - 未配对时生成一次性六码，等待已登录 Web owner 批准；
 *   - 已配对时以 Android Keystore 的设备密钥换取短期设备令牌。
 */
@Composable
fun SplashScreen(
    onReady: () -> Unit
) {
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        delay(800) // 品牌曝光
        // 启动时先恢复用户可编辑的 LAN 网关地址；Web 用户会话不属于真机。
        val startup = EntryPointAccessors.fromApplication(
            context.applicationContext,
            TokenStoreEntryPoint::class.java
        )
        startup.gatewayEndpointStore().hydrate()
        onReady()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s4)
        ) {
            Box(
                modifier = Modifier
                    .size(Size.avatarMd)
                    .background(
                        MaterialTheme.colorScheme.primary,
                        RoundedCornerShape(Spacing.s4)
                    )
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(Spacing.s3),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(Spacing.s2)
                            .background(
                                MaterialTheme.colorScheme.onPrimary,
                                RoundedCornerShape(Spacing.s0_5)
                            )
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(Spacing.s2)
                            .background(
                                MaterialTheme.colorScheme.onPrimary,
                                RoundedCornerShape(Spacing.s0_5)
                            )
                    )
                }
            }

            Text(
                text = "Axi Workbench",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(Spacing.s4))

            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Dot(delayMs = 0)
                Dot(delayMs = 200)
                Dot(delayMs = 400)
            }

            Spacer(Modifier.height(Spacing.s8))

            Text(
                text = "v${BuildConfig.VERSION_NAME}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/** Hilt EntryPoint — 让非 ViewModel 的 Composable 也能拿到 Singleton 依赖 */
@dagger.hilt.EntryPoint
@dagger.hilt.InstallIn(dagger.hilt.components.SingletonComponent::class)
interface TokenStoreEntryPoint {
    fun gatewayEndpointStore(): GatewayEndpointStore
}

@Composable
private fun Dot(delayMs: Int) {
    val infinite = rememberInfiniteTransition(label = "dot")
    val alpha by infinite.animateFloat(
        initialValue = 0.2f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 600, delayMillis = delayMs),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )
    Box(
        modifier = Modifier
            .size(Spacing.s2)
            .alpha(alpha)
            .background(
                MaterialTheme.colorScheme.primary,
                CircleShape
            )
    )
}
