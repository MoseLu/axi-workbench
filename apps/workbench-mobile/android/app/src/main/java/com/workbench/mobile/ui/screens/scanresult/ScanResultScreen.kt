package com.workbench.mobile.ui.screens.scanresult

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material.icons.outlined.QrCode
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.ui.theme.Spacing
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Size

/**
 * 扫一扫结果页
 * 显示二维码原始内容 + 操作按钮（打开 URL / 复制 / 分享）
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanResultScreen(
    rawValue: String,
    onBack: () -> Unit,
    viewModel: ScanResultViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()

    // 首次进入解析一次
    androidx.compose.runtime.LaunchedEffect(rawValue) {
        viewModel.parse(rawValue)
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("扫码结果", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = Spacing.s6, vertical = Spacing.s8)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(Spacing.s5)
        ) {
            // 类型 Hero
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3)
            ) {
                Box(
                    modifier = Modifier
                        .size(Size.row)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = state.icon,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(Size.icon3xl)
                    )
                }
                Column {
                    Text(
                        text = state.typeLabel,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Text(
                        text = state.subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // 内容卡片
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(Radius.md),
                color = MaterialTheme.colorScheme.surface,
                border = androidx.compose.foundation.BorderStroke(
                    Spacing.px, MaterialTheme.colorScheme.outline
                )
            ) {
                Text(
                    text = rawValue,
                    modifier = Modifier.padding(Spacing.s4),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            // 操作按钮
            if (state.isUrl) {
                ActionButton(
                    icon = Icons.Outlined.OpenInNew,
                    label = "打开链接",
                    onClick = {
                        openUrl(context, rawValue)
                    }
                )
            }
            ActionButton(
                icon = Icons.Outlined.ContentCopy,
                label = "复制内容",
                onClick = {
                    copyToClipboard(context, rawValue)
                }
            )
            ActionButton(
                icon = Icons.Outlined.Share,
                label = "分享",
                onClick = {
                    shareText(context, rawValue)
                }
            )
        }
    }
}

@Composable
private fun ActionButton(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit
) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(Size.bar),
        shape = RoundedCornerShape(Radius.sm)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(Size.iconMd)
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(label, color = MaterialTheme.colorScheme.onSurface)
    }
}

// ============== 工具 ==============
private fun openUrl(context: Context, url: String) {
    val normalized = if (url.startsWith("http://") || url.startsWith("https://")) url else "https://$url"
    runCatching {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(normalized)))
    }
}

private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("WorkBench QR", text))
}

private fun shareText(context: Context, text: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    runCatching {
        context.startActivity(Intent.createChooser(intent, "分享扫码结果"))
    }
}
