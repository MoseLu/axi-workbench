package com.workbench.mobile.ui.screens.me

import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.workbench.mobile.R
import com.workbench.mobile.ui.theme.Spacing
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Size
import java.io.File

/**
 * 个人信息二级页。
 * 昵称/邮箱/手机号 → 进入微信式全屏三级编辑页（非弹窗）；
 * 头像 → 全屏相册。
 */
@Composable
fun AccountInfoScreen(
    onBack: () -> Unit,
    onEditNickname: () -> Unit,
    onEditEmail: () -> Unit,
    onEditPhone: () -> Unit,
    viewModel: ProfileViewModel = hiltViewModel()
) {
    val profile by viewModel.profile.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showAlbum by remember { mutableStateOf(false) }

    fun applyAvatar(uri: Uri) {
        viewModel.setAvatar(uri) { ok ->
            if (!ok) {
                Toast.makeText(context, "头像更新失败", Toast.LENGTH_SHORT).show()
            }
        }
    }

    if (showAlbum) {
        FullScreenAlbumPicker(
            onPicked = { uri ->
                showAlbum = false
                applyAvatar(uri)
            },
            onDismiss = { showAlbum = false }
        )
    }

    MeSubScaffold(title = "个人信息", onBack = onBack) {
        MeSectionGap()

        MeGroup {
            // 头像行：右侧头像 + 小箭头；点击进入全屏相册
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(Size.avatarRow)
                    .clickable { showAlbum = true }
                    .padding(horizontal = Spacing.s4),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("头像", style = MaterialTheme.typography.bodyLarge)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ProfileAvatar(
                        avatarPath = profile.avatarPath,
                        size = Size.avatarSm
                    )
                    Spacer(Modifier.width(Spacing.s2))
                    Icon(
                        Icons.Filled.ChevronRight,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            MeDivider()
            MeNavRow(
                "昵称",
                value = profile.nickname,
                showChevron = true,
                onClick = onEditNickname
            )
            MeDivider()
            MeNavRow(
                "邮箱",
                value = profile.email,
                showChevron = true,
                onClick = onEditEmail
            )
            MeDivider()
            MeNavRow(
                "手机号",
                value = profile.phoneDisplay,
                showChevron = true,
                onClick = onEditPhone
            )
        }

        MeSectionGap()

        MeGroup {
            MeNavRow("WorkBench ID", value = profile.workbenchId, showChevron = false)
            MeDivider()
            MeNavRow("注册时间", value = profile.registeredAt, showChevron = false)
            MeDivider()
            MeNavRow("账号状态", value = profile.status, showChevron = false)
        }
    }
}

@Composable
fun ProfileAvatar(
    avatarPath: String,
    size: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(Radius.sm)
    val mod = modifier
        .size(size)
        .clip(shape)
    if (avatarPath.isNotBlank() && File(avatarPath).exists()) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(File(avatarPath))
                .crossfade(true)
                .build(),
            contentDescription = "头像",
            contentScale = ContentScale.Crop,
            modifier = mod
        )
    } else {
        Image(
            painter = painterResource(R.drawable.avatar_me),
            contentDescription = "头像",
            contentScale = ContentScale.Crop,
            modifier = mod
        )
    }
}
