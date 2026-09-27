package com.workbench.mobile.data.api.dto

import kotlinx.serialization.Serializable

/**
 * 邮箱密码登录请求
 * 对应 packages/schemas LoginInput
 */
@Serializable
data class LoginRequest(
    val email: String,
    val password: String
)

/**
 * 邮箱密码登录响应
 * 对应 packages/schemas LoginResponse
 * TokenPairDto 在 QrCodeDtos.kt（snake_case 映射）
 */
@Serializable
data class LoginResponse(
    val user: UserDto,
    val tokens: TokenPairDto
)

/** 当前 Gateway 已验证的 OIDC 主体，绝不由客户端 header 推导。 */
@Serializable
data class GatewaySessionResponse(
    val authenticated: Boolean = false,
    val user: GatewaySessionUser? = null
)

@Serializable
data class GatewaySessionUser(
    val subject: String,
    val email: String? = null,
    val name: String? = null
)
