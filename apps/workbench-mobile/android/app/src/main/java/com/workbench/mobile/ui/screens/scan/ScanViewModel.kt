package com.workbench.mobile.ui.screens.scan

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.workbench.mobile.data.api.ControlPlaneApi
import com.workbench.mobile.data.api.dto.QrPairScanRequest
import com.workbench.mobile.data.api.dto.ControlPlaneTokenRequest
import com.workbench.mobile.data.api.dto.WebLoginQrScanRequest
import com.workbench.mobile.data.api.dto.WorkspaceNonceRequest
import com.workbench.mobile.data.auth.ControlPlaneCrypto
import com.workbench.mobile.data.auth.ControlPlaneSessionStore
import com.workbench.mobile.data.auth.DeviceInfo
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject

/**
 * 扫码状态
 * - SCANNING：摄像头工作中，等待识别
 * - AUTHORIZING：识别到 WorkBench Web QR，正在以已登录设备会话授权
 * - AUTHORIZED：Web 端已授权（短暂 Toast 提示）
 * - ERROR：识别/授权失败
 * - PERMISSION_REQUIRED：相机权限被拒
 */
enum class ScanStatus { PERMISSION_REQUIRED, SCANNING, AUTHORIZING, AUTHORIZED, ERROR }

/**
 * 扫码事件。ScanScreen 收集后决定跳转/弹 Toast。
 * - GeneralScan：识别到非 WorkBench QR（任何 URL/文本/名片），UI 跳 ScanResultScreen
 * - AuthorizeSuccess：WorkBench Web 授权成功，UI 弹 Toast 留在扫一扫
 * - AuthorizeFailed：WorkBench Web 授权失败（含本机尚未完成设备登录），UI 弹错误
 * - DevicePairingScanned：手机已经扫码登记，仍需 Web owner 明确确认设备
 */
sealed class ScanEvent {
    data class GeneralScan(val rawValue: String) : ScanEvent()
    object AuthorizeSuccess : ScanEvent()
    data class AuthorizeFailed(val message: String) : ScanEvent()
    data class DevicePairingScanned(val deviceName: String) : ScanEvent()
}

data class ScanError(
    val title: String,
    val desc: String
)

data class ScanState(
    val status: ScanStatus = ScanStatus.SCANNING,
    val statusText: String = "将二维码放入框内，自动识别",
    val cameraReady: Boolean = false,
    val torchEnabled: Boolean = false,
    val torchOn: Boolean = false,
    val error: ScanError? = null,
)

@Serializable
internal data class WebLoginQrPayload(
    val kind: String,
    val webLoginId: String,
    val scanToken: String
)

/**
 * Web “设备管理”页面生成的短期一次性扫码载荷。它不含浏览器会话、owner 密钥或
 * 控制面地址；scanToken 只能登记该设备，真正绑定仍需 Web 端确认。
 */
@Serializable
internal data class DevicePairingQrPayload(
    val kind: String,
    val webPairingId: String,
    val scanToken: String
)

private val pairingQrJson = Json { ignoreUnknownKeys = true; explicitNulls = false }
private val webPairingIdPattern = Regex("^webpair_[A-Za-z0-9_-]{16,}$")
private val webLoginIdPattern = Regex("^weblogin_[A-Za-z0-9_-]{16,}$")
private val pairingScanTokenPattern = Regex("^[A-Za-z0-9_-]{32,}$")

/** Kept pure so the QR format can be regression-tested without a camera or network. */
internal fun parseDevicePairingQrPayload(rawValue: String): DevicePairingQrPayload? {
    val payload = runCatching {
        pairingQrJson.decodeFromString<DevicePairingQrPayload>(rawValue.trim())
    }.getOrNull() ?: return null
    return payload.takeIf {
        it.kind == "axi-mobile-pair-v1"
            && webPairingIdPattern.matches(it.webPairingId)
            && pairingScanTokenPattern.matches(it.scanToken)
    }
}

/** A browser login QR is authorized only by a phone that already holds a
 * paired Control Plane device session. Its poll credential stays on the Web
 * page and is intentionally absent from this camera payload. */
internal fun parseWebLoginQrPayload(rawValue: String): WebLoginQrPayload? {
    val payload = runCatching {
        pairingQrJson.decodeFromString<WebLoginQrPayload>(rawValue.trim())
    }.getOrNull() ?: return null
    return payload.takeIf {
        it.kind == "axi-web-login-v1"
            && webLoginIdPattern.matches(it.webLoginId)
            && pairingScanTokenPattern.matches(it.scanToken)
    }
}

@HiltViewModel
class ScanViewModel @Inject constructor(
    private val controlPlaneApi: ControlPlaneApi,
    private val controlPlaneSessionStore: ControlPlaneSessionStore,
    private val deviceInfo: DeviceInfo
) : ViewModel() {

    private val _state = MutableStateFlow(ScanState())
    val state: StateFlow<ScanState> = _state.asStateFlow()

    private val _events = Channel<ScanEvent>(capacity = Channel.BUFFERED)
    val events: Flow<ScanEvent> = _events.receiveAsFlow()

    private var lastScannedValue: String? = null

    fun onPermissionGranted() {
        _state.update {
            it.copy(
                status = ScanStatus.SCANNING,
                statusText = "将二维码放入框内，自动识别",
                cameraReady = true,
                error = null
            )
        }
    }

    fun onPermissionDenied() {
        _state.update {
            it.copy(
                status = ScanStatus.ERROR,
                statusText = "需要相机权限",
                cameraReady = false,
                error = ScanError(
                    title = "无法访问摄像头",
                    desc = "请在系统设置中允许使用相机"
                )
            )
        }
    }

    /**
     * 摄像头识别到任何二维码。
     * 通用扫一扫：识别到 WorkBench Web QR 自动授权，其他 QR 发 GeneralScan 事件由 UI 跳转。
     */
    fun onBarcodeDetected(rawValue: String) {
        // 防抖：同一值不重复触发；AUTHORIZING/AUTHORIZED 状态不处理
        val cur = _state.value
        if (cur.status == ScanStatus.AUTHORIZING || cur.status == ScanStatus.AUTHORIZED) return
        if (lastScannedValue == rawValue) return
        lastScannedValue = rawValue

        val devicePairingPayload = parseDevicePairingQrPayload(rawValue)
        val webLoginPayload = parseWebLoginQrPayload(rawValue)
        if (devicePairingPayload != null) {
            scanDevicePairing(devicePairingPayload)
        } else if (webLoginPayload != null) {
            // 识别到电脑登录 QR：仅已登录的本机设备会话可以批准它。
            authorizeWeb(webLoginPayload)
        } else {
            // 通用 QR → 跳转结果页
            viewModelScope.launch {
                _events.send(ScanEvent.GeneralScan(rawValue))
                // 短暂停留避免连续触发
                lastScannedValue = null
            }
        }
    }

    private fun scanDevicePairing(payload: DevicePairingQrPayload) {
        _state.update { it.copy(status = ScanStatus.AUTHORIZING, statusText = "正在登记本机配对...", error = null) }

        viewModelScope.launch {
            try {
                val deviceKey = ControlPlaneCrypto.ensureDevicePublicKey()
                val result = controlPlaneApi.scanWebPairing(
                    QrPairScanRequest(
                        webPairingId = payload.webPairingId,
                        scanToken = payload.scanToken,
                        publicKeyHex = deviceKey.publicKeyHex,
                        publicKeyAlgorithm = deviceKey.algorithm,
                        deviceName = deviceInfo.controlPlaneDeviceName
                    )
                )
                require(result.ok && !result.pairingId.isNullOrBlank() && !result.code.isNullOrBlank()) {
                    result.error ?: "控制面未返回配对事务"
                }
                controlPlaneSessionStore.savePendingPairing(
                    pairingId = requireNotNull(result.pairingId),
                    code = requireNotNull(result.code)
                )
                _state.update {
                    it.copy(
                        status = ScanStatus.AUTHORIZED,
                        statusText = "已扫码，请在网页确认设备配对",
                        error = null
                    )
                }
                _events.send(ScanEvent.DevicePairingScanned(deviceInfo.controlPlaneDeviceName))
            } catch (error: Exception) {
                Log.w("WB_SCAN", "scanDevicePairing failed", error)
                val message = when (error) {
                    is HttpException -> when (error.code()) {
                        400, 404, 410 -> "二维码已失效，请返回网页重新生成"
                        409 -> "二维码已被扫描，请返回网页查看设备状态"
                        401, 403 -> "本机网关拒绝了该配对请求"
                        else -> "服务器错误（${error.code()}）"
                    }
                    is IOException -> "无法连接本机工作台，请检查同一 Wi‑Fi 下的网关地址"
                    else -> error.message?.takeIf { it.isNotBlank() } ?: "扫码配对失败，请重试"
                }
                _events.send(ScanEvent.AuthorizeFailed(message))
                _state.update {
                    it.copy(
                        status = ScanStatus.ERROR,
                        statusText = message,
                        error = ScanError(title = "扫码配对失败", desc = message),
                        cameraReady = true
                    )
                }
                lastScannedValue = null
            }
        }
    }

    private fun authorizeWeb(payload: WebLoginQrPayload) {
        _state.update { it.copy(status = ScanStatus.AUTHORIZING, statusText = "正在授权 Web 端...", error = null) }

        viewModelScope.launch {
            try {
                ensurePairedDeviceAccessToken()
                val result = controlPlaneApi.approveWebLogin(
                    WebLoginQrScanRequest(
                        webLoginId = payload.webLoginId,
                        scanToken = payload.scanToken
                    )
                )
                require(result.ok && result.status == "approved") {
                    result.error ?: "控制面未确认电脑登录"
                }

                _state.update {
                    it.copy(
                        status = ScanStatus.AUTHORIZED,
                        statusText = "已授权 Web 端登录",
                    )
                }
                _events.send(ScanEvent.AuthorizeSuccess)

                // 1.5 秒后恢复扫描状态（允许扫描下一个码）
                kotlinx.coroutines.delay(1500)
                lastScannedValue = null
                _state.update {
                    it.copy(
                        status = ScanStatus.SCANNING,
                        statusText = "将二维码放入框内，自动识别"
                    )
                }
            } catch (e: Exception) {
                Log.w("WB_SCAN", "authorizeWeb failed", e)
                val msg = when (e) {
                    is retrofit2.HttpException -> when (e.code()) {
                        400 -> "本机尚未通过已登录电脑授权；请先在 Web 端设备管理扫码配对"
                        404 -> "二维码已失效，请刷新网页重试"
                        409 -> "二维码已被使用"
                        410 -> "二维码已过期"
                        401 -> "请先在已登录电脑的设备管理中完成本机配对"
                        403 -> "本机没有授权电脑登录的权限"
                        else -> "服务器错误 (${e.code()})"
                    }
                    is java.net.ConnectException, is java.net.SocketTimeoutException ->
                        "无法连接服务器，请检查网络"
                    else -> "授权失败：${e.message}"
                }
                _events.send(ScanEvent.AuthorizeFailed(msg))
                _state.update {
                    it.copy(
                        status = ScanStatus.ERROR,
                        statusText = msg,
                        error = ScanError(title = "授权失败", desc = msg),
                        cameraReady = true
                    )
                }
                lastScannedValue = null
            }
        }
    }

    /**
     * The camera path needs the same proof-of-possession refresh used by the
     * workspace repository. We intentionally do not reuse the legacy account
     * JWT: the paired Android Keystore key signs a fresh Control Plane nonce.
     */
    private suspend fun ensurePairedDeviceAccessToken(): String {
        val session = controlPlaneSessionStore.hydrate()
        if (!session.hasPairing() || !ControlPlaneCrypto.hasDeviceKey()) {
            throw IllegalStateException("请先在已登录电脑的设备管理中扫码配对本机")
        }
        if (session.hasUsableAccessToken()) return requireNotNull(session.accessToken)
        val deviceId = requireNotNull(session.deviceId)
        val nonce = controlPlaneApi.requestNonce(WorkspaceNonceRequest(deviceId))
        require(nonce.ok && !nonce.nonceId.isNullOrBlank() && !nonce.nonce.isNullOrBlank()) {
            nonce.error ?: "控制面未返回设备认证请求"
        }
        val token = controlPlaneApi.exchangeToken(
            ControlPlaneTokenRequest(
                deviceId = deviceId,
                nonceId = requireNotNull(nonce.nonceId),
                nonce = requireNotNull(nonce.nonce),
                signatureHex = ControlPlaneCrypto.signNonce(requireNotNull(nonce.nonce))
            )
        )
        require(token.ok && !token.accessToken.isNullOrBlank() && token.expiresAt != null) {
            token.error ?: "控制面未返回设备访问令牌"
        }
        controlPlaneSessionStore.saveAccessToken(requireNotNull(token.accessToken), requireNotNull(token.expiresAt))
        return requireNotNull(token.accessToken)
    }

    fun toggleTorch() {
        _state.update { it.copy(torchOn = !it.torchOn) }
        // TODO: 实际切换手电筒通过 CameraX cameraProvider
    }

    fun retry() {
        lastScannedValue = null
        onPermissionGranted()
    }
}
