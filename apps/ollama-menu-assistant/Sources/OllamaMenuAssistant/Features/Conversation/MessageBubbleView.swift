import AppKit
import SwiftUI

struct MessageBubbleView: View {
    let message: ChatMessage
    let context: MessageBubbleContext
    let actions: MessageBubbleActions
    var position: Int? = nil
    var totalCount: Int? = nil
    var onPreviewWorkspaceFile: (String) -> Void = { _ in }
    @State private var isHoveringMessageColumn = false
    @State private var isHoveringActionsSlot = false
    @State private var didCopyMessage = false
    @State private var shouldIgnoreNextCopyFeedbackReset = false
    @State private var isChangeSummaryExpanded = true
    @State private var isToolActivityExpanded: Bool
    @State private var toolActivityStartedAt: Date
    @State private var toolActivityCompletedAt: Date?
    @State private var isEditingUserMessage = false
    @State private var editDraft: String
    @State private var visibleContentCache: MessageVisibleContentCache
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    private let actionsRowHeight = DesignTokens.ControlSize.hoverAction
    private let maximumUserBubbleWidth: CGFloat = 520
    private let compactUserTextMeasurementLimit = 240
    private let userBubbleHorizontalPadding = DesignTokens.Spacing.wide

    init(
        message: ChatMessage,
        context: MessageBubbleContext = .empty,
        actions: MessageBubbleActions = .disabled,
        position: Int? = nil,
        totalCount: Int? = nil,
        onPreviewWorkspaceFile: @escaping (String) -> Void = { _ in }
    ) {
        self.message = message
        self.context = context
        self.actions = actions
        self.position = position
        self.totalCount = totalCount
        self.onPreviewWorkspaceFile = onPreviewWorkspaceFile
        let hasCompletedToolEvents = !message.toolEvents.isEmpty
        _isToolActivityExpanded = State(initialValue: !hasCompletedToolEvents && message.content.isEmpty)
        _toolActivityStartedAt = State(initialValue: message.toolEvents.first?.timestamp ?? message.timestamp)
        _toolActivityCompletedAt = State(initialValue: hasCompletedToolEvents ? (message.toolEvents.last?.timestamp ?? message.timestamp) : nil)
        _editDraft = State(initialValue: message.content)
        _visibleContentCache = State(initialValue: MessageVisibleContentCache(message: message))
    }

    var body: some View {
        HStack(alignment: .top) {
            if isAssistant {
                messageColumn
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    .onHover(perform: updateMessageHoverState)
            } else {
                Spacer(minLength: 0)
                messageColumn
                    .frame(maxWidth: maximumUserBubbleWidth, alignment: .trailing)
                    .layoutPriority(1)
                    .contentShape(Rectangle())
                    .onHover(perform: updateMessageHoverState)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier("message.\(message.role.rawValue).\(message.id.uuidString)")
        .accessibilityLabel(accessibilityLabelText)
        .accessibilityValue(accessibilityValueText)
    }

    private var messageColumn: some View {
        VStack(alignment: isAssistant ? .leading : .trailing, spacing: DesignTokens.Spacing.compact) {
            if isEditingUserMessage {
                inlineUserMessageEditor
            } else {
                bubble
                if isAssistant {
                    if shouldReserveAssistantActionsSlot {
                        assistantActionsSlot
                    }
                } else {
                    userActionsSlot
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            guard !shouldIgnoreNextCopyFeedbackReset else {
                shouldIgnoreNextCopyFeedbackReset = false
                return
            }
            didCopyMessage = false
        }
        .onChange(of: message.id) { _, _ in
            didCopyMessage = false
            shouldIgnoreNextCopyFeedbackReset = false
            isChangeSummaryExpanded = true
            isToolActivityExpanded = message.toolEvents.isEmpty && message.content.isEmpty
            toolActivityStartedAt = message.toolEvents.first?.timestamp ?? message.timestamp
            toolActivityCompletedAt = message.toolEvents.isEmpty ? nil : (message.toolEvents.last?.timestamp ?? message.timestamp)
            isEditingUserMessage = false
            editDraft = message.content
            visibleContentCache = MessageVisibleContentCache(message: message)
        }
        .onChange(of: message.content) { _, _ in
            if !isEditingUserMessage {
                editDraft = message.content
            }
            visibleContentCache = MessageVisibleContentCache(message: message)
        }
        .onChange(of: isCurrentGeneratingAssistantMessage) { _, isProcessing in
            if isProcessing {
                toolActivityCompletedAt = nil
                isToolActivityExpanded = true
            } else if hasToolActivity {
                toolActivityCompletedAt = Date()
                isToolActivityExpanded = false
            }
        }
    }

    private var inlineUserMessageEditor: some View {
        InlineUserMessageEditor(
            draft: $editDraft,
            attachments: message.attachments,
            canSubmit: canSubmitEditedUserMessage,
            onCancel: cancelEditingUserMessage,
            onSubmit: submitEditedUserMessage
        )
        .frame(maxWidth: maximumUserBubbleWidth, alignment: .trailing)
    }

    private var bubble: some View {
        VStack(alignment: .leading, spacing: 10) {
            assistantToolActivityPanel

            if !isCurrentGeneratingAssistantMessage, !message.attachments.isEmpty {
                messageAttachments
            }

            if isCurrentGeneratingAssistantMessage {
                AssistantLoadingView(statusText: context.statusLabel)
            } else {
                messageText
                generatedFilePreviewCards
                assistantChangeSummaryPanel
            }
        }
        .modifier(MessageChrome(role: message.role))
    }

    @ViewBuilder
    private var messageText: some View {
        if !isAssistant, !displayText.invocations.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    ForEach(displayText.invocations, id: \.self) { invocation in
                        ChatInvocationChip(invocation: invocation)
                    }
                }

                if !displayText.body.isEmpty {
                    renderedText(displayText.body)
                        .multilineTextAlignment(.leading)
                }
            }
            .frame(maxWidth: userMessageTextWidth, alignment: .leading)
        } else {
            let text = renderedText(displayText.body)

            if isAssistant {
                text
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                text
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: userMessageTextWidth, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private var messageAttachments: some View {
        if isAssistant {
            MessageAttachmentGallery(attachments: message.attachments)
                .frame(maxWidth: .infinity, alignment: .leading)
                .transcriptContentAnchor(
                    messageID: message.id,
                    componentID: "assistant.attachments"
                )
        } else {
            MessageAttachmentGallery(attachments: message.attachments)
                .frame(maxWidth: maximumUserTextWidth, alignment: .leading)
                .transcriptContentAnchor(
                    messageID: message.id,
                    componentID: "user.attachments"
                )
        }
    }

    @ViewBuilder
    private func renderedText(_ content: String) -> some View {
        if isAssistant {
            AssistantMarkdownView(
                content: content,
                projectRootPath: context.currentProjectPath,
                onOpenWorkspaceFile: onPreviewWorkspaceFile,
                transcriptMessageID: message.id
            )
        } else {
            Text(content)
                .font(.system(size: DesignTokens.FontSize.callout))
                .foregroundStyle(AppTheme.textPrimary)
                .lineSpacing(4)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
                .transcriptContentAnchor(
                    messageID: message.id,
                    componentID: "user.text"
                )
        }
    }

    private var maximumUserTextWidth: CGFloat {
        maximumUserBubbleWidth - userBubbleHorizontalPadding
    }

    private var userMessageTextWidth: CGFloat {
        let maxTextWidth = maximumUserTextWidth
        let content = displayText.body.isEmpty ? (displayText.invocations.first?.name ?? " ") : displayText.body
        let invocationMinimumWidth: CGFloat = displayText.invocations.isEmpty ? 0 : 112

        if content.count > compactUserTextMeasurementLimit || content.rangeOfCharacter(from: .newlines) != nil {
            return max(invocationMinimumWidth, maxTextWidth)
        }

        let font = NSFont.systemFont(ofSize: DesignTokens.FontSize.callout)
        let attributes: [NSAttributedString.Key: Any] = [.font: font]
        let singleLineWidth = (content as NSString).size(withAttributes: attributes).width
        return min(max(ceil(singleLineWidth), invocationMinimumWidth), maxTextWidth)
    }

    private var userActionsSlot: some View {
        AppTheme.transparent
            .frame(height: actionsRowHeight)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .background(AppTheme.hitTargetOverlay)
            .contentShape(Rectangle())
            .onHover(perform: updateActionsHoverState)
            .overlay(alignment: .topTrailing) {
                actionsRow
                    .allowsHitTesting(true)
                    .accessibilityHidden(false)
                    .onHover(perform: updateActionsHoverState)
                    .animation(.easeOut(duration: 0.14), value: shouldShowUserTimestamp)
            }
    }

    private var assistantActionsSlot: some View {
        AppTheme.transparent
            .frame(height: actionsRowHeight)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppTheme.hitTargetOverlay)
            .contentShape(Rectangle())
            .onHover(perform: updateActionsHoverState)
            .overlay(alignment: .topLeading) {
                actionsRow
                    .opacity(shouldShowAssistantActions ? 1 : 0)
                    .allowsHitTesting(shouldShowAssistantActions)
                    .accessibilityHidden(!shouldShowAssistantActions)
                    .onHover(perform: updateActionsHoverState)
                    .animation(.easeOut(duration: 0.14), value: shouldShowAssistantActions)
                    .animation(.easeOut(duration: 0.14), value: shouldShowAssistantTimestamp)
            }
    }

    private var actionsRow: some View {
        Group {
            if isAssistant {
                assistantActionsRow
            } else {
                userActionsRow
            }
        }
        .frame(maxWidth: .infinity, minHeight: actionsRowHeight, alignment: isAssistant ? .leading : .trailing)
    }

    private var assistantActionsRow: some View {
        HStack(spacing: 12) {
            copyActionButton

            if shouldShowAssistantTimestamp {
                timestampLabel
            }
        }
        .padding(.leading, MessageBubbleMetrics.assistantHorizontalPadding)
    }

    private var userActionsRow: some View {
        HStack(spacing: 12) {
            if shouldShowUserTimestamp {
                timestampLabel
            }

            copyActionButton

            editActionButton
        }
    }

    private var timestampLabel: some View {
        Text(timestampText)
            .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
            .foregroundStyle(AppTheme.textTertiary)
    }

    private var copyActionButton: some View {
        HoverActionButton(
            glyph: didCopyMessage ? .system("checkmark") : .copy,
            help: didCopyMessage ? tr("已复制，点击消息恢复", "Copied. Click the message to reset") : tr("复制这条消息", "Copy this message")
        ) {
            shouldIgnoreNextCopyFeedbackReset = true
            actions.copyMessage(message)
            didCopyMessage = true
            DispatchQueue.main.async {
                shouldIgnoreNextCopyFeedbackReset = false
            }
        }
    }

    private var editActionButton: some View {
        HoverActionButton(
            systemName: "pencil",
            help: tr("编辑这条消息", "Edit this message"),
            isEnabled: context.canEditUserMessage(message)
        ) {
            beginEditingUserMessage()
        }
    }

    @ViewBuilder
    private var assistantChangeSummaryPanel: some View {
        if isAssistant,
           let summary = message.changeSummary,
           !summary.files.isEmpty {
            AssistantChangeSummaryPanel(summary: summary, isExpanded: $isChangeSummaryExpanded)
                .frame(maxWidth: 680, alignment: .leading)
                .padding(.top, 2)
                .transcriptContentAnchor(
                    messageID: message.id,
                    componentID: "assistant.changeSummary"
                )
        }
    }

    @ViewBuilder
    private var generatedFilePreviewCards: some View {
        if !assistantGeneratedFileLinks.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(assistantGeneratedFileLinks) { link in
                    GeneratedFilePreviewCard(
                        link: link,
                        projectRootPath: context.currentProjectPath,
                        onPreviewFile: onPreviewWorkspaceFile
                    )
                }
            }
            .frame(maxWidth: 680, alignment: .leading)
            .padding(.top, 2)
            .transcriptContentAnchor(
                messageID: message.id,
                componentID: "assistant.generatedFiles"
            )
        }
    }

    @ViewBuilder
    private var assistantToolActivityPanel: some View {
        if hasToolActivity {
            AssistantToolActivityPanel(
                message: message,
                projectRootPath: context.currentProjectPath,
                isProcessing: isCurrentGeneratingAssistantMessage,
                startedAt: toolActivityStartedAt,
                completedAt: toolActivityCompletedAt,
                isExpanded: $isToolActivityExpanded,
                onPreviewFile: onPreviewWorkspaceFile
            )
            .frame(maxWidth: 680, alignment: .leading)
            .transcriptContentAnchor(
                messageID: message.id,
                componentID: "assistant.toolActivity"
            )
        }
    }

    private var isAssistant: Bool {
        message.role == .assistant
    }

    private var isCurrentGeneratingAssistantMessage: Bool {
        context.isCurrentGeneratingAssistantMessage(message)
    }

    private var hasToolActivity: Bool {
        isAssistant && (isCurrentGeneratingAssistantMessage || !message.toolEvents.isEmpty)
    }

    private var assistantGeneratedFileLinks: [WorkspaceFileLink] {
        guard isAssistant else {
            return []
        }
        return AssistantToolActivity
            .make(
                events: message.toolEvents,
                changeSummary: message.changeSummary,
                projectRootPath: context.currentProjectPath
            )
            .fileLinks
            .filter(\.isCreated)
    }

    private var isLatestAssistantMessage: Bool {
        context.latestAssistantMessageID == message.id
    }

    private var shouldShowAssistantActions: Bool {
        !isCurrentGeneratingAssistantMessage
            && (isLatestAssistantMessage || isHoveringMessageOrActions)
    }

    private var shouldReserveAssistantActionsSlot: Bool {
        !isCurrentGeneratingAssistantMessage
    }

    private var shouldShowAssistantTimestamp: Bool {
        isHoveringMessageOrActions
    }

    private var shouldShowUserTimestamp: Bool {
        isHoveringMessageOrActions && !isEditingUserMessage
    }

    private var isHoveringMessageOrActions: Bool {
        (isHoveringMessageColumn || isHoveringActionsSlot) && !AppRuntime.isSnapshotRendering
    }

    private func updateMessageHoverState(_ hovering: Bool) {
        guard !AppRuntime.isSnapshotRendering else { return }
        isHoveringMessageColumn = hovering
    }

    private func updateActionsHoverState(_ hovering: Bool) {
        guard !AppRuntime.isSnapshotRendering else { return }
        isHoveringActionsSlot = hovering
    }

    private var canSubmitEditedUserMessage: Bool {
        context.canEditUserMessage(message)
            && (!editDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !message.attachments.isEmpty)
    }

    private func beginEditingUserMessage() {
        guard context.canEditUserMessage(message) else {
            return
        }
        editDraft = message.content
        didCopyMessage = false
        isEditingUserMessage = true
    }

    private func cancelEditingUserMessage() {
        editDraft = message.content
        isEditingUserMessage = false
    }

    private func submitEditedUserMessage() {
        Task { @MainActor in
            let didSubmit = await actions.submitEditedUserMessage(message, editDraft)
            if didSubmit {
                isEditingUserMessage = false
            }
        }
    }

    private var timestampText: String {
        message.timestamp.formatted(date: .omitted, time: .shortened)
    }

    private var accessibilityLabelText: String {
        let role = isAssistant ? tr("助手消息", "Assistant message") : tr("用户消息", "User message")
        guard let position, let totalCount else {
            return role
        }
        return tr("\(role)，第 \(position) 条，共 \(totalCount) 条", "\(role), item \(position) of \(totalCount)")
    }

    private var accessibilityValueText: String {
        if isCurrentGeneratingAssistantMessage {
            return context.statusLabel
        }
        let content = visibleMessageContent.isEmpty ? tr("空内容", "Empty content") : visibleMessageContent
        if message.attachments.isEmpty {
            return "\(timestampText)。\(content)"
        }
        let attachmentSummary = message.attachments.map(\.name).joined(separator: "，")
        return tr("\(timestampText)。附件：\(attachmentSummary)。\(content)", "\(timestampText). Attachments: \(attachmentSummary). \(content)")
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }

    private var displayText: ChatDisplayText {
        isAssistant
            ? ChatDisplayText(invocations: [], body: visibleMessageText)
            : ChatDisplayText.parse(visibleMessageText, skills: context.availableSkills)
    }

    private var visibleMessageContent: String {
        let invocationPrefix = displayText.invocations.map(\.name).joined(separator: " ")
        if invocationPrefix.isEmpty {
            return displayText.body
        }
        if displayText.body.isEmpty {
            return invocationPrefix
        }
        return "\(invocationPrefix)。\(displayText.body)"
    }

    private var visibleMessageText: String {
        if visibleContentCache.matches(message) {
            return visibleContentCache.text
        }
        return MessageVisibleContentCache.visibleText(for: message.content)
    }
}
