package com.workbench.mobile.ui.components

import android.app.Application
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.workbench.mobile.data.repository.NavBadgeRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface NavBadgeEntryPoint {
    fun navBadgeRepository(): NavBadgeRepository
}

/**
 * 订阅真实 API 徽标；在任意带底栏的页面调用。
 */
@Composable
fun rememberTabBadges(): State<TabBadges> {
    val app = LocalContext.current.applicationContext as Application
    val repo = remember {
        EntryPointAccessors.fromApplication(app, NavBadgeEntryPoint::class.java)
            .navBadgeRepository()
    }
    LaunchedEffect(repo) {
        repo.start()
        repo.refresh()
    }
    return repo.badges.collectAsStateWithLifecycle()
}
