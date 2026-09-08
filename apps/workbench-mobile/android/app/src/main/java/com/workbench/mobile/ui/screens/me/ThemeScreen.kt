package com.workbench.mobile.ui.screens.me

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import com.workbench.mobile.ui.theme.Spacing
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.WeChatPageBg
import com.workbench.mobile.ui.theme.WeChatCardBg
import com.workbench.mobile.ui.theme.WeChatInk
import com.workbench.mobile.ui.theme.DarkBackground
import com.workbench.mobile.ui.theme.DarkTextPrimary

private enum class ThemeMode(val label: String, val desc: String) {
    System("跟随系统", "与设备外观保持一致"),
    Light("浅色", "始终使用浅色界面"),
    Dark("深色", "始终使用深色界面")
}

/**
 * 主题外观二级页 — 跟随系统 / 浅色 / 深色。
 */
@Composable
fun ThemeScreen(onBack: () -> Unit) {
    var selected by remember { mutableStateOf(ThemeMode.System) }

    MeSubScaffold(title = "主题外观", onBack = onBack) {
        MeSectionGap()
        MeGroup {
            ThemeMode.entries.forEachIndexed { index, mode ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { selected = mode }
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s3_5),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3)
                ) {
                    ThemePreviewDot(mode)
                    Column(modifier = Modifier.weight(1f)) {
                        Text(mode.label, style = MaterialTheme.typography.bodyLarge)
                        Text(
                            mode.desc,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (selected == mode) {
                        Icon(
                            Icons.Filled.Check,
                            contentDescription = "已选",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
                if (index < ThemeMode.entries.lastIndex) MeDivider()
            }
        }
    }
}

@Composable
private fun ThemePreviewDot(mode: ThemeMode) {
    val bg = when (mode) {
        ThemeMode.System -> WeChatPageBg
        ThemeMode.Light -> WeChatCardBg
        ThemeMode.Dark -> DarkBackground
    }
    val fg = when (mode) {
        ThemeMode.Dark -> DarkTextPrimary
        else -> WeChatInk
    }
    Box(
        modifier = Modifier
            .size(Size.previewDot)
            .clip(RoundedCornerShape(Radius.sm))
            .background(bg)
            .border(Spacing.px, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f), RoundedCornerShape(Radius.sm)),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .size(Spacing.s3)
                .clip(CircleShape)
                .background(fg)
        )
    }
}
