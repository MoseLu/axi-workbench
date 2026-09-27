package com.workbench.mobile.ui.screens.settings

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.workbench.mobile.BuildConfig
import com.workbench.mobile.data.auth.ControlPlaneSessionStore
import com.workbench.mobile.data.auth.TokenStore
import com.workbench.mobile.data.network.GatewayEndpointStore
import com.workbench.mobile.ui.screens.me.MeDivider
import com.workbench.mobile.ui.screens.me.MeGroup
import com.workbench.mobile.ui.screens.me.MeHint
import com.workbench.mobile.ui.screens.me.MeNavRow
import com.workbench.mobile.ui.screens.me.MeSectionGap
import com.workbench.mobile.ui.screens.me.MeSubScaffold
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val tokenStore: TokenStore,
    private val controlPlaneSessionStore: ControlPlaneSessionStore,
    private val gatewayEndpointStore: GatewayEndpointStore
) : ViewModel() {
    private val _gatewayEndpoint = MutableStateFlow(gatewayEndpointStore.displayUrl)
    val gatewayEndpoint = _gatewayEndpoint.asStateFlow()

    init {
        viewModelScope.launch {
            gatewayEndpointStore.hydrate()
            _gatewayEndpoint.value = gatewayEndpointStore.displayUrl
        }
    }

    fun saveGatewayEndpoint(value: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                gatewayEndpointStore.save(value)
                _gatewayEndpoint.value = gatewayEndpointStore.displayUrl
                onSuccess()
            } catch (error: IllegalArgumentException) {
                onError(error.message ?: "网关地址无效")
            }
        }
    }

    fun logout(onComplete: () -> Unit) {
        viewModelScope.launch {
            tokenStore.clear()
            controlPlaneSessionStore.clear()
            onComplete()
        }
    }
}

/** 设置页只呈现已实现的本机设置与真实版本信息。 */
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showGatewayDialog by remember { mutableStateOf(false) }
    var gatewayDraft by remember { mutableStateOf("") }
    var gatewayError by remember { mutableStateOf<String?>(null) }
    val gatewayEndpoint by viewModel.gatewayEndpoint.collectAsState()

    LaunchedEffect(showGatewayDialog, gatewayEndpoint) {
        if (showGatewayDialog) {
            gatewayDraft = gatewayEndpoint
            gatewayError = null
        }
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("解除本机配对？") },
            text = { Text("解除后会清除本机设备密钥和工作区会话；下次打开时需在 Web 工作台重新批准配对。") },
            confirmButton = {
                TextButton(onClick = {
                    showLogoutDialog = false
                    viewModel.logout(onLogout)
                }) {
                    Text("解除配对", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("取消")
                }
            }
        )
    }

    if (showGatewayDialog) {
        AlertDialog(
            onDismissRequest = { showGatewayDialog = false },
            title = { Text("本机网关地址") },
            text = {
                androidx.compose.foundation.layout.Column {
                    Text("手机与开发机需在同一可互通网络。只填写 API Gateway 地址，不要填写控制面端口。")
                    OutlinedTextField(
                        value = gatewayDraft,
                        onValueChange = { gatewayDraft = it; gatewayError = null },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = Spacing.s3),
                        label = { Text("网关地址") },
                        placeholder = { Text("http://192.168.1.8:8088") },
                        singleLine = true,
                        isError = gatewayError != null
                    )
                    gatewayError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.saveGatewayEndpoint(
                        gatewayDraft,
                        onSuccess = { showGatewayDialog = false },
                        onError = { gatewayError = it }
                    )
                }) {
                    Text("保存")
                }
            },
            dismissButton = {
                TextButton(onClick = { showGatewayDialog = false }) { Text("取消") }
            }
        )
    }

    MeSubScaffold(title = "设置", onBack = onBack) {
        MeSectionGap()
        MeHint("通用")
        MeGroup {
            MeNavRow("语言", value = "简体中文", showChevron = false)
            MeDivider()
            MeNavRow("本机网关", value = gatewayEndpoint, onClick = { showGatewayDialog = true })
        }

        MeSectionGap()
        MeHint("关于")
        MeGroup {
            MeNavRow("当前版本", value = BuildConfig.VERSION_NAME, showChevron = false)
            MeDivider()
            MeNavRow("用户协议", onClick = {})
            MeDivider()
            MeNavRow("隐私政策", onClick = {})
            MeDivider()
            MeNavRow("开源许可", onClick = {})
        }

        MeSectionGap()
        MeGroup {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
            ) {
                OutlinedButton(
                    onClick = { showLogoutDialog = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(Size.bar),
                    shape = RoundedCornerShape(Radius.sm),
                    border = androidx.compose.foundation.BorderStroke(
                        Spacing.px,
                        MaterialTheme.colorScheme.error.copy(alpha = 0.35f)
                    )
                ) {
                    Text("解除本机配对", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
