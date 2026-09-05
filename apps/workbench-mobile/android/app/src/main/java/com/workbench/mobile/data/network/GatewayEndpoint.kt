package com.workbench.mobile.data.network

import android.content.Context
import android.os.Build
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.workbench.mobile.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Request
import java.util.Locale
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

private const val GATEWAY_API_PATH = "/api/v1/"
private const val CONTROL_PLANE_DIRECT_PORT = 8092
private const val EMULATOR_GATEWAY_HOST = "10.0.2.2"
private val Context.gatewayEndpointDataStore by preferencesDataStore(name = "gateway_endpoint")

/** A physical phone must not silently send development traffic to the emulator alias. */
class GatewayEndpointConfigurationRequiredException : IOException(
    "请先在「我的」→「设置」→「本机网关」填写开发机的局域网 API Gateway 地址"
)

/**
 * Normalizes the only supported public ingress. The phone can select a LAN
 * gateway at runtime, but it can never be pointed at the control-plane port.
 */
fun normalizeGatewayBaseUrl(rawValue: String): HttpUrl? {
    val parsed = rawValue.trim().toHttpUrlOrNull() ?: return null
    if (parsed.scheme.lowercase(Locale.ROOT) !in setOf("http", "https")) return null
    if (parsed.username.isNotEmpty() || parsed.password.isNotEmpty()) return null
    if (parsed.query != null || parsed.fragment != null) return null
    if (parsed.port == CONTROL_PLANE_DIRECT_PORT) return null
    val path = parsed.encodedPath.trimEnd('/')
    if (path.isNotEmpty() && path != "/api/v1") return null
    return parsed.newBuilder()
        .encodedPath(GATEWAY_API_PATH)
        .query(null)
        .fragment(null)
        .build()
}

/** Rewrites the Retrofit placeholder route onto the selected gateway base. */
fun rewriteGatewayRequestUrl(endpoint: HttpUrl, placeholder: HttpUrl): HttpUrl {
    val suffix = placeholder.encodedPath.removePrefix("/")
    return endpoint.newBuilder()
        .encodedPath("$GATEWAY_API_PATH$suffix")
        .encodedQuery(placeholder.encodedQuery)
        .build()
}

/** True only for a physical phone that has no saved gateway and inherited 10.0.2.2. */
internal fun requiresExplicitLanGateway(
    hasStoredEndpoint: Boolean,
    defaultEndpoint: HttpUrl,
    isEmulator: Boolean
): Boolean = !hasStoredEndpoint && !isEmulator && defaultEndpoint.host == EMULATOR_GATEWAY_HOST

private fun isLikelyAndroidEmulator(): Boolean {
    val fingerprint = Build.FINGERPRINT.lowercase(Locale.ROOT)
    val model = Build.MODEL.lowercase(Locale.ROOT)
    val product = Build.PRODUCT.lowercase(Locale.ROOT)
    return fingerprint.startsWith("generic") ||
        fingerprint.startsWith("unknown") ||
        model.contains("emulator") ||
        model.contains("android sdk built for") ||
        product.contains("sdk") ||
        product.contains("emulator")
}

@Singleton
class GatewayEndpointStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val endpointKey = stringPreferencesKey("base_url")
    private val defaultEndpoint = requireNotNull(normalizeGatewayBaseUrl(BuildConfig.GATEWAY_BASE_URL)) {
        "GATEWAY_BASE_URL must be a HTTP(S) API Gateway URL"
    }

    @Volatile
    private var cachedEndpoint: HttpUrl = defaultEndpoint

    private val hydrationMutex = Mutex()

    @Volatile
    private var hydrated = false

    @Volatile
    private var hasStoredEndpoint = false

    val displayUrl: String
        get() = cachedEndpoint.toString()

    suspend fun hydrate() {
        hydrationMutex.withLock {
            if (hydrated) return@withLock
            val stored = context.gatewayEndpointDataStore.data.first()[endpointKey]
            normalizeGatewayBaseUrl(stored.orEmpty())?.let {
                cachedEndpoint = it
                hasStoredEndpoint = true
            }
            hydrated = true
        }
    }

    /**
     * Prevent a real handset from making a 15-second socket attempt against
     * 10.0.2.2, which is meaningful only inside an Android emulator.
     */
    suspend fun requireConfiguredLanGateway() {
        hydrate()
        if (requiresExplicitLanGateway(hasStoredEndpoint, defaultEndpoint, isLikelyAndroidEmulator())) {
            throw GatewayEndpointConfigurationRequiredException()
        }
    }

    suspend fun save(rawValue: String) {
        val endpoint = normalizeGatewayBaseUrl(rawValue)
            ?: throw IllegalArgumentException("请输入 HTTP(S) 网关地址，例如 http://192.168.1.8:8088")
        hydrationMutex.withLock {
            cachedEndpoint = endpoint
            hasStoredEndpoint = true
            hydrated = true
            context.gatewayEndpointDataStore.edit { prefs -> prefs[endpointKey] = endpoint.toString() }
        }
    }

    suspend fun reset() {
        hydrationMutex.withLock {
            cachedEndpoint = defaultEndpoint
            hasStoredEndpoint = false
            hydrated = true
            context.gatewayEndpointDataStore.edit { prefs -> prefs.remove(endpointKey) }
        }
    }

    fun rewrite(request: Request): Request = request.newBuilder()
        .url(rewriteGatewayRequestUrl(cachedEndpoint, request.url))
        .build()

    fun interceptor(): Interceptor = Interceptor { chain -> chain.proceed(rewrite(chain.request())) }

    companion object {
        val retrofitPlaceholderBaseUrl: HttpUrl = "http://axi.invalid/".toHttpUrl()
    }
}
