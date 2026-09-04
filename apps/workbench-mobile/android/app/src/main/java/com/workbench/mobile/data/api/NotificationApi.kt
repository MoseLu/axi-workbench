package com.workbench.mobile.data.api

import com.workbench.mobile.data.api.dto.NavBadgesResponse
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * 通知 / 底栏徽标 API（经 API Gateway → notification-service）
 * 前缀：/api/v1/notifications
 */
interface NotificationApi {

    /**
     * 底栏四 Tab 徽标汇总（微信式 count / red-dot）。
     *
     * 身份完全由 Gateway 验证的 Bearer token 决定；客户端不得再传入
     * userId 或 X-User-Id，避免把演示身份或可伪造身份带入真实数据面。
     */
    @GET("notifications/nav-badges")
    suspend fun getNavBadges(): NavBadgesResponse

    @PUT("notifications/{id}/read")
    suspend fun markRead(@Path("id") id: String)

    @PUT("notifications/read-all")
    suspend fun markAllRead()
}
