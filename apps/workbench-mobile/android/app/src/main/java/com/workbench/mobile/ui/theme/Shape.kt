package com.workbench.mobile.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * 圆角令牌（Tailwind rounded-* 思路）
 * **唯一**允许写 `.dp` 字面量的尺寸源文件之一（与 Spacing / Size 并列）。
 */
object Radius {
    val none: Dp = 0.dp
    val xs: Dp = 4.dp
    val sm: Dp = 8.dp
    val md: Dp = 12.dp
    val lg: Dp = 16.dp
    val full: Dp = 999.dp
}

val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(Radius.xs),
    small = RoundedCornerShape(Radius.sm),
    medium = RoundedCornerShape(Radius.sm),
    large = RoundedCornerShape(Radius.md),
    extraLarge = RoundedCornerShape(Radius.lg),
)

/**
 * 间距令牌（Tailwind spacing scale，4 的倍数）
 * UI 禁止裸写 `N.dp`，请用 Spacing / Size。
 */
object Spacing {
    val s0: Dp = 0.dp
    val px: Dp = 1.dp
    val hairline: Dp = 0.5.dp
    val s0_5: Dp = 2.dp
    val s1: Dp = 4.dp
    val s1_5: Dp = 6.dp
    val s2: Dp = 8.dp
    val s2_5: Dp = 10.dp
    val s3: Dp = 12.dp
    val s3_5: Dp = 14.dp
    val s4: Dp = 16.dp
    val s5: Dp = 20.dp
    val s6: Dp = 24.dp
    val s7: Dp = 28.dp
    val s8: Dp = 32.dp
    val s9: Dp = 36.dp
    val s10: Dp = 40.dp
    val s11: Dp = 44.dp
    val s12: Dp = 48.dp
    val s13: Dp = 52.dp
    val s14: Dp = 56.dp
    val s16: Dp = 64.dp
    val s20: Dp = 80.dp
    val s24: Dp = 96.dp
}

/**
 * 组件尺寸令牌（hit area / bar / icon）
 */
object Size {
    val iconXs: Dp = 14.dp
    val iconSm: Dp = 16.dp
    val iconMd: Dp = 18.dp
    val iconLg: Dp = 20.dp
    val iconXl: Dp = 22.dp          // WeChat top action icon
    val icon2xl: Dp = 24.dp
    val icon3xl: Dp = 28.dp
    val hitSm: Dp = 36.dp
    val hit: Dp = 40.dp
    val hitLg: Dp = 44.dp
    val bar: Dp = 48.dp             // top bar content height
    /** 微信式状态提示：只在同步、异常、待处理时占一行，不充当数据面板。 */
    val statusRow: Dp = 48.dp
    /**
     * 底栏内容高度：padTop 10 + icon 24 + gap 4 + label 12 + padBottom 8 = 58，取 60。
     * 角标可向上略溢出，不挤掉文字。
     */
    val barBottom: Dp = 60.dp
    val row: Dp = 56.dp
    val avatarSm: Dp = 48.dp
    val avatarMd: Dp = 64.dp
    val avatarLg: Dp = 68.dp
    val avatarRow: Dp = 72.dp
    val bubbleW: Dp = 120.dp
    val bubbleArrowH: Dp = 7.dp
    val bubbleArrowW: Dp = 12.dp
    val previewDot: Dp = 36.dp
    val hero: Dp = 160.dp
    val scanFrame: Dp = 260.dp
    val scanFrameSm: Dp = 220.dp
    /** 微信红点直径 */
    val badgeDot: Dp = 8.dp
    /** 数字徽标最小宽 / 高 */
    val badgeMin: Dp = 16.dp
    val badgeH: Dp = 16.dp
    /** 底栏 tab 垂直内边距 */
    val barTabPadTop: Dp = 10.dp
    val barTabPadBottom: Dp = 8.dp
    /** 图标与文案间距 */
    val barTabIconLabelGap: Dp = 4.dp
}
