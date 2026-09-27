import AppKit
import SwiftUI

enum DesignTokens {
    enum Primitive {
        static let transparent = ColorToken(hex: 0x000000, alpha: 0)
        static let black = ColorToken(hex: 0x000000)
        static let white = ColorToken(hex: 0xFFFFFF)
    }

    enum Theme {
        static let light = ThemePalette(
            sidebar: ColorToken(hex: 0xF7F5F7),
            canvas: ColorToken(hex: 0xFFFFFF),
            surface: ColorToken(hex: 0xFFFFFF),
            surfaceRaised: ColorToken(hex: 0xF5F5F6),
            surfaceHover: ColorToken(hex: 0xECECF0),
            border: Primitive.black.withAlpha(0.08),
            borderStrong: Primitive.black.withAlpha(0.14),
            borderHover: Primitive.black.withAlpha(0.20),
            textPrimary: ColorToken(hex: 0x1A1C1F),
            textSecondary: ColorToken(hex: 0x1A1C1F, alpha: 0.62),
            textTertiary: ColorToken(hex: 0x1A1C1F, alpha: 0.42),
            accent: ColorToken(hex: 0x3A7CBA),
            accentSoft: ColorToken(hex: 0x3A7CBA, alpha: 0.12),
            textOnAccentPrimary: Primitive.white,
            textOnAccentSecondary: Primitive.white.withAlpha(0.92)
        )

        static let dark = ThemePalette(
            sidebar: ColorToken(hex: 0x2D2925),
            canvas: ColorToken(hex: 0x181818),
            surface: ColorToken(hex: 0x272727),
            surfaceRaised: ColorToken(hex: 0x3D3D3D),
            surfaceHover: ColorToken(hex: 0x4A4A4A),
            border: Primitive.white.withAlpha(0.12),
            borderStrong: Primitive.white.withAlpha(0.20),
            borderHover: Primitive.white.withAlpha(0.26),
            textPrimary: Primitive.white,
            textSecondary: Primitive.white.withAlpha(0.70),
            textTertiary: Primitive.white.withAlpha(0.48),
            accent: ColorToken(hex: 0x339CFF),
            accentSoft: ColorToken(hex: 0x339CFF, alpha: 0.14),
            textOnAccentPrimary: ColorToken(hex: 0x08111F, alpha: 0.92),
            textOnAccentSecondary: ColorToken(hex: 0x08111F, alpha: 0.86)
        )
    }

    enum ThemeDefaults {
        static let accentHex = Theme.dark.accent.hexString
        static let backgroundHex = Theme.dark.canvas.hexString
        static let foregroundHex = Theme.dark.textPrimary.hexString
        static let invalidHexFallback = Primitive.black.hexString
    }

    enum Status {
        static let successSoft = DynamicToken(
            light: ColorToken(hex: 0x6AC784, alpha: 0.18),
            dark: ColorToken(hex: 0x52C878, alpha: 0.18)
        )
        static let warningSoft = DynamicToken(
            light: ColorToken(hex: 0xD49A33, alpha: 0.18),
            dark: ColorToken(hex: 0xD49A33, alpha: 0.18)
        )
        static let destructiveSoft = DynamicToken(
            light: ColorToken(hex: 0xD45B5B, alpha: 0.18),
            dark: ColorToken(hex: 0xD45B5B, alpha: 0.18)
        )
        static let destructive = DynamicToken(
            light: ColorToken(hex: 0xC74646),
            dark: ColorToken(hex: 0xFF6B6B)
        )
        static let destructivePrimary = DynamicToken(
            light: ColorToken(hex: 0xB53B3B),
            dark: ColorToken(hex: 0xFF7A7A)
        )
        static let warning = DynamicToken(
            light: ColorToken(hex: 0xB97912),
            dark: ColorToken(hex: 0xE2A043)
        )
    }

    enum Diff {
        static let removedText = ColorToken(hex: 0xFF5F57).color
        static let removedBackground = ColorToken(hex: 0x4A1D1F).color
        static let addedText = ColorToken(hex: 0x4FD984).color
        static let addedBackground = ColorToken(hex: 0x143421).color
        static let previewPreviousAccentHex = ColorToken(hex: 0x2563EB).hexString
        static let previewCodeSurface = ColorToken(hex: 0x151515).color
        static let previewText = ColorToken(hex: 0xD6D6D6).color
        static let previewLineNumber = Primitive.white.withAlpha(0.46).color
        static let previewSyntaxKeyword = ColorToken(hex: 0xC792EA).color
        static let previewSyntaxName = ColorToken(hex: 0xFFB86C).color
        static let previewSyntaxString = ColorToken(hex: 0x8BE28B).color
    }

    enum Overlay {
        static let transparent = Primitive.transparent.color
        static let hitTarget = Primitive.white.withAlpha(0.001).color
        static let dismissalHitTarget = Primitive.black.withAlpha(0.001).color
        static let dragDropScrim = Primitive.black.withAlpha(0.28).color
        static let dragDropCalloutBackground = Primitive.black.withAlpha(0.46).color
    }

    enum Shadow {
        static let slashMenu = Primitive.black.withAlpha(0.20).color
        static let snapshotIconHover = Primitive.black.withAlpha(0.14).color

        static func sidebarMenuPrimary(colorScheme: ColorScheme) -> Color {
            Primitive.black.withAlpha(colorScheme == .dark ? 0.28 : 0.18).color
        }

        static func sidebarMenuSecondary(colorScheme: ColorScheme) -> Color {
            Primitive.black.withAlpha(colorScheme == .dark ? 0.20 : 0.08).color
        }
    }

    enum Alpha {
        static let sidebarMenuSurfaceLight = 0.80
        static let sidebarMenuSurfaceDark = 0.72
        static let sidebarMenuBorderLight = 0.72
        static let sidebarMenuBorderDark = 0.86
        static let menuDivider = 0.72
        static let menuHoverSurface = 0.62
        static let menuHoverBorder = 0.85
        static let colorChipBorder = 0.72
        static let scrollbarThumb = 0.78
        static let permissionChevron = 0.90
        static let permissionDefaultBackground = 0.08
        static let permissionActiveBackground = 0.12
        static let permissionDefaultBorder = 0.18
        static let permissionActiveBorder = 0.28
        static let noticeDot = 0.90
        static let noticeBackground = 0.10
        static let noticeBorder = 0.18
        static let dropOverlayAccentStart = 0.10
        static let dropOverlayAccentEnd = 0.03
        static let dropCalloutAccentStart = 0.18
        static let dropCalloutAccentEnd = 0.06
    }

    enum FontSize {
        static let badge: CGFloat = 8
        static let iconLabel: CGFloat = 9
        static let micro: CGFloat = 10
        static let metadata: CGFloat = 11
        static let caption: CGFloat = 12
        static let body: CGFloat = 13
        static let bodyLarge: CGFloat = 14
        static let callout: CGFloat = 15
        static let settingsPageTitle: CGFloat = 24
        static let previewIconLarge: CGFloat = 28
    }

    enum IconSize {
        static let chevronSmall: CGFloat = 8
        static let closeSmall: CGFloat = 9
        static let tiny: CGFloat = 10
        static let metadata: CGFloat = 11
        static let small: CGFloat = 12
        static let regular: CGFloat = 13
        static let medium: CGFloat = 14
        static let callout: CGFloat = 15
        static let large: CGFloat = 18
        static let previewLarge: CGFloat = 28
    }

    enum IconFrame {
        static let avatarInline: CGFloat = 16
        static let sidebar: CGFloat = 18
        static let hoverAction: CGFloat = 20
        static let menuAction: CGFloat = 22
        static let sidebarAction: CGFloat = 24
        static let compactButton: CGFloat = 26
        static let standardButton: CGFloat = 28
        static let menuButton: CGFloat = 30
        static let petIcon: CGFloat = 38
    }

    enum ControlSize {
        static let hoverAction: CGFloat = 20
        static let compactButton: CGFloat = 26
        static let standardButton: CGFloat = 28
        static let menuButton: CGFloat = 30
        static let menuRow: CGFloat = 34
    }

    enum CornerRadius {
        static let tiny: CGFloat = 5
        static let xSmall: CGFloat = 6
        static let small: CGFloat = 7
        static let control: CGFloat = 8
        static let medium: CGFloat = 10
        static let card: CGFloat = 12
        static let popover: CGFloat = 14
        static let overlay: CGFloat = 16
        static let composer: CGFloat = 18
    }

    enum Spacing {
        static let hairline: CGFloat = 1
        static let xSmall: CGFloat = 2
        static let small: CGFloat = 3
        static let compact: CGFloat = 4
        static let related: CGFloat = 6
        static let control: CGFloat = 8
        static let row: CGFloat = 10
        static let content: CGFloat = 12
        static let panel: CGFloat = 14
        static let section: CGFloat = 16
        static let sidebar: CGFloat = 18
        static let window: CGFloat = 20
        static let group: CGFloat = 24
        static let transcript: CGFloat = 28
        static let wide: CGFloat = 32
        static let extraWide: CGFloat = 40
    }

    enum Stroke {
        static let hairline: CGFloat = 1
    }

    enum System {
        static let scrollbarThumb = Color(nsColor: .tertiaryLabelColor).opacity(Alpha.scrollbarThumb)
    }

    struct DynamicToken {
        let light: ColorToken
        let dark: ColorToken
    }

    struct ThemePalette {
        let sidebar: ColorToken
        let canvas: ColorToken
        let surface: ColorToken
        let surfaceRaised: ColorToken
        let surfaceHover: ColorToken
        let border: ColorToken
        let borderStrong: ColorToken
        let borderHover: ColorToken
        let textPrimary: ColorToken
        let textSecondary: ColorToken
        let textTertiary: ColorToken
        let accent: ColorToken
        let accentSoft: ColorToken
        let textOnAccentPrimary: ColorToken
        let textOnAccentSecondary: ColorToken
    }

    struct ColorToken {
        let hex: UInt32
        let alpha: CGFloat

        init(hex: UInt32, alpha: CGFloat = 1.0) {
            self.hex = hex
            self.alpha = alpha
        }

        var color: Color {
            Color(nsColor: nsColor)
        }

        var nsColor: NSColor {
            let red = CGFloat((hex >> 16) & 0xFF) / 255
            let green = CGFloat((hex >> 8) & 0xFF) / 255
            let blue = CGFloat(hex & 0xFF) / 255
            return NSColor(red: red, green: green, blue: blue, alpha: alpha)
        }

        var hexString: String {
            String(
                format: "#%02X%02X%02X",
                (hex >> 16) & 0xFF,
                (hex >> 8) & 0xFF,
                hex & 0xFF
            )
        }

        func withAlpha(_ alpha: CGFloat) -> ColorToken {
            ColorToken(hex: hex, alpha: alpha)
        }
    }

    static func dynamicColor(_ token: DynamicToken) -> Color {
        dynamicColor(light: token.light, dark: token.dark)
    }

    static func dynamicColor(light: ColorToken, dark: ColorToken) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            switch appearance.bestMatch(from: [.darkAqua, .vibrantDark, .aqua, .vibrantLight]) {
            case .darkAqua, .vibrantDark:
                dark.nsColor
            default:
                light.nsColor
            }
        })
    }

    static func color(fromHex hex: String, fallback: ColorToken) -> Color {
        Color(nsColor: nsColor(fromHex: hex, fallback: fallback))
    }

    static func nsColor(fromHex hex: String, fallback: ColorToken) -> NSColor {
        let normalized = normalizedHex(hex, fallback: fallback)
        let scanner = Scanner(string: String(normalized.dropFirst()))
        var rgb: UInt64 = 0

        guard scanner.scanHexInt64(&rgb) else {
            return fallback.nsColor
        }

        return NSColor(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }

    static func hexString(from color: Color, fallback: ColorToken) -> String {
        let nsColor = NSColor(color)
        guard let rgbColor = nsColor.usingColorSpace(.sRGB) else {
            return fallback.hexString
        }

        return String(
            format: "#%02X%02X%02X",
            Int(round(rgbColor.redComponent * 255)),
            Int(round(rgbColor.greenComponent * 255)),
            Int(round(rgbColor.blueComponent * 255))
        )
    }

    static func normalizedHex(_ value: String, fallback: ColorToken) -> String {
        let digits = value
            .uppercased()
            .filter { character in
                character.isNumber || ("A"..."F").contains(character)
            }

        guard digits.count == 6 else {
            return fallback.hexString
        }

        return "#\(digits)"
    }
}
