package com.workbench.mobile.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * 字号令牌（Tailwind text-*）
 * **唯一**允许写 `.sp` 字面量的字体源。
 */
object FontSize {
    val xxs: TextUnit = 10.sp
    val xs: TextUnit = 11.sp
    val sm: TextUnit = 12.sp
    val md: TextUnit = 14.sp
    val base: TextUnit = 15.sp
    val lg: TextUnit = 16.sp
    val xl: TextUnit = 17.sp
    val x2l: TextUnit = 18.sp
    val x3l: TextUnit = 22.sp
}

object LetterSpacing {
    val none: TextUnit = 0.sp
    val wide: TextUnit = 0.5.sp
}

object LineHeight {
    val xs: TextUnit = 14.sp
    val sm: TextUnit = 16.sp
    val md: TextUnit = 20.sp
    val lg: TextUnit = 22.sp
    val xl: TextUnit = 24.sp
    val x2l: TextUnit = 28.sp
}

// 字体：西文 Inter（默认 sans-serif），中文回退到系统
private val Sans = FontFamily.SansSerif
private val Mono = FontFamily.Monospace

val AppTypography = Typography(
    titleLarge = TextStyle(
        fontFamily = Sans,
        fontWeight = FontWeight.SemiBold,
        fontSize = FontSize.x3l,
        lineHeight = LineHeight.x2l,
        letterSpacing = LetterSpacing.none,
    ),
    titleMedium = TextStyle(
        fontFamily = Sans,
        fontWeight = FontWeight.SemiBold,
        fontSize = FontSize.x2l,
        lineHeight = LineHeight.xl,
        letterSpacing = LetterSpacing.none,
    ),
    titleSmall = TextStyle(
        fontFamily = Sans,
        fontWeight = FontWeight.Medium,
        fontSize = FontSize.lg,
        lineHeight = LineHeight.lg,
        letterSpacing = LetterSpacing.none,
    ),
    bodyLarge = TextStyle(
        fontFamily = Sans,
        fontWeight = FontWeight.Normal,
        fontSize = FontSize.md,
        lineHeight = LineHeight.md,
        letterSpacing = LetterSpacing.none,
    ),
    bodyMedium = TextStyle(
        fontFamily = Sans,
        fontWeight = FontWeight.Normal,
        fontSize = FontSize.md,
        lineHeight = LineHeight.md,
        letterSpacing = LetterSpacing.none,
    ),
    bodySmall = TextStyle(
        fontFamily = Sans,
        fontWeight = FontWeight.Normal,
        fontSize = FontSize.sm,
        lineHeight = LineHeight.sm,
        letterSpacing = LetterSpacing.none,
    ),
    labelLarge = TextStyle(
        fontFamily = Sans,
        fontWeight = FontWeight.Medium,
        fontSize = FontSize.md,
        lineHeight = LineHeight.md,
        letterSpacing = LetterSpacing.none,
    ),
    labelMedium = TextStyle(
        fontFamily = Sans,
        fontWeight = FontWeight.Medium,
        fontSize = FontSize.sm,
        lineHeight = LineHeight.sm,
        letterSpacing = LetterSpacing.none,
    ),
    labelSmall = TextStyle(
        fontFamily = Sans,
        fontWeight = FontWeight.Medium,
        fontSize = FontSize.xs,
        lineHeight = LineHeight.xs,
        letterSpacing = LetterSpacing.wide,
    ),
)

// WeChat chrome 专用文字样式
val TextStyleChromeTitle = TextStyle(
    fontFamily = Sans,
    fontWeight = FontWeight.SemiBold,
    fontSize = FontSize.xl,
    lineHeight = LineHeight.xl,
    color = WeChatInk,
)

val TextStyleChromeBody = TextStyle(
    fontFamily = Sans,
    fontWeight = FontWeight.Normal,
    fontSize = FontSize.lg,
    lineHeight = LineHeight.lg,
    color = WeChatInk,
)

val TextStyleChromeMenu = TextStyle(
    fontFamily = Sans,
    fontWeight = FontWeight.Medium,
    fontSize = FontSize.base,
    lineHeight = LineHeight.md,
    color = WeChatMenuOnDark,
)

val MonoStyle = TextStyle(
    fontFamily = Mono,
    fontWeight = FontWeight.Normal,
    fontSize = FontSize.md,
    lineHeight = LineHeight.md,
)
