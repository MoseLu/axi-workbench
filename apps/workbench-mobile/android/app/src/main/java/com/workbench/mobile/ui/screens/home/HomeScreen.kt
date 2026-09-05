package com.workbench.mobile.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.ui.components.WorkBenchBottomBar
import com.workbench.mobile.ui.components.NavBadge
import com.workbench.mobile.ui.components.WorkBenchEmptyState
import com.workbench.mobile.ui.components.WorkBenchTopBar
import com.workbench.mobile.ui.components.WorkspaceProjectDivider
import com.workbench.mobile.ui.components.WorkspaceProjectRow
import com.workbench.mobile.ui.components.WorkspaceSectionLabel
import com.workbench.mobile.ui.components.WorkspaceStatusNoticeRow
import com.workbench.mobile.ui.components.WorkspaceStateContent
import com.workbench.mobile.ui.components.rememberTabBadges
import com.workbench.mobile.ui.screens.workspace.WorkspaceStatusNotice
import com.workbench.mobile.ui.screens.workspace.WorkspaceTodoItem
import com.workbench.mobile.ui.screens.workspace.WorkspaceViewModel
import com.workbench.mobile.ui.screens.workspace.forPersonalWorkbench
import com.workbench.mobile.ui.screens.workspace.pendingWorkBadgeCount
import com.workbench.mobile.ui.screens.workspace.todoItems
import com.workbench.mobile.ui.screens.workspace.workspaceSnapshotOrNull
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing

/** 移动端概览只呈现控制面已配对并同步的真实工作区项目。 */
@Composable
fun HomeScreen(
    onScanClick: () -> Unit,
    onSearchClick: () -> Unit,
    onTabWork: () -> Unit,
    onTabPending: () -> Unit,
    onTabMe: () -> Unit,
    onPendingClick: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel()
) {
    val badges by rememberTabBadges()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingBadge = NavBadge.ofCount(state.workspaceSnapshotOrNull()?.pendingWorkBadgeCount() ?: 0)
    Scaffold(
        topBar = {
            WorkBenchTopBar(
                title = "概览",
                onSearch = onSearchClick,
                onScan = onScanClick
            )
        },
        bottomBar = {
            WorkBenchBottomBar(
                current = "home",
                badges = badges,
                pendingBadge = pendingBadge,
                onHome = {},
                onWork = onTabWork,
                onPending = onTabPending,
                onMe = onTabMe
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            color = MaterialTheme.colorScheme.surface
        ) {
            WorkspaceStateContent(
                state = state,
                onRetry = viewModel::refresh,
                onStartPairingScan = onScanClick,
                modifier = Modifier.fillMaxSize()
            ) { snapshot, notice ->
                if (snapshot.projects.isEmpty()) {
                    WorkBenchEmptyState(
                        title = "工作区尚无登记项目",
                        description = "控制面已连接，但当前工作区没有可展示的项目。",
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    val todos = snapshot.todoItems()
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(vertical = Spacing.s3)
                    ) {
                        if (notice is WorkspaceStatusNotice.Syncing || notice is WorkspaceStatusNotice.ConnectionProblem) {
                            item {
                                WorkspaceStatusNoticeRow(
                                    notice = notice,
                                    onRetry = viewModel::refresh
                                )
                            }
                        }
                        if (todos.isNotEmpty()) {
                            item { WorkspaceSectionLabel("你的待办") }
                            items(todos.take(3), key = { it.id }) { todo ->
                                WorkspaceTodoOverviewRow(
                                    todo = todo,
                                    onClick = onPendingClick
                                )
                                WorkspaceProjectDivider()
                            }
                            if (todos.size > 3) {
                                item {
                                    TextButton(
                                        onClick = onPendingClick,
                                        modifier = Modifier.padding(horizontal = Spacing.s3)
                                    ) {
                                        Text("查看剩余 ${todos.size - 3} 项待办")
                                    }
                                }
                            }
                        } else {
                            item { WorkspaceTodoClearRow() }
                        }
                        item { WorkspaceSectionLabel("常用工作") }
                        items(snapshot.projects.forPersonalWorkbench().take(6), key = { it.id }) { project ->
                            WorkspaceProjectRow(project = project, onClick = { onProjectClick(project.id) })
                            WorkspaceProjectDivider()
                        }
                    }
                }
            }
        }
    }
}

/** 概览只给出少量、可读、可点开的待办，不把所有项目状态铺成一张报告。 */
@Composable
private fun WorkspaceTodoOverviewRow(
    todo: WorkspaceTodoItem,
    onClick: () -> Unit
) {
    val presentation = todo.presentation
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = "${todo.projectTitle}，${presentation.title}，${presentation.detail}，下一步：${presentation.nextStepLabel}"
            }
            .defaultMinSize(minHeight = Size.row)
            .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = presentation.title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "${todo.projectTitle} · ${presentation.detail}",
                modifier = Modifier.padding(top = Spacing.s0_5),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "下一步：${presentation.nextStepLabel}",
                modifier = Modifier.padding(top = Spacing.s0_5),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(Modifier.width(Spacing.s2))
        Icon(
            imageVector = Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(Spacing.s1)
        )
    }
}

@Composable
private fun WorkspaceTodoClearRow() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
    ) {
        Text(
            text = "你的待办",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = "今天没有需要你处理的事项。",
            modifier = Modifier.padding(top = Spacing.s1),
            style = MaterialTheme.typography.bodyMedium
        )
    }
}
