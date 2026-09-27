package com.workbench.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.Stable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import com.workbench.mobile.ui.theme.BadgeOnRed
import com.workbench.mobile.ui.theme.BadgeRed
import com.workbench.mobile.ui.theme.FontSize
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing

/**
 * 微信式导航徽标：
 * - [None] 无
 * - [Dot] 红点（通知）
 * - [Count] 数字，>99 → 99+
 *
 * 定位（真机微信）：
 * - 以图标右上角为锚点，徽标**向右外伸**（宽数字不往左压图标）
 * - 1 位 / 2 位共用同一锚点，相对位置一致
 */
@Immutable
sealed class NavBadge {
    data object None : NavBadge()
    data object Dot : NavBadge()
    data class Count(val value: Int) : NavBadge() {
        init {
            require(value >= 0)
        }
    }

    val isVisible: Boolean
        get() = when (this) {
            None -> false
            Dot -> true
            is Count -> value > 0
        }

    companion object {
        fun ofCount(value: Int): NavBadge =
            if (value <= 0) None else Count(value)

        fun formatCount(value: Int): String =
            if (value > 99) "99+" else value.toString()
    }
}

@Stable
data class TabBadges(
    val home: NavBadge = NavBadge.None,
    val work: NavBadge = NavBadge.None,
    val me: NavBadge = NavBadge.None
) {
    companion object {
        /** 空态：等 API；勿再使用硬编码 Demo 数量 */
        val Empty = TabBadges()
    }
}

/**
 * 图标 + 角标。角标锚在 [iconSize] 右上角，向右/略上生长。
 */
@Composable
fun BadgedIcon(
    badge: NavBadge,
    modifier: Modifier = Modifier,
    iconSize: Dp = Size.icon2xl,
    content: @Composable BoxScope.() -> Unit
) {
    // 固定图标盒，所有 tab 同一坐标系 → 概览/我的相对位置一致
    Box(
        modifier = modifier.size(iconSize)
    ) {
        Box(
            modifier = Modifier
                .size(iconSize)
                .align(Alignment.Center),
            contentAlignment = Alignment.Center,
            content = content
        )
        if (!badge.isVisible) return@Box

        // 锚点：图标右上角（约右缘内 6dp、上缘上 3dp）
        // 徽标左上角落在此点 → 向右外伸；1/2 位同锚点，概览/我的相对位置一致
        val anchorX = iconSize - Spacing.s1_5
        val anchorY = -Spacing.s0_5 - Spacing.px

        when (badge) {
            NavBadge.None -> Unit
            NavBadge.Dot -> {
                Box(
                    modifier = Modifier
                        .offset(
                            x = iconSize - Size.badgeDot + Spacing.s0_5,
                            y = -Spacing.s0_5
                        )
                        .size(Size.badgeDot)
                        .clip(CircleShape)
                        .background(BadgeRed)
                )
            }
            is NavBadge.Count -> {
                val label = NavBadge.formatCount(badge.value)
                val wide = badge.value > 9
                // 数字垂直居中：关掉 includeFontPadding，行高=字号，避免中文数字视觉偏下
                Box(
                    modifier = Modifier
                        .offset(x = anchorX, y = anchorY)
                        .height(Size.badgeH)
                        .defaultMinSize(minWidth = Size.badgeMin)
                        .clip(RoundedCornerShape(Radius.full))
                        .background(BadgeRed)
                        .padding(horizontal = if (wide) Spacing.s1 else Spacing.s0_5),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = label,
                        color = BadgeOnRed,
                        style = TextStyle(
                            fontSize = FontSize.xxs,
                            lineHeight = FontSize.xxs,
                            fontWeight = FontWeight.Medium,
                            textAlign = TextAlign.Center,
                            platformStyle = PlatformTextStyle(includeFontPadding = false),
                            lineHeightStyle = LineHeightStyle(
                                alignment = LineHeightStyle.Alignment.Center,
                                trim = LineHeightStyle.Trim.Both
                            )
                        ),
                        maxLines = 1
                    )
                }
            }
        }
    }
}
