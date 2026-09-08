package com.workbench.mobile.data.repository

import com.workbench.mobile.data.api.ControlPlaneApi
import com.workbench.mobile.data.api.dto.ControlPlaneTokenRequest
import com.workbench.mobile.data.api.dto.MobileActionRequest
import com.workbench.mobile.data.api.dto.MobileActionResult
import com.workbench.mobile.data.api.dto.MobileApprovalDecisionRequest
import com.workbench.mobile.data.api.dto.MobileWorkspaceSnapshot
import com.workbench.mobile.data.api.dto.PairingStatusRequest
import com.workbench.mobile.data.api.dto.WorkspaceApproval
import com.workbench.mobile.data.api.dto.WorkspaceNonceRequest
import com.workbench.mobile.data.auth.ControlPlaneCrypto
import com.workbench.mobile.data.auth.ControlPlaneSession
import com.workbench.mobile.data.auth.ControlPlaneSessionStore
import com.workbench.mobile.data.network.GatewayEndpointConfigurationRequiredException
import com.workbench.mobile.data.network.GatewayEndpointStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException
import timber.log.Timber
import java.io.IOException
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

sealed interface WorkspaceLoadState {
    /** 刷新时保留上一次已验证快照，避免把用户正在看的内容替换成整页加载态。 */
    data class Loading(
        val snapshot: MobileWorkspaceSnapshot? = null,
        /** 只有用户主动下拉/重试时，缓存刷新才应在界面上显示进度。 */
        val userInitiated: Boolean = snapshot == null
    ) : WorkspaceLoadState
    data class Ready(val snapshot: MobileWorkspaceSnapshot) : WorkspaceLoadState
    /** 手机尚未扫码登记；需从 Web 设备管理页面扫描一次性二维码。 */
    data object QrPairingRequired : WorkspaceLoadState
    /** 手机已扫码登记，等待已登录 Web owner 确认这台设备。 */
    data class AwaitingPairApproval(
        val expiresAt: Long?
    ) : WorkspaceLoadState
    /** A physical phone has not yet been pointed at a same-LAN API Gateway. */
    data object GatewaySetupRequired : WorkspaceLoadState
    /** 网络异常只影响同步状态；存在旧快照时，界面仍可继续展示旧内容。 */
    data class Error(
        val message: String,
        val snapshot: MobileWorkspaceSnapshot? = null
    ) : WorkspaceLoadState
}

sealed interface WorkspaceActionState {
    data object Idle : WorkspaceActionState
    data object Submitting : WorkspaceActionState
    data class PendingApproval(val approvalId: String) : WorkspaceActionState
    data class Completed(val message: String) : WorkspaceActionState
    data class Failed(val message: String) : WorkspaceActionState
}

/** The phone has scanned a pairing request, but Web must still approve it. */
private class PairingApprovalPendingException(
    val expiresAt: Long?
) : IllegalStateException()

/** No pairing transaction is created until the phone camera scans Web's QR. */
private class QrPairingRequiredException : IllegalStateException()

/**
 * 读取已配对设备可见的工作区事实。失败时显式呈现同步错误，绝不回退到示例项目。
 */
@Singleton
class WorkspaceRepository @Inject constructor(
    private val api: ControlPlaneApi,
    private val sessionStore: ControlPlaneSessionStore,
    private val gatewayEndpointStore: GatewayEndpointStore
) {
    companion object {
        private const val SNAPSHOT_FRESHNESS_MS = 30_000L
    }

    private val refreshMutex = Mutex()
    private var latestSnapshot: MobileWorkspaceSnapshot? = null
    private var lastSyncedAtMillis: Long = 0L
    private var lastAutomaticAttemptAtMillis: Long = 0L
    private val _state = MutableStateFlow<WorkspaceLoadState>(WorkspaceLoadState.Loading())
    val state: StateFlow<WorkspaceLoadState> = _state.asStateFlow()
    private val _actionStates = MutableStateFlow<Map<String, WorkspaceActionState>>(emptyMap())
    val actionStates: StateFlow<Map<String, WorkspaceActionState>> = _actionStates.asStateFlow()

    /** 普通导航只在快照超过 30 秒时静默刷新。 */
    suspend fun refreshIfStale() = refresh(force = false, userInitiated = false)

    /** 用户主动刷新时才呈现同步反馈。 */
    suspend fun refresh() = refresh(force = true, userInitiated = true)

    private suspend fun refresh(force: Boolean, userInitiated: Boolean) = refreshMutex.withLock {
        val cached = latestSnapshot
        val now = System.currentTimeMillis()
        if (!force) {
            val isSnapshotFresh = cached != null && now - lastSyncedAtMillis < SNAPSHOT_FRESHNESS_MS
            val automaticAttemptIsRecent = now - lastAutomaticAttemptAtMillis < SNAPSHOT_FRESHNESS_MS
            if (isSnapshotFresh || automaticAttemptIsRecent) return@withLock
        }
        lastAutomaticAttemptAtMillis = now
        _state.value = WorkspaceLoadState.Loading(cached, userInitiated = userInitiated || cached == null)
        try {
            var session = sessionStore.hydrate()
            ensureAccessToken(session)
            val snapshot = try {
                api.workspace()
            } catch (error: HttpException) {
                if (error.code() != 401) throw error
                sessionStore.clearAccessToken()
                session = sessionStore.hydrate()
                ensureAccessToken(session)
                api.workspace()
            }
            latestSnapshot = snapshot
            lastSyncedAtMillis = System.currentTimeMillis()
            _state.value = WorkspaceLoadState.Ready(snapshot)
            Timber.i("workspace synced: %s projects", snapshot.projects.size)
        } catch (_: QrPairingRequiredException) {
            _state.value = WorkspaceLoadState.QrPairingRequired
        } catch (error: PairingApprovalPendingException) {
            _state.value = WorkspaceLoadState.AwaitingPairApproval(
                expiresAt = error.expiresAt
            )
        } catch (_: GatewayEndpointConfigurationRequiredException) {
            _state.value = WorkspaceLoadState.GatewaySetupRequired
        } catch (error: Exception) {
            Timber.w(error, "workspace sync failed")
            _state.value = WorkspaceLoadState.Error(
                message = friendlyMessage(error),
                snapshot = latestSnapshot
            )
        }
    }

    suspend fun submitProjectAction(
        projectId: String,
        actionId: String,
        actionType: String
    ): MobileActionResult? {
        val key = actionKey(projectId, actionId)
        _actionStates.update { it + (key to WorkspaceActionState.Submitting) }
        return try {
            var session = sessionStore.hydrate()
            ensureAccessToken(session)
            val result = try {
                api.submitProjectAction(
                    MobileActionRequest(
                        idempotencyKey = nextIdempotencyKey(),
                        projectId = projectId,
                        actionId = actionId,
                        actionType = actionType
                    )
                )
            } catch (error: HttpException) {
                if (error.code() != 401) throw error
                sessionStore.clearAccessToken()
                session = sessionStore.hydrate()
                ensureAccessToken(session)
                api.submitProjectAction(
                    MobileActionRequest(
                        idempotencyKey = nextIdempotencyKey(),
                        projectId = projectId,
                        actionId = actionId,
                        actionType = actionType
                    )
                )
            }
            _actionStates.update {
                val state = result.approvalId?.let(WorkspaceActionState::PendingApproval)
                    ?: WorkspaceActionState.Completed(mobileActionSubmissionMessage(actionType))
                it + (key to state)
            }
            refresh(force = true, userInitiated = false)
            result
        } catch (error: Exception) {
            val message = friendlyMessage(error)
            _actionStates.update { it + (key to WorkspaceActionState.Failed(message)) }
            null
        }
    }

    suspend fun decideProjectApproval(approval: WorkspaceApproval, decision: String): WorkspaceApproval? {
        val projectId = approval.projectId
        val actionId = approval.actionId
        val actionType = approval.actionType
        if (projectId.isNullOrBlank() || actionId.isNullOrBlank() || actionType.isNullOrBlank()) {
            _actionStates.update { it + (approvalActionKey(approval.id) to WorkspaceActionState.Failed("该审批项缺少受管动作标识，无法执行。")) }
            return null
        }
        val key = actionKey(projectId, actionId)
        _actionStates.update { it + (key to WorkspaceActionState.Submitting) }
        return try {
            var session = sessionStore.hydrate()
            ensureAccessToken(session)
            val request = MobileApprovalDecisionRequest(
                idempotencyKey = nextIdempotencyKey(),
                projectId = projectId,
                actionId = actionId,
                actionType = actionType,
                approvalRef = approval.id,
                decision = decision
            )
            val result = try {
                api.decideProjectApproval(approval.id, request)
            } catch (error: HttpException) {
                if (error.code() != 401) throw error
                sessionStore.clearAccessToken()
                session = sessionStore.hydrate()
                ensureAccessToken(session)
                api.decideProjectApproval(approval.id, request.copy(idempotencyKey = nextIdempotencyKey()))
            }
            _actionStates.update {
                it + (key to if (decision == "approved") {
                    WorkspaceActionState.Completed("已批准，诊断结果已更新到项目详情。")
                } else {
                    WorkspaceActionState.Completed("已拒绝该诊断申请。")
                })
            }
            refresh(force = true, userInitiated = false)
            result
        } catch (error: Exception) {
            val message = friendlyMessage(error)
            _actionStates.update { it + (key to WorkspaceActionState.Failed(message)) }
            null
        }
    }

    fun actionState(projectId: String, actionId: String): WorkspaceActionState =
        actionStates.value[actionKey(projectId, actionId)] ?: WorkspaceActionState.Idle

    private fun actionKey(projectId: String, actionId: String) = "$projectId:$actionId"

    private fun approvalActionKey(approvalId: String) = "approval:$approvalId"

    private fun nextIdempotencyKey(): String = UUID.randomUUID().toString().replace("-", "")

    private suspend fun ensureAccessToken(session: ControlPlaneSession): String {
        gatewayEndpointStore.requireConfiguredLanGateway()
        if (session.hasUsableAccessToken()) return requireNotNull(session.accessToken)
        val activeSession = when {
            session.hasPairing() && ControlPlaneCrypto.hasDeviceKey() -> session
            session.hasPendingPairing() && ControlPlaneCrypto.hasDeviceKey() -> resolvePendingPairing(session)
            else -> {
                if (session.hasPairing() || session.hasPendingPairing() || ControlPlaneCrypto.hasDeviceKey()) {
                    sessionStore.clear()
                }
                throw QrPairingRequiredException()
            }
        }

        return try {
            issueAccessToken(activeSession)
        } catch (error: HttpException) {
            if (error.code() !in setOf(400, 401, 404)) throw error
            // 被撤销或遗失的设备登记只清掉本机控制面凭据；新的配对必须再次扫码。
            sessionStore.clear()
            throw QrPairingRequiredException()
        }
    }

    private suspend fun resolvePendingPairing(session: ControlPlaneSession): ControlPlaneSession {
        val pairingId = requireNotNull(session.pendingPairingId)
        val code = requireNotNull(session.pendingPairingCode)
        val status = try {
            api.pairingStatus(PairingStatusRequest(pairingId = pairingId, code = code))
        } catch (error: HttpException) {
            // A bad or expired pairing is not a connectivity failure. Remove
            // only this obsolete local transaction and require one fresh
            // camera scan instead of silently creating a new code.
            if (error.code() !in setOf(400, 404)) throw error
            sessionStore.clear()
            throw QrPairingRequiredException()
        }
        if (!status.ok) {
            sessionStore.clear()
            throw QrPairingRequiredException()
        }
        if (status.status != "approved") {
            throw PairingApprovalPendingException(status.expiresAt)
        }
        val deviceId = requireNotNull(status.deviceId) { "控制面未返回已配对设备 ID" }
        sessionStore.savePairing(deviceId)
        return sessionStore.hydrate()
    }

    private suspend fun issueAccessToken(session: ControlPlaneSession): String {
        val deviceId = requireNotNull(session.deviceId) { "控制面设备 ID 缺失" }
        val nonce = api.requestNonce(WorkspaceNonceRequest(deviceId))
        require(nonce.ok && !nonce.nonceId.isNullOrBlank() && !nonce.nonce.isNullOrBlank()) {
            nonce.error ?: "控制面未返回认证 nonce"
        }
        val token = api.exchangeToken(
            ControlPlaneTokenRequest(
                deviceId = deviceId,
                nonceId = requireNotNull(nonce.nonceId),
                nonce = requireNotNull(nonce.nonce),
                signatureHex = ControlPlaneCrypto.signNonce(requireNotNull(nonce.nonce))
            )
        )
        require(token.ok && !token.accessToken.isNullOrBlank() && token.expiresAt != null) {
            token.error ?: "控制面未返回访问令牌"
        }
        sessionStore.saveAccessToken(requireNotNull(token.accessToken), requireNotNull(token.expiresAt))
        return requireNotNull(token.accessToken)
    }

    private fun friendlyMessage(error: Exception): String = when (error) {
        is QrPairingRequiredException -> "请在 Web 工作台的「设备管理」生成二维码，再用本机扫一扫。"
        is PairingApprovalPendingException -> "本机已扫码，请在 Web 工作台的「设备管理」确认设备配对后重试。"
        is IOException -> "无法连接本机工作台。请确认 API Gateway 已启动，且手机与开发机处于同一可互通网络。"
        is HttpException -> when (error.code()) {
            401 -> "设备授权已失效，正在重新建立工作区会话。"
            503 -> "本机工作台暂不可用，请启动控制面后重试。"
            else -> "工作区同步失败（服务端返回 ${error.code()}）。"
        }
        else -> error.message?.takeIf { it.isNotBlank() } ?: "工作区同步失败，请重试。"
    }
}

/**
 * 控制面任务摘要可能含运行时名、命令或队列术语，不能直接放进移动端第一层。
 * 这里仅按已登记的动作类型给出稳定、可理解的用户反馈。
 */
internal fun mobileActionSubmissionMessage(actionType: String): String = when (actionType) {
    "project_verification" -> "已开始重新核验，完成后会更新项目状态。"
    "project_diagnosis" -> "已提交只读诊断申请，等待已配对设备审批。"
    else -> "操作已受理，完成后会更新结果。"
}
