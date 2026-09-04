package com.workbench.mobile.ui.startup

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import android.os.SystemClock
import androidx.hilt.navigation.compose.hiltViewModel
import com.workbench.mobile.BuildConfig
import com.workbench.mobile.R
import com.workbench.mobile.ui.navigation.WorkBenchNavHost
import com.workbench.mobile.ui.screens.workspace.WorkspaceViewModel
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull

private const val BRAND_LOADING_DURATION_MS = 800L
private const val INITIAL_WORKSPACE_TIMEOUT_MS = 1_200L

/**
 * App-owned startup gate.
 *
 * Android 12's platform Splash is only the pre-first-frame handoff. Once the
 * Compose tree is mounted, this is the single visible branded loading surface;
 * the ready state removes this opaque overlay after the workspace has settled,
 * instead of replacing the root content and exposing an intermediate frame.
 */
@Composable
fun WorkBenchStartupGate(
    onStartup: suspend () -> Unit
) {
    // 与 NavHost 共用同一个 Activity-scoped ViewModel，让启动页等待同一次
    // 首次同步，而不是在切换瞬间把“正在同步”中间态闪出来。
    val workspaceViewModel: WorkspaceViewModel = hiltViewModel()
    val workspaceReadySignal = remember { CompletableDeferred<Unit>() }
    var ready by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val startedAt = SystemClock.elapsedRealtime()
        onStartup()
        withTimeoutOrNull(INITIAL_WORKSPACE_TIMEOUT_MS) {
            workspaceReadySignal.await()
        }
        val remaining = BRAND_LOADING_DURATION_MS - (SystemClock.elapsedRealtime() - startedAt)
        if (remaining > 0) delay(remaining)
        // 给底层工作区两个完整绘制周期，再移除不透明 Loading 覆盖层。
        // 否则 NavHost 首次布局和状态更新可能分落在相邻帧，形成一闪而过的半成品页。
        withFrameNanos { }
        withFrameNanos { }
        ready = true
    }

    // 工作区从首帧就在 Loading 下方挂载；交接时只移除覆盖层，不重新替换
    // 根内容，避免出现空帧、同步中间态或 NavHost 初次组合造成的闪屏。
    Box(modifier = Modifier.fillMaxSize()) {
        WorkBenchNavHost(
            workspaceViewModel = workspaceViewModel,
            onInitialWorkspaceReady = { workspaceReadySignal.complete(Unit) }
        )
        if (!ready) {
            BrandLoadingSurface()
        }
    }
}

@Composable
private fun BrandLoadingSurface() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(R.drawable.ic_launcher_foreground),
            contentDescription = "Axi Workbench",
            modifier = Modifier
                .align(Alignment.Center)
                .size(Size.splashBrand),
            contentScale = ContentScale.Fit
        )

        Column(
            modifier = Modifier
                .align(Alignment.Center)
                .offset(y = Size.splashDetailsOffset),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s4)
        ) {
            Text(
                text = "Axi Workbench",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = "正在准备工作区…",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                LoadingDot(delayMs = 0)
                LoadingDot(delayMs = 180)
                LoadingDot(delayMs = 360)
            }

            Spacer(Modifier.height(Spacing.s4))

            Text(
                text = "v${BuildConfig.VERSION_NAME}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun LoadingDot(delayMs: Int) {
    val infinite = rememberInfiniteTransition(label = "brand-loading-dot")
    val alpha by infinite.animateFloat(
        initialValue = 0.2f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 600, delayMillis = delayMs),
            repeatMode = RepeatMode.Reverse
        ),
        label = "brand-loading-alpha"
    )
    Box(
        modifier = Modifier
            .size(Spacing.s2)
            .alpha(alpha)
            .background(MaterialTheme.colorScheme.primary, CircleShape)
    )
}
