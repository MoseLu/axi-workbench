package com.workbench.mobile.data.api.dto

import kotlinx.serialization.Serializable

@Serializable
data class PairStartRequest(
    val publicKeyHex: String,
    val publicKeyAlgorithm: String,
    val deviceName: String
)

@Serializable
data class PairStartResponse(
    val ok: Boolean = false,
    val pairingId: String? = null,
    val code: String? = null,
    val codeExpiresAt: Long? = null,
    val error: String? = null
)

/** Request sent only after a phone camera reads a one-time Web QR payload. */
@Serializable
data class QrPairScanRequest(
    val webPairingId: String,
    val scanToken: String,
    val publicKeyHex: String,
    val publicKeyAlgorithm: String,
    val deviceName: String
)

/** The old code is retained locally only to poll the server-side transaction. */
@Serializable
data class QrPairScanResponse(
    val ok: Boolean = false,
    val pairingId: String? = null,
    val code: String? = null,
    val expiresAt: Long? = null,
    val error: String? = null
)

/** A phone that already holds an active Control Plane device session uses this
 * to approve a browser's one-time QR login transaction. */
@Serializable
data class WebLoginQrScanRequest(
    val webLoginId: String,
    val scanToken: String
)

@Serializable
data class WebLoginQrScanResponse(
    val ok: Boolean = false,
    val status: String? = null,
    val error: String? = null
)

@Serializable
data class PairingStatusRequest(
    val pairingId: String,
    val code: String
)

@Serializable
data class PairingStatusResponse(
    val ok: Boolean = false,
    val status: String? = null,
    val deviceId: String? = null,
    val expiresAt: Long? = null,
    val error: String? = null
)

@Serializable
data class WorkspaceNonceRequest(val deviceId: String)

@Serializable
data class WorkspaceNonceResponse(
    val ok: Boolean = false,
    val nonceId: String? = null,
    val nonce: String? = null,
    val expiresAt: Long? = null,
    val error: String? = null
)

@Serializable
data class ControlPlaneTokenRequest(
    val deviceId: String,
    val nonceId: String,
    val nonce: String,
    val signatureHex: String,
    val scopes: List<String> = listOf("workspace.read")
)

@Serializable
data class ControlPlaneTokenResponse(
    val ok: Boolean = false,
    val accessToken: String? = null,
    val expiresAt: Long? = null,
    val error: String? = null
)

@Serializable
data class MobileWorkspaceSnapshot(
    val generatedAt: String? = null,
    val source: String = "workspace.graph",
    val summary: WorkspaceSummary = WorkspaceSummary(),
    val attentionItems: List<WorkspaceAttentionItem> = emptyList(),
    val projects: List<WorkspaceProject> = emptyList(),
    val runningTasks: List<WorkspaceRunningTask> = emptyList(),
    val recentTasks: List<WorkspaceRunningTask> = emptyList(),
    val approvals: List<WorkspaceApproval> = emptyList()
)

@Serializable
data class WorkspaceSummary(
    val total: Int = 0,
    val healthy: Int = 0,
    val attention: Int = 0,
    val blocked: Int = 0,
    val stale: Int = 0,
    val unknown: Int = 0
)

@Serializable
data class WorkspaceAttentionItem(
    val id: String = "",
    val projectId: String? = null,
    val severity: String = "info",
    val type: String = "",
    val reasonCode: String = "",
    val title: String = "",
    val summary: String = "",
    val updatedAt: String? = null
)

@Serializable
data class WorkspaceProject(
    val id: String = "",
    val name: String = "",
    val kind: String = "project",
    val status: String = "unknown",
    val health: String = "unknown",
    val reasonCode: String = "",
    val summary: String = "",
    val phase: String = "unknown",
    val lastVerifiedAt: String? = null,
    val capabilities: List<String> = emptyList(),
    val progress: WorkspaceProgress = WorkspaceProgress(),
    val configuration: List<WorkspaceConfigurationSection> = emptyList(),
    val actions: List<MobileProjectAction> = emptyList()
)

@Serializable
data class MobileProjectAction(
    val actionId: String = "",
    val commandId: String = "",
    val label: String = "",
    val intent: String = "",
    val autoExecutable: Boolean = false,
    val actionType: String = "",
    val executionMode: String = "requires_approval",
    val riskLevel: String = "medium",
    val summary: String = ""
)

@Serializable
data class WorkspaceRunningTask(
    val id: String = "",
    val projectId: String? = null,
    val status: String = "running",
    val reasonCode: String = "task_running",
    val summary: String = "",
    val actionType: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class WorkspaceApproval(
    val id: String = "",
    val projectId: String? = null,
    val actionId: String? = null,
    val actionType: String? = null,
    val source: String = "control-plane",
    val status: String = "pending",
    val actionSummary: String = "",
    val riskLevel: String = "medium",
    val createdAt: String? = null
)

@Serializable
data class MobileActionRequest(
    val idempotencyKey: String,
    val projectId: String,
    val actionId: String,
    val actionType: String
)

@Serializable
data class MobileApprovalDecisionRequest(
    val idempotencyKey: String,
    val projectId: String,
    val actionId: String,
    val actionType: String,
    val approvalRef: String,
    val decision: String,
    val decisionText: String? = null
)

@Serializable
data class WorkspaceJobSummary(
    val id: String = "",
    val status: String = "",
    val summary: String = ""
)

@Serializable
data class MobileActionResult(
    val status: String? = null,
    val approvalId: String? = null,
    val riskLevel: String? = null,
    val actionSummary: String? = null,
    val accepted: Boolean? = null,
    val job: WorkspaceJobSummary? = null,
    val dispatchedJobId: String? = null
)

@Serializable
data class WorkspaceProgress(
    val stage: String = "unknown",
    val confidence: String = "unknown",
    val summary: String = "",
    val updatedAt: String? = null,
    val evidenceCount: Int = 0,
    val remaining: List<String> = emptyList()
)

@Serializable
data class WorkspaceConfigurationSection(
    val id: String = "",
    val title: String = "",
    val facts: List<WorkspaceFact> = emptyList()
)

@Serializable
data class WorkspaceFact(
    val key: String = "",
    val label: String = "",
    val value: String = ""
)
