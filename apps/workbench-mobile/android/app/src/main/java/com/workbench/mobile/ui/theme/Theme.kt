package com.workbench.mobile.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// 亮色主题
private val LightColors = lightColorScheme(
    primary = BrandPrimary,
    onPrimary = OnPrimary,
    primaryContainer = BrandPrimarySubtle,
    onPrimaryContainer = BrandPrimaryPressed,

    secondary = Neutral800,
    onSecondary = Neutral0,
    secondaryContainer = Neutral100,
    onSecondaryContainer = Neutral900,

    tertiary = SemanticInfo,
    onTertiary = Neutral0,

    // 微信分层：灰底 + 白卡片（全页通用）
    background = WeChatPageBg,
    onBackground = Neutral900,
    surface = WeChatCardBg,
    onSurface = Neutral900,
    surfaceVariant = WeChatPageBg,
    onSurfaceVariant = Neutral600,

    error = SemanticError,
    onError = Neutral0,
    errorContainer = SemanticErrorSubtle,
    onErrorContainer = SemanticError,

    outline = Neutral200,
    outlineVariant = Neutral100,
)

// 暗色主题
private val DarkColors = darkColorScheme(
    primary = DarkBrandPrimary,
    onPrimary = Neutral0,
    primaryContainer = Neutral800,
    onPrimaryContainer = BrandPrimarySubtle,

    secondary = Neutral100,
    onSecondary = Neutral900,
    secondaryContainer = Neutral800,
    onSecondaryContainer = Neutral100,

    tertiary = SemanticInfo,
    onTertiary = Neutral0,

    background = DarkBackground,
    onBackground = DarkTextPrimary,
    surface = DarkSurface,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkSurfaceElevated,
    onSurfaceVariant = DarkTextSecondary,

    error = SemanticError,
    onError = Neutral0,

    outline = DarkBorder,
    outlineVariant = DarkSurfaceElevated,
)

@Composable
fun WorkBenchTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColors else LightColors
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // 顶栏/页底同为微信浅灰
            window.statusBarColor = WeChatChromeBg.toArgb()
            window.navigationBarColor = WeChatChromeBg.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !darkTheme
                isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography,
        shapes = AppShapes,
        content = content
    )
}