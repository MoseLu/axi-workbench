package com.workbench.mobile.ui.screens.manual

import android.util.Log
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.workbench.mobile.data.api.AuthApi
import com.workbench.mobile.data.api.dto.LoginRequest
import com.workbench.mobile.data.auth.TokenStore
import com.workbench.mobile.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Size

/**
 * DEPRECATED native email + password login screen.
 *
 * See `apps/workbench-mobile/docs/decisions/0001-kotlin-manual-login.md`.
 *
 * The supported mobile login path is the JS surface in
 * `apps/workbench-mobile/src/pages/LoginPage.tsx`, which uses
 * `requestEmailCode` + `confirmEmailCode` (opaque email challenge) and an
 * Ed25519-paired device confirmation via
 * `apps/workbench-mobile/src/lib/mobileControl.ts`. That path is guarded by
 * `scripts/verify-mobile-contracts.mjs`.
 *
 * This Compose screen is intentionally NOT registered in
 * `WorkBenchNavHost.kt` and has no caller. It is kept on disk so a future
 * contributor can see what was removed and so the contract guard can flag any
 * attempt to re-introduce a password field on the Kotlin side. Do not wire
 * this back into the navigation graph; doing so will break the
 * mobile-login parity invariant.
 */
@Deprecated(
    message = "Kotlin email/password login is deprecated. Use the mobile JS LoginPage (email challenge) path. See docs/decisions/0001-kotlin-manual-login.md.",
    level = DeprecationLevel.WARNING
)
data class EmailLoginState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false
)

@HiltViewModel
@Deprecated(
    message = "Kotlin email/password login is deprecated. See docs/decisions/0001-kotlin-manual-login.md.",
    level = DeprecationLevel.WARNING
)
class EmailLoginViewModel @Inject constructor(
    private val authApi: AuthApi,
    private val tokenStore: TokenStore
) : ViewModel() {

    private val _state = MutableStateFlow(EmailLoginState())
    val state: StateFlow<EmailLoginState> = _state.asStateFlow()

    fun login(email: String, password: String) {
        if (_state.value.isLoading) return
        _state.update { it.copy(isLoading = true, error = null) }

        viewModelScope.launch {
            try {
                val response = authApi.login(LoginRequest(email = email.trim(), password = password))
                tokenStore.save(
                    accessToken = response.tokens.accessToken,
                    refreshToken = response.tokens.refreshToken,
                    userId = response.user.id,
                    userEmail = response.user.email,
                    userName = response.user.name
                )
                _state.update { it.copy(isLoading = false, success = true) }
            } catch (e: Exception) {
                Log.w("WB_LOGIN", "login failed", e)
                val msg = when (e) {
                    is retrofit2.HttpException -> when (e.code()) {
                        401 -> "邮箱或密码错误"
                        else -> "登录失败 (${e.code()})"
                    }
                    is java.net.ConnectException, is java.net.SocketTimeoutException ->
                        "无法连接服务器，请检查网络"
                    else -> e.message ?: "登录失败"
                }
                _state.update { it.copy(isLoading = false, error = msg) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
@Deprecated(
    message = "Kotlin manual login is deprecated. See docs/decisions/0001-kotlin-manual-login.md.",
    level = DeprecationLevel.WARNING
)
fun ManualLoginScreen(
    onLoginSuccess: () -> Unit,
    onBack: () -> Unit,
    viewModel: EmailLoginViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    LaunchedEffect(state.success) {
        if (state.success) onLoginSuccess()
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("邮箱密码登录", fontWeight = FontWeight.SemiBold) },
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
                .padding(horizontal = Spacing.s6, vertical = Spacing.s8),
            verticalArrangement = Arrangement.spacedBy(Spacing.s6)
        ) {
            Text(
                text = "使用 Axi 工作台账号登录",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "登录后可扫描电脑端二维码授权登录 Web 端",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(Spacing.s4))

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("邮箱") },
                placeholder = { Text("you@company.com") },
                singleLine = true,
                shape = RoundedCornerShape(Radius.sm),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next
                ),
                enabled = !state.isLoading
            )

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("密码") },
                placeholder = { Text("********") },
                singleLine = true,
                shape = RoundedCornerShape(Radius.sm),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                enabled = !state.isLoading
            )

            if (state.error != null) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(Radius.sm)
                ) {
                    Text(
                        text = state.error!!,
                        modifier = Modifier.padding(Spacing.s4),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }

            Spacer(Modifier.weight(1f))

            Button(
                onClick = { viewModel.login(email, password) },
                enabled = !state.isLoading && email.isNotBlank() && password.isNotBlank(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(Size.bar),
                shape = RoundedCornerShape(Radius.sm),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(Spacing.s5),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = Spacing.s0_5
                    )
                } else {
                    Text("登录", color = MaterialTheme.colorScheme.onPrimary)
                }
            }

            Text(
                text = "登录后请用相机扫描电脑端二维码，完成 Web 端登录授权",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}
