package com.workbench.mobile.ui.screens.scanresult

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.QrCode
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject

data class ScanResultState(
    val isUrl: Boolean = false,
    val icon: ImageVector = Icons.Outlined.QrCode,
    val typeLabel: String = "二维码",
    val subtitle: String = "扫描结果"
)

/**
 * 扫码结果页 ViewModel
 * 解析 raw value 类型（URL / Email / Tel / Text），决定显示哪些操作按钮
 */
@HiltViewModel
class ScanResultViewModel @Inject constructor() : ViewModel() {

    private val _state = MutableStateFlow(ScanResultState())
    val state: StateFlow<ScanResultState> = _state.asStateFlow()

    fun parse(rawValue: String) {
        _state.update { detectType(rawValue.trim()) }
    }

    private fun detectType(rawValue: String): ScanResultState {
        val isUrl = Regex("^(https?|ftp|file)://[^\\s]+$", RegexOption.IGNORE_CASE).matches(rawValue)
            || (Regex("^[a-zA-Z0-9-]+\\.[a-zA-Z]{2,}(/.*)?$").matches(rawValue)
                && !rawValue.contains(' '))

        val isEmail = Regex("^[\\w.+-]+@[\\w-]+\\.[\\w.-]+$").matches(rawValue)
        val isTel = !isUrl && !isEmail &&
            Regex("^\\+?[\\d\\s\\-()]{6,}$").matches(rawValue) &&
            rawValue.any { it.isDigit() }

        return when {
            isEmail -> ScanResultState(
                isUrl = false,
                icon = Icons.Outlined.Mail,
                typeLabel = "电子邮件",
                subtitle = "邮箱地址"
            )
            isTel -> ScanResultState(
                isUrl = false,
                icon = Icons.Outlined.Phone,
                typeLabel = "电话号码",
                subtitle = "联系号码"
            )
            isUrl -> ScanResultState(
                isUrl = true,
                icon = Icons.Outlined.Link,
                typeLabel = "网址",
                subtitle = "链接地址"
            )
            rawValue.length > 200 -> ScanResultState(
                isUrl = false,
                icon = Icons.Outlined.Description,
                typeLabel = "文本",
                subtitle = "较长内容"
            )
            else -> ScanResultState(
                isUrl = false,
                icon = Icons.Outlined.QrCode,
                typeLabel = "文本",
                subtitle = "二维码内容"
            )
        }
    }
}
