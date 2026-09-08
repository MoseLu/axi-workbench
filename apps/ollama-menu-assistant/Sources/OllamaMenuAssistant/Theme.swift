import AppKit
import SwiftUI

enum AppearanceMode: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        title(language: .simplifiedChinese)
    }

    func title(language: AppLanguage) -> String {
        switch self {
        case .system:
            language == .english ? "System" : "系统"
        case .light:
            language == .english ? "Light" : "浅色"
        case .dark:
            language == .english ? "Dark" : "深色"
        }
    }

    var systemName: String {
        switch self {
        case .system: "desktopcomputer"
        case .light: "sun.max"
        case .dark: "moon"
        }
    }

    var preferredColorScheme: ColorScheme? {
        switch self {
        case .system:
            nil
        case .light:
            .light
        case .dark:
            .dark
        }
    }

    init(storedValue: String) {
        self = AppearanceMode(rawValue: storedValue) ?? .system
    }
}

enum AppTheme {
    typealias ColorFallbackToken = DesignTokens.ColorToken

    static let sidebar = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.sidebar,
        dark: DesignTokens.Theme.dark.sidebar
    )
    static let canvas = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.canvas,
        dark: DesignTokens.Theme.dark.canvas
    )
    static let surface = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.surface,
        dark: DesignTokens.Theme.dark.surface
    )
    static let surfaceRaised = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.surfaceRaised,
        dark: DesignTokens.Theme.dark.surfaceRaised
    )
    static let surfaceHover = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.surfaceHover,
        dark: DesignTokens.Theme.dark.surfaceHover
    )
    static let border = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.border,
        dark: DesignTokens.Theme.dark.border
    )
    static let borderStrong = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.borderStrong,
        dark: DesignTokens.Theme.dark.borderStrong
    )
    static let borderHover = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.borderHover,
        dark: DesignTokens.Theme.dark.borderHover
    )
    static let textPrimary = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.textPrimary,
        dark: DesignTokens.Theme.dark.textPrimary
    )
    static let textSecondary = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.textSecondary,
        dark: DesignTokens.Theme.dark.textSecondary
    )
    static let textTertiary = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.textTertiary,
        dark: DesignTokens.Theme.dark.textTertiary
    )
    static let accent = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.accent,
        dark: DesignTokens.Theme.dark.accent
    )
    static let accentSoft = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.accentSoft,
        dark: DesignTokens.Theme.dark.accentSoft
    )
    static let textOnAccent = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.textOnAccentPrimary,
        dark: DesignTokens.Theme.dark.textOnAccentPrimary
    )
    static let textOnAccentSecondary = DesignTokens.dynamicColor(
        light: DesignTokens.Theme.light.textOnAccentSecondary,
        dark: DesignTokens.Theme.dark.textOnAccentSecondary
    )
    static let greenSoft = DesignTokens.dynamicColor(DesignTokens.Status.successSoft)
    static let amberSoft = DesignTokens.dynamicColor(DesignTokens.Status.warningSoft)
    static let redSoft = DesignTokens.dynamicColor(DesignTokens.Status.destructiveSoft)
    static let destructive = DesignTokens.dynamicColor(DesignTokens.Status.destructive)
    static let destructivePrimary = DesignTokens.dynamicColor(DesignTokens.Status.destructivePrimary)
    static let warning = DesignTokens.dynamicColor(DesignTokens.Status.warning)
    static let transparent = DesignTokens.Overlay.transparent
    static let hitTargetOverlay = DesignTokens.Overlay.hitTarget
    static let dismissalOverlay = DesignTokens.Overlay.dismissalHitTarget
    static let dragDropScrim = DesignTokens.Overlay.dragDropScrim
    static let dragDropCalloutBackground = DesignTokens.Overlay.dragDropCalloutBackground
    static let scrollbarThumb = DesignTokens.System.scrollbarThumb
    static let slashMenuShadow = DesignTokens.Shadow.slashMenu
    static let snapshotIconHoverShadow = DesignTokens.Shadow.snapshotIconHover
    static let diffRemovedText = DesignTokens.Diff.removedText
    static let diffRemovedBackground = DesignTokens.Diff.removedBackground
    static let diffAddedText = DesignTokens.Diff.addedText
    static let diffAddedBackground = DesignTokens.Diff.addedBackground
    static let themePreviewCodeSurface = DesignTokens.Diff.previewCodeSurface
    static let themePreviewText = DesignTokens.Diff.previewText
    static let themePreviewLineNumber = DesignTokens.Diff.previewLineNumber
    static let themePreviewSyntaxKeyword = DesignTokens.Diff.previewSyntaxKeyword
    static let themePreviewSyntaxName = DesignTokens.Diff.previewSyntaxName
    static let themePreviewSyntaxString = DesignTokens.Diff.previewSyntaxString
    static let dropOverlayAccentStart = accent.opacity(DesignTokens.Alpha.dropOverlayAccentStart)
    static let dropOverlayAccentEnd = accent.opacity(DesignTokens.Alpha.dropOverlayAccentEnd)
    static let dropCalloutAccentStart = accent.opacity(DesignTokens.Alpha.dropCalloutAccentStart)
    static let dropCalloutAccentEnd = accent.opacity(DesignTokens.Alpha.dropCalloutAccentEnd)
    static let menuDividerBorder = border.opacity(DesignTokens.Alpha.menuDivider)
    static let menuHoverSurface = surfaceHover.opacity(DesignTokens.Alpha.menuHoverSurface)
    static let menuHoverBorder = border.opacity(DesignTokens.Alpha.menuHoverBorder)
    static let colorChipBorder = border.opacity(DesignTokens.Alpha.colorChipBorder)
    static let themeAccentDefaultHex = DesignTokens.ThemeDefaults.accentHex
    static let themeBackgroundDefaultHex = DesignTokens.ThemeDefaults.backgroundHex
    static let themeForegroundDefaultHex = DesignTokens.ThemeDefaults.foregroundHex
    static let themePreviewPreviousAccentHex = DesignTokens.Diff.previewPreviousAccentHex
    static let themeAccentFallback = DesignTokens.Theme.light.accent
    static let themeBackgroundFallback = DesignTokens.Theme.light.canvas
    static let themeForegroundFallback = DesignTokens.Theme.light.textPrimary

    static func permissionChevron(_ tint: Color) -> Color {
        tint.opacity(DesignTokens.Alpha.permissionChevron)
    }

    static func permissionBackground(_ tint: Color, isDefault: Bool) -> Color {
        tint.opacity(isDefault ? DesignTokens.Alpha.permissionDefaultBackground : DesignTokens.Alpha.permissionActiveBackground)
    }

    static func permissionBorder(_ tint: Color, isDefault: Bool) -> Color {
        tint.opacity(isDefault ? DesignTokens.Alpha.permissionDefaultBorder : DesignTokens.Alpha.permissionActiveBorder)
    }

    static func sidebarMenuSurfaceOpacity(colorScheme: ColorScheme) -> Double {
        colorScheme == .dark ? DesignTokens.Alpha.sidebarMenuSurfaceDark : DesignTokens.Alpha.sidebarMenuSurfaceLight
    }

    static func sidebarMenuBorderOpacity(colorScheme: ColorScheme) -> Double {
        colorScheme == .dark ? DesignTokens.Alpha.sidebarMenuBorderDark : DesignTokens.Alpha.sidebarMenuBorderLight
    }

    static func sidebarMenuPrimaryShadow(colorScheme: ColorScheme) -> Color {
        DesignTokens.Shadow.sidebarMenuPrimary(colorScheme: colorScheme)
    }

    static func sidebarMenuSecondaryShadow(colorScheme: ColorScheme) -> Color {
        DesignTokens.Shadow.sidebarMenuSecondary(colorScheme: colorScheme)
    }

    static func customThemeColor(fromHex hex: String, fallback: ColorFallbackToken) -> Color {
        DesignTokens.color(fromHex: hex, fallback: fallback)
    }

    static func customThemeHexString(from color: Color, fallback: ColorFallbackToken) -> String {
        DesignTokens.hexString(from: color, fallback: fallback)
    }

    static func normalizedCustomThemeHex(_ value: String, fallback: ColorFallbackToken) -> String {
        DesignTokens.normalizedHex(value, fallback: fallback)
    }
}

struct AppearancePreviewPalette {
    let sidebar: Color
    let canvas: Color
    let surface: Color
    let surfaceRaised: Color
    let surfaceHover: Color
    let border: Color
    let borderStrong: Color

    static let light = AppearancePreviewPalette(tokens: DesignTokens.Theme.light)
    static let dark = AppearancePreviewPalette(tokens: DesignTokens.Theme.dark)

    private init(tokens: DesignTokens.ThemePalette) {
        sidebar = tokens.sidebar.color
        canvas = tokens.canvas.color
        surface = tokens.surface.color
        surfaceRaised = tokens.surfaceRaised.color
        surfaceHover = tokens.surfaceHover.color
        border = tokens.border.color
        borderStrong = tokens.borderStrong.color
    }
}

extension View {
    func appCard(cornerRadius: CGFloat = DesignTokens.CornerRadius.card) -> some View {
        self
            .background(AppTheme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
    }
}
