package com.workbench.mobile.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
// Box already imported
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.workbench.mobile.R
import com.workbench.mobile.ui.theme.FontSize
import com.workbench.mobile.ui.theme.LineHeight
import com.workbench.mobile.ui.theme.Radius
import com.workbench.mobile.ui.theme.Size
import com.workbench.mobile.ui.theme.Spacing
import com.workbench.mobile.ui.theme.TextStyleChromeMenu
import com.workbench.mobile.ui.theme.TextStyleChromeTitle
import com.workbench.mobile.ui.theme.WeChatBottomBarBg
import com.workbench.mobile.ui.theme.WeChatChromeBg
import com.workbench.mobile.ui.theme.WeChatDivider
import com.workbench.mobile.ui.theme.WeChatGreen
import com.workbench.mobile.ui.theme.WeChatInk
import com.workbench.mobile.ui.theme.WeChatInkMuted
import com.workbench.mobile.ui.theme.WeChatMenuOnDark
import com.workbench.mobile.ui.theme.WeChatPlusMenuBg

// 全部样式来自 theme tokens（禁止本地 Color(0x) / 裸 dp/sp）
private val ActionHitSize = Size.hit
private val ActionIconSize = Size.iconXl
private val TopBarContentHeight = Size.bar
private val BubbleArrowH = Size.bubbleArrowH
private val BubbleArrowW = Size.bubbleArrowW
private val PlusToDividerGap = (Size.bar - Size.hit) / 2

/**
 * 顶栏操作图标：纯色位图资源（#181818 + alpha AA）。
 * 不再做 ColorFilter / AndroidView 绕路——叠色发灰的根因是窗口 translucent，
 * 已在 MainActivity.enforceOpaqueWindow 与 Theme 里强制不透明。
 */
@Composable
private fun WeChatActionIcon(
    @androidx.annotation.DrawableRes resId: Int,
    desc: String,
    modifier: Modifier = Modifier
) {
    Image(
        painter = painterResource(resId),
        contentDescription = desc,
        modifier = modifier.size(ActionIconSize)
    )
}

@Composable
private fun WeChatSearchIcon(modifier: Modifier = Modifier) {
    WeChatActionIcon(
        resId = R.drawable.ic_wechat_search,
        desc = "搜索",
        modifier = modifier
    )
}

@Composable
private fun WeChatPlusIcon(modifier: Modifier = Modifier) {
    WeChatActionIcon(
        resId = R.drawable.ic_wechat_plus,
        desc = "更多",
        modifier = modifier
    )
}

/** 朝上的实心小三角，尖端在上（贴分割线） */
@Composable
private fun BubbleArrowUp(
    modifier: Modifier = Modifier,
    color: Color = WeChatPlusMenuBg
) {
    Canvas(
        modifier = modifier.size(width = BubbleArrowW, height = BubbleArrowH)
    ) {
        val path = Path().apply {
            moveTo(size.width / 2f, 0f) // tip
            lineTo(size.width, size.height)
            lineTo(0f, size.height)
            close()
        }
        drawPath(path, color)
    }
}

/**
 * 微信标准气泡：紧凑 120dp，右缘对齐加号热区；
 * 上三角水平对准加号中心；菜单项内容在气泡内居中。
 * （若整卡相对加号几何居中，右半会出屏被系统左推，故用右对齐 + 三角对位。）
 */
@Composable
private fun WeChatPlusBubble(
    onScan: () -> Unit,
    onDismiss: () -> Unit
) {
    val bubbleWidth = Size.bubbleW
    // 气泡右缘 = 加号热区右缘；三角中心 = 加号中心
    val arrowEndPad = (ActionHitSize - BubbleArrowW) / 2
    Column(
        horizontalAlignment = Alignment.End,
        modifier = Modifier.width(bubbleWidth)
    ) {
        BubbleArrowUp(modifier = Modifier.padding(end = arrowEndPad))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(
                    elevation = Spacing.s1_5,
                    shape = RoundedCornerShape(Radius.sm),
                    clip = false
                )
                .clip(RoundedCornerShape(Radius.sm))
                .background(WeChatPlusMenuBg)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    role = Role.Button,
                    onClick = {
                        onDismiss()
                        onScan()
                    }
                )
                .padding(horizontal = Spacing.s3_5, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_scan),
                contentDescription = null,
                tint = WeChatMenuOnDark,
                modifier = Modifier.size(Size.iconMd)
            )
            Spacer(Modifier.width(Spacing.s2_5))
            Text(text = "扫一扫", style = TextStyleChromeMenu)
        }
    }
}

/**
 * 主 Tab 顶栏（概览/工作/待处理）：
 * - 标题绝对居中，与底栏文案一致
 * - 右侧固定：全局搜索 + 更多（圆圈 +），热区同为 40dp
 * - 左侧仅返回（二级页）；主 Tab 不放头像
 */
@Composable
fun WorkBenchTopBar(
    title: String,
    modifier: Modifier = Modifier,
    showBack: Boolean = false,
    onBack: (() -> Unit)? = null,
    showSearch: Boolean = true,
    onSearch: (() -> Unit)? = null,
    onScan: (() -> Unit)? = null,
    centerTitle: Boolean = true
) {
    var plusMenuOpen by remember { mutableStateOf(false) }
    val density = LocalDensity.current
    val popupOffsetY = with(density) {
        (ActionHitSize + PlusToDividerGap).roundToPx()
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(WeChatChromeBg)
            .statusBarsPadding()
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(TopBarContentHeight)
                .padding(horizontal = Spacing.s1)
        ) {
            // 标题：相对顶栏整宽水平居中
            Text(
                text = title,
                modifier = Modifier
                    .align(if (centerTitle) Alignment.Center else Alignment.CenterStart)
                    .padding(
                        start = if (centerTitle) Spacing.s24 else Size.bar,
                        end = Spacing.s24
                    ),
                textAlign = if (centerTitle) TextAlign.Center else TextAlign.Start,
                style = TextStyleChromeTitle,
                maxLines = 1
            )

            // 左侧：仅返回（二级页）
            if (showBack && onBack != null) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier
                        .align(Alignment.CenterStart)
                        .size(ActionHitSize)
                ) {
                    Icon(
                        Icons.Filled.ArrowBack,
                        contentDescription = "返回",
                        tint = WeChatInk,
                        modifier = Modifier.size(Size.iconXl)
                    )
                }
            }

            // 右侧：自绘细线图标。不用 M3 IconButton（会压内容 alpha≈0.72，颜色发灰）。
            Row(
                modifier = Modifier.align(Alignment.CenterEnd),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (showSearch && onSearch != null) {
                    Box(
                        modifier = Modifier
                            .size(ActionHitSize)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                role = Role.Button,
                                onClick = onSearch
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        WeChatSearchIcon()
                    }
                }
                if (onScan != null) {
                    Box(
                        modifier = Modifier.size(ActionHitSize),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(ActionHitSize)
                                .clickable(
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = null,
                                    role = Role.Button,
                                    onClick = { plusMenuOpen = !plusMenuOpen }
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            WeChatPlusIcon()
                        }
                        if (plusMenuOpen) {
                            Popup(
                                alignment = Alignment.TopEnd,
                                offset = IntOffset(x = 0, y = popupOffsetY),
                                onDismissRequest = { plusMenuOpen = false },
                                properties = PopupProperties(
                                    focusable = true,
                                    dismissOnBackPress = true,
                                    dismissOnClickOutside = true
                                )
                            ) {
                                WeChatPlusBubble(
                                    onScan = onScan,
                                    onDismiss = { plusMenuOpen = false }
                                )
                            }
                        }
                    }
                }
            }
        }
        HorizontalDivider(thickness = Spacing.hairline, color = WeChatDivider)
    }
}

/**
 * 底部导航 — 自绘 4 Tab（概览/工作/待处理/我的），扫一扫不在底栏。
 * 点击：矩形水波纹（tab 格子内），不用 Material3 NavigationBarItem 的椭圆 indicator。
 */
@Composable
fun WorkBenchBottomBar(
    current: String,
    onHome: () -> Unit,
    onWork: () -> Unit,
    onPending: () -> Unit,
    onMe: () -> Unit,
    /** 通知徽标仅用于消息相关入口；待处理角标由控制面快照单独传入。 */
    badges: TabBadges = TabBadges.Empty,
    pendingBadge: NavBadge = NavBadge.None
) {
    // 自绘底栏 + navigationBarsPadding，避免被系统手势条挤出屏幕
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(WeChatBottomBarBg)
            .navigationBarsPadding()
    ) {
        HorizontalDivider(thickness = Spacing.hairline, color = WeChatDivider)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(Size.barBottom),
            verticalAlignment = Alignment.CenterVertically
        ) {
            BottomTab(
                selected = current == "home",
                label = "概览",
                icon = Icons.Filled.Dashboard,
                badge = badges.home,
                onClick = onHome
            )
            BottomTab(
                selected = current == "work",
                label = "工作",
                icon = Icons.Filled.Folder,
                badge = badges.work,
                onClick = onWork
            )
            BottomTab(
                selected = current == "pending",
                label = "待处理",
                icon = Icons.Filled.Assignment,
                badge = pendingBadge,
                onClick = onPending
            )
            BottomTab(
                selected = current == "me",
                label = "我的",
                icon = Icons.Filled.Person,
                badge = badges.me,
                onClick = onMe
            )
        }
    }
}

@Composable
private fun RowScope.BottomTab(
    selected: Boolean,
    label: String,
    icon: ImageVector,
    badge: NavBadge = NavBadge.None,
    onClick: () -> Unit
) {
    val color = if (selected) WeChatGreen else WeChatInkMuted
    val interaction = remember { MutableInteractionSource() }
    Column(
        modifier = Modifier
            .weight(1f)
            .fillMaxWidth()
            .clickable(
                interactionSource = interaction,
                indication = null,
                role = Role.Tab,
                onClick = onClick
            )
            .padding(top = Size.barTabPadTop, bottom = Size.barTabPadBottom),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // 角标可画出图标盒；栏高紧凑，标签必须完整可见
        BadgedIcon(badge = badge, iconSize = Size.icon2xl) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = color,
                modifier = Modifier.size(Size.icon2xl)
            )
        }
        Spacer(modifier = Modifier.height(Size.barTabIconLabelGap))
        Text(
            text = label,
            color = color,
            fontSize = FontSize.xxs,
            fontWeight = if (selected) FontWeight.Medium else FontWeight.Normal,
            lineHeight = LineHeight.sm,
            maxLines = 1
        )
    }
}
