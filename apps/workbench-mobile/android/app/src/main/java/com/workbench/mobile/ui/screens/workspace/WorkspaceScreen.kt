package com.workbench.mobile.ui.screens.workspace

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.ui.components.WorkBenchBottomBar
import com.workbench.mobile.ui.components.NavBadge
import com.workbench.mobile.ui.components.WorkBenchEmptyState
import com.workbench.mobile.ui.components.WorkBenchTopBar
import com.workbench.mobile.ui.components.WorkspaceGroupRow
import com.workbench.mobile.ui.components.WorkspaceStatusNoticeRow
import com.workbench.mobile.ui.components.WorkspaceStateContent
import com.workbench.mobile.ui.components.rememberTabBadges
import com.workbench.mobile.ui.screens.me.MeDivider
import com.workbench.mobile.ui.screens.me.MeGroup
import com.workbench.mobile.ui.theme.Spacing

/** 工作页只展示二级工作分组；具体项目留在分组页和三级详情。 */
@Composable
fun WorkspaceScreen(
    onSearchClick: () -> Unit,
    onScanClick: () -> Unit,
    onTabHome: () -> Unit,
    onTabPending: () -> Unit,
    onTabMe: () -> Unit,
    onGroupClick: (String) -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel()
) {
    val badges by rememberTabBadges()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingBadge = NavBadge.ofCount(state.workspaceSnapshotOrNull()?.pendingWorkBadgeCount() ?: 0)
    Scaffold(
        topBar = {
            WorkBenchTopBar(
                title = "工作",
                onSearch = onSearchClick,
                onScan = onScanClick
            )
        },
        bottomBar = {
            WorkBenchBottomBar(
                current = "work",
                badges = badges,
                pendingBadge = pendingBadge,
                onHome = onTabHome,
                onWork = {},
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
            color = MaterialTheme.colorScheme.background
        ) {
            WorkspaceStateContent(
                state = state,
                onRetry = viewModel::refresh,
                onStartPairingScan = onScanClick,
                modifier = Modifier.fillMaxSize()
            ) { snapshot, notice ->
                if (snapshot.projects.isEmpty()) {
                    WorkBenchEmptyState(
                        title = "工作区尚无项目",
                        description = "同步完成后，已登记的 Axi 项目会显示在这里。",
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    val groups = snapshot.projects.groupedForPersonalWorkbench()
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = Spacing.s3)
                    ) {
                        if (notice != null) {
                            item {
                                WorkspaceStatusNoticeRow(
                                    notice = notice,
                                    onRetry = viewModel::refresh
                                )
                            }
                        }
                        item {
                            Spacer(Modifier.height(Spacing.s3))
                            MeGroup {
                                groups.forEachIndexed { index, group ->
                                    WorkspaceGroupRow(
                                        group = group,
                                        onClick = { onGroupClick(group.id.routeSegment) }
                                    )
                                    if (index < groups.lastIndex) {
                                        MeDivider()
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
