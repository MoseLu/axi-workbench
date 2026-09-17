package com.workbench.mobile.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import com.workbench.mobile.data.api.dto.WorkspaceAttentionItem
import com.workbench.mobile.data.api.dto.WorkspaceProject
import com.workbench.mobile.ui.screens.workspace.healthPresentation
import com.workbench.mobile.ui.screens.workspace.presentation
import com.workbench.mobile.ui.screens.workspace.workPresentation
import com.workbench.mobile.ui.screens.workspace.workspaceHealthPresentation
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing

/** 待办原因说明：颜色只辅助识别，具体动作始终由文字表达。 */
@Composable
fun WorkspaceStatusLegendCard(modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Radius.md),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(Spacing.px, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Column(modifier = Modifier.padding(Spacing.s4)) {
            Text(
                text = "待办说明",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.padding(top = Spacing.s2))
            StatusLegendRow("blocked", "先处理阻塞", "项目不能继续，先确认阻塞原因。")
            StatusLegendRow("attention", "补齐交接或确认进展", "确认当前进展、未完成事项和下一步。")
            StatusLegendRow("stale", "重新核验", "上一次核验已失效，需要重新确认项目状态。")
            StatusLegendRow("unknown", "补齐完成信息", "缺少判断项目是否完成的信息。")
        }
    }
}

@Composable
private fun StatusLegendRow(health: String, label: String, description: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically
    ) {
        WorkspaceHealthBadge(health = health)
        Spacer(Modifier.width(Spacing.s2))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Medium)
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun WorkspaceStatusSectionHeader(
    health: String,
    count: Int,
    modifier: Modifier = Modifier
) {
    val presentation = workspaceHealthPresentation(health)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically
    ) {
        WorkspaceHealthBadge(health = health)
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = "${presentation.label} · $count 项",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold
        )
    }
}

/** 一张状态卡只承载一个项目及其控制面事实，点击进入项目详情。 */
@Composable
fun WorkspaceStatusProjectCard(
    project: WorkspaceProject,
    attentionItems: List<WorkspaceAttentionItem>,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val work = project.workPresentation()
    val health = project.healthPresentation()
    val detail = attentionItems.firstOrNull()?.presentation()?.detail ?: health.description
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = "${work.title}，${health.label}，$detail"
            },
        shape = RoundedCornerShape(Radius.md),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(Spacing.px, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Column(modifier = Modifier.padding(Spacing.s4)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = work.title,
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
                Spacer(Modifier.width(Spacing.s2))
                WorkspaceHealthBadge(project)
                Spacer(Modifier.width(Spacing.s1))
                Icon(
                    Icons.Filled.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(Size.iconMd)
                )
            }

            if (attentionItems.isEmpty()) {
                Text(
                    text = health.description,
                    modifier = Modifier.padding(top = Spacing.s3),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                attentionItems.forEachIndexed { index, item ->
                    val attention = item.presentation()
                    HorizontalDivider(
                        modifier = Modifier.padding(top = Spacing.s3, bottom = Spacing.s2),
                        color = MaterialTheme.colorScheme.outlineVariant
                    )
                    Text(
                        text = attention.title,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = attention.detail,
                        modifier = Modifier.padding(top = Spacing.s0_5),
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
                    if (index < attentionItems.lastIndex) {
                        Spacer(Modifier.padding(top = Spacing.s1))
                    }
                }
            }
        }
    }
}

/** 没有对应项目的运行时任务或审批，同样保留在状态页，不静默丢弃。 */
@Composable
fun WorkspaceRuntimeAttentionCard(
    item: WorkspaceAttentionItem,
    modifier: Modifier = Modifier
) {
    val attention = item.presentation()
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Radius.md),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(Spacing.px, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Column(modifier = Modifier.padding(Spacing.s4)) {
            Text(
                text = attention.title,
                style = MaterialTheme.typography.titleSmall,
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
                    modifier = Modifier.padding(top = Spacing.s2),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
