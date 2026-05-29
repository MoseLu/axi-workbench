import Foundation
import SwiftUI

enum AppRuntime {
    static let isSnapshotRendering = ProcessInfo.processInfo.arguments.contains("--snapshot")
}

struct SnapshotAwareModelMenu: View {
    let models: [ModelSummary]
    let selectedModelName: String
    let currentModelDisplayName: String
    let onSelect: (String) -> Void
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        Group {
            if AppRuntime.isSnapshotRendering {
                SnapshotModelMenuLabel(title: currentModelDisplayName)
            } else {
                ModelSelector(
                    models: models,
                    selectedModelName: selectedModelName,
                    onSelect: onSelect
                )
            }
        }
        .frame(minWidth: 160, maxWidth: 240)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityIdentifier("header.modelMenu")
        .accessibilityLabel(tr("当前模型", "Current model"))
        .accessibilityValue(currentModelDisplayName)
        .accessibilityHint(tr("切换模型", "Switch model"))
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }
}

struct SnapshotAwarePromptInput: View {
    @Binding var text: String
    let onSubmit: () -> Void
    let onDropAttachments: ([URL]) -> Bool
    let onDropTargetChange: (Bool) -> Void
    var onMoveSlashSelection: (Int) -> Bool = { _ in false }
    var onAcceptSlashSelection: () -> Bool = { false }
    var onDismissSlashMenu: () -> Bool = { false }
    var onTextActivityChange: (Bool) -> Void = { _ in }
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        Group {
            if AppRuntime.isSnapshotRendering {
                SnapshotPromptPreview(text: text)
            } else {
                PromptComposer(
                    text: $text,
                    onSubmit: onSubmit,
                    onDropAttachments: onDropAttachments,
                    onDropTargetChange: onDropTargetChange,
                    onMoveSlashSelection: onMoveSlashSelection,
                    onAcceptSlashSelection: onAcceptSlashSelection,
                    onDismissSlashMenu: onDismissSlashMenu,
                    onTextActivityChange: onTextActivityChange,
                    accessibilityLabel: tr("消息输入框", "Message input"),
                    accessibilityHint: tr("按 Enter 发送，按 Shift 加 Enter 换行", "Press Enter to send, Shift-Enter for a new line"),
                    emptyAccessibilityValue: tr("空白", "Blank")
                )
            }
        }
        .accessibilityLabel(tr("消息输入框", "Message input"))
        .accessibilityIdentifier("composer.input")
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }
}

struct SidebarSettingsAnchorButton: View {
    let isPresented: Bool
    let title: String
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            settingsLabel
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovered = hovering
        }
        .animation(.easeOut(duration: 0.12), value: isHovered)
        .animation(.easeOut(duration: 0.12), value: isPresented)
        .accessibilityIdentifier("sidebar.settings")
        .accessibilityLabel(title)
    }

    private var settingsLabel: some View {
        let isActive = isHovered || isPresented

        return HStack(spacing: AssistantPanelLayout.sidebarIconTextSpacing) {
            Image(systemName: "gearshape")
                .font(.system(size: DesignTokens.IconSize.medium, weight: .medium))
                .foregroundStyle(isActive ? AppTheme.textPrimary : AppTheme.textSecondary)
                .frame(
                    width: AssistantPanelLayout.sidebarIconColumnWidth,
                    height: DesignTokens.ControlSize.standardButton
                )

            Text(title)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(isActive ? AppTheme.textPrimary : AppTheme.textSecondary)

            Spacer()
        }
        .padding(.horizontal, AssistantPanelLayout.sidebarRowHorizontalPadding)
        .padding(.vertical, DesignTokens.Spacing.related)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(alignment: .leading) {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium)
                .fill(isActive ? AppTheme.surfaceHover : AppTheme.transparent)
                .frame(width: AssistantPanelLayout.sidebarFloatingPanelWidth)
                .offset(x: AssistantPanelLayout.sidebarMenuSurfaceOffset)
        }
        .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium))
    }
}

struct SidebarSettingsMenuPanel: View {
    let onOpenSettings: () -> Void
    let onQuit: () -> Void
    @Environment(\.colorScheme) private var colorScheme
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        VStack(alignment: .leading, spacing: SidebarSettingsMenuMetrics.itemSpacing) {
            UserMenuAccountHeader(
                name: tr("系统管理员", "System administrator"),
                email: "admin@workspace.internal"
            )

            menuDivider

            UserMenuRow(title: tr("设置", "Settings"), systemName: "gearshape", action: onOpenSettings)

            menuDivider

            UserMenuRow(title: tr("退出应用", "Quit app"), systemName: "rectangle.portrait.and.arrow.right", action: onQuit)
        }
        .padding(SidebarSettingsMenuMetrics.panelPadding)
        .frame(
            width: AssistantPanelLayout.sidebarFloatingPanelWidth,
            alignment: .leading
        )
        .background {
            RoundedRectangle(cornerRadius: SidebarSettingsMenuMetrics.panelCornerRadius, style: .continuous)
                .fill(.regularMaterial)

            RoundedRectangle(cornerRadius: SidebarSettingsMenuMetrics.panelCornerRadius, style: .continuous)
                .fill(AppTheme.surface.opacity(panelSurfaceOpacity))
        }
        .overlay {
            RoundedRectangle(cornerRadius: SidebarSettingsMenuMetrics.panelCornerRadius, style: .continuous)
                .stroke(AppTheme.borderStrong.opacity(panelBorderOpacity), lineWidth: DesignTokens.Stroke.hairline)
        }
        .clipShape(RoundedRectangle(cornerRadius: SidebarSettingsMenuMetrics.panelCornerRadius, style: .continuous))
        .shadow(color: primaryShadow, radius: 18, x: 0, y: 12)
        .shadow(color: secondaryShadow, radius: 4, x: 0, y: 1)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }

    private var menuDivider: some View {
        Divider()
            .overlay(AppTheme.menuDividerBorder)
            .padding(.vertical, SidebarSettingsMenuMetrics.dividerVerticalPadding)
            .padding(.leading, SidebarSettingsMenuMetrics.dividerLeadingPadding)
            .padding(.trailing, SidebarSettingsMenuMetrics.dividerTrailingPadding)
    }

    private var panelSurfaceOpacity: Double {
        AppTheme.sidebarMenuSurfaceOpacity(colorScheme: colorScheme)
    }

    private var panelBorderOpacity: Double {
        AppTheme.sidebarMenuBorderOpacity(colorScheme: colorScheme)
    }

    private var primaryShadow: Color {
        AppTheme.sidebarMenuPrimaryShadow(colorScheme: colorScheme)
    }

    private var secondaryShadow: Color {
        AppTheme.sidebarMenuSecondaryShadow(colorScheme: colorScheme)
    }
}

private enum SidebarSettingsMenuMetrics {
    static let panelCornerRadius: CGFloat = 13
    static let panelPadding: CGFloat = 10
    static let itemSpacing: CGFloat = 0
    static let rowCornerRadius: CGFloat = 8
    static let rowHeight: CGFloat = 34
    static let rowHorizontalPadding: CGFloat = 8
    static let rowVerticalPadding: CGFloat = 7
    static let accountVerticalPadding: CGFloat = 7
    static let dividerVerticalPadding: CGFloat = 3
    static let dividerLeadingPadding: CGFloat = 34
    static let dividerTrailingPadding: CGFloat = 2
}

private struct UserMenuAccountHeader: View {
    let name: String
    let email: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: DesignTokens.IconSize.medium, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
                .frame(width: DesignTokens.IconFrame.avatarInline)

            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                Text(email)
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .regular))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)
            }

            Spacer()
        }
        .padding(.horizontal, SidebarSettingsMenuMetrics.rowHorizontalPadding)
        .padding(.vertical, SidebarSettingsMenuMetrics.accountVerticalPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct UserMenuRow: View {
    let title: String
    let systemName: String
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
            Image(systemName: systemName)
                .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(isHovered ? AppTheme.textPrimary : AppTheme.textSecondary)
                .frame(width: DesignTokens.IconFrame.sidebar)
            Text(title)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                Spacer()
            }
            .padding(.horizontal, SidebarSettingsMenuMetrics.rowHorizontalPadding)
            .padding(.vertical, SidebarSettingsMenuMetrics.rowVerticalPadding)
            .frame(maxWidth: .infinity, minHeight: SidebarSettingsMenuMetrics.rowHeight, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous)
                    .fill(isHovered ? AppTheme.menuHoverSurface : AppTheme.transparent)
            }
            .overlay {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous)
                    .stroke(isHovered ? AppTheme.menuHoverBorder : AppTheme.transparent, lineWidth: DesignTokens.Stroke.hairline)
            }
            .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovered = hovering
        }
        .animation(.easeOut(duration: 0.12), value: isHovered)
    }
}

private struct SnapshotModelMenuLabel: View {
    let title: String

    var body: some View {
            HStack(spacing: 8) {
            Text(title)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.system(size: DesignTokens.IconSize.tiny, weight: .bold))
                .foregroundStyle(AppTheme.textSecondary)
        }
        .padding(.horizontal, DesignTokens.Spacing.content)
        .padding(.vertical, DesignTokens.Spacing.control)
        .background(AppTheme.surfaceRaised)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium)
                .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium))
    }
}

private struct SnapshotIconButton: View {
    let systemName: String
    @State private var isHovered = false

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
            .foregroundStyle(AppTheme.textPrimary)
            .frame(width: DesignTokens.IconFrame.standardButton, height: DesignTokens.IconFrame.standardButton)
            .background(isHovered ? AppTheme.surfaceHover : AppTheme.surfaceRaised)
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.small)
                    .stroke(isHovered ? AppTheme.borderHover : AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.small))
            .shadow(color: isHovered ? AppTheme.snapshotIconHoverShadow : AppTheme.transparent, radius: 8, y: 3)
            .animation(.easeOut(duration: 0.14), value: isHovered)
            .onHover { hovering in
                isHovered = hovering
            }
    }
}

private struct SnapshotPromptPreview: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: ComposerTextMetrics.inputFontSize))
            .foregroundStyle(AppTheme.textPrimary)
            .lineSpacing(ComposerTextMetrics.snapshotLineSpacing)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 24, alignment: .topLeading)
    }
}
