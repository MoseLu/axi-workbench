package com.workbench.mobile.ui.screens.workspace

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.ui.components.WorkspaceProjectRow
import com.workbench.mobile.ui.components.WorkspaceStatusNoticeRow
import com.workbench.mobile.ui.screens.me.MeDivider
import com.workbench.mobile.ui.screens.me.MeGroup
import com.workbench.mobile.ui.screens.me.MeHint
import com.workbench.mobile.ui.screens.me.MeSectionGap
import com.workbench.mobile.ui.screens.me.MeSubScaffold

/**
 * 工作区二级页：复用“个人信息”页的返回、灰底与白色分组列表，
 * 只在这里展示该工作分区下的项目，项目详情仍保留规范项目名称。
 */
@Composable
fun WorkspaceGroupScreen(
    groupRouteId: String,
    onBack: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel()
) {
    val requestedGroup = PersonalWorkbenchGroupId.fromRouteSegment(groupRouteId)
        ?: PersonalWorkbenchGroupId.OTHER
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snapshot = state.workspaceSnapshotOrNull()
    val notice = state.workspaceStatusNotice()
    val group = snapshot
        ?.projects
        ?.groupedForPersonalWorkbench()
        ?.firstOrNull { it.id == requestedGroup }
    val title = group?.title ?: requestedGroup.presentation().title

    MeSubScaffold(title = title, onBack = onBack) {
        MeSectionGap()

        if (snapshot == null) {
            notice?.let {
                WorkspaceStatusNoticeRow(notice = it, onRetry = viewModel::refresh)
            }
        } else if (group == null) {
            MeHint("该分组暂时没有已登记的项目")
        } else {
            if (notice is WorkspaceStatusNotice.ConnectionProblem) {
                WorkspaceStatusNoticeRow(notice = notice, onRetry = viewModel::refresh)
                MeSectionGap()
            }
            MeHint(group.description)
            MeGroup {
                group.projects.forEachIndexed { index, project ->
                    WorkspaceProjectRow(
                        project = project,
                        showChevron = true,
                        onClick = { onProjectClick(project.id) }
                    )
                    if (index < group.projects.lastIndex) {
                        MeDivider()
                    }
                }
            }
        }
    }
}
