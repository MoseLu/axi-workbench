package com.workbench.mobile.ui.screens.workspace

import com.workbench.mobile.data.api.dto.MobileWorkspaceSnapshot
import com.workbench.mobile.data.api.dto.WorkspaceAttentionItem
import com.workbench.mobile.data.api.dto.WorkspaceSummary
import com.workbench.mobile.data.api.dto.WorkspaceProject
import com.workbench.mobile.data.api.dto.WorkspaceApproval
import com.workbench.mobile.data.api.dto.WorkspaceRunningTask
import com.workbench.mobile.data.repository.WorkspaceLoadState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkspacePresentationTest {
    private val project = WorkspaceProject(
        id = "axi-docs",
        name = "Axi Docs",
        kind = "documentation-hub",
        summary = "工作区文档浏览与同步入口",
        capabilities = listOf("docs-search-surface", "knowledge-graph-ui")
    )

    @Test
    fun `searches synchronized project name summary and capabilities`() {
        assertTrue(project.matchesWorkspaceQuery("docs"))
        assertTrue(project.matchesWorkspaceQuery("文档", "zh-CN"))
        assertTrue(project.matchesWorkspaceQuery("knowledge-graph"))
        assertFalse(project.matchesWorkspaceQuery("not-present"))
    }

    @Test
    fun `uses Chinese work contexts in the personal workbench while retaining canonical names for detail`() {
        val axiDocs = project.copy(id = "axi-docs", name = "Axi Docs")
        val zh = axiDocs.workPresentation("zh-CN")

        assertEquals("文档与知识", zh.title)
        assertEquals("检索规范、方案与项目文档", zh.purpose)
        assertEquals("Axi Docs", zh.canonicalName)
        assertEquals("Axi Docs", axiDocs.workPresentation("en-US").title)
        assertTrue(axiDocs.matchesWorkspaceQuery("文档", "zh-CN"))
    }

    @Test
    fun `sorts personal work before lower priority reference projects`() {
        val reference = project.copy(id = "comfyui", name = "ComfyUI Reference")
        val axiDocs = project.copy(id = "axi-docs", name = "Axi Docs")

        assertEquals(listOf("axi-docs", "comfyui"), listOf(reference, axiDocs).forPersonalWorkbench("zh-CN").map { it.id })
    }

    @Test
    fun `groups workbench projects without dropping unknown registered projects`() {
        val daily = project.copy(id = "axi-docs", name = "Axi Docs")
        val foundation = project.copy(id = "axi-model-gateway", name = "Axi Model Gateway")
        val creation = project.copy(id = "story-graph", name = "Story Graph")
        val reference = project.copy(id = "comfyui", name = "ComfyUI")
        val newlyRegistered = project.copy(id = "future-project", name = "Future Project")

        val groups = listOf(daily, foundation, creation, reference, newlyRegistered)
            .groupedForPersonalWorkbench("zh-CN")

        assertEquals(
            listOf(
                PersonalWorkbenchGroupId.DAILY_WORK,
                PersonalWorkbenchGroupId.AI_FOUNDATION,
                PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION,
                PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE,
                PersonalWorkbenchGroupId.OTHER
            ),
            groups.map { it.id }
        )
        assertEquals("日常工作", groups.first().title)
        assertEquals(listOf("future-project"), groups.last().projects.map { it.id })
        assertEquals(
            setOf(daily.id, foundation.id, creation.id, reference.id, newlyRegistered.id),
            groups.flatMap { it.projects }.map { it.id }.toSet()
        )
    }

    @Test
    fun `uses the concise project type in mobile lists instead of raw capability summaries`() {
        assertEquals("documentation hub", project.mobileListSubtitle())
        assertEquals("运行中 · documentation hub", project.copy(phase = "active").mobileListSubtitle())
    }

    @Test
    fun `only exposes an attention notice when the workspace has an actionable status`() {
        val healthySnapshot = MobileWorkspaceSnapshot(summary = WorkspaceSummary(total = 2, healthy = 2))
        assertNull(WorkspaceLoadState.Ready(healthySnapshot).workspaceStatusNotice())

        val needsAttention = MobileWorkspaceSnapshot(
            summary = WorkspaceSummary(total = 35, attention = 31, blocked = 2, stale = 2)
        )
        assertEquals(
            WorkspaceStatusNotice.Attention(
                approvals = 0,
                running = 0,
                blocked = 2,
                followUp = 31,
                recheck = 2,
                completionInfo = 0
            ),
            WorkspaceLoadState.Ready(needsAttention).workspaceStatusNotice()
        )
    }

    @Test
    fun `uses concrete next-step labels instead of vague project status labels`() {
        val blocked = project.copy(health = "blocked", reasonCode = "project_blocked").healthPresentation()
        val attention = project.copy(health = "attention", reasonCode = "handoff_unready").healthPresentation()
        val stale = project.copy(health = "stale", reasonCode = "evidence_stale").healthPresentation()
        val unknown = project.copy(health = "unknown", reasonCode = "evidence_missing").healthPresentation()

        assertEquals("先处理阻塞", blocked.label)
        assertTrue(blocked.requiresAttention)
        assertEquals("补齐交接", attention.label)
        assertTrue(attention.description.contains("当前进展"))
        assertEquals("重新核验", stale.label)
        assertTrue(stale.description.contains("超过有效期"))
        assertEquals("补齐信息", unknown.label)
    }

    @Test
    fun `localizes control plane attention from stable reason code without showing raw technical summary`() {
        val item = WorkspaceAttentionItem(
            type = "verification_stale",
            title = "Axi Docs evidence stale",
            reasonCode = "evidence_stale",
            summary = "raw command and evidence must stay out of the first layer"
        )

        val presentation = item.presentation()

        assertEquals("重新核验项目", presentation.title)
        assertEquals("上一次核验已超过有效期，请重新确认项目状态。", presentation.detail)
    }

    @Test
    fun `keeps the last snapshot visible during sync and connection failures`() {
        val snapshot = MobileWorkspaceSnapshot(projects = listOf(project))
        assertEquals(snapshot, WorkspaceLoadState.Loading(snapshot).workspaceSnapshotOrNull())
        assertEquals(snapshot, WorkspaceLoadState.Error("网络不可用", snapshot).workspaceSnapshotOrNull())
        assertNull(WorkspaceLoadState.Loading(snapshot).workspaceStatusNotice())
        assertEquals(WorkspaceStatusNotice.Syncing, WorkspaceLoadState.Loading(snapshot, userInitiated = true).workspaceStatusNotice())
        assertEquals(
            WorkspaceStatusNotice.ConnectionProblem("网络不可用"),
            WorkspaceLoadState.Error("网络不可用", snapshot).workspaceStatusNotice()
        )
    }

    @Test
    fun `presents QR pairing and Web confirmation separately from a workspace connection failure`() {
        val scanRequired = WorkspaceLoadState.QrPairingRequired
        val awaitingApproval = WorkspaceLoadState.AwaitingPairApproval(
            expiresAt = 1_786_608_900L
        )

        assertNull(scanRequired.workspaceSnapshotOrNull())
        assertEquals(
            WorkspaceStatusNotice.QrPairingRequired,
            scanRequired.workspaceStatusNotice()
        )
        assertNull(awaitingApproval.workspaceSnapshotOrNull())
        assertEquals(
            WorkspaceStatusNotice.PairingApprovalRequired(
                expiresAt = 1_786_608_900L
            ),
            awaitingApproval.workspaceStatusNotice()
        )
    }

    @Test
    fun `presents LAN gateway setup separately from a workspace connection failure`() {
        val setupRequired = WorkspaceLoadState.GatewaySetupRequired

        assertNull(setupRequired.workspaceSnapshotOrNull())
        assertEquals(
            WorkspaceStatusNotice.GatewayConfigurationRequired,
            setupRequired.workspaceStatusNotice()
        )
    }

    @Test
    fun `builds pending work in action priority and derives its badge from control plane facts`() {
        val blocked = project.copy(id = "axi-docs", health = "blocked", reasonCode = "project_blocked")
        val snapshot = MobileWorkspaceSnapshot(
            summary = WorkspaceSummary(total = 1, blocked = 1, attention = 1),
            projects = listOf(blocked),
            approvals = listOf(WorkspaceApproval(id = "apr_1", projectId = "axi-docs", actionId = "diagnose", actionType = "project_diagnosis")),
            runningTasks = listOf(WorkspaceRunningTask(id = "task_1", projectId = "axi-docs")),
            attentionItems = listOf(WorkspaceAttentionItem(id = "blocked", projectId = "axi-docs", type = "project_blocked", reasonCode = "project_blocked"))
        )

        assertEquals(listOf("approvals", "running", "blocked"), snapshot.pendingWorkGroups().map { it.key })
        assertEquals(4, snapshot.pendingWorkBadgeCount())
    }

    @Test
    fun `projects each control plane reason into a readable todo with a next step`() {
        val handoff = project.copy(health = "attention", reasonCode = "handoff_unready")
        val snapshot = MobileWorkspaceSnapshot(
            summary = WorkspaceSummary(total = 1, attention = 1),
            projects = listOf(handoff),
            attentionItems = listOf(
                WorkspaceAttentionItem(
                    id = "handoff",
                    projectId = "axi-docs",
                    type = "project_attention",
                    reasonCode = "handoff_unready"
                )
            )
        )

        val todo = snapshot.todoItems().single()

        assertEquals("文档与知识", todo.projectTitle)
        assertEquals("补齐交接信息", todo.presentation.title)
        assertEquals("查看下一步", todo.presentation.nextStepLabel)
        assertTrue(todo.presentation.detail.contains("未完成事项"))
    }

    @Test
    fun `presents a completed diagnosis result without exposing raw task output`() {
        val result = WorkspaceRunningTask(
            id = "task_1",
            projectId = "axi-docs",
            status = "succeeded",
            reasonCode = "diagnosis_completed",
            summary = "raw JSON evidence must stay out of the first layer"
        ).taskPresentation()

        assertEquals("已完成", result.label)
        assertEquals("只读诊断已完成，未修改项目文件。", result.detail)
    }
}
