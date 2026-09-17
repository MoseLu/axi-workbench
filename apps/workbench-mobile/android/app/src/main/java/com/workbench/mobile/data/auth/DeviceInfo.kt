package com.workbench.mobile.data.auth

import android.content.Context
import android.os.Build
import android.provider.Settings
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 设备指纹：Android ID（卸载重装后会变，但同一设备基本稳定）
 * App 重装后会变化，但服务端只用于审计，不强依赖稳定性。
 */
@Singleton
class DeviceInfo @Inject constructor(
    @ApplicationContext private val context: Context
) {
    val deviceId: String by lazy {
        Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: "unknown-android-${System.currentTimeMillis()}"
    }

    val platform: String = "android"

    val controlPlaneDeviceName: String by lazy {
        listOf(Build.MANUFACTURER, Build.MODEL)
            .filter { it.isNotBlank() }
            .joinToString(" ")
            .ifBlank { "Axi Android" }
    }

    val appVersion: String by lazy {
        try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0.0"
        } catch (_: Exception) {
            "1.0.0"
        }
    }
}
