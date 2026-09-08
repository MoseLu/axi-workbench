package com.workbench.mobile.ui.screens.workspace

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.data.api.dto.MobileProjectAction
import com.workbench.mobile.data.api.dto.WorkspaceApproval
import com.workbench.mobile.data.repository.WorkspaceActionState
import com.workbench.mobile.ui.components.NavBadge
import com.workbench.mobile.ui.components.WorkBenchBottomBar
import com.workbench.mobile.ui.components.WorkBenchEmptyState
import com.workbench.mobile.ui.components.WorkBenchTopBar
import com.workbench.mobile.ui.components.WorkspaceProjectDivider
import com.workbench.mobile.ui.components.WorkspaceStateContent
import com.workbench.mobile.ui.components.WorkspaceStatusNoticeRow
import com.workbench.mobile.ui.components.rememberTabBadges
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing

/** 微信式待处理页：行动优先，状态说明只在每个紧凑分组标题出现一次。 */
@Composable
fun PendingWorkScreen(
    onSearchClick: () -> Unit,
    onScanClick: () -> Unit,
    onTabHome: () -> Unit,
    onTabWork: () -> Unit,
    onTabMe: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel()
) {
    val badges by rememberTabBadges()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val actionStates by viewModel.actionStates.collectAsStateWithLifecycle()
    val pendingBadge = NavBadge.ofCount(state.workspaceSnapshotOrNull()?.pendingWorkBadgeCount() ?: 0)

    Scaffold(
        topBar = {
            WorkBenchTopBar(
                title = "待处理",
                onSearch = onSearchClick,
                onScan = onScanClick
            )
        },
        bottomBar = {
            WorkBenchBottomBar(
                current = "pending",
                badges = badges,
                pendingBadge = pendingBadge,
                onHome = onTabHome,
                onWork = onTabWork,
                onPending = {},
                onMe = onTabMe
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Surface(
            modifier = Modifier.fillMaxSize().padding(padding),
            color = MaterialTheme.colorScheme.surface
        ) {
            WorkspaceStateContent(
                state = state,
                onRetry = viewModel::refresh,
                onStartPairingScan = onScanClick,
                modifier = Modifier.fillMaxSize()
            ) { snapshot, notice ->
                val groups = snapshot.pendingWorkGroups()
                if (groups.isEmpty()) {
                    WorkBenchEmptyState(
                        title = "暂时没有待处理事项",
                        description = "控制面当前没有返回需要你决定、处理或重新核验的事项。",
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(vertical = Spacing.s2)
                    ) {
                        if (notice is WorkspaceStatusNotice.ConnectionProblem) {
                            item(key = "connection") {
                                WorkspaceStatusNoticeRow(notice = notice, onRetry = viewModel::refresh)
                            }
                        }
                        groups.forEach { group ->
                            item(key = "group-${group.key}") {
                                PendingGroupHeader(group.title, group.description, group.entries.size)
                            }
                            items(group.entries, key = { "${group.key}-${it.id}" }) { entry ->
                                PendingWorkRow(
                                    entry = entry,
                                    actionStates = actionStates,
                                    onProjectClick = onProjectClick,
                                    onSubmitAction = viewModel::submitAction,
                                    onDecideApproval = viewModel::decideApproval
                                )
                                WorkspaceProjectDivider()
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PendingGroupHeader(title: String, description: String, count: Int) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
    ) {
        Text(
            text = "$title · $count 项",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = description,
            modifier = Modifier.padding(top = Spacing.s0_5),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun PendingWorkRow(
    entry: WorkspacePendingEntry,
    actionStates: Map<String, WorkspaceActionState>,
    onProjectClick: (String) -> Unit,
    onSubmitAction: (String, MobileProjectAction) -> Unit,
    onDecideApproval: (WorkspaceApproval, String) -> Unit
) {
    when (entry) {
        is WorkspacePendingEntry.Approval -> PendingApprovalRow(entry, onDecideApproval)
        is WorkspacePendingEntry.Running -> {
            val todo = entry.todoPresentation()
            PendingInfoRow(
                title = todo.title,
                detail = "${entry.project?.workPresentation()?.title ?: "工作区"} · ${todo.detail}",
                status = todo.badgeLabel,
                updatedAt = entry.updatedAt
            )
        }
        is WorkspacePendingEntry.Project -> PendingProjectRow(
            entry = entry,
            actionStates = actionStates,
            onProjectClick = onProjectClick,
            onSubmitAction = onSubmitAction
        )
        is WorkspacePendingEntry.Runtime -> {
            val todo = entry.todoPresentation()
            PendingInfoRow(
                title = todo.title,
                detail = todo.detail,
                status = todo.badgeLabel,
                updatedAt = entry.updatedAt
            )
        }
    }
}

@Composable
private fun PendingApprovalRow(
    entry: WorkspacePendingEntry.Approval,
    onDecideApproval: (WorkspaceApproval, String) -> Unit
) {
    val approval = entry.approval
    val todo = entry.todoPresentation()
    val projectTitle = entry.project?.workPresentation()?.title ?: "工作区"
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .defaultMinSize(minHeight = Size.row)
            .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
            .semantics(mergeDescendants = true) {
                contentDescription = "$projectTitle，${todo.title}，${todo.detail}"
            }
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = todo.title,
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(todo.badgeLabel, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        }
        Text(
            text = "$projectTitle · ${todo.detail}",
            modifier = Modifier.padding(top = Spacing.s0_5),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Row(modifier = Modifier.padding(top = Spacing.s1), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { onDecideApproval(approval, "rejected") }) { Text("拒绝") }
            Spacer(Modifier.width(Spacing.s2))
            TextButton(onClick = { onDecideApproval(approval, "approved") }) { Text("批准") }
        }
    }
}

@Composable
private fun PendingProjectRow(
    entry: WorkspacePendingEntry.Project,
    actionStates: Map<String, WorkspaceActionState>,
    onProjectClick: (String) -> Unit,
    onSubmitAction: (String, MobileProjectAction) -> Unit
) {
    val project = entry.project
    val work = project.workPresentation()
    val todo = entry.todoPresentation()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .defaultMinSize(minHeight = Size.row)
            .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
    ) {
        // 分组标题已说明共用原因；行内只保留项目、具体待办与真实动作，
        // 不能把相同解释与技术摘要重复铺成项目状态报告。
        // 详情入口只覆盖项目标题区；下方的受控动作必须能独立接收点击。
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button) { onProjectClick(project.id) }
                .semantics(mergeDescendants = true) {
                    contentDescription = "${work.title}，${todo.title}，${todo.detail}，下一步：${todo.nextStepLabel}"
                }
        ) {
            Text(
                text = "${work.title} · ${todo.title}",
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = work.purpose,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        if (project.actions.isEmpty()) {
            Text(
                text = "下一步：${todo.nextStepLabel}",
                modifier = Modifier.padding(top = Spacing.s1),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary
            )
        } else {
            PendingActionStrip(
                projectId = project.id,
                actions = project.actions,
                actionStates = actionStates,
                onSubmitAction = onSubmitAction
            )
        }
    }
}

@Composable
private fun PendingActionStrip(
    projectId: String,
    actions: List<MobileProjectAction>,
    actionStates: Map<String, WorkspaceActionState>,
    onSubmitAction: (String, MobileProjectAction) -> Unit
) {
    val feedback = actions.firstNotNullOfOrNull { action ->
        val state = actionStates["$projectId:${action.actionId}"] ?: WorkspaceActionState.Idle
        state.compactMessage()?.let { "${action.displayLabel()}：$it" }
    }
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically
    ) {
        actions.forEachIndexed { index, action ->
            val state = actionStates["$projectId:${action.actionId}"] ?: WorkspaceActionState.Idle
            if (index > 0) Spacer(Modifier.width(Spacing.s1))
            TextButton(
                onClick = { onSubmitAction(projectId, action) },
                enabled = state !is WorkspaceActionState.Submitting && state !is WorkspaceActionState.PendingApproval
            ) {
                Text(action.displayLabel())
            }
        }
    }
    feedback?.let { message ->
        Text(
            text = message,
            modifier = Modifier.padding(top = Spacing.s0_5),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

private fun MobileProjectAction.displayLabel(): String = when (actionType) {
    "project_diagnosis" -> "申请只读诊断"
    else -> label.ifBlank { "执行受管操作" }
}

private fun WorkspaceActionState.compactMessage(): String? = when (this) {
    WorkspaceActionState.Idle -> null
    WorkspaceActionState.Submitting -> "正在提交…"
    is WorkspaceActionState.PendingApproval -> "已申请，等待已配对设备审批。"
    is WorkspaceActionState.Completed -> message
    is WorkspaceActionState.Failed -> message
}

@Composable
private fun PendingInfoRow(title: String, detail: String, status: String, updatedAt: String?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .defaultMinSize(minHeight = Size.row)
            .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(status, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        }
        Text(detail, modifier = Modifier.padding(top = Spacing.s0_5), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        updatedAt?.take(10)?.takeIf { it.isNotBlank() }?.let { date ->
            Text("更新于 $date", modifier = Modifier.padding(top = Spacing.s0_5), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
