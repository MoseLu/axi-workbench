package com.workbench.mobile.ui.screens.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.ui.components.WorkBenchEmptyState
import com.workbench.mobile.ui.components.WorkspaceProjectDivider
import com.workbench.mobile.ui.components.WorkspaceProjectRow
import com.workbench.mobile.ui.components.WorkspaceStatusNoticeRow
import com.workbench.mobile.ui.components.WorkspaceStateContent
import com.workbench.mobile.ui.screens.workspace.WorkspaceViewModel
import com.workbench.mobile.ui.screens.workspace.forPersonalWorkbench
import com.workbench.mobile.ui.screens.workspace.matchesWorkspaceQuery
import com.workbench.mobile.ui.theme.FontSize
import com.workbench.mobile.ui.theme.Spacing
import com.workbench.mobile.ui.theme.Size

/** 全局搜索只检索当前设备从控制面同步到的工作区事实。 */
@Composable
fun SearchScreen(
    onBack: () -> Unit,
    onStatusClick: () -> Unit,
    onProjectClick: (String) -> Unit,
    viewModel: WorkspaceViewModel = hiltViewModel()
) {
    var query by remember { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(Size.bar)
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = Spacing.s1),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack, modifier = Modifier.size(Size.hit)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回", tint = MaterialTheme.colorScheme.onBackground)
            }
            Row(
                modifier = Modifier
                    .weight(1f)
                    .height(Size.hitSm)
                    .clip(RoundedCornerShape(Spacing.s1_5))
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(horizontal = Spacing.s2_5),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Filled.Search,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(Size.iconMd)
                )
                Spacer(Modifier.width(Spacing.s2))
                BasicTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.weight(1f).focusRequester(focusRequester),
                    singleLine = true,
                    textStyle = TextStyle(fontSize = FontSize.base, color = MaterialTheme.colorScheme.onSurface),
                    cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { keyboard?.hide() }),
                    decorationBox = { inner ->
                        if (query.isEmpty()) {
                            Text("搜索工作区项目、能力与摘要", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = FontSize.base)
                        }
                        inner()
                    }
                )
                if (query.isNotEmpty()) {
                    IconButton(onClick = { query = "" }, modifier = Modifier.size(Size.hitSm)) {
                        Icon(Icons.Filled.Close, contentDescription = "清除", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(Size.iconMd))
                    }
                }
            }
            TextButton(onClick = onBack) { Text("取消", color = MaterialTheme.colorScheme.primary) }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))

        WorkspaceStateContent(
            state = state,
            onRetry = viewModel::refresh,
            modifier = Modifier.fillMaxWidth().weight(1f)
        ) { snapshot, notice ->
            val results = snapshot.projects.forPersonalWorkbench().filter { it.matchesWorkspaceQuery(query) }
            Column(modifier = Modifier.fillMaxSize()) {
                if (notice != null) {
                    WorkspaceStatusNoticeRow(
                        notice = notice,
                        onRetry = viewModel::refresh,
                        onViewStatus = onStatusClick
                    )
                }
                when {
                    query.isBlank() -> WorkBenchEmptyState(
                        title = "已同步 ${snapshot.summary.total} 个工作区项目",
                        description = "输入项目名称、能力或摘要关键词进行全局检索。",
                        modifier = Modifier.weight(1f)
                    )

                    results.isEmpty() -> WorkBenchEmptyState(
                        title = "未找到结果",
                        description = "已同步项目中没有与「${query.trim()}」匹配的内容。",
                        modifier = Modifier.weight(1f)
                    )

                    else -> LazyColumn(modifier = Modifier.weight(1f)) {
                        items(results, key = { it.id }) { project ->
                            WorkspaceProjectRow(project = project, onClick = { onProjectClick(project.id) })
                            WorkspaceProjectDivider()
                        }
                    }
                }
            }
        }
    }
}
