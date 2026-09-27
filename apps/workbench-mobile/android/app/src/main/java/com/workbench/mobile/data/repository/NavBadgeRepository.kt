package com.workbench.mobile.data.repository

import com.workbench.mobile.data.api.NotificationApi
import com.workbench.mobile.data.api.AuthApi
import com.workbench.mobile.data.api.dto.GatewaySessionResponse
import com.workbench.mobile.data.api.dto.NavBadgeDto
import com.workbench.mobile.data.auth.TokenStore
import com.workbench.mobile.ui.components.NavBadge
import com.workbench.mobile.ui.components.TabBadges
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 从真实 API 拉取底栏徽标，并周期性刷新。
 * API 不可用时保持上一成功值；首次失败则回落 Empty（不再用假 Demo）。
 */
@Singleton
class NavBadgeRepository @Inject constructor(
    private val api: NotificationApi,
    private val authApi: AuthApi,
    private val tokenStore: TokenStore
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _badges = MutableStateFlow(TabBadges())
    val badges: StateFlow<TabBadges> = _badges.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    @Volatile
    private var started = false

    @Volatile
    private var verifiedSubject: String? = null

    fun start() {
        if (started) return
        started = true

        // 登录、换号、退出都通过持久化会话驱动。没有已验证主体时明确清空，
        // 不再回退到演示账号或遗留角标。
        scope.launch {
            tokenStore.userIdFlow
                .map(::authenticatedSubjectOrNull)
                .distinctUntilChanged()
                .collectLatest { subject ->
                    if (subject == null) {
                        _badges.value = TabBadges.Empty
                    } else {
                        refresh()
                    }
                }
        }

        scope.launch {
            while (isActive) {
                refresh()
                delay(POLL_MS)
            }
        }
    }

    suspend fun refresh() {
        val subject = authenticatedSubjectOrNull(tokenStore.cachedUserId)
        if (subject == null) {
            _badges.value = TabBadges.Empty
            _loading.value = false
            return
        }

        _loading.value = true
        try {
            if (!hasVerifiedGatewaySession(subject)) {
                _badges.value = TabBadges.Empty
                return
            }
            val res = api.getNavBadges()
            _badges.value = TabBadges(
                home = res.home.toNavBadge(),
                // 工作/待处理不复用通知服务数据；待处理角标由控制面快照计算。
                work = NavBadge.None,
                me = res.me.toNavBadge()
            )
            Timber.d("nav-badges ok home=%s me=%s", res.home, res.me)
        } catch (e: Exception) {
            Timber.w(e, "nav-badges fetch failed")
            // keep last successful; if still empty leave empty
        } finally {
            _loading.value = false
        }
    }

    private suspend fun hasVerifiedGatewaySession(subject: String): Boolean {
        if (verifiedSubject == subject) return true
        return try {
            val session = authApi.session()
            val verified = isVerifiedGatewaySession(subject, session)
            verifiedSubject = if (verified) subject else null
            if (!verified) {
                Timber.w("notification badges suppressed: gateway subject did not verify")
            }
            verified
        } catch (error: Exception) {
            verifiedSubject = null
            Timber.w(error, "notification badges suppressed: gateway session contract unavailable")
            false
        }
    }

    companion object {
        private const val POLL_MS = 30_000L
    }
}

/** A blank or absent session must never be transformed into a fallback user. */
internal fun authenticatedSubjectOrNull(userId: String?): String? =
    userId?.trim()?.takeIf { it.isNotEmpty() }

internal fun isVerifiedGatewaySession(
    expectedSubject: String,
    session: GatewaySessionResponse
): Boolean = session.authenticated && session.user?.subject == expectedSubject

private fun NavBadgeDto.toNavBadge(): NavBadge = when (kind.lowercase()) {
    "dot" -> NavBadge.Dot
    "count" -> NavBadge.ofCount(value)
    else -> NavBadge.None
}
