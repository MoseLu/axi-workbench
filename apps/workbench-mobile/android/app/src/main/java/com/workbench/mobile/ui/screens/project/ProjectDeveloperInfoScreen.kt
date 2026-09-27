package com.workbench.mobile.ui.screens.project

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.data.api.dto.WorkspaceConfigurationSection
import com.workbench.mobile.data.api.dto.WorkspaceProject
import com.workbench.mobile.ui.screens.me.MeSectionGap
import com.workbench.mobile.ui.screens.me.MeSubScaffold
import com.workbench.mobile.ui.screens.workspace.WorkspaceViewModel
import com.workbench.mobile.ui.screens.workspace.workspaceSnapshotOrNull
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Spacing

/** 只有在主动进入二级页后才展示路径、规范名称、原始摘要与证据字段。 */
@Composable
fun ProjectDeveloperInfoScreen(
    projectId: String,
    onBack: () -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val project = state.workspaceSnapshotOrNull()?.projects?.find { it.id == projectId }

    MeSubScaffold(title = "开发信息", onBack = onBack) {
        MeSectionGap()
        if (project == null) {
            DeveloperCard("项目不可用") {
                Text("当前没有该项目的同步快照。", style = MaterialTheme.typography.bodyMedium)
            }
        } else {
            DeveloperIdentityCard(project)
            MeSectionGap()
            DeveloperEvidenceCard(project)
            if (project.capabilities.isNotEmpty()) {
                MeSectionGap()
                DeveloperListCard("能力标识", project.capabilities)
            }
            project.configuration.forEach { section ->
                MeSectionGap()
                DeveloperConfigurationCard(section)
            }
        }
    }
}

@Composable
private fun DeveloperIdentityCard(project: WorkspaceProject) {
    DeveloperCard("项目标识") {
        DeveloperRow("规范名称", project.name.ifBlank { project.id })
        DeveloperDivider()
        DeveloperRow("项目 ID", project.id)
        DeveloperDivider()
        DeveloperRow("原因码", project.reasonCode.ifBlank { "未提供" })
    }
}

@Composable
private fun DeveloperEvidenceCard(project: WorkspaceProject) {
    DeveloperCard("证据详情") {
        Text(
            text = project.progress.summary.ifBlank { "控制面未提供原始进展摘要。" },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (project.progress.remaining.isNotEmpty()) {
            Spacer(Modifier.padding(top = Spacing.s3))
            Text("原始后续项", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Medium)
            project.progress.remaining.forEach { item ->
                Text(
                    text = "• $item",
                    modifier = Modifier.padding(top = Spacing.s1),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun DeveloperListCard(title: String, values: List<String>) {
    DeveloperCard(title) {
        values.forEachIndexed { index, value ->
            Text(value, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (index < values.lastIndex) DeveloperDivider()
        }
    }
}

@Composable
private fun DeveloperConfigurationCard(section: WorkspaceConfigurationSection) {
    DeveloperCard(section.title) {
        section.facts.forEachIndexed { index, fact ->
            DeveloperRow(fact.label, fact.value)
            if (index < section.facts.lastIndex) DeveloperDivider()
        }
    }
}

@Composable
private fun DeveloperCard(title: String, content: @Composable () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
        shape = RoundedCornerShape(Radius.md),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(Spacing.px, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Column(modifier = Modifier.padding(Spacing.s4)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.padding(top = Spacing.s3))
            content()
        }
    }
}

@Composable
private fun DeveloperRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Text(label, modifier = Modifier.weight(0.34f), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(Spacing.s2))
        Text(value, modifier = Modifier.weight(0.66f), style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun DeveloperDivider() {
    androidx.compose.material3.HorizontalDivider(
        modifier = Modifier.padding(vertical = Spacing.s2),
        color = MaterialTheme.colorScheme.outlineVariant
    )
}
