package com.workbench.mobile.data.api

import com.workbench.mobile.data.api.dto.ControlPlaneTokenRequest
import com.workbench.mobile.data.api.dto.ControlPlaneTokenResponse
import com.workbench.mobile.data.api.dto.MobileActionRequest
import com.workbench.mobile.data.api.dto.MobileActionResult
import com.workbench.mobile.data.api.dto.MobileApprovalDecisionRequest
import com.workbench.mobile.data.api.dto.PairStartRequest
import com.workbench.mobile.data.api.dto.PairStartResponse
import com.workbench.mobile.data.api.dto.QrPairScanRequest
import com.workbench.mobile.data.api.dto.QrPairScanResponse
import com.workbench.mobile.data.api.dto.WebLoginQrScanRequest
import com.workbench.mobile.data.api.dto.WebLoginQrScanResponse
import com.workbench.mobile.data.api.dto.WorkspaceNonceRequest
import com.workbench.mobile.data.api.dto.WorkspaceNonceResponse
import com.workbench.mobile.data.api.dto.MobileWorkspaceSnapshot
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/** Axi Workbench 移动设备合同。所有路径由 API Gateway 转发，绝不直连控制面。 */
interface ControlPlaneApi {
    @POST("mobile/pair/start")
    suspend fun startPair(@Body request: PairStartRequest): PairStartResponse

    /** Scans a short-lived Web QR transaction; final device binding still happens in Web. */
    @POST("mobile/pair/qr/scan")
    suspend fun scanWebPairing(@Body request: QrPairScanRequest): QrPairScanResponse

    /** Requires the paired-device bearer injected by the Control Plane client. */
    @POST("mobile/web-login/qr/scan")
    suspend fun approveWebLogin(@Body request: WebLoginQrScanRequest): WebLoginQrScanResponse

    @POST("mobile/pair/status")
    suspend fun pairingStatus(@Body request: com.workbench.mobile.data.api.dto.PairingStatusRequest): com.workbench.mobile.data.api.dto.PairingStatusResponse

    @POST("mobile/auth/nonce")
    suspend fun requestNonce(@Body request: WorkspaceNonceRequest): WorkspaceNonceResponse

    @POST("mobile/auth/token")
    suspend fun exchangeToken(@Body request: ControlPlaneTokenRequest): ControlPlaneTokenResponse

    @GET("mobile/workspace")
    suspend fun workspace(): MobileWorkspaceSnapshot

    @POST("mobile/jobs")
    suspend fun submitProjectAction(@Body request: MobileActionRequest): MobileActionResult

    @POST("mobile/approvals/{approvalId}/decision")
    suspend fun decideProjectApproval(
        @Path("approvalId") approvalId: String,
        @Body request: MobileApprovalDecisionRequest
    ): com.workbench.mobile.data.api.dto.WorkspaceApproval
}
