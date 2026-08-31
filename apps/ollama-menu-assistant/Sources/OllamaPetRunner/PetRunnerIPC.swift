import Foundation

enum PetRunnerIPC {
    static let groupID = "com.mose.OllamaMenuAssistant.default-pet-group"
    static let groupIDEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_GROUP_ID"
    static let languageEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_LANGUAGE"
    static let dragModeDefaultsKey = "OllamaPetRunner.dragMode"

    static let groupCommandNotificationName = Notification.Name(
        "com.mose.OllamaMenuAssistant.PetRunner.groupCommand"
    )
    static let languageUpdateNotificationName = Notification.Name(
        "com.mose.OllamaMenuAssistant.PetRunner.languageUpdate"
    )
    static let groupDragNotificationName = Notification.Name(
        "com.mose.OllamaMenuAssistant.PetRunner.groupDrag"
    )
    static let groupIDKey = "groupID"
    static let senderInstanceIDKey = "senderInstanceID"
    static let commandKey = "command"
    static let languageKey = "language"
    static let dragModeKey = "dragMode"
    static let dragEventKey = "dragEvent"
    static let dragSessionIDKey = "dragSessionID"
    static let dragAnchorXKey = "dragAnchorX"
    static let dragAnchorYKey = "dragAnchorY"

    enum Command: String, Sendable {
        case pause
        case resume
        case runToCursor
        case reload
        case quit
        case setDragMode
    }

    enum DragEvent: String, Sendable {
        case began
        case moved
        case ended
    }

    static func publishGroupCommand(
        _ command: Command,
        groupID: String,
        senderInstanceID: String,
        dragMode: PetRunnerDragMode? = nil
    ) {
        var userInfo: [String: Any] = [
            groupIDKey: groupID,
            senderInstanceIDKey: senderInstanceID,
            commandKey: command.rawValue,
        ]
        if let dragMode {
            userInfo[dragModeKey] = dragMode.rawValue
        }

        DistributedNotificationCenter.default().postNotificationName(
            groupCommandNotificationName,
            object: senderInstanceID,
            userInfo: userInfo,
            deliverImmediately: true
        )
    }

    static func publishGroupDrag(
        _ event: DragEvent,
        groupID: String,
        senderInstanceID: String,
        sessionID: String,
        anchor: CGPoint? = nil
    ) {
        var userInfo: [String: Any] = [
            groupIDKey: groupID,
            senderInstanceIDKey: senderInstanceID,
            dragEventKey: event.rawValue,
            dragSessionIDKey: sessionID,
        ]
        if let anchor {
            userInfo[dragAnchorXKey] = NSNumber(value: Double(anchor.x))
            userInfo[dragAnchorYKey] = NSNumber(value: Double(anchor.y))
        }

        DistributedNotificationCenter.default().postNotificationName(
            groupDragNotificationName,
            object: senderInstanceID,
            userInfo: userInfo,
            deliverImmediately: true
        )
    }
}

enum PetRunnerDragMode: String, Equatable, Sendable {
    case individual
    case allPets
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

    var dragMode: String {
        language == .english ? "Drag Mode" : "拖拽模式"
    }

    var individualDrag: String {
        language == .english ? "This Pet Only" : "单独拖拽"
    }

    var allPetsDrag: String {
        language == .english ? "All Pets" : "全部拖拽"
    }
}
