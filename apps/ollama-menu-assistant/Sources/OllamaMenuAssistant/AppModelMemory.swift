import Foundation

extension AppModel {
    func assistantMemoryPrompt(language: AppLanguage) async -> String? {
        guard defaults.bool(forKey: AssistantSettingsPreferences.memoryEnabledKey) else {
            return nil
        }
        return try? await memoryStore.runtimePrompt(language: language)
    }

    func recordAssistantMemoryIfNeeded(
        conversation: StoredConversation,
        project: ConversationProject?,
        assistantMessageID: UUID
    ) async {
        guard defaults.bool(forKey: AssistantSettingsPreferences.memoryEnabledKey) else {
            return
        }

        let skipToolAssisted = defaults.bool(forKey: AssistantSettingsPreferences.skipToolAssistedMemoryKey)
        do {
            _ = try await memoryStore.capture(
                conversation: conversation,
                project: project,
                assistantMessageID: assistantMessageID,
                skipToolAssisted: skipToolAssisted
            )
        } catch {
            // Memory capture should never interrupt the chat flow.
        }
    }

    func resetAssistantMemory() async throws {
        try await memoryStore.clear()
    }
}
