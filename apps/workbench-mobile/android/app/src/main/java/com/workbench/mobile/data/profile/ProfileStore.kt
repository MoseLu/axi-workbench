package com.workbench.mobile.data.profile

import android.content.Context
import android.net.Uri
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.workbench.mobile.data.auth.TokenStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import javax.inject.Inject
import javax.inject.Singleton

private val Context.profileDataStore by preferencesDataStore(name = "user_profile")

data class UserProfile(
    val nickname: String = "未登录",
    val email: String = "未绑定邮箱",
    val phone: String = "",
    /** 本地文件绝对路径；空则用默认 drawable */
    val avatarPath: String = "",
    val workbenchId: String = "—",
    val registeredAt: String = "—",
    val status: String = "未登录",
    val sessionActive: Boolean = false
) {
    val phoneDisplay: String get() = phone.ifBlank { "未绑定" }
    val hasCustomAvatar: Boolean get() = avatarPath.isNotBlank() && File(avatarPath).exists()
}

/**
 * 个人信息本地存储（DataStore + 头像文件）。
 */
@Singleton
class ProfileStore @Inject constructor(
    @ApplicationContext private val context: Context,
    private val tokenStore: TokenStore
) {
    private val nicknameKey = stringPreferencesKey("nickname")
    private val emailKey = stringPreferencesKey("email")
    private val phoneKey = stringPreferencesKey("phone")
    private val avatarPathKey = stringPreferencesKey("avatar_path")

    val profileFlow: Flow<UserProfile> = combine(
        context.profileDataStore.data,
        tokenStore.userIdFlow,
        tokenStore.userNameFlow,
        tokenStore.userEmailFlow
    ) { prefs, rawUserId, rawUserName, rawUserEmail ->
        val userId = rawUserId.normalized()
        val userName = rawUserName.normalized()
        val userEmail = rawUserEmail.normalized()
        val signedIn = userId != null
        val localNickname = prefs[nicknameKey].normalized()
        val localEmail = prefs[emailKey].normalized()

        UserProfile(
            nickname = if (signedIn) userName ?: localNickname ?: userEmail?.substringBefore('@') ?: "已登录用户" else "未登录",
            email = if (signedIn) userEmail ?: localEmail ?: "未绑定邮箱" else "未绑定邮箱",
            phone = prefs[phoneKey] ?: "",
            avatarPath = prefs[avatarPathKey] ?: "",
            workbenchId = userId ?: "—",
            status = if (signedIn) "已登录" else "未登录",
            sessionActive = signedIn
        )
    }

    suspend fun updateNickname(value: String) {
        context.profileDataStore.edit { it[nicknameKey] = value.trim() }
    }

    suspend fun updateEmail(value: String) {
        context.profileDataStore.edit { it[emailKey] = value.trim() }
    }

    suspend fun updatePhone(value: String) {
        context.profileDataStore.edit { it[phoneKey] = value.trim() }
    }

    /**
     * 将相册/图库 URI 复制到应用私有目录并记录路径。
     */
    suspend fun updateAvatarFromUri(uri: Uri): Boolean = withContext(Dispatchers.IO) {
        try {
            val dir = File(context.filesDir, "profile").apply { mkdirs() }
            val dest = File(dir, "avatar.jpg")
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(dest).use { output -> input.copyTo(output) }
            } ?: return@withContext false
            context.profileDataStore.edit { it[avatarPathKey] = dest.absolutePath }
            true
        } catch (_: Exception) {
            false
        }
    }

    suspend fun clearAvatar() {
        withContext(Dispatchers.IO) {
            File(context.filesDir, "profile/avatar.jpg").delete()
        }
        context.profileDataStore.edit { it.remove(avatarPathKey) }
    }
}

private fun String?.normalized(): String? = this?.trim()?.takeIf { it.isNotEmpty() }
