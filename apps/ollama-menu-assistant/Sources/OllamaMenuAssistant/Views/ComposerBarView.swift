import AppKit
import SwiftUI

enum ComposerControlMetrics {
    static let compactButtonSize = DesignTokens.ControlSize.compactButton
    static let sendButtonSize = DesignTokens.ControlSize.standardButton
    static let modeFontSize = DesignTokens.FontSize.micro
    static let iconSize = DesignTokens.IconSize.small
    static let permissionIconSize = DesignTokens.IconSize.metadata
    static let chevronIconSize = DesignTokens.IconSize.chevronSmall
}

enum ComposerChromeMetrics {
    static let containerCornerRadius = DesignTokens.CornerRadius.composer
    static let slashMenuCornerRadius = DesignTokens.CornerRadius.popover
    static let chipCornerRadius = DesignTokens.CornerRadius.control
    static let maximumWidth: CGFloat = 760
}

struct ComposerBarView: View {
    @Binding var draft: String
    let routingMode: RoutingMode
    let toolPermissionMode: ToolPermissionMode
    let attachments: [MessageAttachment]
    let projects: [ConversationProject]
    let skills: [SkillSummary]
    let selectedProjectID: UUID?
    let showsWorkspacePicker: Bool
    let allowsNoProjectSelection: Bool
    let isVoiceInputActive: Bool
    let canSubmit: Bool
    let contextWindowUsage: ContextWindowUsage?
    let onPickAttachments: () -> Void
    let onDropAttachments: ([URL]) -> Bool
    let onDropTargetChange: (Bool) -> Void
    let onRemoveAttachment: (MessageAttachment) -> Void
    let onSelectWorkspace: (UUID?) -> Void
    let onPickWorkspaceFolder: () -> Void
    let onSetRoutingMode: (RoutingMode) -> Void
    let onSetToolPermissionMode: (ToolPermissionMode) -> Void
    let onToggleVoiceInput: () -> Void
    let onSubmit: () -> Void
    @State private var previewedImageAttachment: MessageAttachment?
    @State private var selectedSlashSkillID: SkillSummary.ID?
    @State private var isSlashMenuDismissed = false
    @State private var isDraftTextActive = false
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    private let minimumTextAreaHeight: CGFloat = 32
    private let maximumTextAreaHeight: CGFloat = 104
    private let maximumTextAreaHeightWithAttachments: CGFloat = 72

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let slashQuery {
                SlashCommandSuggestionMenu(
                    query: slashQuery,
                    skills: slashSuggestions,
                    selectedSkillID: selectedSlashSkillID ?? slashSuggestions.first?.id,
                    language: appLanguage,
                    onSelect: { skill in
                        acceptSlashSkill(skill)
                    }
                )
                .padding(.horizontal, 2)
                .padding(.bottom, 8)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }

            inputContainer

            if showsWorkspacePicker {
                WorkspacePickerButton(
                    projects: projects,
                    selectedProjectID: selectedProjectID,
                    allowsNoProjectSelection: allowsNoProjectSelection,
                    onSelectWorkspace: onSelectWorkspace,
                    onPickWorkspaceFolder: onPickWorkspaceFolder
                )
                .accessibilityIdentifier("composer.workspace")
                .padding(.leading, 10)
                .padding(.top, 8)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .padding(.bottom, 14)
        .background(AppTheme.canvas)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("composer")
        .sheet(item: $previewedImageAttachment) { attachment in
            ImageAttachmentPreviewSheet(attachment: attachment)
        }
        .animation(.easeOut(duration: 0.12), value: slashQuery)
        .onChange(of: draft) { oldValue, newValue in
            let oldFragment = Self.slashCommandFragment(in: oldValue)
            let newFragment = Self.slashCommandFragment(in: newValue)
            if let newFragment {
                if newFragment != oldFragment {
                    isSlashMenuDismissed = false
                    selectedSlashSkillID = nil
                }
            } else {
                selectedSlashSkillID = nil
                isSlashMenuDismissed = newValue.hasPrefix("/")
            }
        }
    }

    private var inputContainer: some View {
        VStack(spacing: 0) {
            if !attachments.isEmpty {
                attachmentStrip
            }

            textArea

            controlsBar
        }
        .background(
            RoundedRectangle(cornerRadius: ComposerChromeMetrics.containerCornerRadius)
                .fill(AppTheme.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: ComposerChromeMetrics.containerCornerRadius)
                .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: ComposerChromeMetrics.containerCornerRadius))
        .frame(maxWidth: ComposerChromeMetrics.maximumWidth)
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private var textArea: some View {
        ZStack(alignment: .topLeading) {
            if !isDraftTextActive {
                Text(tr("问点什么，或者拖进文件和照片", "Ask anything, or drop files and photos"))
                    .font(.system(size: ComposerTextMetrics.placeholderFontSize, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .padding(.top, 4)
            }

            SnapshotAwarePromptInput(
                text: $draft,
                onSubmit: onSubmit,
                onDropAttachments: onDropAttachments,
                onDropTargetChange: onDropTargetChange,
                onMoveSlashSelection: moveSlashSelection,
                onAcceptSlashSelection: acceptSelectedSlashSuggestion,
                onDismissSlashMenu: dismissSlashMenu,
                onTextActivityChange: { isActive in
                    isDraftTextActive = isActive
                }
            )
                .frame(height: textAreaHeight, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.top, attachments.isEmpty ? 15 : 7)
        .padding(.bottom, 10)
    }

    private var attachmentStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .center, spacing: 8) {
                ForEach(attachments) { attachment in
                    AttachmentPreviewItem(attachment: attachment) {
                        onRemoveAttachment(attachment)
                    } onPreview: {
                        previewedImageAttachment = attachment
                    }
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.top, 10)
        .padding(.bottom, 2)
        .accessibilityIdentifier("composer.attachments")
    }

    private var controlsBar: some View {
        HStack(spacing: 8) {
            AttachmentButton(
                count: attachments.count,
                accessibilityLabel: tr("上传文件或照片", "Upload files or photos"),
                action: onPickAttachments
            )
                .accessibilityIdentifier("composer.attach")

            PermissionModePicker(selection: toolPermissionMode, language: appLanguage, onSelect: onSetToolPermissionMode)
                .accessibilityIdentifier("composer.permission")
                .accessibilityLabel(tr("工具权限", "Tool permissions"))
                .accessibilityValue(toolPermissionMode.title(language: appLanguage))

            GitBranchPicker(project: selectedProject, language: appLanguage)
                .accessibilityIdentifier("composer.branch")

            Spacer(minLength: 6)

            if let contextWindowUsage {
                ContextWindowIndicator(usage: contextWindowUsage, language: appLanguage)
                    .accessibilityIdentifier("composer.contextWindow")
            }

            RoutingModePicker(selection: routingMode, language: appLanguage, onSelect: onSetRoutingMode)
                .accessibilityIdentifier("composer.mode")
                .accessibilityLabel(tr("回答模式", "Response mode"))
                .accessibilityValue(routingMode.title(language: appLanguage))

            VoiceButton(
                isActive: isVoiceInputActive,
                accessibilityLabel: isVoiceInputActive ? tr("停止语音录入", "Stop voice input") : tr("开始语音录入", "Start voice input"),
                action: onToggleVoiceInput
            )
                .accessibilityIdentifier("composer.voice")

            SendButton(
                canSubmit: canSubmit,
                accessibilityLabel: tr("发送消息", "Send message"),
                action: onSubmit
            )
                .accessibilityIdentifier("composer.send")
        }
        .padding(.horizontal, 12)
        .padding(.top, 1)
        .padding(.bottom, 9)
    }

    private var textAreaHeight: CGFloat {
        let lineCount = max(1, draft.split(separator: "\n", omittingEmptySubsequences: false).count)
        let desiredHeight = minimumTextAreaHeight + CGFloat(lineCount - 1) * ComposerTextMetrics.expandedLineHeight
        let maximumHeight = attachments.isEmpty ? maximumTextAreaHeight : maximumTextAreaHeightWithAttachments
        return min(maximumHeight, desiredHeight)
    }

    private var slashQuery: String? {
        isSlashMenuDismissed ? nil : commandFragment
    }

    private var commandFragment: String? {
        Self.slashCommandFragment(in: draft)
    }

    private static func slashCommandFragment(in text: String) -> String? {
        guard text.hasPrefix("/") else {
            return nil
        }
        let commandText = String(text.dropFirst())
        if commandText.contains(where: \.isWhitespace) {
            return nil
        }
        return commandText
    }

    private var slashSuggestions: [SkillSummary] {
        guard let slashQuery else {
            return []
        }
        let normalizedQuery = slashQuery.lowercased()
        let filtered: [SkillSummary]
        if normalizedQuery.isEmpty {
            filtered = skills
        } else {
            filtered = skills.filter { skill in
                skill.name.lowercased().contains(normalizedQuery)
                    || skill.description.lowercased().contains(normalizedQuery)
                    || skill.directoryPath.lowercased().contains(normalizedQuery)
            }
        }
        return Array(filtered.prefix(8))
    }

    private var selectedProject: ConversationProject? {
        guard let selectedProjectID else {
            return nil
        }
        return projects.first { $0.id == selectedProjectID }
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }

    private func acceptSlashSkill(_ skill: SkillSummary) {
        draft = "/\(skill.name) "
        selectedSlashSkillID = skill.id
        isSlashMenuDismissed = true
    }

    private func moveSlashSelection(_ delta: Int) -> Bool {
        guard slashQuery != nil, !slashSuggestions.isEmpty else {
            return false
        }

        let currentID = selectedSlashSkillID ?? slashSuggestions.first?.id
        let currentIndex = slashSuggestions.firstIndex(where: { $0.id == currentID }) ?? 0
        let nextIndex = (currentIndex + delta + slashSuggestions.count) % slashSuggestions.count
        selectedSlashSkillID = slashSuggestions[nextIndex].id
        return true
    }

    private func acceptSelectedSlashSuggestion() -> Bool {
        guard slashQuery != nil,
              let selected = selectedSlashSkill else {
            return false
        }
        acceptSlashSkill(selected)
        return true
    }

    private func dismissSlashMenu() -> Bool {
        guard slashQuery != nil else {
            return false
        }
        isSlashMenuDismissed = true
        return true
    }

    private var selectedSlashSkill: SkillSummary? {
        let selectedID = selectedSlashSkillID ?? slashSuggestions.first?.id
        return slashSuggestions.first(where: { $0.id == selectedID }) ?? slashSuggestions.first
    }
}
