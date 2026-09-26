package com.workbench.mobile.ui.startup

import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameNanos
import androidx.hilt.navigation.compose.hiltViewModel
import com.workbench.mobile.ui.navigation.WorkBenchNavHost
import com.workbench.mobile.ui.screens.workspace.WorkspaceViewModel
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull

private const val BRAND_LOADING_DURATION_MS = 800L
private const val INITIAL_WORKSPACE_TIMEOUT_MS = 1_200L

/**
 * 启动状态门面。
 *
 * 可见的品牌 Loading 由原生 [BrandLoadingView] 在 Activity 首帧绘制，避免
 * Compose 冷启动期间只能看到 Android 系统图标。这里仅负责等待网关恢复、
 * 工作区首轮状态和完整绘制帧，然后通知 Activity 移除那一个 Loading 覆盖层。
 */
@Composable
fun WorkBenchStartupGate(
    onStartup: suspend () -> Unit,
    onReady: () -> Unit
) {
    // 与 NavHost 共用同一个 Activity-scoped ViewModel，让启动页等待同一次
    // 首次同步，而不是在切换瞬间把“正在同步”中间态闪出来。
    val workspaceViewModel: WorkspaceViewModel = hiltViewModel()
    val workspaceReadySignal = remember { CompletableDeferred<Unit>() }

    LaunchedEffect(Unit) {
        val startedAt = SystemClock.elapsedRealtime()
        onStartup()
        withTimeoutOrNull(INITIAL_WORKSPACE_TIMEOUT_MS) {
            workspaceReadySignal.await()
        }
        val remaining = BRAND_LOADING_DURATION_MS - (SystemClock.elapsedRealtime() - startedAt)
        if (remaining > 0) delay(remaining)
        // 原生 Loading 会在 Activity 首帧就可见；给 Compose 工作区两个完整绘制
        // 周期后再移除，避免工作区首个布局/状态更新形成一闪而过的半成品页。
        withFrameNanos { }
        withFrameNanos { }
        onReady()
    }

    // 工作区一直在原生品牌 Loading 下方挂载；交接时只移除覆盖层，不替换根内容。
    WorkBenchNavHost(
        workspaceViewModel = workspaceViewModel,
        onInitialWorkspaceReady = { workspaceReadySignal.complete(Unit) }
    )
}
