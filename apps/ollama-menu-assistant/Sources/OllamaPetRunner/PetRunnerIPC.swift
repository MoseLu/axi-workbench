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

    static func publishGroupCommand(
        _ command: Command,
        groupID: String,
        senderInstanceID: String
    ) {
        DistributedNotificationCenter.default().postNotificationName(
            groupCommandNotificationName,
            object: senderInstanceID,
            userInfo: [
                groupIDKey: groupID,
                senderInstanceIDKey: senderInstanceID,
                commandKey: command.rawValue,
            ],
            deliverImmediately: true
        )
    }
}

enum PetRunnerLanguage: String, Equatable, Sendable {
    case simplifiedChinese
    case english

    static func resolved(from rawValue: String?, locale: Locale = .current) -> Self {
        switch rawValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "simplifiedchinese", "zh-hans", "zh_cn", "zh-cn", "简体中文":
            return .simplifiedChinese
        case "english", "en":
            return .english
        default:
            let identifier = locale.identifier.lowercased()
            let languageCode = locale.language.languageCode?.identifier.lowercased()
            return languageCode == "zh" || identifier.hasPrefix("zh") ? .simplifiedChinese : .english
        }
    }

    static var current: Self {
        resolved(from: nil)
    }
}

struct PetRunnerMenuLabels: Equatable, Sendable {
    let language: PetRunnerLanguage

    var pauseMovement: String {
        language == .english ? "Pause Movement" : "暂停移动"
    }

    var resumeMovement: String {
        language == .english ? "Resume Movement" : "恢复移动"
    }

    var runToCursor: String {
        language == .english ? "Run To Cursor" : "移动到光标"
    }

    var reloadPet: String {
        language == .english ? "Reload Pet" : "重新加载宠物"
    }

    var quit: String {
        language == .english ? "Quit" : "退出"
    }
}
