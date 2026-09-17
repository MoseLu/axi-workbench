package com.workbench.mobile.ui.screens.me

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.ui.theme.FontSize
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing
import com.workbench.mobile.ui.theme.WeChatCardBg
import com.workbench.mobile.ui.theme.WeChatDoneDisabled
import com.workbench.mobile.ui.theme.WeChatDoneEnabled
import com.workbench.mobile.ui.theme.WeChatGreen
import com.workbench.mobile.ui.theme.WeChatInk
import com.workbench.mobile.ui.theme.WeChatPlaceholder

enum class ProfileEditField {
    Nickname,
    Email,
    Phone
}

/**
 * 微信式三级编辑页：全屏灰底 + 白底单行输入 + 顶栏「完成」。
 * 「完成」：未修改时灰色不可点；修改后变绿可点；矩形文字按钮，非胶囊。
 * 样式全部来自 design tokens。
 */
@Composable
fun ProfileFieldEditScreen(
    field: ProfileEditField,
    onBack: () -> Unit,
    viewModel: ProfileViewModel = hiltViewModel()
) {
    val profile by viewModel.profile.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val focusRequester = remember { FocusRequester() }

    val title = when (field) {
        ProfileEditField.Nickname -> "设置名字"
        ProfileEditField.Email -> "设置邮箱"
        ProfileEditField.Phone -> "设置手机号"
    }
    val placeholder = when (field) {
        ProfileEditField.Nickname -> "请输入名字"
        ProfileEditField.Email -> "name@example.com"
        ProfileEditField.Phone -> "请输入手机号"
    }
    val keyboard = when (field) {
        ProfileEditField.Email -> KeyboardType.Email
        ProfileEditField.Phone -> KeyboardType.Phone
        ProfileEditField.Nickname -> KeyboardType.Text
    }
    val initial = when (field) {
        ProfileEditField.Nickname -> profile.nickname
        ProfileEditField.Email -> profile.email
        ProfileEditField.Phone -> profile.phone
    }

    var draft by remember(field, initial) { mutableStateOf(initial) }

    val dirty = draft != initial
    val canSave = when (field) {
        ProfileEditField.Nickname -> dirty && draft.trim().isNotEmpty()
        else -> dirty
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    fun save() {
        if (!canSave) return
        when (field) {
            ProfileEditField.Nickname -> {
                if (draft.trim().isEmpty()) {
                    Toast.makeText(context, "名字不能为空", Toast.LENGTH_SHORT).show()
                    return
                }
                viewModel.setNickname(draft)
            }
            ProfileEditField.Email -> {
                val v = draft.trim()
                if (v.isNotEmpty() && (!v.contains("@") || !v.contains("."))) {
                    Toast.makeText(context, "请输入有效邮箱", Toast.LENGTH_SHORT).show()
                    return
                }
                viewModel.setEmail(v)
            }
            ProfileEditField.Phone -> {
                val v = draft.trim()
                if (v.isNotEmpty() && v.length < 6) {
                    Toast.makeText(context, "手机号格式不正确", Toast.LENGTH_SHORT).show()
                    return
                }
                viewModel.setPhone(v)
            }
        }
        onBack()
    }

    MeSubScaffold(
        title = title,
        onBack = onBack,
        scrollable = false,
        trailing = {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .widthIn(min = Size.row)
                    .clickable(
                        enabled = canSave,
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        role = Role.Button,
                        onClick = { save() }
                    )
                    .padding(horizontal = Spacing.s3),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "完成",
                    color = if (canSave) WeChatDoneEnabled else WeChatDoneDisabled,
                    fontSize = FontSize.lg,
                    fontWeight = FontWeight.Normal
                )
            }
        }
    ) {
        MeSectionGap()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(Size.row)
                .background(WeChatCardBg)
                .padding(horizontal = Spacing.s4),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(modifier = Modifier.weight(1f)) {
                if (draft.isEmpty()) {
                    Text(
                        text = placeholder,
                        color = WeChatPlaceholder,
                        fontSize = FontSize.xl
                    )
                }
                BasicTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    singleLine = true,
                    textStyle = TextStyle(
                        color = WeChatInk,
                        fontSize = FontSize.xl
                    ),
                    cursorBrush = SolidColor(WeChatGreen),
                    keyboardOptions = KeyboardOptions(keyboardType = keyboard),
                    modifier = Modifier
                        .fillMaxWidth()
                        .focusRequester(focusRequester)
                )
            }
            if (draft.isNotEmpty()) {
                IconButton(
                    onClick = { draft = "" },
                    modifier = Modifier.size(Size.hitSm)
                ) {
                    Icon(
                        Icons.Filled.Cancel,
                        contentDescription = "清除",
                        tint = WeChatPlaceholder,
                        modifier = Modifier.size(Size.iconMd)
                    )
                }
            }
        }
    }
}
