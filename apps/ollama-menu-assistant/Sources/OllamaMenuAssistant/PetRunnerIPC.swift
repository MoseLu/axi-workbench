import Foundation

enum PetRunnerIPC {
    static let groupID = "com.mose.OllamaMenuAssistant.default-pet-group"
    static let groupIDEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_GROUP_ID"
    static let languageEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_LANGUAGE"

    static let groupCommandNotificationName = Notification.Name(
        "com.mose.OllamaMenuAssistant.PetRunner.groupCommand"
    )
    static let languageUpdateNotificationName = Notification.Name(
        "com.mose.OllamaMenuAssistant.PetRunner.languageUpdate"
    )
    static let groupIDKey = "groupID"
    static let senderInstanceIDKey = "senderInstanceID"
    static let commandKey = "command"
    static let languageKey = "language"

    enum Command: String, Sendable {
        case pause
        case resume
        case runToCursor
        case reload
        case quit
    }

    @MainActor
    static func publishLanguage(_ language: AppLanguage) {
        DistributedNotificationCenter.default().postNotificationName(
            languageUpdateNotificationName,
            object: groupID,
            userInfo: [
                groupIDKey: groupID,
                languageKey: language.rawValue,
            ],
            deliverImmediately: true
        )
    }
}
