package com.workbench.mobile.ui.screens.projects

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.ui.components.WorkBenchBottomBar
import com.workbench.mobile.ui.components.WorkBenchEmptyState
import com.workbench.mobile.ui.components.WorkBenchTopBar
import com.workbench.mobile.ui.components.WorkspaceProjectDivider
import com.workbench.mobile.ui.components.WorkspaceProjectRow
import com.workbench.mobile.ui.components.WorkspaceStatusNoticeRow
import com.workbench.mobile.ui.components.WorkspaceStateContent
import com.workbench.mobile.ui.components.rememberTabBadges
import com.workbench.mobile.ui.screens.workspace.WorkspaceViewModel
import com.workbench.mobile.ui.screens.workspace.forPersonalWorkbench
import com.workbench.mobile.ui.theme.Spacing

/** 项目页直接呈现工作区注册表投影，不再以静态空页代替项目数据。 */
@Composable
fun ProjectsScreen(
    onSearchClick: () -> Unit,
    onScanClick: () -> Unit,
    onTabHome: () -> Unit,
    onTabWorkspace: () -> Unit,
    onTabMe: () -> Unit,
    onStatusClick: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel()
) {
    val badges by rememberTabBadges()
    val state by viewModel.state.collectAsStateWithLifecycle()
    Scaffold(
        topBar = {
            WorkBenchTopBar(
                title = "项目",
                onSearch = onSearchClick,
                onScan = onScanClick
            )
        },
        bottomBar = {
            WorkBenchBottomBar(
                current = "work",
                badges = badges,
                onHome = onTabHome,
                onWork = onTabWorkspace,
                onPending = onStatusClick,
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
                        title = "暂无登记项目",
                        description = "当前控制面没有返回可展示的工作区项目。",
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(vertical = Spacing.s2)
                    ) {
                        if (notice != null) {
                            item {
                                WorkspaceStatusNoticeRow(
                                    notice = notice,
                                    onRetry = viewModel::refresh,
                                    onViewStatus = onStatusClick
                                )
                            }
                        }
                        items(snapshot.projects.forPersonalWorkbench(), key = { it.id }) { project ->
                            WorkspaceProjectRow(project = project, onClick = { onProjectClick(project.id) })
                            WorkspaceProjectDivider()
                        }
                    }
                }
            }
        }
    }
}
