import Foundation

struct MessageBubbleContext {
    let statusLabel: String
    let availability: AppAvailability
    let currentProjectPath: String?
    let currentConversationMessageIDs: Set<UUID>
    let currentConversationLastMessageID: UUID?
    let latestAssistantMessageID: UUID?
    let availableSkills: [SkillSummary]

    init(
        statusLabel: String,
        availability: AppAvailability,
        currentProjectPath: String?,
        currentConversation: StoredConversation,
        availableSkills: [SkillSummary]
    ) {
        self.statusLabel = statusLabel
        self.availability = availability
        self.currentProjectPath = currentProjectPath
        currentConversationMessageIDs = Set(currentConversation.messages.map(\.id))
        currentConversationLastMessageID = currentConversation.messages.last?.id
        latestAssistantMessageID = currentConversation.messages.last(where: { $0.role == .assistant })?.id
        self.availableSkills = availableSkills
    }

    func isCurrentGeneratingAssistantMessage(_ message: ChatMessage) -> Bool {
        message.role == .assistant
            && availability == .generating
            && currentConversationLastMessageID == message.id
    }

    func canEditUserMessage(_ message: ChatMessage) -> Bool {
        availability != .generating
            && message.role == .user
            && currentConversationMessageIDs.contains(message.id)
    }

    static let empty = MessageBubbleContext(
        statusLabel: "",
        availability: .idle,
        currentProjectPath: nil,
        currentConversation: StoredConversation(model: "main:latest"),
        availableSkills: []
    )
}

struct MessageBubbleActions {
    var copyMessage: @MainActor (ChatMessage) -> Void
    var submitEditedUserMessage: @MainActor (ChatMessage, String) async -> Bool

    static let disabled = MessageBubbleActions(
        copyMessage: { _ in },
        submitEditedUserMessage: { _, _ in false }
    )
}

extension AppModel {
    var messageBubbleContext: MessageBubbleContext {
        MessageBubbleContext(
            statusLabel: statusLabel,
            availability: availability,
            currentProjectPath: currentProject?.path,
            currentConversation: currentConversation,
            availableSkills: availableSkills
        )
    }

    var messageBubbleActions: MessageBubbleActions {
        MessageBubbleActions(
            copyMessage: { [weak self] message in
                self?.copyMessage(message)
            },
            submitEditedUserMessage: { [weak self] message, content in
                guard let self else {
                    return false
                }
                return await self.submitEditedUserMessage(message, content: content)
            }
        )
    }
}
