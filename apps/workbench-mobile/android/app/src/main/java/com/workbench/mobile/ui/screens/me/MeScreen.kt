package com.workbench.mobile.ui.screens.me

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.ui.components.WorkBenchBottomBar
import com.workbench.mobile.ui.components.NavBadge
import com.workbench.mobile.ui.components.rememberTabBadges
import com.workbench.mobile.ui.screens.workspace.WorkspaceViewModel
import com.workbench.mobile.ui.screens.workspace.pendingWorkBadgeCount
import com.workbench.mobile.ui.screens.workspace.workspaceSnapshotOrNull
import com.workbench.mobile.ui.theme.Spacing
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.StatusOnline
import com.workbench.mobile.ui.theme.FontSize

private val MenuRowHeight = Size.row
private val AvatarSize = Size.barBottom

/**
 * 我的 — 资料栏读取 ProfileStore；点资料栏进入可编辑的个人信息页。
 */
@Composable
fun MeScreen(
    onProfileClick: () -> Unit,
    onDevicesClick: () -> Unit,
    onNotificationsClick: () -> Unit,
    onThemeClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onTabHome: () -> Unit,
    onTabWork: () -> Unit,
    onTabPending: () -> Unit,
    viewModel: ProfileViewModel = hiltViewModel(),
    workspaceViewModel: WorkspaceViewModel
) {
    val profile by viewModel.profile.collectAsStateWithLifecycle()

    val badges by rememberTabBadges()
    val workspaceState by workspaceViewModel.state.collectAsStateWithLifecycle()
    val pendingBadge = NavBadge.ofCount(workspaceState.workspaceSnapshotOrNull()?.pendingWorkBadgeCount() ?: 0)
    Scaffold(
        bottomBar = {
            WorkBenchBottomBar(
                current = "me",
                badges = badges,
                pendingBadge = pendingBadge,
                onHome = onTabHome,
                onWork = onTabWork,
                onPending = onTabPending,
                onMe = {}
            )
        },
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = padding.calculateBottomPadding())
                .verticalScroll(rememberScrollState())
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onProfileClick),
                color = MaterialTheme.colorScheme.surface
            ) {
                Column {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .statusBarsPadding()
                            .padding(horizontal = Spacing.s4)
                            .padding(top = Spacing.s2, bottom = Spacing.s2),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s3)
                    ) {
                        ProfileAvatar(
                            avatarPath = profile.avatarPath,
                            size = AvatarSize
                        )
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                profile.nickname,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1
                            )
                            Text(
                                profile.email,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1
                            )
                            Spacer(Modifier.height(Spacing.s0_5))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(Spacing.s1_5)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(Spacing.s2)
                                        .clip(RoundedCornerShape(Radius.xs))
                                        .background(
                                            if (profile.sessionActive) StatusOnline
                                            else MaterialTheme.colorScheme.outline
                                        )
                                )
                                Text(
                                    profile.status,
                                    fontSize = FontSize.sm,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        Icon(
                            Icons.Filled.ChevronRight,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    HorizontalDivider(
                        thickness = Spacing.hairline,
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.45f)
                    )
                }
            }

            Spacer(Modifier.height(Spacing.s3))

            MenuGroup(
                items = listOf(
                    MenuRow("设备管理", onClick = onDevicesClick),
                    MenuRow("通知设置", onClick = onNotificationsClick)
                )
            )

            Spacer(Modifier.height(Spacing.s3))

            MenuGroup(
                items = listOf(
                    MenuRow("主题外观", value = "跟随系统", onClick = onThemeClick),
                    MenuRow("设置", onClick = onSettingsClick)
                )
            )

            Spacer(Modifier.height(Spacing.s6))
        }
    }
}

private data class MenuRow(
    val title: String,
    val value: String? = null,
    val onClick: () -> Unit = {}
)

@Composable
private fun MenuGroup(items: List<MenuRow>) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface
    ) {
        Column {
            items.forEachIndexed { index, item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(MenuRowHeight)
                        .clickable { item.onClick() }
                        .padding(horizontal = Spacing.s4),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(item.title, style = MaterialTheme.typography.bodyLarge)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (item.value != null) {
                            Text(
                                item.value,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.width(Spacing.s2))
                        }
                        Icon(
                            Icons.Filled.ChevronRight,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                if (index < items.lastIndex) {
                    HorizontalDivider(
                        modifier = Modifier.padding(start = Spacing.s4),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.45f)
                    )
                }
            }
        }
    }
}
