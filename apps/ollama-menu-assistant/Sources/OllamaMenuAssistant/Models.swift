import Foundation

enum ChatRole: String, Codable, Sendable {
    case user
    case assistant
}

enum RoutingMode: String, CaseIterable, Codable, Sendable, Identifiable {
    case quick
    case balanced
    case expert

    var id: String { rawValue }

    var title: String {
        title(language: .simplifiedChinese)
    }

    func title(language: AppLanguage) -> String {
        switch self {
        case .quick:
            return language == .english ? "Quick" : "快速"
        case .balanced:
            return language == .english ? "Balanced" : "均衡"
        case .expert:
            return language == .english ? "Expert" : "专家"
        }
    }

    var subtitle: String {
        subtitle(language: .simplifiedChinese)
    }

    func subtitle(language: AppLanguage) -> String {
        switch self {
        case .quick:
            return language == .english ? "Faster responses for lightweight questions" : "响应更快，适合轻量提问"
        case .balanced:
            return language == .english ? "Balances speed and quality" : "速度和质量更均衡"
        case .expert:
            return language == .english ? "More careful for complex questions" : "更稳更严谨，适合复杂问题"
        }
    }
}

enum AttachmentKind: String, Codable, Sendable {
    case image
    case text
    case file
}

struct MessageAttachment: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var name: String
    var path: String
    var kind: AttachmentKind
    var byteCount: Int64

    init(
        id: UUID = UUID(),
        name: String,
        path: String,
        kind: AttachmentKind,
        byteCount: Int64
    ) {
        self.id = id
        self.name = name
        self.path = path
        self.kind = kind
        self.byteCount = byteCount
    }

    var url: URL {
        URL(fileURLWithPath: path)
    }
}

struct ChatMessage: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var role: ChatRole
    var content: String
    var attachments: [MessageAttachment]
    var timestamp: Date
    var toolEvents: [ToolExecutionEvent]
    var changeSummary: AssistantChangeSummary?

    enum CodingKeys: String, CodingKey {
        case id
        case role
        case content
        case attachments
        case timestamp
        case toolEvents
        case changeSummary
    }

    init(
        id: UUID = UUID(),
        role: ChatRole,
        content: String,
        attachments: [MessageAttachment] = [],
        timestamp: Date = .now,
        toolEvents: [ToolExecutionEvent] = [],
        changeSummary: AssistantChangeSummary? = nil
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.attachments = attachments
        self.timestamp = timestamp
        self.toolEvents = toolEvents
        self.changeSummary = changeSummary
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        role = try container.decode(ChatRole.self, forKey: .role)
        content = try container.decodeIfPresent(String.self, forKey: .content) ?? ""
        attachments = try container.decodeIfPresent([MessageAttachment].self, forKey: .attachments) ?? []
        timestamp = try container.decodeIfPresent(Date.self, forKey: .timestamp) ?? .now
        toolEvents = try container.decodeIfPresent([ToolExecutionEvent].self, forKey: .toolEvents) ?? []
        changeSummary = try container.decodeIfPresent(AssistantChangeSummary.self, forKey: .changeSummary)
    }
}

struct StoredConversation: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var projectID: UUID?
    var title: String
    var model: String
    var createdAt: Date
    var updatedAt: Date
    var isPinned: Bool
    var isArchived: Bool
    var isTitleManuallyEdited: Bool
    var messages: [ChatMessage]

    enum CodingKeys: String, CodingKey {
        case id
        case projectID
        case title
        case model
        case createdAt
        case updatedAt
        case isPinned
        case isArchived
        case isTitleManuallyEdited
        case messages
    }

    init(
        id: UUID = UUID(),
        projectID: UUID? = nil,
        title: String = "New Chat",
        model: String,
        createdAt: Date = .now,
        updatedAt: Date = .now,
        isPinned: Bool = false,
        isArchived: Bool = false,
        isTitleManuallyEdited: Bool = false,
        messages: [ChatMessage] = []
    ) {
        self.id = id
        self.projectID = projectID
        self.title = title
        self.model = model
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.isPinned = isPinned
        self.isArchived = isArchived
        self.isTitleManuallyEdited = isTitleManuallyEdited
        self.messages = messages
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        projectID = try container.decodeIfPresent(UUID.self, forKey: .projectID)
        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "New Chat"
        model = try container.decode(String.self, forKey: .model)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt) ?? .now
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt) ?? createdAt
        isPinned = try container.decodeIfPresent(Bool.self, forKey: .isPinned) ?? false
        isArchived = try container.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false
        isTitleManuallyEdited = try container.decodeIfPresent(Bool.self, forKey: .isTitleManuallyEdited) ?? false
        messages = try container.decodeIfPresent([ChatMessage].self, forKey: .messages) ?? []
    }

    var isEmpty: Bool {
        messages.isEmpty
    }

    mutating func updateMetadata(now: Date = .now) {
        updatedAt = now
        guard !isTitleManuallyEdited else {
            return
        }
        if let firstUserMessage = messages.first(where: { $0.role == .user }) {
            let displayTitleSource = ChatDisplayText.titleText(from: firstUserMessage.content)
            let condensed = displayTitleSource
                .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            title = condensed.isEmpty ? "New Chat" : String(condensed.prefix(30))
        } else {
            title = "New Chat"
        }
    }

    var metadataOnly: StoredConversation {
        var copy = self
        copy.messages = []
        return copy
    }

    func mergingMetadata(from metadata: StoredConversation) -> StoredConversation {
        var copy = metadata.metadataOnly
        copy.messages = messages
        return copy
    }
}

struct ConversationProject: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var name: String
    var path: String?
    var startupCommand: String?
    var localEnvironment: ProjectLocalEnvironment?
    var createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        path: String? = nil,
        startupCommand: String? = nil,
        localEnvironment: ProjectLocalEnvironment? = nil,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.path = path
        self.startupCommand = startupCommand
        self.localEnvironment = localEnvironment
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

struct ProjectLocalEnvironment: Codable, Hashable, Sendable {
    var name: String
    var setupScripts: ProjectEnvironmentScripts
    var cleanupScripts: ProjectEnvironmentScripts
    var operations: [ProjectEnvironmentOperation]

    init(
        name: String,
        setupScripts: ProjectEnvironmentScripts = .empty,
        cleanupScripts: ProjectEnvironmentScripts = .empty,
        operations: [ProjectEnvironmentOperation] = []
    ) {
        self.name = name
        self.setupScripts = setupScripts
        self.cleanupScripts = cleanupScripts
        self.operations = operations
    }

    static func template(for project: ConversationProject) -> ProjectLocalEnvironment {
        ProjectLocalEnvironment(
            name: project.name,
            setupScripts: ProjectEnvironmentScripts(
                defaultScript: """
                cd "$CODEX_WORKTREE_PATH"
                pip install -r requirements.txt
                npm install
                ./run/setup.sh
                """,
                macOS: "",
                linux: "",
                windows: ""
            ),
            cleanupScripts: ProjectEnvironmentScripts(
                defaultScript: """
                docker compose down --remove-orphans
                rm -rf .cache/tmp
                """,
                macOS: "",
                linux: "",
                windows: ""
            )
        )
    }
}

struct ProjectEnvironmentScripts: Codable, Hashable, Sendable {
    var defaultScript: String
    var macOS: String
    var linux: String
    var windows: String

    static let empty = ProjectEnvironmentScripts(defaultScript: "", macOS: "", linux: "", windows: "")

    func script(for scope: ProjectEnvironmentScriptScope) -> String {
        switch scope {
        case .default:
            defaultScript
        case .macOS:
            macOS
        case .linux:
            linux
        case .windows:
            windows
        }
    }

    mutating func setScript(_ script: String, for scope: ProjectEnvironmentScriptScope) {
        switch scope {
        case .default:
            defaultScript = script
        case .macOS:
            macOS = script
        case .linux:
            linux = script
        case .windows:
            windows = script
        }
    }
}

enum ProjectEnvironmentScriptScope: String, CaseIterable, Identifiable, Codable, Hashable, Sendable {
    case `default`
    case macOS
    case linux
    case windows

    var id: String { rawValue }

    func title(language: AppLanguage) -> String {
        switch self {
        case .default:
            language == .english ? "Default" : "默认"
        case .macOS:
            "macOS"
        case .linux:
            "Linux"
        case .windows:
            "Windows"
        }
    }
}

struct ProjectEnvironmentOperation: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var title: String
    var command: String

    init(id: UUID = UUID(), title: String = "", command: String = "") {
        self.id = id
        self.title = title
        self.command = command
    }
}

struct ConversationLibrary: Codable, Hashable, Sendable {
    var projects: [ConversationProject]
    var conversations: [StoredConversation]
    var activeConversationID: UUID?

    init(
        projects: [ConversationProject] = [],
        conversations: [StoredConversation] = [],
        activeConversationID: UUID? = nil
    ) {
        self.projects = projects
        self.conversations = conversations
        self.activeConversationID = activeConversationID
    }
}

enum AppAvailability: String, Sendable {
    case offline
    case idle
    case generating
}

struct ModelSummary: Identifiable, Hashable, Sendable {
    let name: String
    let displayName: String
    let size: Int64
    let capabilities: [String]
    let contextLength: Int?
    let isLoaded: Bool
    let modifiedAt: Date

    var id: String { name }

    init(
        name: String,
        displayName: String,
        size: Int64,
        capabilities: [String],
        contextLength: Int? = nil,
        isLoaded: Bool,
        modifiedAt: Date
    ) {
        self.name = name
        self.displayName = displayName
        self.size = size
        self.capabilities = capabilities
        self.contextLength = contextLength
        self.isLoaded = isLoaded
        self.modifiedAt = modifiedAt
    }
}

extension ModelSummary {
    var supportsCompletion: Bool {
        capabilities.contains("completion")
    }

    var supportsVision: Bool {
        capabilities.contains("vision")
    }

    var supportsTools: Bool {
        capabilities.contains("tools")
    }
}

extension Collection where Element == MessageAttachment {
    var requiresVisionModel: Bool {
        contains(where: { $0.kind == .image })
    }
}

enum OllamaError: LocalizedError, Sendable {
    case offline
    case invalidResponse
    case server(String)
    case attachmentPreparationFailed(String)
    case missingExecutablePath
    case launchAgentInstallFailed

    var errorDescription: String? {
        switch self {
        case .offline:
            return LocalizedStrings.current()("无法连接到本地 Ollama 服务，请先启动 Ollama.app。", "Cannot connect to the local Ollama service. Start Ollama.app first.")
        case .invalidResponse:
            return LocalizedStrings.current()("Ollama 返回了无法识别的数据。", "Ollama returned unrecognized data.")
        case .server(let message):
            return message
        case .attachmentPreparationFailed(let message):
            return message
        case .missingExecutablePath:
            return LocalizedStrings.current()("未能确定当前应用路径，无法配置开机启动。", "Could not determine the current app path, so launch at login cannot be configured.")
        case .launchAgentInstallFailed:
            return LocalizedStrings.current()("开机启动配置失败。", "Failed to configure launch at login.")
        }
    }
}

struct OllamaTaggedModel: Decodable, Sendable {
    let name: String
    let size: Int64
    let modifiedAt: Date

    enum CodingKeys: String, CodingKey {
        case name
        case size
        case modifiedAt = "modified_at"
    }
}

struct OllamaModelDetails: Decodable, Sendable {
    let capabilities: [String]
    let parameters: String?
    let modelInfo: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case capabilities
        case parameters
        case modelInfo = "model_info"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        capabilities = try container.decodeIfPresent([String].self, forKey: .capabilities) ?? []
        parameters = try container.decodeIfPresent(String.self, forKey: .parameters)
        modelInfo = try container.decodeIfPresent([String: JSONValue].self, forKey: .modelInfo) ?? [:]
    }

    var contextLength: Int? {
        modelInfoContextLength ?? parameterContextLength
    }

    private var modelInfoContextLength: Int? {
        modelInfo.compactMap { key, value -> Int? in
            guard key == "context_length" || key.hasSuffix(".context_length"),
                  let length = value.intValue,
                  length > 0 else {
                return nil
            }
            return length
        }
        .max()
    }

    private var parameterContextLength: Int? {
        parameters?
            .components(separatedBy: .newlines)
            .compactMap { line -> Int? in
                let parts = line.split(whereSeparator: \.isWhitespace)
                guard parts.count >= 2,
                      parts[0] == "num_ctx",
                      let length = Int(parts[1]),
                      length > 0 else {
                    return nil
                }
                return length
            }
            .first
    }
}

struct OllamaRunningModel: Decodable, Sendable {
    let name: String
}

struct OllamaChatChunk: Decodable, Sendable {
    let message: OllamaChatChunkMessage?
    let done: Bool?
    let error: String?
}

struct OllamaChatChunkMessage: Decodable, Sendable {
    let role: String?
    let content: String?
    let thinking: String?
    let toolCalls: [OllamaToolCall]?

    enum CodingKeys: String, CodingKey {
        case role
        case content
        case thinking
        case toolCalls = "tool_calls"
    }
}

struct OllamaToolCall: Decodable, Hashable, Sendable {
    let id: String?
    let function: OllamaToolFunctionCall
}

struct OllamaToolFunctionCall: Decodable, Hashable, Sendable {
    let name: String
    let arguments: JSONValue?
}

extension OllamaToolCall {
    var agentCall: AgentToolCall {
        var decodedArguments: [String: JSONValue] = [:]
        if let arguments = function.arguments {
            switch arguments {
            case .object(let object):
                decodedArguments = object
            case .string(let string):
                decodedArguments = Self.decodeStringArguments(string)
            default:
                decodedArguments = [:]
            }
        }
        return AgentToolCall(id: id, name: function.name, arguments: decodedArguments)
    }

    private static func decodeStringArguments(_ string: String) -> [String: JSONValue] {
        guard let data = string.data(using: .utf8),
              let object = try? JSONDecoder().decode([String: JSONValue].self, from: data) else {
            return [:]
        }
        return object
    }
}

enum ChatRetryState: Sendable {
    case unavailable
    case ready
}
