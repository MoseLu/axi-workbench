import SwiftUI

struct InlineUserMessageEditor: View {
    @Binding var draft: String
    let attachments: [MessageAttachment]
    let canSubmit: Bool
    let onCancel: () -> Void
    let onSubmit: () -> Void
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    private let minimumTextAreaHeight: CGFloat = 42
    private let maximumTextAreaHeight: CGFloat = 132

    var body: some View {
        VStack(spacing: 0) {
            if !attachments.isEmpty {
                MessageAttachmentGallery(attachments: attachments)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 2)
            }

            editTextArea

            controlsRow
        }
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.overlay)
                .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.overlay))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("message.user.edit")
    }

    private var editTextArea: some View {
        PromptComposer(
            text: $draft,
            onSubmit: onSubmit,
            onDropAttachments: { _ in false },
            onDropTargetChange: { _ in },
            accessibilityLabel: tr("编辑消息", "Edit message"),
            accessibilityIdentifier: "message.user.edit.input",
            accessibilityHint: tr("按 Enter 发送，按 Shift 加 Enter 换行", "Press Enter to send, Shift-Enter for a new line"),
            emptyAccessibilityValue: tr("空白", "Blank"),
            focusOnAppear: true
        )
        .frame(height: textAreaHeight, alignment: .topLeading)
        .padding(.horizontal, 16)
        .padding(.top, attachments.isEmpty ? 14 : 8)
        .padding(.bottom, 8)
    }

    private var controlsRow: some View {
        HStack(spacing: 8) {
            Spacer(minLength: 8)

            Button(tr("取消", "Cancel"), action: onCancel)
                .buttonStyle(InlineEditSecondaryButtonStyle())
                .accessibilityIdentifier("message.user.edit.cancel")

            Button(tr("发送", "Send"), action: onSubmit)
                .buttonStyle(InlineEditPrimaryButtonStyle(isEnabled: canSubmit))
                .disabled(!canSubmit)
                .keyboardShortcut(.defaultAction)
                .accessibilityIdentifier("message.user.edit.submit")
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 10)
    }

    private var textAreaHeight: CGFloat {
        let lineCount = max(1, draft.split(separator: "\n", omittingEmptySubsequences: false).count)
        let desiredHeight = minimumTextAreaHeight + CGFloat(lineCount - 1) * ComposerTextMetrics.expandedLineHeight
        return min(maximumTextAreaHeight, desiredHeight)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }
}

private struct InlineEditSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
            .foregroundStyle(AppTheme.textSecondary)
            .padding(.horizontal, 10)
            .frame(height: 28)
            .background(configuration.isPressed ? AppTheme.surfaceHover : AppTheme.transparent)
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                    .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
    }
}

private struct InlineEditPrimaryButtonStyle: ButtonStyle {
    let isEnabled: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
            .foregroundStyle(isEnabled ? AppTheme.textOnAccentSecondary : AppTheme.textTertiary)
            .padding(.horizontal, 12)
            .frame(height: 28)
            .background(isEnabled ? AppTheme.accent : AppTheme.surfaceRaised)
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                    .stroke(isEnabled ? AppTheme.transparent : AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
            .opacity(configuration.isPressed && isEnabled ? 0.88 : 1)
    }
}
