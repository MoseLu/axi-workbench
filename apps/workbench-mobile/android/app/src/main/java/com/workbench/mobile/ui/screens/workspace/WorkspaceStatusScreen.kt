package com.workbench.mobile.ui.screens.workspace

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.data.api.dto.WorkspaceProject
import com.workbench.mobile.ui.components.WorkspaceRuntimeAttentionCard
import com.workbench.mobile.ui.components.WorkspaceStatusLegendCard
import com.workbench.mobile.ui.components.WorkspaceStatusNoticeRow
import com.workbench.mobile.ui.components.WorkspaceStatusProjectCard
import com.workbench.mobile.ui.components.WorkspaceStatusSectionHeader
import com.workbench.mobile.ui.screens.me.MeSubScaffold
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Spacing
import androidx.compose.foundation.shape.RoundedCornerShape

/**
 * 展示控制面返回的项目待办事实；颜色只作为辅助，具体下一步由待办文案说明。
 */
@Composable
fun WorkspaceStatusScreen(
    onBack: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snapshot = state.workspaceSnapshotOrNull()
    val notice = state.workspaceStatusNotice()

    MeSubScaffold(
        title = "项目待办",
        onBack = onBack,
        scrollable = false
    ) {
        if (snapshot == null) {
            notice?.let {
                WorkspaceStatusNoticeRow(
                    notice = it,
                    onRetry = viewModel::refresh,
                    modifier = Modifier.padding(top = Spacing.s3)
                )
            }
        } else {
            WorkspaceStatusContent(
                projects = snapshot.projects,
                attentionItems = snapshot.attentionItems,
                showConnectionProblem = notice as? WorkspaceStatusNotice.ConnectionProblem,
                onRetry = viewModel::refresh,
                onProjectClick = onProjectClick
            )
        }
    }
}

@Composable
private fun WorkspaceStatusContent(
    projects: List<WorkspaceProject>,
    attentionItems: List<com.workbench.mobile.data.api.dto.WorkspaceAttentionItem>,
    showConnectionProblem: WorkspaceStatusNotice.ConnectionProblem?,
    onRetry: () -> Unit,
    onProjectClick: (String) -> Unit
) {
    val projectIds = projects.mapTo(mutableSetOf()) { it.id }
    val statusProjects = projects
        .filter { it.requiresStatusAttention() }
        .sortedWith(
            compareBy<WorkspaceProject> { it.healthPresentation().priority }
                .thenBy { it.workPresentation().title }
        )
    val attentionByProject = attentionItems
        .filter { !it.projectId.isNullOrBlank() }
        .groupBy { requireNotNull(it.projectId) }
    val runtimeAttention = attentionItems.filter { item ->
        item.projectId.isNullOrBlank() || item.projectId !in projectIds
    }
    val healthOrder = listOf("blocked", "attention", "stale", "unknown")

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = Spacing.s4, vertical = Spacing.s3)
    ) {
        if (showConnectionProblem != null) {
            item(key = "connection-problem") {
                WorkspaceStatusNoticeRow(
                    notice = showConnectionProblem,
                    onRetry = onRetry
                )
            }
        }
        item(key = "legend") {
            WorkspaceStatusLegendCard(
                modifier = Modifier.padding(bottom = Spacing.s3)
            )
        }
        if (statusProjects.isEmpty() && runtimeAttention.isEmpty()) {
            item(key = "clear") { WorkspaceStatusClearCard() }
        }
        healthOrder.forEach { health ->
            val sectionProjects = statusProjects.filter { it.health == health }
            if (sectionProjects.isNotEmpty()) {
                item(key = "header-$health") {
                    WorkspaceStatusSectionHeader(health = health, count = sectionProjects.size)
                }
                items(sectionProjects, key = { "status-${it.id}" }) { project ->
                    WorkspaceStatusProjectCard(
                        project = project,
                        attentionItems = attentionByProject[project.id].orEmpty(),
                        onClick = { onProjectClick(project.id) },
                        modifier = Modifier.padding(bottom = Spacing.s2)
                    )
                }
            }
        }
        if (runtimeAttention.isNotEmpty()) {
            item(key = "runtime-header") {
                Text(
                    text = "运行与审批",
                    modifier = Modifier.padding(vertical = Spacing.s2),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
            items(runtimeAttention, key = { "runtime-${it.id}" }) { item ->
                WorkspaceRuntimeAttentionCard(
                    item = item,
                    modifier = Modifier.padding(bottom = Spacing.s2)
                )
            }
        }
    }
}

@Composable
private fun WorkspaceStatusClearCard() {
    Surface(
        shape = RoundedCornerShape(Radius.md),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(Spacing.px, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Text(
            text = "当前没有需要你处理的项目待办。",
            modifier = Modifier.padding(Spacing.s4),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
