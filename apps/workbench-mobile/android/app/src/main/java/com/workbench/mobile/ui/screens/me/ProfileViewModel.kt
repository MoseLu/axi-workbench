package com.workbench.mobile.ui.screens.me

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.workbench.mobile.data.profile.ProfileStore
import com.workbench.mobile.data.profile.UserProfile
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val profileStore: ProfileStore
) : ViewModel() {

    val profile: StateFlow<UserProfile> = profileStore.profileFlow.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = UserProfile()
    )

    fun setNickname(value: String) {
        if (value.isBlank()) return
        viewModelScope.launch { profileStore.updateNickname(value) }
    }

    fun setEmail(value: String) {
        if (value.isBlank()) return
        viewModelScope.launch { profileStore.updateEmail(value) }
    }

    fun setPhone(value: String) {
        viewModelScope.launch { profileStore.updatePhone(value) }
    }

    fun setAvatar(uri: Uri, onDone: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            onDone(profileStore.updateAvatarFromUri(uri))
        }
    }
}
