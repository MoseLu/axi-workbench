package com.workbench.mobile.di

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.workbench.mobile.BuildConfig
import com.workbench.mobile.data.api.AuthApi
import com.workbench.mobile.data.api.ControlPlaneApi
import com.workbench.mobile.data.api.NotificationApi
import com.workbench.mobile.data.auth.ControlPlaneSessionStore
import com.workbench.mobile.data.auth.TokenStore
import com.workbench.mobile.data.network.GatewayEndpointStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton

/**
 * 应用级 DI 绑定
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    /**
     * OkHttp 客户端：仅附带已保存会话的 JWT。
     *
     * 网关负责验证 token 并向下游注入身份；客户端不发送可伪造的用户头。
     */
    @Provides
    @Singleton
    fun provideOkHttpClient(
        tokenStore: TokenStore,
        gatewayEndpointStore: GatewayEndpointStore
    ): OkHttpClient {
        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val builder = original.newBuilder()
            val token = tokenStore.cachedAccessToken
            if (!token.isNullOrBlank() && original.header("Authorization") == null) {
                builder.header("Authorization", "Bearer $token")
            }
            chain.proceed(builder.build())
        }

        val builder = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .addInterceptor(gatewayEndpointStore.interceptor())
            .addInterceptor(authInterceptor)
        if (BuildConfig.DEBUG) {
            val logger = HttpLoggingInterceptor().apply {
                // 不记录 Authorization 与通知内容，避免调试日志泄露会话数据。
                level = HttpLoggingInterceptor.Level.BASIC
            }
            builder.addInterceptor(logger)
        }
        return builder.build()
    }

    /**
     * JSON 解析器
     */
    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }

    /**
     * Retrofit 使用稳定占位 host；真正的地址由 GatewayEndpointStore 在请求时
     * 改写为唯一的 /api/v1 网关入口，支持真机运行时切换局域网地址。
     */
    @Provides
    @Singleton
    fun provideRetrofit(okHttp: OkHttpClient, json: Json): Retrofit {
        return Retrofit.Builder()
            .baseUrl(GatewayEndpointStore.retrofitPlaceholderBaseUrl)
            .client(okHttp)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    /**
     * AuthApi
     */
    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)

    /**
     * NotificationApi — 底栏徽标 / 未读通知
     */
    @Provides
    @Singleton
    fun provideNotificationApi(retrofit: Retrofit): NotificationApi =
        retrofit.create(NotificationApi::class.java)

    /** 控制面仅携带短期设备会话，且仍经 Gateway 转发，绝不直连控制面端口。 */
    @Provides
    @Singleton
    @Named("controlPlane")
    fun provideControlPlaneOkHttpClient(
        sessionStore: ControlPlaneSessionStore,
        gatewayEndpointStore: GatewayEndpointStore
    ): OkHttpClient {
        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val request = original.newBuilder().apply {
                sessionStore.cachedAccessToken
                    ?.takeIf { original.header("Authorization") == null }
                    ?.let { header("Authorization", "Bearer $it") }
            }.build()
            chain.proceed(request)
        }
        return OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .addInterceptor(gatewayEndpointStore.interceptor())
            .addInterceptor(authInterceptor)
            .apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
                }
            }
            .build()
    }

    @Provides
    @Singleton
    @Named("controlPlane")
    fun provideControlPlaneRetrofit(
        @Named("controlPlane") okHttp: OkHttpClient,
        json: Json
    ): Retrofit = Retrofit.Builder()
        .baseUrl(GatewayEndpointStore.retrofitPlaceholderBaseUrl)
        .client(okHttp)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    fun provideControlPlaneApi(
        @Named("controlPlane") retrofit: Retrofit
    ): ControlPlaneApi = retrofit.create(ControlPlaneApi::class.java)
}
