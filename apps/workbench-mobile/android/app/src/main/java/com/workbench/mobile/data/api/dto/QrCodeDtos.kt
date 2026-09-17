package com.workbench.mobile.data.api.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * App 扫码登录 — confirm 请求
 * 对应 packages/schemas QrCodeConfirmInput
 */
@Serializable
data class QrCodeConfirmRequest(
    val qrCodeId: String,
    val signature: String,
    val deviceId: String,
    val platform: String,       // "ios" | "android" | "harmonyos"
    val appVersion: String? = null
)

/**
 * App 扫码登录 — confirm 响应
 * 对应 packages/schemas QrCodeConfirmResponse
 */
@Serializable
data class QrCodeConfirmResponse(
    val user: UserDto,
    val tokens: TokenPairDto
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val name: String,
    val createdAt: String? = null
)

/**
 * 服务端返回的是 snake_case（access_token / refresh_token / expires_in）
 * 用 @SerialName 映射
 */
@Serializable
data class TokenPairDto(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in") val expiresIn: Long = 0
)