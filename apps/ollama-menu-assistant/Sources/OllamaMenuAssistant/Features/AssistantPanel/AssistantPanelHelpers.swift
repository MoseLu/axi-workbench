import Foundation
import UniformTypeIdentifiers

enum AssistantPanelConversationTitleFormatter {
    static func title(
        for conversation: StoredConversation,
        skills: [SkillSummary],
        language: AppLanguage
    ) -> String {
        let tr = LocalizedStrings(language: language)
        let parsedTitle = ChatDisplayText.parse(conversation.title, skills: skills)
        if parsedTitle.invocations.isEmpty || !parsedTitle.body.isEmpty {
            let title = parsedTitle.titleSource
            return title.isEmpty ? tr("新聊天", "New chat") : title
        }

        if let firstUserMessage = conversation.messages.first(where: { $0.role == .user }) {
            let messageTitle = ChatDisplayText.titleText(from: firstUserMessage.content, skills: skills)
            if !messageTitle.isEmpty {
                return messageTitle
            }
        }

        return parsedTitle.titleSource.isEmpty ? tr("新聊天", "New chat") : parsedTitle.titleSource
    }
}

enum AssistantPanelConversationSearch {
    static func searchableConversations(_ conversations: [StoredConversation]) -> [StoredConversation] {
        conversations
            .filter { !$0.isArchived }
            .sorted { lhs, rhs in
                if lhs.isPinned != rhs.isPinned {
                    return lhs.isPinned && !rhs.isPinned
                }
                if lhs.updatedAt == rhs.updatedAt {
                    return lhs.id.uuidString > rhs.id.uuidString
                }
                return lhs.updatedAt > rhs.updatedAt
            }
    }

    static func results(
        query: String,
        conversations: [StoredConversation],
        title: (StoredConversation) -> String
    ) -> [StoredConversation] {
        guard !query.isEmpty else {
            return Array(conversations.prefix(8))
        }

        return conversations.filter { conversation in
            title(conversation).localizedCaseInsensitiveContains(query)
                || conversation.title.localizedCaseInsensitiveContains(query)
        }
    }
}

enum AssistantPanelAutomationErrorFormatter {
    static func localized(_ message: String, language: AppLanguage) -> String {
        let tr = LocalizedStrings(language: language)
        switch message {
        case "Automation title, prompt, project, and schedule are required.":
            return tr("请填写标题、提示词、项目和循环设置。", "Title, prompt, project, and schedule are required.")
        default:
            return message
        }
    }
}

enum AssistantPanelDropHandler {
    static let fileURLTypeIdentifier = UTType.fileURL.identifier

    static func handleFileDrop(
        providers: [NSItemProvider],
        addAttachments: @escaping ([URL]) -> Bool
    ) -> Bool {
        let fileProviders = providers.filter { $0.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) }
        guard !fileProviders.isEmpty else {
            return false
        }

        let action = AssistantPanelDropAction(addAttachments: addAttachments)
        for provider in fileProviders {
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                guard let resolvedURL = resolvedFileURL(from: item) else {
                    return
                }
                DispatchQueue.main.async {
                    _ = action.addAttachments([resolvedURL])
                }
            }
        }

        return true
    }

    private static func resolvedFileURL(from item: NSSecureCoding?) -> URL? {
        let resolvedURL: URL?
        switch item {
        case let data as Data:
            resolvedURL = URL(dataRepresentation: data, relativeTo: nil)
        case let url as URL:
            resolvedURL = url
        case let url as NSURL:
            resolvedURL = url as URL
        default:
            resolvedURL = nil
        }

        guard let resolvedURL, resolvedURL.isFileURL else {
            return nil
        }
        return resolvedURL
    }
}

private final class AssistantPanelDropAction: @unchecked Sendable {
    let addAttachments: ([URL]) -> Bool

    init(addAttachments: @escaping ([URL]) -> Bool) {
        self.addAttachments = addAttachments
    }
}
