package com.workbench.mobile.data.auth

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

private val Context.controlPlaneSessionDataStore by preferencesDataStore(name = "control_plane_session")

/** 本机工作区控制面的独立设备会话；绝不复用账号网关的 JWT。 */
data class ControlPlaneSession(
    val deviceId: String? = null,
    val pendingPairingId: String? = null,
    val pendingPairingCode: String? = null,
    val accessToken: String? = null,
    val accessTokenExpiresAt: Long? = null
) {
    fun hasPairing(): Boolean = !deviceId.isNullOrBlank()

    fun hasPendingPairing(): Boolean = !pendingPairingId.isNullOrBlank() && !pendingPairingCode.isNullOrBlank()

    fun hasUsableAccessToken(nowSeconds: Long = System.currentTimeMillis() / 1000): Boolean =
        !accessToken.isNullOrBlank() && (accessTokenExpiresAt ?: 0L) > nowSeconds + 30
}

@Singleton
class ControlPlaneSessionStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val legacyDeviceSecretKey = stringPreferencesKey("device_secret_hex")
    private val deviceIdKey = stringPreferencesKey("device_id")
    private val pendingPairingIdKey = stringPreferencesKey("pending_pairing_id")
    private val pendingPairingCodeKey = stringPreferencesKey("pending_pairing_code")
    private val accessTokenKey = stringPreferencesKey("access_token")
    private val accessTokenExpiresAtKey = longPreferencesKey("access_token_expires_at")

    @Volatile
    private var cachedSession = ControlPlaneSession()

    val cachedAccessToken: String?
        get() = cachedSession.accessToken

    suspend fun hydrate(): ControlPlaneSession {
        val prefs = context.controlPlaneSessionDataStore.data.first()
        if (prefs[legacyDeviceSecretKey] != null) {
            // The previous shared HMAC secret is incompatible with the
            // per-device Keystore pairing contract and must not remain on
            // disk after an upgrade.
            context.controlPlaneSessionDataStore.edit { it.remove(legacyDeviceSecretKey) }
        }
        return ControlPlaneSession(
            deviceId = prefs[deviceIdKey],
            pendingPairingId = prefs[pendingPairingIdKey],
            pendingPairingCode = prefs[pendingPairingCodeKey],
            accessToken = prefs[accessTokenKey],
            accessTokenExpiresAt = prefs[accessTokenExpiresAtKey]
        ).also { cachedSession = it }
    }

    suspend fun savePendingPairing(pairingId: String, code: String) {
        cachedSession = ControlPlaneSession(pendingPairingId = pairingId, pendingPairingCode = code)
        context.controlPlaneSessionDataStore.edit { prefs ->
            prefs.remove(deviceIdKey)
            prefs[pendingPairingIdKey] = pairingId
            prefs[pendingPairingCodeKey] = code
            prefs.remove(accessTokenKey)
            prefs.remove(accessTokenExpiresAtKey)
        }
    }

    suspend fun savePairing(deviceId: String) {
        cachedSession = ControlPlaneSession(deviceId = deviceId)
        context.controlPlaneSessionDataStore.edit { prefs ->
            prefs[deviceIdKey] = deviceId
            prefs.remove(pendingPairingIdKey)
            prefs.remove(pendingPairingCodeKey)
            prefs.remove(accessTokenKey)
            prefs.remove(accessTokenExpiresAtKey)
        }
    }

    suspend fun saveAccessToken(accessToken: String, expiresAt: Long) {
        cachedSession = cachedSession.copy(accessToken = accessToken, accessTokenExpiresAt = expiresAt)
        context.controlPlaneSessionDataStore.edit { prefs ->
            prefs[accessTokenKey] = accessToken
            prefs[accessTokenExpiresAtKey] = expiresAt
        }
    }

    suspend fun clearAccessToken() {
        cachedSession = cachedSession.copy(accessToken = null, accessTokenExpiresAt = null)
        context.controlPlaneSessionDataStore.edit { prefs ->
            prefs.remove(accessTokenKey)
            prefs.remove(accessTokenExpiresAtKey)
        }
    }

    suspend fun clear() {
        cachedSession = ControlPlaneSession()
        context.controlPlaneSessionDataStore.edit { it.clear() }
        ControlPlaneCrypto.deleteDeviceKey()
    }
}
