import SwiftUI

struct ConversationTranscriptView: View {
    let conversation: StoredConversation
    let currentTitle: String
    let messageContext: MessageBubbleContext
    let messageActions: MessageBubbleActions
    let onPreviewWorkspaceFile: (String) -> Void
    @Binding private var scrollMetrics: AppScrollMetrics
    private let scrollController: AppScrollController?
    @State private var isLiveResizing = false
    @State private var resizeSettleToken = UUID()
    @State private var messageFrames: [UUID: CGRect] = [:]
    @State private var contentAnchorFrames: [TranscriptContentAnchorID: CGRect] = [:]
    @State private var stableResizeAnchor: TranscriptResizeAnchor?
    @State private var activeResizeAnchor: TranscriptResizeAnchor?
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    init(
        conversation: StoredConversation,
        currentTitle: String,
        messageContext: MessageBubbleContext = .empty,
        messageActions: MessageBubbleActions = .disabled,
        onPreviewWorkspaceFile: @escaping (String) -> Void = { _ in },
        scrollMetrics: Binding<AppScrollMetrics> = .constant(AppScrollMetrics()),
        scrollController: AppScrollController? = nil
    ) {
        self.conversation = conversation
        self.currentTitle = currentTitle
        self.messageContext = messageContext
        self.messageActions = messageActions
        self.onPreviewWorkspaceFile = onPreviewWorkspaceFile
        self.scrollController = scrollController
        _scrollMetrics = scrollMetrics
    }

    private enum Metrics {
        static let bottomAnchor = "conversation.transcript.bottom"
        static let contentMaxWidth: CGFloat = 860
        static let resizeDetectionThreshold: CGFloat = 0.5
        static let resizeSettleDelay: TimeInterval = 0.28
        static let scrollGutter: CGFloat = 14
        static let bottomFollowThreshold: CGFloat = 96
    }

    var body: some View {
        if AppRuntime.isSnapshotRendering {
            snapshotTranscript
        } else {
            liveTranscript
        }
    }

    private var liveTranscript: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    transcriptContent

                    AppTheme.transparent
                        .frame(height: 1)
                        .id(Metrics.bottomAnchor)
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .coordinateSpace(name: TranscriptCoordinateSpaces.content)
                .background(
                    AppScrollMetricsReader(
                        metrics: $scrollMetrics,
                        controller: scrollController,
                        preservesBottomDistanceOnContentResize: true,
                        bottomPreservationThreshold: Metrics.bottomFollowThreshold
                    )
                )
            }
            .background(AppTheme.canvas)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(
                ScrollViewAccessibilityBridge(
                    identifier: "messages.list",
                    label: tr("消息列表", "Message list"),
                    value: messageListAccessibilityValue
                )
            )
            .accessibilityElement(children: .contain)
            .accessibilityLabel(tr("消息列表", "Message list"))
            .accessibilityValue(messageListAccessibilityValue)
            .accessibilityIdentifier("messages.list")
            .onPreferenceChange(TranscriptMessageFramePreferenceKey.self) { frames in
                messageFrames = frames
                if isLiveResizing {
                    restoreActiveResizeAnchor(using: frames)
                } else if stableResizeAnchor == nil {
                    updateStableResizeAnchor(using: frames)
                }
            }
            .onPreferenceChange(TranscriptContentAnchorFramePreferenceKey.self) { frames in
                contentAnchorFrames = frames
                if isLiveResizing {
                    restoreActiveResizeAnchor(contentFrames: frames)
                } else if stableResizeAnchor == nil {
                    updateStableResizeAnchor(contentFrames: frames)
                }
            }
            .onAppear {
                scrollToBottom(proxy, retryDelays: initialScrollRetryDelays)
            }
            .onChange(of: scrollMetrics) { oldMetrics, newMetrics in
                if didViewportWidthChange(from: oldMetrics, to: newMetrics) {
                    handleViewportWidthChange(from: oldMetrics, to: newMetrics)
                    return
                }

                guard !isLiveResizing else {
                    restoreActiveResizeAnchor()
                    return
                }
                updateStableResizeAnchor(metrics: newMetrics)
            }
            .onChange(of: scrollTrigger) { oldTrigger, newTrigger in
                guard newTrigger.messageCount > 0 else {
                    return
                }

                if oldTrigger.conversationID != newTrigger.conversationID {
                    activeResizeAnchor = nil
                    stableResizeAnchor = nil
                    scrollToBottom(proxy, retryDelays: initialScrollRetryDelays)
                } else if shouldAutoFollowLatestMessage {
                    scrollToBottom(proxy)
                }
            }
        }
    }

    private var snapshotTranscript: some View {
        transcriptContent
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(AppTheme.canvas)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(tr("消息列表", "Message list"))
            .accessibilityValue(messageListAccessibilityValue)
            .accessibilityIdentifier("messages.list")
    }

    @ViewBuilder
    private var transcriptContent: some View {
        if conversation.messages.isEmpty {
            AppTheme.transparent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityIdentifier("messages.empty")
        } else {
            messageStack
                .frame(maxWidth: Metrics.contentMaxWidth, alignment: .topLeading)
                .frame(maxWidth: .infinity, alignment: .top)
                .padding(.leading, DesignTokens.Spacing.wide)
                .padding(.trailing, DesignTokens.Spacing.wide + Metrics.scrollGutter)
                .padding(.top, DesignTokens.Spacing.transcript)
                .padding(.bottom, DesignTokens.Spacing.transcript)
                .transaction { transaction in
                    transaction.animation = nil
                }
        }
    }

    private var scrollTrigger: TranscriptScrollTrigger {
        let lastMessage = conversation.messages.last
        return TranscriptScrollTrigger(
            conversationID: conversation.id,
            messageCount: conversation.messages.count,
            lastMessageID: lastMessage?.id,
            lastContentCount: lastMessage?.content.utf8.count ?? 0,
            lastToolEventCount: lastMessage?.toolEvents.count ?? 0
        )
    }

    private var initialScrollRetryDelays: [Double] {
        [0.12, 0.36]
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy, retryDelays: [Double] = []) {
        guard !conversation.messages.isEmpty else {
            return
        }

        guard !isLiveResizing else {
            return
        }

        proxy.scrollTo(Metrics.bottomAnchor, anchor: .bottom)
        DispatchQueue.main.async {
            if !isLiveResizing {
                proxy.scrollTo(Metrics.bottomAnchor, anchor: .bottom)
            }
        }
        for delay in retryDelays {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                if !isLiveResizing {
                    proxy.scrollTo(Metrics.bottomAnchor, anchor: .bottom)
                }
            }
        }
    }

    private var shouldAutoFollowLatestMessage: Bool {
        guard !isLiveResizing else {
            return false
        }

        return isNearBottom(scrollMetrics)
    }

    private func isNearBottom(_ metrics: AppScrollMetrics) -> Bool {
        bottomDistance(in: metrics) <= Metrics.bottomFollowThreshold
    }

    private func bottomDistance(in metrics: AppScrollMetrics) -> CGFloat {
        let maxOffset = max(metrics.contentHeight - metrics.viewportHeight, 0)
        let clampedOffset = min(max(metrics.offset, 0), maxOffset)
        return maxOffset - clampedOffset
    }

    private func didViewportWidthChange(
        from oldMetrics: AppScrollMetrics,
        to newMetrics: AppScrollMetrics
    ) -> Bool {
        oldMetrics.viewportWidth > 0
            && newMetrics.viewportWidth > 0
            && abs(oldMetrics.viewportWidth - newMetrics.viewportWidth) > Metrics.resizeDetectionThreshold
    }

    private func handleViewportWidthChange(
        from oldMetrics: AppScrollMetrics,
        to newMetrics: AppScrollMetrics
    ) {
        isLiveResizing = true
        if activeResizeAnchor == nil {
            if let bottomDistance = AppScrollPositionPreserver.bottomDistanceToPreserveDuringResize(
                previous: oldMetrics,
                current: newMetrics,
                threshold: Metrics.bottomFollowThreshold
            ) {
                activeResizeAnchor = TranscriptResizeAnchor(
                    bottomDistance: bottomDistance
                )
            } else {
                activeResizeAnchor = stableResizeAnchor ?? currentResizeAnchor()
            }
        }
        restoreActiveResizeAnchor()

        let token = UUID()
        resizeSettleToken = token
        DispatchQueue.main.asyncAfter(deadline: .now() + Metrics.resizeSettleDelay) {
            if resizeSettleToken == token {
                isLiveResizing = false
                activeResizeAnchor = nil
                updateStableResizeAnchor()
            }
        }
    }

    private func updateStableResizeAnchor(
        using frames: [UUID: CGRect]? = nil,
        contentFrames: [TranscriptContentAnchorID: CGRect]? = nil,
        metrics: AppScrollMetrics? = nil
    ) {
        stableResizeAnchor = currentResizeAnchor(
            using: frames ?? messageFrames,
            contentFrames: contentFrames ?? contentAnchorFrames,
            metrics: metrics ?? scrollMetrics
        )
    }

    private func restoreActiveResizeAnchor(
        using frames: [UUID: CGRect]? = nil,
        contentFrames: [TranscriptContentAnchorID: CGRect]? = nil
    ) {
        guard let anchor = activeResizeAnchor,
              let scrollController else {
            return
        }

        if let bottomDistance = anchor.bottomDistance {
            scrollController.scroll(toBottomDistance: bottomDistance)
            return
        }

        let frame: CGRect?
        if let contentAnchorID = anchor.contentAnchorID {
            frame = (contentFrames ?? contentAnchorFrames)[contentAnchorID]
        } else if let messageID = anchor.messageID {
            frame = (frames ?? messageFrames)[messageID]
        } else {
            frame = nil
        }

        guard let frame else {
            return
        }

        let targetOffset = AppScrollPositionPreserver.targetOffsetPreservingVisibleAnchor(
            previousOffset: anchor.offset,
            previousFrame: anchor.anchorFrame,
            newFrame: frame
        )
        scrollController.scroll(toOffset: targetOffset)
    }

    private func currentResizeAnchor(
        using frames: [UUID: CGRect]? = nil,
        contentFrames: [TranscriptContentAnchorID: CGRect]? = nil,
        metrics: AppScrollMetrics? = nil
    ) -> TranscriptResizeAnchor? {
        let frames = frames ?? messageFrames
        let contentFrames = contentFrames ?? contentAnchorFrames
        let metrics = metrics ?? scrollMetrics
        guard metrics.viewportHeight > 0 else {
            return nil
        }

        let viewportTop = metrics.offset
        let viewportBottom = viewportTop + metrics.viewportHeight
        let visibleSlop: CGFloat = 2

        if let contentAnchor = contentFrames
            .filter({ _, frame in
                frame.height > 0.5
                    && frame.maxY > viewportTop + visibleSlop
                    && frame.minY < viewportBottom - visibleSlop
            })
            .min(by: { lhs, rhs in
                if lhs.value.minY == rhs.value.minY {
                    return lhs.key.componentID < rhs.key.componentID
                }
                return lhs.value.minY < rhs.value.minY
            }) {
            return TranscriptResizeAnchor(
                messageID: contentAnchor.key.messageID,
                contentAnchorID: contentAnchor.key,
                offset: viewportTop,
                anchorFrame: contentAnchor.value
            )
        }

        guard let message = conversation.messages.first(where: { message in
            guard let frame = frames[message.id] else {
                return false
            }
            return frame.maxY > viewportTop + visibleSlop
                && frame.minY < viewportBottom - visibleSlop
        }),
            let frame = frames[message.id] else {
            return nil
        }

        return TranscriptResizeAnchor(
            messageID: message.id,
            contentAnchorID: nil,
            offset: viewportTop,
            anchorFrame: frame
        )
    }

    private var messageListAccessibilityValue: String {
        let messageCount = conversation.messages.count
        guard messageCount > 0 else {
            return tr("当前会话为空", "Current chat is empty")
        }
        return tr("当前会话 \(currentTitle)，共 \(messageCount) 条消息", "Current chat \(currentTitle), \(messageCount) messages")
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }

    @ViewBuilder
    private var messageStack: some View {
        VStack(spacing: 28) {
            messageRows
        }
    }

    private var messageRows: some View {
        ForEach(Array(conversation.messages.enumerated()), id: \.element.id) { index, message in
            MessageBubbleView(
                message: message,
                context: messageContext,
                actions: messageActions,
                position: index + 1,
                totalCount: conversation.messages.count,
                onPreviewWorkspaceFile: onPreviewWorkspaceFile
            )
            .id(message.id)
            .background(
                GeometryReader { geometry in
                    Color.clear.preference(
                        key: TranscriptMessageFramePreferenceKey.self,
                        value: [message.id: geometry.frame(in: .named(TranscriptCoordinateSpaces.content))]
                    )
                }
            )
        }
    }
}

private struct TranscriptResizeAnchor: Equatable {
    let messageID: UUID?
    let contentAnchorID: TranscriptContentAnchorID?
    let offset: CGFloat
    let anchorFrame: CGRect
    let bottomDistance: CGFloat?

    init(
        messageID: UUID,
        contentAnchorID: TranscriptContentAnchorID?,
        offset: CGFloat,
        anchorFrame: CGRect
    ) {
        self.messageID = messageID
        self.contentAnchorID = contentAnchorID
        self.offset = offset
        self.anchorFrame = anchorFrame
        bottomDistance = nil
    }

    init(bottomDistance: CGFloat) {
        messageID = nil
        contentAnchorID = nil
        offset = 0
        anchorFrame = .zero
        self.bottomDistance = bottomDistance
    }
}

private struct TranscriptScrollTrigger: Equatable {
    let conversationID: UUID
    let messageCount: Int
    let lastMessageID: UUID?
    let lastContentCount: Int
    let lastToolEventCount: Int
}

private struct TranscriptMessageFramePreferenceKey: PreferenceKey {
    static let defaultValue: [UUID: CGRect] = [:]

    static func reduce(value: inout [UUID: CGRect], nextValue: () -> [UUID: CGRect]) {
        value.merge(nextValue()) { _, new in new }
    }
}

enum TranscriptCoordinateSpaces {
    static let content = "conversation.transcript.content"
}

struct TranscriptContentAnchorID: Hashable, Equatable {
    let messageID: UUID
    let componentID: String
}

struct TranscriptContentAnchorFramePreferenceKey: PreferenceKey {
    static let defaultValue: [TranscriptContentAnchorID: CGRect] = [:]

    static func reduce(
        value: inout [TranscriptContentAnchorID: CGRect],
        nextValue: () -> [TranscriptContentAnchorID: CGRect]
    ) {
        value.merge(nextValue()) { _, new in new }
    }
}

extension View {
    func transcriptContentAnchor(messageID: UUID, componentID: String) -> some View {
        background(
            GeometryReader { geometry in
                Color.clear.preference(
                    key: TranscriptContentAnchorFramePreferenceKey.self,
                    value: [
                        TranscriptContentAnchorID(
                            messageID: messageID,
                            componentID: componentID
                        ): geometry.frame(in: .named(TranscriptCoordinateSpaces.content))
                    ]
                )
            }
        )
    }

    @ViewBuilder
    func transcriptContentAnchor(messageID: UUID?, componentID: String) -> some View {
        if let messageID {
            transcriptContentAnchor(messageID: messageID, componentID: componentID)
        } else {
            self
        }
    }
}
