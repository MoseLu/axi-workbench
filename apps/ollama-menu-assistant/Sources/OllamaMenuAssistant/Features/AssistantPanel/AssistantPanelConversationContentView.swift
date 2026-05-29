import AppKit
import SwiftUI

struct AssistantPanelConversationContentView<ComposerContent: View>: View {
    let conversation: StoredConversation
    let currentTitle: String
    let isCurrentConversationLoading: Bool
    let errorMessage: String?
    let hotkeyRegistrationFailed: Bool
    let language: AppLanguage
    let newConversationPromptTitle: String
    let messageContext: MessageBubbleContext
    let messageActions: MessageBubbleActions
    let onPreviewWorkspaceFile: (String) -> Void
    let onDrop: ([NSItemProvider]) -> Bool
    @Binding var isDropTargeted: Bool
    @Binding var transcriptScrollMetrics: AppScrollMetrics
    let transcriptScrollController: AppScrollController
    private let composer: ComposerContent

    init(
        conversation: StoredConversation,
        currentTitle: String,
        isCurrentConversationLoading: Bool,
        errorMessage: String?,
        hotkeyRegistrationFailed: Bool,
        language: AppLanguage,
        newConversationPromptTitle: String,
        messageContext: MessageBubbleContext,
        messageActions: MessageBubbleActions,
        isDropTargeted: Binding<Bool>,
        transcriptScrollMetrics: Binding<AppScrollMetrics>,
        transcriptScrollController: AppScrollController,
        onPreviewWorkspaceFile: @escaping (String) -> Void,
        onDrop: @escaping ([NSItemProvider]) -> Bool,
        @ViewBuilder composer: () -> ComposerContent
    ) {
        self.conversation = conversation
        self.currentTitle = currentTitle
        self.isCurrentConversationLoading = isCurrentConversationLoading
        self.errorMessage = errorMessage
        self.hotkeyRegistrationFailed = hotkeyRegistrationFailed
        self.language = language
        self.newConversationPromptTitle = newConversationPromptTitle
        self.messageContext = messageContext
        self.messageActions = messageActions
        _isDropTargeted = isDropTargeted
        _transcriptScrollMetrics = transcriptScrollMetrics
        self.transcriptScrollController = transcriptScrollController
        self.onPreviewWorkspaceFile = onPreviewWorkspaceFile
        self.onDrop = onDrop
        self.composer = composer()
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: 0) {
                if errorMessage != nil || hotkeyRegistrationFailed {
                    noticeBanner
                }

                if isCurrentConversationLoading {
                    conversationLoadingState
                } else if conversation.messages.isEmpty {
                    newConversationStart
                } else {
                    ConversationTranscriptView(
                        conversation: conversation,
                        currentTitle: currentTitle,
                        messageContext: messageContext,
                        messageActions: messageActions,
                        onPreviewWorkspaceFile: onPreviewWorkspaceFile,
                        scrollMetrics: $transcriptScrollMetrics,
                        scrollController: transcriptScrollController
                    )

                    composer
                }
            }

            if isDropTargeted {
                MainContentDropOverlay()
                    .transition(.opacity)
            }
        }
        .overlay(alignment: .topTrailing) {
            if !isCurrentConversationLoading && !conversation.messages.isEmpty {
                AppVerticalScrollIndicator(
                    metrics: transcriptScrollMetrics,
                    controller: transcriptScrollController,
                    width: 7,
                    trailingInset: 2,
                    verticalInset: 6,
                    minimumThumbHeight: 36
                )
            }
        }
        .contentShape(Rectangle())
        .onDrop(
            of: [AssistantPanelDropHandler.fileURLTypeIdentifier],
            isTargeted: $isDropTargeted,
            perform: onDrop
        )
        .animation(.easeOut(duration: 0.16), value: isDropTargeted)
    }

    @ViewBuilder
    private var noticeBanner: some View {
        if let errorMessage {
            InlineNotice(text: errorMessage, tint: AppTheme.destructive)
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 10)
        } else if hotkeyRegistrationFailed {
            InlineNotice(
                text: tr("全局快捷键注册失败，请检查辅助功能权限。", "Global hotkey registration failed. Check Accessibility permissions."),
                tint: AppTheme.warning
            )
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 10)
        }
    }

    private var conversationLoadingState: some View {
        AppTheme.canvas
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityIdentifier("messages.loading")
    }

    private var newConversationStart: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 0)

            Text(newConversationPromptTitle)
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .accessibilityIdentifier("newChat.prompt")

            composer
                .frame(maxWidth: 760)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 50)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.canvas)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: language)
    }
}
