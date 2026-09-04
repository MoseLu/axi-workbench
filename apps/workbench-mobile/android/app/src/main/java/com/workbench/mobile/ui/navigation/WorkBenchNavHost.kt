package com.workbench.mobile.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.workbench.mobile.ui.screens.file.FilePreviewScreen
import com.workbench.mobile.ui.screens.home.HomeScreen
import com.workbench.mobile.ui.screens.me.AccountInfoScreen
import com.workbench.mobile.ui.screens.me.DevicesScreen
import com.workbench.mobile.ui.screens.me.MeScreen
import com.workbench.mobile.ui.screens.me.NotificationsScreen
import com.workbench.mobile.ui.screens.me.ProfileEditField
import com.workbench.mobile.ui.screens.me.ProfileFieldEditScreen
import com.workbench.mobile.ui.screens.me.ThemeScreen
import com.workbench.mobile.ui.screens.project.ProjectDetailScreen
import com.workbench.mobile.ui.screens.project.ProjectDeveloperInfoScreen
import com.workbench.mobile.ui.screens.scan.ScanScreen
import com.workbench.mobile.ui.screens.scanresult.ScanResultScreen
import com.workbench.mobile.ui.screens.search.SearchScreen
import com.workbench.mobile.ui.screens.settings.SettingsScreen
import com.workbench.mobile.ui.screens.workspace.WorkspaceScreen
import com.workbench.mobile.ui.screens.workspace.WorkspaceGroupScreen
import com.workbench.mobile.ui.screens.workspace.PendingWorkScreen
import com.workbench.mobile.ui.screens.workspace.WorkspaceViewModel
import java.net.URLDecoder
import java.net.URLEncoder

object Routes {
    const val HOME = "home"
    const val SCAN = "scan"
    const val SCAN_RESULT = "scan_result/{value}"
    const val PROJECTS = "projects"
    const val PROJECT_DETAIL = "project/{projectId}"
    const val PROJECT_DEVELOPER = "project/{projectId}/developer"
    const val WORKSPACE = "workspace"
    const val PENDING = "pending"
    const val WORKSPACE_GROUP = "workspace/group/{groupId}"
    const val WORKSPACE_STATUS = "workspace/status"
    const val FILE_PREVIEW = "file/{fileId}"
    const val ME = "me"
    const val ACCOUNT = "me/account"
    const val ACCOUNT_EDIT = "me/account/edit/{field}"
    const val DEVICES = "me/devices"
    const val NOTIFICATIONS = "me/notifications"
    const val THEME = "me/theme"
    const val SETTINGS = "settings"
    const val SEARCH = "search"

    fun accountEdit(field: String) = "me/account/edit/$field"

    fun projectDetail(id: String) = "project/$id"
    fun projectDeveloper(id: String) = "project/$id/developer"
    fun workspaceGroup(id: String) = "workspace/group/$id"
    fun filePreview(id: String) = "file/$id"
    fun scanResult(rawValue: String): String {
        val encoded = URLEncoder.encode(rawValue, "UTF-8")
        return "scan_result/$encoded"
    }
}

@Composable
fun WorkBenchNavHost() {
    val nav = rememberNavController()
    // 工作区事实属于导航图共享状态，而不是每页各建一个同步器。
    val workspaceViewModel: WorkspaceViewModel = hiltViewModel()
    val backStackEntry by nav.currentBackStackEntryAsState()

    LaunchedEffect(backStackEntry?.destination?.route) {
        workspaceViewModel.ensureFresh()
    }

    NavHost(
        navController = nav,
        startDestination = Routes.WORKSPACE
    ) {
        composable(Routes.HOME) {
            HomeScreen(
                onScanClick = { nav.navigate(Routes.SCAN) },
                onSearchClick = { nav.navigate(Routes.SEARCH) },
                onTabWork = { nav.navigate(Routes.WORKSPACE) },
                onTabPending = { nav.navigate(Routes.PENDING) },
                onTabMe = { nav.navigate(Routes.ME) },
                onPendingClick = { nav.navigate(Routes.PENDING) },
                onProjectClick = { id -> nav.navigate(Routes.projectDetail(id)) },
                viewModel = workspaceViewModel
            )
        }

        composable(Routes.SEARCH) {
            SearchScreen(
                onBack = { nav.popBackStack() },
                onStatusClick = { nav.navigate(Routes.PENDING) },
                onProjectClick = { id -> nav.navigate(Routes.projectDetail(id)) },
                viewModel = workspaceViewModel
            )
        }

        composable(Routes.SCAN) {
            ScanScreen(
                onBack = { nav.popBackStack() },
                onGeneralScanResult = { rawValue ->
                    nav.navigate(Routes.scanResult(rawValue))
                },
                onDevicePairingScanned = workspaceViewModel::refresh
            )
        }

        composable(
            route = Routes.SCAN_RESULT,
            arguments = listOf(navArgument("value") { type = NavType.StringType })
        ) { backStackEntry ->
            val encoded = backStackEntry.arguments?.getString("value") ?: ""
            val rawValue = URLDecoder.decode(encoded, "UTF-8")
            ScanResultScreen(
                rawValue = rawValue,
                onBack = { nav.popBackStack() }
            )
        }

        composable(Routes.PROJECTS) {
            LaunchedEffect(Unit) {
                nav.navigate(Routes.WORKSPACE) {
                    popUpTo(Routes.PROJECTS) { inclusive = true }
                }
            }
        }

        composable(
            route = Routes.PROJECT_DETAIL,
            arguments = listOf(navArgument("projectId") { type = NavType.StringType })
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("projectId") ?: ""
            ProjectDetailScreen(
                projectId = id,
                onBack = { nav.popBackStack() },
                onDeveloperInfo = { nav.navigate(Routes.projectDeveloper(id)) },
                viewModel = workspaceViewModel
            )
        }

        composable(
            route = Routes.PROJECT_DEVELOPER,
            arguments = listOf(navArgument("projectId") { type = NavType.StringType })
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("projectId") ?: ""
            ProjectDeveloperInfoScreen(
                projectId = id,
                onBack = { nav.popBackStack() },
                viewModel = workspaceViewModel
            )
        }

        composable(Routes.WORKSPACE) {
            WorkspaceScreen(
                onSearchClick = { nav.navigate(Routes.SEARCH) },
                onScanClick = { nav.navigate(Routes.SCAN) },
                onTabHome = { nav.navigate(Routes.HOME) },
                onTabPending = { nav.navigate(Routes.PENDING) },
                onTabMe = { nav.navigate(Routes.ME) },
                onGroupClick = { id -> nav.navigate(Routes.workspaceGroup(id)) },
                viewModel = workspaceViewModel
            )
        }

        composable(Routes.WORKSPACE_STATUS) {
            LaunchedEffect(Unit) {
                nav.navigate(Routes.PENDING) {
                    popUpTo(Routes.WORKSPACE_STATUS) { inclusive = true }
                }
            }
        }

        composable(Routes.PENDING) {
            PendingWorkScreen(
                onSearchClick = { nav.navigate(Routes.SEARCH) },
                onScanClick = { nav.navigate(Routes.SCAN) },
                onTabHome = { nav.navigate(Routes.HOME) },
                onTabWork = { nav.navigate(Routes.WORKSPACE) },
                onTabMe = { nav.navigate(Routes.ME) },
                onProjectClick = { id -> nav.navigate(Routes.projectDetail(id)) },
                viewModel = workspaceViewModel
            )
        }

        composable(
            route = Routes.WORKSPACE_GROUP,
            arguments = listOf(navArgument("groupId") { type = NavType.StringType })
        ) { backStackEntry ->
            val groupId = backStackEntry.arguments?.getString("groupId").orEmpty()
            WorkspaceGroupScreen(
                groupRouteId = groupId,
                onBack = { nav.popBackStack() },
                onProjectClick = { id -> nav.navigate(Routes.projectDetail(id)) },
                viewModel = workspaceViewModel
            )
        }

        composable(
            route = Routes.FILE_PREVIEW,
            arguments = listOf(navArgument("fileId") { type = NavType.StringType })
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("fileId") ?: ""
            FilePreviewScreen(
                fileId = id,
                onBack = { nav.popBackStack() }
            )
        }

        composable(Routes.ME) {
            MeScreen(
                onProfileClick = { nav.navigate(Routes.ACCOUNT) },
                onDevicesClick = { nav.navigate(Routes.DEVICES) },
                onNotificationsClick = { nav.navigate(Routes.NOTIFICATIONS) },
                onThemeClick = { nav.navigate(Routes.THEME) },
                onSettingsClick = { nav.navigate(Routes.SETTINGS) },
                onTabHome = { nav.navigate(Routes.HOME) },
                onTabWork = { nav.navigate(Routes.WORKSPACE) },
                onTabPending = { nav.navigate(Routes.PENDING) },
                workspaceViewModel = workspaceViewModel
            )
        }

        composable(Routes.ACCOUNT) {
            AccountInfoScreen(
                onBack = { nav.popBackStack() },
                onEditNickname = { nav.navigate(Routes.accountEdit("nickname")) },
                onEditEmail = { nav.navigate(Routes.accountEdit("email")) },
                onEditPhone = { nav.navigate(Routes.accountEdit("phone")) }
            )
        }
        composable(
            route = Routes.ACCOUNT_EDIT,
            arguments = listOf(navArgument("field") { type = NavType.StringType })
        ) { entry ->
            val fieldArg = entry.arguments?.getString("field").orEmpty()
            val field = when (fieldArg) {
                "email" -> ProfileEditField.Email
                "phone" -> ProfileEditField.Phone
                else -> ProfileEditField.Nickname
            }
            ProfileFieldEditScreen(
                field = field,
                onBack = { nav.popBackStack() }
            )
        }
        composable(Routes.DEVICES) {
            DevicesScreen(onBack = { nav.popBackStack() })
        }
        composable(Routes.NOTIFICATIONS) {
            NotificationsScreen(onBack = { nav.popBackStack() })
        }
        composable(Routes.THEME) {
            ThemeScreen(onBack = { nav.popBackStack() })
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(
                onBack = { nav.popBackStack() },
                onLogout = {
                    nav.navigate(Routes.WORKSPACE) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }

    // 处理 workbench:// 深链
    LaunchedEffect(Unit) {
        // TODO: 处理 deep link
    }
}
