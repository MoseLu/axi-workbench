package com.workbench.mobile.ui.screens.me

import android.os.Build
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing

/** 设备管理：先展示可从本机读取的真实设备，其他设备由会话服务同步。 */
@Composable
fun DevicesScreen(onBack: () -> Unit) {
    val deviceName = remember {
        listOf(Build.MANUFACTURER, Build.MODEL)
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
            .joinToString(" ")
            .ifBlank { "Android 设备" }
    }
    val platform = remember { "Android ${Build.VERSION.RELEASE}" }

    MeSubScaffold(title = "设备管理", onBack = onBack) {
        MeSectionGap()
        MeGroup {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3_5),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3)
            ) {
                Icon(
                    Icons.Filled.PhoneAndroid,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(Spacing.s1).height(Size.icon3xl)
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(deviceName, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                    Spacer(Modifier.height(Spacing.s0_5))
                    Text(
                        "$platform · 当前设备",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        MeSectionGap()
        MeHint("其他已登录设备会在账户会话同步接入后显示。")
    }
}
