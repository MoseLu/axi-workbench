package com.workbench.mobile.data.auth

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.tokenDataStore by preferencesDataStore(name = "auth_tokens")

/**
 * Token 本地存储（DataStore Preferences）
 * 用于：扫码登录成功后保存 access / refresh token，启动时检查是否已登录
 */
@Singleton
class TokenStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val accessKey = stringPreferencesKey("access_token")
    private val refreshKey = stringPreferencesKey("refresh_token")
    private val userIdKey = stringPreferencesKey("user_id")
    private val userEmailKey = stringPreferencesKey("user_email")
    private val userNameKey = stringPreferencesKey("user_name")

    val accessTokenFlow: Flow<String?> = context.tokenDataStore.data.map { it[accessKey] }
    val userIdFlow: Flow<String?> = context.tokenDataStore.data.map { it[userIdKey] }
    val userEmailFlow: Flow<String?> = context.tokenDataStore.data.map { it[userEmailKey] }
    val userNameFlow: Flow<String?> = context.tokenDataStore.data.map { it[userNameKey] }

    /** In-memory cache for OkHttp interceptors (no suspend). */
    @Volatile
    var cachedAccessToken: String? = null
        private set

    @Volatile
    var cachedUserId: String? = null
        private set

    suspend fun save(
        accessToken: String,
        refreshToken: String,
        userId: String,
        userEmail: String,
        userName: String
    ) {
        cachedAccessToken = accessToken
        cachedUserId = userId
        context.tokenDataStore.edit { prefs ->
            prefs[accessKey] = accessToken
            prefs[refreshKey] = refreshToken
            prefs[userIdKey] = userId
            prefs[userEmailKey] = userEmail
            prefs[userNameKey] = userName
        }
    }

    /** Warm interceptor cache from DataStore (call on app start / splash). */
    suspend fun hydrateCache() {
        val prefs = context.tokenDataStore.data.first()
        cachedAccessToken = prefs[accessKey]
        cachedUserId = prefs[userIdKey]
    }

    suspend fun clear() {
        cachedAccessToken = null
        cachedUserId = null
        context.tokenDataStore.edit { it.clear() }
    }
}
