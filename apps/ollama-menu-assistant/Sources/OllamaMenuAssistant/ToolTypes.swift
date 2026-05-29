import Foundation

enum ToolPermissionMode: String, CaseIterable, Codable, Sendable, Identifiable {
    case `default`
    case autoReview
    case fullAccess

    var id: String { rawValue }

    var title: String {
        title(language: .simplifiedChinese)
    }

    func title(language: AppLanguage) -> String {
        switch self {
        case .default:
            return language == .english ? "Default" : "默认权限"
        case .autoReview:
            return language == .english ? "Auto review" : "自动审查"
        case .fullAccess:
            return language == .english ? "Full access" : "完全访问"
        }
    }

    var subtitle: String {
        subtitle(language: .simplifiedChinese)
    }

    func subtitle(language: AppLanguage) -> String {
        switch self {
        case .default:
            return language == .english ? "Only allow read-only workspace tools and safe read commands." : "仅允许工作区内只读工具和安全读类命令。"
        case .autoReview:
            return language == .english ? "Allow the model to request elevated access, with static review and sandbox-first execution." : "允许模型请求提权，先静态审查并优先沙箱执行。"
        case .fullAccess:
            return language == .english ? "Allow local commands and file writes while keeping timeouts, truncation, and logs." : "允许本地命令和文件写入，仍保留超时、截断和日志。"
        }
    }
}

enum ToolExecutionStatus: String, Codable, Hashable, Sendable {
    case allowed
    case denied
    case failed
}

struct ToolExecutionEvent: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var toolName: String
    var status: ToolExecutionStatus
    var summary: String
    var timestamp: Date
    var metadata: [String: JSONValue]

    init(
        id: UUID = UUID(),
        toolName: String,
        status: ToolExecutionStatus,
        summary: String,
        timestamp: Date = .now,
        metadata: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.toolName = toolName
        self.status = status
        self.summary = summary
        self.timestamp = timestamp
        self.metadata = metadata
    }

    enum CodingKeys: String, CodingKey {
        case id
        case toolName
        case status
        case summary
        case timestamp
        case metadata
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        toolName = try container.decodeIfPresent(String.self, forKey: .toolName) ?? ""
        status = try container.decodeIfPresent(ToolExecutionStatus.self, forKey: .status) ?? .allowed
        summary = try container.decodeIfPresent(String.self, forKey: .summary) ?? ""
        timestamp = try container.decodeIfPresent(Date.self, forKey: .timestamp) ?? .now
        metadata = try container.decodeIfPresent([String: JSONValue].self, forKey: .metadata) ?? [:]
    }
}

enum JSONValue: Codable, Hashable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }
}

extension JSONValue {
    var stringValue: String? {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            if value.rounded() == value {
                return String(Int(value))
            }
            return String(value)
        case .bool(let value):
            return String(value)
        default:
            return nil
        }
    }

    var intValue: Int? {
        switch self {
        case .number(let value):
            return Int(value)
        case .string(let value):
            return Int(value)
        default:
            return nil
        }
    }

    var boolValue: Bool? {
        switch self {
        case .bool(let value):
            return value
        case .string(let value):
            return Bool(value)
        default:
            return nil
        }
    }

    var objectValue: [String: JSONValue]? {
        if case .object(let value) = self {
            return value
        }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case .array(let value) = self {
            return value
        }
        return nil
    }
}

struct ToolDefinition: Codable, Hashable, Sendable {
    var type: String
    var function: ToolFunctionDefinition

    init(name: String, description: String, parameters: JSONValue) {
        self.type = "function"
        self.function = ToolFunctionDefinition(name: name, description: description, parameters: parameters)
    }
}

struct ToolFunctionDefinition: Codable, Hashable, Sendable {
    var name: String
    var description: String
    var parameters: JSONValue
}

struct AgentToolCall: Codable, Hashable, Sendable {
    var id: String?
    var name: String
    var arguments: [String: JSONValue]

    init(id: String? = nil, name: String, arguments: [String: JSONValue] = [:]) {
        self.id = id
        self.name = name
        self.arguments = arguments
    }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case tool
        case arguments
        case args
        case parameters
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name)
            ?? container.decodeIfPresent(String.self, forKey: .tool)
            ?? ""

        if let arguments = try container.decodeIfPresent([String: JSONValue].self, forKey: .arguments) {
            self.arguments = arguments
        } else if let arguments = try container.decodeIfPresent([String: JSONValue].self, forKey: .args) {
            self.arguments = arguments
        } else if let arguments = try container.decodeIfPresent([String: JSONValue].self, forKey: .parameters) {
            self.arguments = arguments
        } else {
            self.arguments = [:]
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(arguments, forKey: .arguments)
    }
}

struct ToolResult: Codable, Hashable, Sendable {
    var ok: Bool
    var toolName: String
    var content: String
    var errorCode: String?
    var metadata: [String: JSONValue]

    init(
        ok: Bool,
        toolName: String,
        content: String,
        errorCode: String? = nil,
        metadata: [String: JSONValue] = [:]
    ) {
        self.ok = ok
        self.toolName = toolName
        self.content = content
        self.errorCode = errorCode
        self.metadata = metadata
    }
}

enum WorkspaceToolOperation: String, Sendable {
    case read
    case write
    case delete
    case shell
}

struct ToolExecutionContext: Sendable {
    var project: ConversationProject?
    var permissionMode: ToolPermissionMode

    var workspaceRootURL: URL? {
        guard let path = project?.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !path.isEmpty else {
            return nil
        }
        return URL(fileURLWithPath: path).standardizedFileURL.resolvingSymlinksInPath()
    }
}

struct RegisteredTool: Sendable {
    var definition: ToolDefinition
    var operation: WorkspaceToolOperation
    var execute: @Sendable (AgentToolCall, ToolExecutionContext) async -> ToolResult
}

struct ToolRegistry: Sendable {
    private let toolsByName: [String: RegisteredTool]
    private let tools: [RegisteredTool]

    init(tools: [RegisteredTool]) {
        var uniqueTools: [RegisteredTool] = []
        var toolsByName: [String: RegisteredTool] = [:]
        for tool in tools {
            let name = tool.definition.function.name
            guard toolsByName[name] == nil else {
                continue
            }
            uniqueTools.append(tool)
            toolsByName[name] = tool
        }
        self.tools = uniqueTools
        self.toolsByName = toolsByName
    }

    var registeredTools: [RegisteredTool] {
        tools
    }

    var definitions: [ToolDefinition] {
        toolsByName.values.map(\.definition).sorted { $0.function.name < $1.function.name }
    }

    func tool(named name: String) -> RegisteredTool? {
        toolsByName[name]
    }

    func execute(_ call: AgentToolCall, context: ToolExecutionContext) async -> ToolResult {
        guard let tool = tool(named: call.name) else {
            return ToolResult(
                ok: false,
                toolName: call.name,
                content: "Unknown tool: \(call.name)",
                errorCode: "unknown_tool"
            )
        }
        return await tool.execute(call, context)
    }

    func manifestText() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(definitions),
              let text = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return text
    }
}

struct AgentChatMessage: Hashable, Sendable {
    var role: String
    var content: String
    var attachments: [MessageAttachment]

    init(role: String, content: String, attachments: [MessageAttachment] = []) {
        self.role = role
        self.content = content
        self.attachments = attachments
    }

    init(message: ChatMessage) {
        self.role = message.role.rawValue
        self.content = message.content
        self.attachments = message.attachments
    }
}
