package com.workbench.mobile.ui.screens.project

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.data.api.dto.WorkspaceAttentionItem
import com.workbench.mobile.data.api.dto.WorkspaceProject
import com.workbench.mobile.data.api.dto.WorkspaceRunningTask
import com.workbench.mobile.data.api.dto.MobileProjectAction
import com.workbench.mobile.data.repository.WorkspaceActionState
import com.workbench.mobile.ui.components.WorkspaceHealthBadge
import com.workbench.mobile.ui.components.WorkspaceStatusNoticeRow
import com.workbench.mobile.ui.screens.me.MeSectionGap
import com.workbench.mobile.ui.screens.me.MeSubScaffold
import com.workbench.mobile.ui.screens.workspace.WorkspaceStatusNotice
import com.workbench.mobile.ui.screens.workspace.WorkspaceViewModel
import com.workbench.mobile.ui.screens.workspace.healthPresentation
import com.workbench.mobile.ui.screens.workspace.phaseLabel
import com.workbench.mobile.ui.screens.workspace.presentation
import com.workbench.mobile.ui.screens.workspace.progressStageLabel
import com.workbench.mobile.ui.screens.workspace.taskPresentation
import com.workbench.mobile.ui.screens.workspace.workPresentation
import com.workbench.mobile.ui.screens.workspace.mobileReasonDescription
import com.workbench.mobile.ui.screens.workspace.workspaceSnapshotOrNull
import com.workbench.mobile.ui.screens.workspace.workspaceStatusNotice
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Spacing

/**
 * 项目详情采用信息卡片表达真实控制面数据：工作语义、状态原因、进展和配置互不混杂。
 * 不生成不存在的里程碑或任务，也不把原始英文阶段直接暴露给移动端用户。
 */
@Composable
fun ProjectDetailScreen(
    projectId: String,
    onBack: () -> Unit,
    onDeveloperInfo: () -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val actionStates by viewModel.actionStates.collectAsStateWithLifecycle()
    val snapshot = state.workspaceSnapshotOrNull()
    val selectedProject = snapshot?.projects?.find { it.id == projectId }
    val title = selectedProject?.workPresentation()?.title ?: "项目详情"
    val notice = state.workspaceStatusNotice()

    MeSubScaffold(title = title, onBack = onBack) {
        MeSectionGap()
        if (snapshot == null) {
            notice?.let {
                WorkspaceStatusNoticeRow(notice = it, onRetry = viewModel::refresh)
            }
        } else if (selectedProject == null) {
            ProjectInfoCard(title = "项目未在当前工作区中") {
                Text(
                    text = "该项目可能已移除，或当前设备尚未同步到它。",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            if (notice is WorkspaceStatusNotice.ConnectionProblem) {
                WorkspaceStatusNoticeRow(notice = notice, onRetry = viewModel::refresh)
                MeSectionGap()
            }
            val attentionItems = snapshot.attentionItems.filter { it.projectId == selectedProject.id }
            val recentTask = snapshot.recentTasks.firstOrNull { it.projectId == selectedProject.id }
            ProjectIdentityCard(project = selectedProject)
            MeSectionGap()
            ProjectProgressCard(project = selectedProject)
            if (recentTask != null) {
                MeSectionGap()
                ProjectRecentTaskCard(task = recentTask)
            }
            if (attentionItems.isNotEmpty()) {
                MeSectionGap()
                ProjectAttentionCard(items = attentionItems)
            }
            if (selectedProject.actions.isNotEmpty()) {
                MeSectionGap()
                ProjectActionCard(
                    project = selectedProject,
                    actionStates = actionStates,
                    onSubmitAction = viewModel::submitAction
                )
            }
            MeSectionGap()
            ProjectDeveloperInfoLink(onClick = onDeveloperInfo)
        }
    }
}

@Composable
private fun ProjectRecentTaskCard(task: WorkspaceRunningTask) {
    val presentation = task.taskPresentation()
    ProjectInfoCard(title = "最近受管结果") {
        ProjectFactRow(label = "状态", value = presentation.label)
        Text(
            text = presentation.detail,
            modifier = Modifier.padding(top = Spacing.s2),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        task.updatedAt?.take(10)?.takeIf { it.isNotBlank() }?.let { date ->
            Text(
                text = "更新于 $date",
                modifier = Modifier.padding(top = Spacing.s1),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ProjectIdentityCard(project: WorkspaceProject) {
    val work = project.workPresentation()
    val health = project.healthPresentation()
    ProjectInfoCard(title = "工作用途") {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = work.purpose,
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.width(Spacing.s2))
            WorkspaceHealthBadge(project)
        }
        Text(
            text = health.description,
            modifier = Modifier.padding(top = Spacing.s2),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ProjectProgressCard(project: WorkspaceProject) {
    ProjectInfoCard(title = "当前进展") {
        ProjectFactRow(label = "阶段", value = project.phaseLabel())
        ProjectFactDivider()
        ProjectFactRow(label = "进展", value = project.progress.stage.progressStageLabel())
        ProjectFactDivider()
        ProjectFactRow(label = "证据", value = "${project.progress.evidenceCount} 条")
        project.lastVerifiedAt?.take(10)?.takeIf { it.isNotBlank() }?.let { date ->
            ProjectFactDivider()
            ProjectFactRow(label = "最近核验", value = date)
        }
        HorizontalDivider(
            modifier = Modifier.padding(vertical = Spacing.s3),
            color = MaterialTheme.colorScheme.outlineVariant
        )
        Text("下一步", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Medium)
        Text(
            text = project.nextStepCopy(),
            modifier = Modifier.padding(top = Spacing.s1),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ProjectAttentionCard(items: List<WorkspaceAttentionItem>) {
    ProjectInfoCard(title = "当前待办") {
        items.forEachIndexed { index, item ->
            val attention = item.presentation()
            Text(
                text = attention.title,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = attention.detail,
                modifier = Modifier.padding(top = Spacing.s1),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            item.updatedAt?.take(10)?.takeIf { it.isNotBlank() }?.let { date ->
                Text(
                    text = "更新于 $date",
                    modifier = Modifier.padding(top = Spacing.s1),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (index < items.lastIndex) {
                HorizontalDivider(
                    modifier = Modifier.padding(vertical = Spacing.s3),
                    color = MaterialTheme.colorScheme.outlineVariant
                )
            }
        }
    }
}

private fun WorkspaceProject.nextStepCopy(): String = when {
    actions.any { it.actionId == "verify" } -> "可执行重新核验，获取最新状态与审计结果。"
    actions.any { it.actionId == "diagnose" } -> "可申请只读诊断，等待 owner 批准后复核证据。"
    reasonCode.mobileReasonDescription().isNotBlank() -> reasonCode.mobileReasonDescription()
    else -> "当前没有可执行的受管操作，请在开发信息中查看登记证据。"
}

@Composable
private fun ProjectActionCard(
    project: WorkspaceProject,
    actionStates: Map<String, WorkspaceActionState>,
    onSubmitAction: (String, MobileProjectAction) -> Unit
) {
    ProjectInfoCard(title = "可执行操作") {
        project.actions.forEachIndexed { index, action ->
            val state = actionStates["${project.id}:${action.actionId}"] ?: WorkspaceActionState.Idle
            val message = when (state) {
                WorkspaceActionState.Idle -> action.summary
                WorkspaceActionState.Submitting -> "正在提交…"
                is WorkspaceActionState.PendingApproval -> "已申请，等待 owner 审批。"
                is WorkspaceActionState.Completed -> state.message
                is WorkspaceActionState.Failed -> state.message
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(action.label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Medium)
                    Text(
                        message,
                        modifier = Modifier.padding(top = Spacing.s0_5),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                TextButton(
                    onClick = { onSubmitAction(project.id, action) },
                    enabled = state !is WorkspaceActionState.Submitting && state !is WorkspaceActionState.PendingApproval
                ) { Text(action.label) }
            }
            if (index < project.actions.lastIndex) ProjectFactDivider()
        }
    }
}

@Composable
private fun ProjectDeveloperInfoLink(onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(Spacing.px, MaterialTheme.colorScheme.outlineVariant),
        shape = RoundedCornerShape(Radius.md)
    ) {
        TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
            Text("开发信息 / 证据详情")
        }
    }
}

@Composable
private fun ProjectInfoCard(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.s4),
        shape = RoundedCornerShape(Radius.md),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(Spacing.px, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Column(modifier = Modifier.padding(Spacing.s4)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.padding(top = Spacing.s3))
            content()
        }
    }
}

@Composable
private fun ProjectFactRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Text(
            text = label,
            modifier = Modifier.weight(0.36f),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            modifier = Modifier.weight(0.64f),
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun ProjectFactDivider() {
    HorizontalDivider(
        modifier = Modifier.padding(vertical = Spacing.s2),
        color = MaterialTheme.colorScheme.outlineVariant
    )
}
