package com.workbench.mobile.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * 设计令牌 — Tailwind 思路：
 * 1. [Palette] 原始色阶（**唯一**允许写 Color(0x…) 的地方）
 * 2. [语义别名] 指向 Palette；UI / Theme 只消费语义名
 *
 * UI 代码禁止：Color(0x…)、#RRGGBB、Color.White / Color.Black 字面量。
 */

// ─────────────────────────────────────────────
// 1. Primitive palette
// ─────────────────────────────────────────────
object Palette {
    val transparent = Color(0x00000000)
    val white = Color(0xFFFFFFFF)
    val black = Color(0xFF000000)

    // Gray
    val gray50 = Color(0xFFFAFAFA)
    val gray100 = Color(0xFFF7F7F7)   // bottom bar
    val gray125 = Color(0xFFF4F4F5)   // neutral-100 legacy
    val gray150 = Color(0xFFEDEDED)   // page / top chrome
    val gray200 = Color(0xFFE4E4E7)
    val gray250 = Color(0xFFD8D8D8)
    val gray300 = Color(0xFFC0C0C0)
    val gray350 = Color(0xFFB2B2B2)
    val gray400 = Color(0xFFA1A1AA)
    val gray500 = Color(0xFF7F7F7F)
    val gray600 = Color(0xFF52525B)
    val gray700 = Color(0xFF4C4C4C)
    val gray750 = Color(0xFF3F3F46)
    val gray800 = Color(0xFF27272A)
    val gray850 = Color(0xFF191919)
    val gray900 = Color(0xFF181818)   // WeChat ink
    val gray925 = Color(0xFF18181B)
    val gray950 = Color(0xFF09090B)
    val gray333 = Color(0xFF333333)

    // Indigo (brand)
    val indigo50 = Color(0xFFEEF0FF)
    val indigo400 = Color(0xFF6366F1)
    val indigo500 = Color(0xFF3D5AFE)
    val indigo600 = Color(0xFF324BE0)
    val indigo700 = Color(0xFF2939C2)

    // Green
    val green50 = Color(0xFFECFDF5)
    val green500 = Color(0xFF07C160)  // WeChat green
    val green600 = Color(0xFF10B981)

    // Accents
    val amber50 = Color(0xFFFEF3C7)
    val amber500 = Color(0xFFF59E0B)
    val red50 = Color(0xFFFEE2E2)
    val red500 = Color(0xFFEF4444)
    /** 微信角标红（消息数字 / 红点） */
    val redBadge = Color(0xFFFA5151)
    val blue500 = Color(0xFF3B82F6)
    val link = Color(0xFF576B95)

    // Overlays
    val blackAlpha08 = Color(0x14000000)
}

// ─────────────────────────────────────────────
// 2. Semantic tokens（UI 只引用这些）
// ─────────────────────────────────────────────

// Brand
val BrandPrimary = Palette.indigo500
val BrandPrimaryHover = Palette.indigo600
val BrandPrimaryPressed = Palette.indigo700
val BrandPrimarySubtle = Palette.indigo50
val OnPrimary = Palette.white

// Neutral bridge (MaterialTheme)
val Neutral0 = Palette.white
val Neutral50 = Palette.gray50
val Neutral100 = Palette.gray125
val Neutral200 = Palette.gray200
val Neutral400 = Palette.gray400
val Neutral600 = Palette.gray600
val Neutral800 = Palette.gray800
val Neutral900 = Palette.gray925
val Neutral950 = Palette.gray950

// WeChat surface / chrome
val WeChatPageBg = Palette.gray150
val WeChatCardBg = Palette.white
val WeChatChromeBg = Palette.gray150
val WeChatBottomBarBg = Palette.gray100
val WeChatDivider = Palette.blackAlpha08
val WeChatInk = Palette.gray900
val WeChatInkStrong = Palette.gray850
val WeChatInkMuted = Palette.gray500
val WeChatGreen = Palette.green500
val WeChatLink = Palette.link
val WeChatPlusMenuBg = Palette.gray700
val WeChatDoneEnabled = Palette.green500
val WeChatDoneDisabled = Palette.gray350
val WeChatPlaceholder = Palette.gray350
val WeChatChevron = Palette.gray300
val WeChatClearBg = Palette.gray250
/** + 菜单上的浅色字/图标 */
val WeChatMenuOnDark = Palette.white

// Semantic
val SemanticSuccess = Palette.green600
val SemanticSuccessSubtle = Palette.green50
val SemanticWarning = Palette.amber500
val SemanticWarningSubtle = Palette.amber50
val SemanticError = Palette.red500
val SemanticErrorSubtle = Palette.red50
val SemanticInfo = Palette.blue500

// Dark
val DarkBackground = Palette.gray950
val DarkSurface = Palette.gray925
val DarkSurfaceElevated = Palette.gray800
val DarkBorder = Palette.gray750
val DarkTextPrimary = Palette.gray50
val DarkTextSecondary = Palette.gray400
val DarkBrandPrimary = Palette.indigo400

// Domain accents
val FileTypeDesign = Palette.amber500
val FileTypeImage = Palette.blue500
val ScanOverlayBg = Palette.gray950
val ScanToolbarIcon = Palette.gray333
val StatusOnline = Palette.green500
/** 底栏/列表角标红 */
val BadgeRed = Palette.redBadge
val BadgeOnRed = Palette.white
