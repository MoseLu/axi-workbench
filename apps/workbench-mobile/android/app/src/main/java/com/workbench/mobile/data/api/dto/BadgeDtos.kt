package com.workbench.mobile.data.api.dto

import kotlinx.serialization.Serializable

/**
 * 与 notification-service GET /notifications/nav-badges 对齐。
 * kind: none | dot | count
 */
@Serializable
data class NavBadgeDto(
    val kind: String = "none",
    val value: Int = 0
)

@Serializable
data class NavBadgesResponse(
    val home: NavBadgeDto = NavBadgeDto(),
    val projects: NavBadgeDto = NavBadgeDto(),
    val workspace: NavBadgeDto = NavBadgeDto(),
    val me: NavBadgeDto = NavBadgeDto(),
    val unreadTotal: Int = 0
)
