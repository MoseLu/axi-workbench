import SwiftUI

struct PanelExpansionButton: View {
    let isExpanded: Bool
    let accessibilityLabel: String
    let help: String
    let action: () -> Void

    var body: some View {
        AppIconGlyphButton(
            accessibilityLabel: accessibilityLabel,
            help: help,
            hoverStyle: .titleBar,
            keyboardShortcut: KeyboardShortcut("j", modifiers: [.command, .option]),
            action: action
        ) {
            PanelExpansionGlyph(isExpanded: isExpanded)
                .foregroundStyle(AppTheme.textTertiary)
        }
    }
}

struct DefaultEditorPickerButton: View {
    @Binding var selection: DefaultEditorTarget
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        Menu {
            ForEach(DefaultEditorTarget.allCases) { target in
                Button {
                    selection = target
                } label: {
                    HStack(spacing: 10) {
                        DefaultEditorIcon(target: target, size: 20)
                        Text(target.title(language: appLanguage))
                        if target == selection {
                            Spacer()
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 8) {
                DefaultEditorIcon(target: selection, size: 20)

                Image(systemName: "chevron.down")
                    .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
                    .foregroundStyle(AppTheme.textTertiary)
            }
            .padding(.leading, 9)
            .padding(.trailing, 8)
            .frame(height: 32)
            .background(AppTheme.surfaceRaised)
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                    .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
            .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
        }
        .buttonStyle(.plain)
        .menuStyle(.button)
        .help(tr("默认编辑器", "Default editor"))
        .accessibilityLabel(tr("默认编辑器", "Default editor"))
        .accessibilityValue(selection.title(language: appLanguage))
        .accessibilityIdentifier("header.defaultEditor")
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }
}

struct DefaultEditorIcon: View {
    let target: DefaultEditorTarget
    let size: CGFloat

    var body: some View {
        Group {
            if let image = target.iconImage {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: target.fallbackSystemName)
                    .font(.system(size: size * 0.72, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
        .frame(width: size, height: size)
    }
}

struct PanelExpansionGlyph: View {
    let isExpanded: Bool

    var body: some View {
        IconFontFullscreenShape()
            .fill(AppTheme.textTertiary)
            .frame(width: 18, height: 18)
    }
}

struct IconFontFullscreenShape: Shape {
    private let viewBox: CGFloat = 1024

    func path(in rect: CGRect) -> Path {
        let side = min(rect.width, rect.height) * 0.96
        let scale = side / viewBox
        let origin = CGPoint(x: rect.midX - side / 2, y: rect.midY - side / 2)

        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: origin.x + x * scale, y: origin.y + y * scale)
        }

        var path = Path()
        path.move(to: p(475.3408, 813.2608))
        path.addLine(to: p(209.1008, 813.2608))
        path.addLine(to: p(209.1008, 547.0208))

        path.move(to: p(564.0704, 192.0512))
        path.addLine(to: p(830.3104, 192.0512))
        path.addLine(to: p(830.3104, 458.2912))

        return path.strokedPath(StrokeStyle(
            lineWidth: 74.5472 * scale,
            lineCap: .round,
            lineJoin: .round
        ))
    }
}
