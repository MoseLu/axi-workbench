package com.workbench.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import com.workbench.mobile.data.api.dto.MobileWorkspaceSnapshot
import com.workbench.mobile.data.api.dto.WorkspaceProject
import com.workbench.mobile.data.repository.WorkspaceLoadState
import com.workbench.mobile.ui.screens.workspace.WorkspaceStatusNotice
import com.workbench.mobile.ui.screens.workspace.WorkspaceProjectGroup
import com.workbench.mobile.ui.screens.workspace.workPresentation
import com.workbench.mobile.ui.screens.workspace.healthLabel
import com.workbench.mobile.ui.screens.workspace.healthPresentation
import com.workbench.mobile.ui.screens.workspace.workspaceHealthPresentation
import com.workbench.mobile.ui.screens.workspace.workspaceSnapshotOrNull
import com.workbench.mobile.ui.screens.workspace.workspaceStatusNotice
import com.workbench.mobile.ui.theme.FontSize
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.SemanticError
import com.workbench.mobile.ui.theme.SemanticWarning
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing
import com.workbench.mobile.ui.theme.WeChatGreen

@Composable
fun WorkspaceStateContent(
    state: WorkspaceLoadState,
    onRetry: () -> Unit,
    onStartPairingScan: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable (MobileWorkspaceSnapshot, WorkspaceStatusNotice?) -> Unit
) {
    val snapshot = state.workspaceSnapshotOrNull()
    if (snapshot != null) {
        // 普通导航的静默刷新不会触发指示器；只有明确下拉/重试才展示刷新反馈。
        PullToRefreshBox(
            isRefreshing = state is WorkspaceLoadState.Loading && state.userInitiated,
            onRefresh = onRetry,
            modifier = modifier
        ) {
            content(snapshot, state.workspaceStatusNotice())
        }
    } else {
        val notice = state.workspaceStatusNotice() ?: return
        if (notice is WorkspaceStatusNotice.ConnectionProblem) {
            WorkspaceColdErrorState(
                title = "暂时无法加载工作区",
                message = notice.message,
                actionLabel = "重试",
                onRetry = onRetry,
                modifier = modifier
            )
            return
        }
        if (notice is WorkspaceStatusNotice.QrPairingRequired) {
            WorkspaceColdErrorState(
                title = "先完成本机配对",
                message = "在已登录 Web 工作台的「设备管理」生成手机配对二维码，再用本机扫一扫扫描并在网页确认。完成后，手机可扫描电脑登录二维码来授权登录。",
                actionLabel = onStartPairingScan?.let { "扫描配对二维码" },
                onRetry = onStartPairingScan ?: onRetry,
                modifier = modifier
            )
            return
        }
        if (notice is WorkspaceStatusNotice.PairingApprovalRequired) {
            WorkspaceColdErrorState(
                title = "等待网页确认设备",
                message = "本机已扫描配对二维码。请在 Web 工作台的「设备管理」核对设备后确认配对，再回到这里检查状态。",
                actionLabel = "检查确认状态",
                onRetry = onRetry,
                secondaryActionLabel = onStartPairingScan?.let { "改用扫码配对" },
                onSecondaryAction = onStartPairingScan,
                modifier = modifier
            )
            return
        }
        if (notice is WorkspaceStatusNotice.GatewayConfigurationRequired) {
            WorkspaceColdErrorState(
                title = "先设置本机网关",
                message = "真机不能使用模拟器地址 10.0.2.2。请在底部「我的」→「设置」→「本机网关」填写开发机在同一 Wi‑Fi 下的 API Gateway 地址，例如 http://192.168.1.8:8088。",
                actionLabel = null,
                onRetry = onRetry,
                modifier = modifier
            )
            return
        }
        Box(
            modifier = modifier.fillMaxSize(),
            contentAlignment = Alignment.TopCenter
        ) {
            WorkspaceStatusNoticeRow(
                notice = notice,
                onRetry = onRetry,
                modifier = Modifier.padding(top = Spacing.s2)
            )
        }
    }
}

@Composable
private fun WorkspaceColdErrorState(
    title: String,
    message: String,
    actionLabel: String?,
    onRetry: () -> Unit,
    secondaryActionLabel: String? = null,
    onSecondaryAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize().padding(Spacing.s6),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = message,
                modifier = Modifier.padding(top = Spacing.s2),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            actionLabel?.let { label ->
                TextButton(
                    onClick = onRetry,
                    modifier = Modifier.padding(top = Spacing.s3)
                ) {
                    Text(label)
                }
            }
            if (secondaryActionLabel != null && onSecondaryAction != null) {
                TextButton(
                    onClick = onSecondaryAction,
                    modifier = Modifier.padding(top = Spacing.s1)
                ) {
                    Text(secondaryActionLabel)
                }
            }
        }
    }
}

@Composable
fun WorkspaceStatusNoticeRow(
    notice: WorkspaceStatusNotice,
    onRetry: () -> Unit,
    onViewStatus: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val presentation = when (notice) {
        WorkspaceStatusNotice.Syncing -> WorkspaceStatusPresentation(
            title = "正在同步工作区",
            detail = "正在更新项目状态",
            color = WeChatGreen,
            isSyncing = true
        )

        WorkspaceStatusNotice.GatewayConfigurationRequired -> WorkspaceStatusPresentation(
            title = "先设置本机网关",
            detail = "请在「我的」→「设置」填写同一局域网中的 API Gateway 地址。",
            color = SemanticWarning
        )

        WorkspaceStatusNotice.QrPairingRequired -> WorkspaceStatusPresentation(
            title = "需要扫码配对",
            detail = "请在 Web 工作台设备管理页生成二维码，再用本机扫一扫。",
            color = SemanticWarning
        )

        is WorkspaceStatusNotice.PairingApprovalRequired -> WorkspaceStatusPresentation(
            title = "等待网页确认设备",
            detail = "本机已扫码，请在 Web 工作台的设备管理中确认。",
            color = SemanticWarning,
            actionLabel = "检查状态",
            onAction = onRetry
        )

        is WorkspaceStatusNotice.Attention -> WorkspaceStatusPresentation(
            title = notice.headline(),
            detail = notice.statusBreakdown(),
            color = if (notice.blocked > 0) SemanticError else SemanticWarning,
            actionLabel = onViewStatus?.let { "查看待办" },
            onAction = onViewStatus
        )

        is WorkspaceStatusNotice.ConnectionProblem -> WorkspaceStatusPresentation(
            title = "工作区连接异常",
            detail = notice.message,
            color = SemanticError,
            actionLabel = "重试",
            onAction = onRetry
        )
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Surface(color = MaterialTheme.colorScheme.surface) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = Size.statusRow)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (presentation.isSyncing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(Size.iconSm),
                        color = presentation.color,
                        strokeWidth = Spacing.s0_5
                    )
                } else {
                    Surface(
                        modifier = Modifier.size(Size.badgeDot),
                        shape = CircleShape,
                        color = presentation.color
                    ) {}
                }
                Spacer(Modifier.width(Spacing.s3))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = presentation.title,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium
                    )
                    presentation.detail?.let { detail ->
                        Text(
                            text = detail,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2
                        )
                    }
                }
                if (presentation.actionLabel != null && presentation.onAction != null) {
                    TextButton(onClick = presentation.onAction) {
                        Text(presentation.actionLabel)
                    }
                }
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

private data class WorkspaceStatusPresentation(
    val title: String,
    val detail: String?,
    val color: androidx.compose.ui.graphics.Color,
    val isSyncing: Boolean = false,
    val actionLabel: String? = null,
    val onAction: (() -> Unit)? = null
)

private fun WorkspaceStatusNotice.Attention.statusBreakdown(): String = buildList {
    if (approvals > 0) add("需要你决定 $approvals")
    if (running > 0) add("正在等待结果 $running")
    if (blocked > 0) add("先处理阻塞 $blocked")
    if (followUp > 0) add("补齐交接或确认进展 $followUp")
    if (recheck > 0) add("重新核验 $recheck")
    if (completionInfo > 0) add("补齐完成信息 $completionInfo")
}.joinToString(" · ").ifBlank { "当前没有需要处理的事项。" }

private fun WorkspaceStatusNotice.Attention.headline(): String =
    "已整理 ${approvals + running + blocked + followUp + recheck + completionInfo} 项待办"

@Composable
fun WorkspaceProjectRow(
    project: WorkspaceProject,
    onClick: () -> Unit,
    showChevron: Boolean = false,
    modifier: Modifier = Modifier
) {
    val work = project.workPresentation()
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = "${work.title}，${project.healthLabel()}，${work.purpose}"
            }
            .defaultMinSize(minHeight = Size.row)
            .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = work.title,
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.width(Spacing.s2))
            WorkspaceHealthBadge(project)
            if (showChevron) {
                Spacer(Modifier.width(Spacing.s3))
                Icon(
                    Icons.Filled.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(Size.iconMd)
                )
            }
        }
        Spacer(Modifier.height(Spacing.s0_5))
        Text(
            text = work.purpose,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

/**
 * 工作区一级入口：只显示用户可理解的工作分区、说明和项目数量。
 * 具体项目留给二级页，避免把长项目清单铺在主 Tab 上。
 */
@Composable
fun WorkspaceGroupRow(
    group: WorkspaceProjectGroup,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = "${group.title}，${group.projects.size} 项，${group.description}"
            }
            .defaultMinSize(minHeight = Size.row)
            .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = group.title,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(Spacing.s0_5))
            Text(
                text = group.description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(Modifier.width(Spacing.s3))
        Text(
            text = "${group.projects.size} 项",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.width(Spacing.s1))
        Icon(
            Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(Size.iconMd)
        )
    }
}

@Composable
fun WorkspaceHealthBadge(
    project: WorkspaceProject,
    modifier: Modifier = Modifier
) {
    WorkspaceHealthBadgeContent(
        health = project.health,
        label = project.healthPresentation().label,
        modifier = modifier
    )
}

@Composable
fun WorkspaceHealthBadge(
    health: String,
    modifier: Modifier = Modifier
) {
    WorkspaceHealthBadgeContent(
        health = health,
        label = workspaceHealthPresentation(health).label,
        modifier = modifier
    )
}

@Composable
private fun WorkspaceHealthBadgeContent(
    health: String,
    label: String,
    modifier: Modifier = Modifier
) {
    val colors = when (health) {
        "healthy" -> WeChatGreen.copy(alpha = 0.18f) to MaterialTheme.colorScheme.onSurface
        "blocked" -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        "attention" -> SemanticWarning.copy(alpha = 0.18f) to MaterialTheme.colorScheme.onSurface
        "stale" -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(modifier = modifier, shape = RoundedCornerShape(Radius.full), color = colors.first) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = Spacing.s2, vertical = Spacing.s0_5),
            color = colors.second,
            fontSize = FontSize.xs,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
fun WorkspaceSectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        modifier = modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
fun WorkspaceProjectDivider() {
    HorizontalDivider(
        modifier = Modifier.padding(start = Spacing.s4),
        color = MaterialTheme.colorScheme.outlineVariant
    )
}
