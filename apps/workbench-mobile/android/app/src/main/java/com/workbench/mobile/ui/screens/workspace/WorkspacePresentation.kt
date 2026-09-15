package com.workbench.mobile.ui.screens.workspace

import com.workbench.mobile.data.api.dto.MobileWorkspaceSnapshot
import com.workbench.mobile.data.api.dto.WorkspaceApproval
import com.workbench.mobile.data.api.dto.WorkspaceAttentionItem
import com.workbench.mobile.data.api.dto.WorkspaceProject
import com.workbench.mobile.data.api.dto.WorkspaceRunningTask
import com.workbench.mobile.data.repository.WorkspaceLoadState
import java.util.Locale

/**
 * 移动端状态不是仪表盘摘要：它只在同步、连接异常或需要处理时出现。
 * 这让内容列表保持主体地位，状态则像微信的网络提示/未读入口一样轻量且可消失。
 */
sealed interface WorkspaceStatusNotice {
    data object Syncing : WorkspaceStatusNotice

    /** A true device needs an explicit API Gateway on its routable LAN. */
    data object GatewayConfigurationRequired : WorkspaceStatusNotice

    /** The unpaired phone must scan the short-lived QR displayed by Web. */
    data object QrPairingRequired : WorkspaceStatusNotice

    /** An owner must confirm the scanned device before the phone can obtain a device bearer. */
    data class PairingApprovalRequired(
        val expiresAt: Long?
    ) : WorkspaceStatusNotice

    data class Attention(
        val approvals: Int,
        val running: Int,
        val blocked: Int,
        val followUp: Int,
        val recheck: Int,
        val completionInfo: Int
    ) : WorkspaceStatusNotice

    data class ConnectionProblem(val message: String) : WorkspaceStatusNotice
}

fun WorkspaceLoadState.workspaceSnapshotOrNull(): MobileWorkspaceSnapshot? = when (this) {
    is WorkspaceLoadState.Loading -> snapshot
    is WorkspaceLoadState.Ready -> snapshot
    WorkspaceLoadState.QrPairingRequired -> null
    is WorkspaceLoadState.AwaitingPairApproval -> null
    WorkspaceLoadState.GatewaySetupRequired -> null
    is WorkspaceLoadState.Error -> snapshot
}

fun WorkspaceLoadState.workspaceStatusNotice(): WorkspaceStatusNotice? = when (this) {
    is WorkspaceLoadState.Loading -> if (snapshot == null || userInitiated) WorkspaceStatusNotice.Syncing else null
    WorkspaceLoadState.QrPairingRequired -> WorkspaceStatusNotice.QrPairingRequired
    is WorkspaceLoadState.AwaitingPairApproval -> WorkspaceStatusNotice.PairingApprovalRequired(expiresAt)
    WorkspaceLoadState.GatewaySetupRequired -> WorkspaceStatusNotice.GatewayConfigurationRequired
    is WorkspaceLoadState.Error -> WorkspaceStatusNotice.ConnectionProblem(message)
    is WorkspaceLoadState.Ready -> {
        val approvals = snapshot.approvals.size
        val running = snapshot.runningTasks.size
        val blocked = snapshot.summary.blocked
        val followUp = snapshot.summary.attention
        val recheck = snapshot.summary.stale
        val completionInfo = snapshot.summary.unknown
        if (approvals == 0 && running == 0 && blocked == 0 && followUp == 0 && recheck == 0 && completionInfo == 0) {
            null
        } else {
            WorkspaceStatusNotice.Attention(
                approvals = approvals,
                running = running,
                blocked = blocked,
                followUp = followUp,
                recheck = recheck,
                completionInfo = completionInfo,
            )
        }
    }
}

fun WorkspaceProject.matchesWorkspaceQuery(
    query: String,
    localeTag: String = Locale.getDefault().toLanguageTag()
): Boolean {
    val keyword = query.trim()
    if (keyword.isEmpty()) return true
    val work = workPresentation(localeTag)
    return listOf(name, id, kind, summary, phase, work.title, work.purpose, work.canonicalName)
        .plus(capabilities)
        .any { value -> value.contains(keyword, ignoreCase = true) }
}

fun WorkspaceProject.healthLabel(): String = healthPresentation().label

/**
 * 移动端不把项目状态简化成“需关注 / 待验证”。
 * 控制面给出稳定原因码，这里把它转成用户能立即理解的待办语义。
 */
data class WorkspaceHealthPresentation(
    val label: String,
    val description: String,
    val priority: Int,
    val requiresAttention: Boolean
)

data class WorkspaceTodoPresentation(
    val groupKey: String,
    val groupTitle: String,
    val groupDescription: String,
    val title: String,
    val detail: String,
    val badgeLabel: String,
    val nextStepLabel: String,
    val priority: Int
)

/**
 * 一份待办必须回答四件事：要做什么、为什么、放在哪一组、下一步到哪里处理。
 * 这层只消费控制面的 reasonCode，不展示命令、路径或原始英文摘要。
 */
private fun workspaceTodoPresentation(
    reasonCode: String,
    fallbackHealth: String = "unknown"
): WorkspaceTodoPresentation = when (reasonCode) {
    "approval_pending" -> WorkspaceTodoPresentation(
        groupKey = "approvals",
        groupTitle = "需要你决定",
        groupDescription = "确认或拒绝只读诊断申请。",
        title = "决定是否批准诊断",
        detail = "确认后仅复核项目状态和证据，不会修改项目文件。",
        badgeLabel = "需要决定",
        nextStepLabel = "去决定",
        priority = 0
    )

    "task_running" -> WorkspaceTodoPresentation(
        groupKey = "running",
        groupTitle = "正在等待结果",
        groupDescription = "受管任务正在安全执行，完成后会自动更新。",
        title = "等待诊断完成",
        detail = "受管任务正在执行，暂时不需要重复提交操作。",
        badgeLabel = "执行中",
        nextStepLabel = "查看进度",
        priority = 10
    )

    "project_blocked" -> WorkspaceTodoPresentation(
        groupKey = "blocked",
        groupTitle = "先处理阻塞",
        groupDescription = "项目报告了阻塞；先确认阻塞原因和下一步。",
        title = "处理项目阻塞",
        detail = "项目当前不能继续，先处理阻塞原因后再推进。",
        badgeLabel = "先处理阻塞",
        nextStepLabel = "查看阻塞原因",
        priority = 20
    )

    "project_unavailable" -> WorkspaceTodoPresentation(
        groupKey = "project-access",
        groupTitle = "恢复项目访问",
        groupDescription = "项目目录暂不可用，恢复访问后才能继续核验。",
        title = "恢复项目访问",
        detail = "项目目录当前不可用，暂时不能执行受管核验。",
        badgeLabel = "恢复访问",
        nextStepLabel = "查看原因",
        priority = 30
    )

    "task_execution_failed", "diagnosis_failed" -> WorkspaceTodoPresentation(
        groupKey = "task-result",
        groupTitle = "检查未完成任务",
        groupDescription = "有任务未完成，请先打开项目详情查看结果，再决定下一步。",
        title = "检查未完成任务",
        detail = if (reasonCode == "diagnosis_failed") {
            "只读诊断未完成，请查看结果后再处理。"
        } else {
            "受管任务未完成，请查看结果后再决定下一步。"
        },
        badgeLabel = "未完成",
        nextStepLabel = "打开项目详情",
        priority = 35
    )

    "handoff_unready" -> WorkspaceTodoPresentation(
        groupKey = "handoff",
        groupTitle = "补齐交接信息",
        groupDescription = "确认当前进展、未完成事项和下一步。",
        title = "补齐交接信息",
        detail = "请确认当前进展、未完成事项和下一步。",
        badgeLabel = "补齐交接",
        nextStepLabel = "查看下一步",
        priority = 40
    )

    "evidence_stale" -> WorkspaceTodoPresentation(
        groupKey = "recheck",
        groupTitle = "重新核验项目",
        groupDescription = "上一次核验已失效，需要重新运行登记的只读核验。",
        title = "重新核验项目",
        detail = "上一次核验已超过有效期，请重新确认项目状态。",
        badgeLabel = "重新核验",
        nextStepLabel = "重新核验",
        priority = 50
    )

    "evidence_missing" -> WorkspaceTodoPresentation(
        groupKey = "completion-info",
        groupTitle = "补齐完成信息",
        groupDescription = "缺少判断项目状态的完成度信息。",
        title = "补齐完成信息",
        detail = "尚未记录足够的信息来判断项目是否完成。",
        badgeLabel = "补齐信息",
        nextStepLabel = "查看要求",
        priority = 60
    )

    "evidence_low_confidence" -> WorkspaceTodoPresentation(
        groupKey = "progress-check",
        groupTitle = "确认项目进展",
        groupDescription = "现有信息不足以确认进展，需要补充或复核。",
        title = "确认项目进展",
        detail = "现有证据不足以确认项目进展，请补充或复核。",
        badgeLabel = "确认进展",
        nextStepLabel = "查看详情",
        priority = 70
    )

    "task_cancelled" -> WorkspaceTodoPresentation(
        groupKey = "task-result",
        groupTitle = "检查未完成任务",
        groupDescription = "任务已取消，请先打开项目详情确认是否需要重新安排。",
        title = "确认是否重新安排任务",
        detail = "受管任务已取消，未执行项目文件修改。",
        badgeLabel = "任务已取消",
        nextStepLabel = "查看结果",
        priority = 35
    )

    "verified" -> WorkspaceTodoPresentation(
        groupKey = "healthy",
        groupTitle = "无需处理",
        groupDescription = "项目状态已通过有效证据核验。",
        title = "项目已核验",
        detail = "当前项目状态已通过有效证据核验。",
        badgeLabel = "已核验",
        nextStepLabel = "查看详情",
        priority = 100
    )

    else -> when (fallbackHealth) {
        "blocked" -> workspaceTodoPresentation("project_blocked")
        "attention" -> workspaceTodoPresentation("evidence_low_confidence")
        "stale" -> workspaceTodoPresentation("evidence_stale")
        "healthy" -> workspaceTodoPresentation("verified")
        else -> workspaceTodoPresentation("evidence_missing")
    }
}

fun workspaceHealthPresentation(
    health: String,
    reasonCode: String = ""
): WorkspaceHealthPresentation {
    val todo = workspaceTodoPresentation(reasonCode, health)
    return WorkspaceHealthPresentation(
        label = todo.badgeLabel,
        description = todo.detail,
        priority = todo.priority,
        requiresAttention = health != "healthy"
    )
}

fun WorkspaceProject.healthPresentation(): WorkspaceHealthPresentation =
    workspaceHealthPresentation(health, reasonCode)

fun WorkspaceProject.requiresStatusAttention(): Boolean = healthPresentation().requiresAttention

data class WorkspaceAttentionPresentation(
    val title: String,
    val detail: String
)

/** 控制面给出事实原因；这里仅将稳定类型转换为移动端的中文操作语义。 */
fun WorkspaceAttentionItem.presentation(): WorkspaceAttentionPresentation {
    val fallbackHealth = when (type) {
        "project_blocked" -> "blocked"
        "project_attention" -> "attention"
        "verification_stale" -> "stale"
        "verification_needed" -> "unknown"
        else -> "unknown"
    }
    val todo = workspaceTodoPresentation(reasonCode, fallbackHealth)
    return WorkspaceAttentionPresentation(
        title = todo.title,
        detail = todo.detail
    )
}

/** 原始技术摘要留在高级页；首层只消费控制面的稳定原因码。 */
fun String.mobileReasonDescription(): String = when (this) {
    "project_unavailable" -> "项目目录当前不可用，恢复访问后才能核验。"
    "evidence_missing" -> "尚未记录足够的信息来判断项目是否完成。"
    "project_blocked" -> "项目当前不能继续，先处理阻塞原因后再推进。"
    "handoff_unready" -> "请确认当前进展、未完成事项和下一步。"
    "evidence_stale" -> "上一次核验已超过有效期，请重新确认项目状态。"
    "evidence_low_confidence" -> "现有证据不足以确认项目进展，请补充或复核。"
    "approval_pending" -> "需要你决定是否批准只读诊断。"
    "task_running" -> "受管任务正在执行，暂时不需要重复提交操作。"
    "task_execution_failed" -> "受管任务未完成，请查看结果后再决定下一步。"
    "diagnosis_failed" -> "只读诊断未完成，请查看结果后再处理。"
    "diagnosis_completed" -> "只读诊断已完成，未修改项目文件。"
    "verification_completed" -> "已完成登记的只读核验，结果已记录。"
    "task_cancelled" -> "受管任务已取消，未执行项目文件修改。"
    "verified" -> "当前项目状态已通过有效证据核验。"
    else -> ""
}

data class WorkspaceTaskPresentation(
    val label: String,
    val detail: String
)

/** 任务结果继续由稳定状态和原因码表达，避免把命令输出塞回个人工作台首层。 */
fun WorkspaceRunningTask.taskPresentation(): WorkspaceTaskPresentation {
    val label = when (status) {
        "running" -> "执行中"
        "succeeded" -> "已完成"
        "failed" -> "未完成"
        "cancelled" -> "已取消"
        else -> "受管任务"
    }
    val fallback = when (status) {
        "running" -> "受管任务正在执行，完成后会更新结果。"
        "succeeded" -> "受管任务已完成，结果已记录。"
        "failed" -> "受管任务未完成，请查看开发信息后处理。"
        "cancelled" -> "受管任务已取消。"
        else -> "控制面已更新受管任务状态。"
    }
    return WorkspaceTaskPresentation(label = label, detail = reasonCode.mobileReasonDescription().ifBlank { fallback })
}

data class WorkspacePendingGroup(
    val key: String,
    val title: String,
    val description: String,
    val entries: List<WorkspacePendingEntry>
)

sealed interface WorkspacePendingEntry {
    val id: String
    val projectId: String?
    val updatedAt: String?

    data class Approval(
        val approval: WorkspaceApproval,
        val project: WorkspaceProject? = null
    ) : WorkspacePendingEntry {
        override val id: String = approval.id
        override val projectId: String? = approval.projectId
        override val updatedAt: String? = approval.createdAt
    }

    data class Running(
        val task: WorkspaceRunningTask,
        val project: WorkspaceProject? = null
    ) : WorkspacePendingEntry {
        override val id: String = task.id
        override val projectId: String? = task.projectId
        override val updatedAt: String? = task.updatedAt
    }

    data class Project(val project: WorkspaceProject, val attention: WorkspaceAttentionItem) : WorkspacePendingEntry {
        override val id: String = attention.id
        override val projectId: String = project.id
        override val updatedAt: String? = attention.updatedAt
    }

    data class Runtime(val attention: WorkspaceAttentionItem) : WorkspacePendingEntry {
        override val id: String = attention.id
        override val projectId: String? = attention.projectId
        override val updatedAt: String? = attention.updatedAt
    }
}

/** 同一份待办投影同时驱动概览与“待处理”，避免两处重新解释控制面状态。 */
fun WorkspacePendingEntry.todoPresentation(): WorkspaceTodoPresentation = when (this) {
    is WorkspacePendingEntry.Approval -> workspaceTodoPresentation("approval_pending")
    is WorkspacePendingEntry.Running -> workspaceTodoPresentation(task.reasonCode, "attention")
    is WorkspacePendingEntry.Project -> {
        val todo = workspaceTodoPresentation(
            reasonCode = attention.reasonCode.ifBlank { project.reasonCode },
            fallbackHealth = project.health
        )
        val registeredAction = project.actions.firstOrNull { it.actionId == "verify" }
            ?: project.actions.firstOrNull()
        todo.copy(nextStepLabel = registeredAction?.label?.takeIf { it.isNotBlank() } ?: todo.nextStepLabel)
    }
    is WorkspacePendingEntry.Runtime -> workspaceTodoPresentation(attention.reasonCode, "attention")
}

data class WorkspaceTodoItem(
    val id: String,
    val projectTitle: String,
    val presentation: WorkspaceTodoPresentation,
    val updatedAt: String?
)

/** 概览只展示优先级最高的待办；完整队列仍由“待处理”承载。 */
fun MobileWorkspaceSnapshot.todoItems(): List<WorkspaceTodoItem> = pendingWorkGroups()
    .flatMap { group ->
        group.entries.map { entry ->
            val projectTitle = when (entry) {
                is WorkspacePendingEntry.Approval -> entry.project?.workPresentation()?.title ?: "工作区"
                is WorkspacePendingEntry.Running -> entry.project?.workPresentation()?.title ?: "工作区"
                is WorkspacePendingEntry.Project -> entry.project.workPresentation().title
                is WorkspacePendingEntry.Runtime -> "工作区任务"
            }
            WorkspaceTodoItem(
                id = "${group.key}:${entry.id}",
                projectTitle = projectTitle,
                presentation = entry.todoPresentation(),
                updatedAt = entry.updatedAt
            )
        }
    }

/**
 * 待处理按真实动作而不是抽象状态分组：需要你决定 → 等待结果 →
 * 先处理阻塞 → 补齐交接/完成信息 → 重新核验 → 确认进展。
 */
fun MobileWorkspaceSnapshot.pendingWorkGroups(): List<WorkspacePendingGroup> {
    val projectsById = projects.associateBy { it.id }
    val result = mutableListOf<WorkspacePendingEntry>()
    result += approvals.map { approval ->
        WorkspacePendingEntry.Approval(
            approval = approval,
            project = approval.projectId?.let(projectsById::get)
        )
    }
    result += runningTasks.map { task ->
        WorkspacePendingEntry.Running(
            task = task,
            project = task.projectId?.let(projectsById::get)
        )
    }
    val projectAttention = attentionItems
        .filter { it.type != "approval_pending" }
        .mapNotNull { item ->
            item.projectId?.let { projectId ->
                projectsById[projectId]?.let { WorkspacePendingEntry.Project(it, item) }
            }
        }
    result += projectAttention
    val runtime = attentionItems
        .filter { item -> item.projectId?.let { !projectsById.containsKey(it) } ?: true }
        .filter { it.type != "approval_pending" }
        .map { WorkspacePendingEntry.Runtime(it) }
    result += runtime

    return result
        .sortedWith(
            compareBy<WorkspacePendingEntry> { it.todoPresentation().priority }
                .thenByDescending { it.updatedAt.orEmpty() }
        )
        .groupBy { it.todoPresentation().groupKey }
        .map { (key, entries) ->
            val todo = entries.first().todoPresentation()
            WorkspacePendingGroup(
                key = key,
                title = todo.groupTitle,
                description = todo.groupDescription,
                entries = entries
            )
        }
}

/** 底栏角标只来自真实的待批准、执行中、阻塞和待办控制面事实。 */
fun MobileWorkspaceSnapshot.pendingWorkBadgeCount(): Int =
    approvals.size + runningTasks.size + summary.blocked + summary.attention

/** 移动列表只展示真实项目类型；完整能力与摘要留在详情，避免列表变成技术字段墙。 */
fun WorkspaceProject.mobileListSubtitle(): String {
    val projectType = kind
        .trim()
        .split("-")
        .filter { it.isNotBlank() }
        .joinToString(" ")
        .ifBlank { id }
    val phase = phaseLabel().takeUnless { it == "未声明" }
    return listOfNotNull(phase, projectType.takeIf { it.isNotBlank() }).joinToString(" · ")
}

/**
 * 个人工作台的工作语义，不更改 workspace.graph 的规范项目身份。
 * 中文环境优先给出“我能在这里做什么”，原始项目名只在详情页展示；非中文环境则自然回退。
 */
data class WorkspaceWorkPresentation(
    val title: String,
    val purpose: String,
    val canonicalName: String,
    val priority: Int
)

/**
 * 个人工作台的第一层不是技术项目清单，而是用户能理解的工作分区。
 * routeSegment 保持稳定，避免把中文标题或项目规范名称当作导航协议。
 */
enum class PersonalWorkbenchGroupId(val routeSegment: String) {
    DAILY_WORK("daily-work"),
    AI_FOUNDATION("ai-foundation"),
    PRODUCTS_AND_CREATION("products-and-creation"),
    TOOLS_AND_REFERENCE("tools-and-reference"),
    OTHER("other");

    companion object {
        fun fromRouteSegment(value: String): PersonalWorkbenchGroupId? =
            values().firstOrNull { it.routeSegment == value }
    }
}

data class PersonalWorkbenchGroupPresentation(
    val title: String,
    val description: String
)

data class WorkspaceProjectGroup(
    val id: PersonalWorkbenchGroupId,
    val title: String,
    val description: String,
    val projects: List<WorkspaceProject>
)

private data class ChineseWorkCopy(
    val title: String,
    val purpose: String,
    val priority: Int
)

private val chineseWorkCatalog = mapOf(
    "axi-docs" to ChineseWorkCopy("文档与知识", "检索规范、方案与项目文档", 10),
    "axi-coder" to ChineseWorkCopy("开发与编程", "编码任务、终端与本地开发", 20),
    "axi-agent-platform" to ChineseWorkCopy("智能体任务", "运行、调度与质量检查", 30),
    "axi-rules" to ChineseWorkCopy("工作规范", "规则、流程与验收依据", 40),
    "axi-workbench" to ChineseWorkCopy("个人工作台", "项目、任务与工作区协作", 50),
    "axi-notify" to ChineseWorkCopy("消息与协作", "通知、提醒与移动工作入口", 60),
    "axi-ui" to ChineseWorkCopy("界面系统", "组件、主题与后台界面", 70),
    "ai-capability" to ChineseWorkCopy("AI 能力中心", "识别、生成与本地能力", 80),
    "axi-image-preview" to ChineseWorkCopy("图像预览", "查看、审阅与管理图像", 90),
    "axi-feishu-codex-bridge" to ChineseWorkCopy("飞书协作", "消息通道与 Codex 桥接", 100),
    "axi-model-gateway" to ChineseWorkCopy("模型网关", "模型路由与能力接入", 110),
    "ollama-local" to ChineseWorkCopy("本地模型", "离线推理与向量能力", 120),
    "minimax-tokenplan" to ChineseWorkCopy("云端 AI 能力", "媒体生成与在线检索", 130),
    "axi-skills" to ChineseWorkCopy("智能体技能库", "可复用技能与执行规范", 140),
    "axi-registry" to ChineseWorkCopy("本地包仓库", "私有包与依赖分发", 150),
    "codex-app-projects" to ChineseWorkCopy("工作区总览", "项目注册与工作区边界", 160),
    "axi-workspace-governance" to ChineseWorkCopy("工作区治理", "项目目录、合同与验证规则", 170),
    "story-graph" to ChineseWorkCopy("故事关系图谱", "事件、人物与叙事探索", 180),
    "axi-pet" to ChineseWorkCopy("桌面陪伴", "虚拟陪伴与互动内容", 190),
    "axi-pet-desktop" to ChineseWorkCopy("桌面陪伴客户端", "桌面端运行与资源管理", 200),
    "axi-artboard" to ChineseWorkCopy("创作画板", "视觉创作与画板工具", 210),
    "ielts-vocab" to ChineseWorkCopy("雅思词汇", "词汇学习与复习", 220),
    "sports-management" to ChineseWorkCopy("体育管理", "赛事与团队管理", 230),
    "axi-proxy-companion" to ChineseWorkCopy("代理助手", "本地代理与辅助工具", 240),
    "axi-video-downloader" to ChineseWorkCopy("视频工具", "视频下载与本地处理", 250),
    "axi-tauri-starter" to ChineseWorkCopy("桌面应用模板", "Tauri 桌面应用起步模板", 260),
    "axi-accounts" to ChineseWorkCopy("账号与凭证", "身份与账号契约", 270),
    "sub2api" to ChineseWorkCopy("订阅接口参考", "订阅 API 与工具参考", 280),
    "cliproxyapi" to ChineseWorkCopy("代理接口参考", "CLIProxyAPI 集成参考", 290),
    "image2prompt" to ChineseWorkCopy("图像提示词参考", "图像到提示词工具参考", 300),
    "opencodex" to ChineseWorkCopy("本地 Codex 参考", "本地网关与调用参考", 310),
    "cockpit-tools" to ChineseWorkCopy("桌面工具参考", "桌面工具与工作流参考", 320),
    "blinko" to ChineseWorkCopy("笔记参考", "知识笔记与同步参考", 330),
    "comfyui" to ChineseWorkCopy("ComfyUI 参考", "图像工作流与节点参考", 340),
    "dbskill" to ChineseWorkCopy("数据库技能参考", "数据库技能与工具参考", 350)
)

private val personalWorkbenchGroups = mapOf(
    PersonalWorkbenchGroupId.DAILY_WORK to PersonalWorkbenchGroupPresentation(
        title = "日常工作",
        description = "文档、开发、智能体与协作"
    ),
    PersonalWorkbenchGroupId.AI_FOUNDATION to PersonalWorkbenchGroupPresentation(
        title = "AI 与基础能力",
        description = "模型、技能、账号与工作区能力"
    ),
    PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION to PersonalWorkbenchGroupPresentation(
        title = "产品与创作",
        description = "图像、故事、学习与桌面产品"
    ),
    PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE to PersonalWorkbenchGroupPresentation(
        title = "工具与参考",
        description = "模板、第三方工具与技术参考"
    ),
    PersonalWorkbenchGroupId.OTHER to PersonalWorkbenchGroupPresentation(
        title = "其他项目",
        description = "尚未归类的已登记工作区项目"
    )
)

private val englishPersonalWorkbenchGroups = mapOf(
    PersonalWorkbenchGroupId.DAILY_WORK to PersonalWorkbenchGroupPresentation(
        title = "Daily work",
        description = "Docs, development, agents and collaboration"
    ),
    PersonalWorkbenchGroupId.AI_FOUNDATION to PersonalWorkbenchGroupPresentation(
        title = "AI and foundations",
        description = "Models, skills, accounts and workspace capabilities"
    ),
    PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION to PersonalWorkbenchGroupPresentation(
        title = "Products and creation",
        description = "Images, stories, learning and desktop products"
    ),
    PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE to PersonalWorkbenchGroupPresentation(
        title = "Tools and references",
        description = "Templates, third-party tools and technical references"
    ),
    PersonalWorkbenchGroupId.OTHER to PersonalWorkbenchGroupPresentation(
        title = "Other projects",
        description = "Registered workspace projects not yet classified"
    )
)

private val personalWorkbenchGroupByProjectId = mapOf(
    "axi-docs" to PersonalWorkbenchGroupId.DAILY_WORK,
    "axi-coder" to PersonalWorkbenchGroupId.DAILY_WORK,
    "axi-agent-platform" to PersonalWorkbenchGroupId.DAILY_WORK,
    "axi-rules" to PersonalWorkbenchGroupId.DAILY_WORK,
    "axi-workbench" to PersonalWorkbenchGroupId.DAILY_WORK,
    "axi-notify" to PersonalWorkbenchGroupId.DAILY_WORK,
    "axi-ui" to PersonalWorkbenchGroupId.DAILY_WORK,
    "ai-capability" to PersonalWorkbenchGroupId.AI_FOUNDATION,
    "axi-feishu-codex-bridge" to PersonalWorkbenchGroupId.AI_FOUNDATION,
    "axi-model-gateway" to PersonalWorkbenchGroupId.AI_FOUNDATION,
    "ollama-local" to PersonalWorkbenchGroupId.AI_FOUNDATION,
    "minimax-tokenplan" to PersonalWorkbenchGroupId.AI_FOUNDATION,
    "axi-skills" to PersonalWorkbenchGroupId.AI_FOUNDATION,
    "axi-registry" to PersonalWorkbenchGroupId.AI_FOUNDATION,
    "codex-app-projects" to PersonalWorkbenchGroupId.AI_FOUNDATION,
    "axi-workspace-governance" to PersonalWorkbenchGroupId.AI_FOUNDATION,
    "axi-accounts" to PersonalWorkbenchGroupId.AI_FOUNDATION,
    "axi-image-preview" to PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION,
    "axi-pet" to PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION,
    "axi-pet-desktop" to PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION,
    "axi-artboard" to PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION,
    "ielts-vocab" to PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION,
    "story-graph" to PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION,
    "sports-management" to PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION,
    "axi-proxy-companion" to PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION,
    "axi-video-downloader" to PersonalWorkbenchGroupId.PRODUCTS_AND_CREATION,
    "axi-tauri-starter" to PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE,
    "sub2api" to PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE,
    "cliproxyapi" to PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE,
    "image2prompt" to PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE,
    "opencodex" to PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE,
    "cockpit-tools" to PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE,
    "blinko" to PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE,
    "comfyui" to PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE,
    "dbskill" to PersonalWorkbenchGroupId.TOOLS_AND_REFERENCE
)

fun PersonalWorkbenchGroupId.presentation(
    localeTag: String = Locale.getDefault().toLanguageTag()
): PersonalWorkbenchGroupPresentation {
    val catalog = if (localeTag.startsWith("zh", ignoreCase = true)) {
        personalWorkbenchGroups
    } else {
        englishPersonalWorkbenchGroups
    }
    return checkNotNull(catalog[this])
}

fun WorkspaceProject.personalWorkbenchGroupId(): PersonalWorkbenchGroupId =
    personalWorkbenchGroupByProjectId[id] ?: PersonalWorkbenchGroupId.OTHER

fun WorkspaceProject.workPresentation(localeTag: String = Locale.getDefault().toLanguageTag()): WorkspaceWorkPresentation {
    val canonicalName = name.ifBlank { id }
    val copy = chineseWorkCatalog[id].takeIf { localeTag.startsWith("zh", ignoreCase = true) }
    return if (copy != null) {
        WorkspaceWorkPresentation(
            title = copy.title,
            purpose = copy.purpose,
            canonicalName = canonicalName,
            priority = copy.priority
        )
    } else {
        WorkspaceWorkPresentation(
            title = canonicalName,
            purpose = mobileListSubtitle(),
            canonicalName = canonicalName,
            priority = 1000
        )
    }
}

fun List<WorkspaceProject>.forPersonalWorkbench(localeTag: String = Locale.getDefault().toLanguageTag()): List<WorkspaceProject> =
    sortedWith(
        compareBy<WorkspaceProject> { it.workPresentation(localeTag).priority }
            .thenBy { it.workPresentation(localeTag).title }
    )

/**
 * 保证分组不会遗漏控制面后来登记的新项目：未显式归类的项目统一进入“其他项目”。
 */
fun List<WorkspaceProject>.groupedForPersonalWorkbench(
    localeTag: String = Locale.getDefault().toLanguageTag()
): List<WorkspaceProjectGroup> =
    PersonalWorkbenchGroupId.values().mapNotNull { groupId ->
        val projects = filter { it.personalWorkbenchGroupId() == groupId }
            .forPersonalWorkbench(localeTag)
        projects.takeIf { it.isNotEmpty() }?.let {
            val presentation = groupId.presentation(localeTag)
            WorkspaceProjectGroup(
                id = groupId,
                title = presentation.title,
                description = presentation.description,
                projects = it
            )
        }
    }

fun WorkspaceProject.phaseLabel(): String = when (phase) {
    "active" -> "运行中"
    "building" -> "建设中"
    "usable" -> "可用"
    "unknown" -> "未声明"
    else -> phase.ifBlank { "未声明" }
}

fun String.progressStageLabel(): String = when (lowercase(Locale.ROOT)) {
    "active", "usable", "ready" -> "可用"
    "building" -> "建设中"
    "blocked" -> "已阻塞"
    "failed" -> "失败"
    "unassessed" -> "信息待补齐"
    "unknown", "" -> "未声明"
    else -> this
}
