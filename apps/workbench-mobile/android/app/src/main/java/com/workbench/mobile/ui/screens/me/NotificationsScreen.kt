package com.workbench.mobile.ui.screens.me

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.workbench.mobile.ui.components.WorkBenchEmptyState

/**
 * 通知偏好必须由账户偏好服务持久化；在该合同接入前不展示不可保存的假开关。
 */
@Composable
fun NotificationsScreen(onBack: () -> Unit) {
    MeSubScaffold(title = "通知设置", onBack = onBack, scrollable = false) {
        WorkBenchEmptyState(
            title = "通知偏好待同步",
            description = "当前底栏只显示账户的真实未读；通知偏好将在账户设置同步后提供。",
            modifier = Modifier.fillMaxSize()
        )
    }
}
