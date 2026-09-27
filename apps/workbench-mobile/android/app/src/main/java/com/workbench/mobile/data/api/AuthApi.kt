package com.workbench.mobile.data.api

import com.workbench.mobile.data.api.dto.LoginRequest
import com.workbench.mobile.data.api.dto.LoginResponse
import com.workbench.mobile.data.api.dto.GatewaySessionResponse
import com.workbench.mobile.data.api.dto.QrCodeConfirmRequest
import com.workbench.mobile.data.api.dto.QrCodeConfirmResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

/**
 * 认证相关 API
 * 路径前缀：/api/v1/auth
 */
interface AuthApi {

    /**
     * 只有当前 OIDC 网关实现的会话验证端点成功后，客户端才信任未读角标。
     */
    @GET("auth/session")
    suspend fun session(): GatewaySessionResponse

    /**
     * 邮箱密码登录
     * 公开端点（无需 JWT）
     */
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    /**
     * App 扫码授权 Web 端登录 — confirm
     * 需要 App JWT（从 Authorization 头）
     */
    @POST("auth/qrcode/confirm")
    suspend fun confirmQrCode(
        @Header("Authorization") authorization: String,
        @Body request: QrCodeConfirmRequest
    ): QrCodeConfirmResponse
}
