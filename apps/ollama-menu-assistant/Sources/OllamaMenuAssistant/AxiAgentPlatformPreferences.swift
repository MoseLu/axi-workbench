import Foundation

enum AxiAgentPlatformProvider: String, CaseIterable, Identifiable, Sendable {
    case minimax
    case openAI
    case qwen

    var id: String { rawValue }

    func title(language: AppLanguage) -> String {
        switch self {
        case .minimax:
            return "MiniMax"
        case .openAI:
            return "OpenAI"
        case .qwen:
            return language == .english ? "Qwen" : "通义千问"
        }
    }
}

struct AxiAgentPlatformPreferences: Equatable, Sendable {
    static let defaultProvider = AxiAgentPlatformProvider.minimax.rawValue
    static let defaultMiniMaxAPIURL = "https://api.minimaxi.com/v1"
    static let defaultMiniMaxModel = "abab6-chat"
    static let defaultOpenAIModel = "gpt-4"
    static let defaultQwenAPIURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    static let defaultQwenModel = "qwen-plus"
    static let defaultTemperature = 0.7
    static let defaultMaxTokens = 2048
    static let defaultMaxAgents = 10
    static let defaultRepositoryPath = "./projects"
    static let defaultMaxWorktrees = 10
    static let defaultMaxParallelAgents = 8
    static let defaultBaseBranch = "main"
    static let defaultWorktreesCleanupHours = 24
    static let defaultMCPCommand = "node"
    static let defaultMCPTimeoutSeconds = 5.0
    static let defaultMCPProtocolVersion = "2024-11-05"

    var provider: AxiAgentPlatformProvider
    var minimaxAPIKey: String
    var minimaxAPIURL: String
    var minimaxDefaultModel: String
    var openAIAPIKey: String
    var openAIDefaultModel: String
    var qwenAPIKey: String
    var qwenAPIURL: String
    var qwenDefaultModel: String
    var defaultTemperature: Double
    var defaultMaxTokens: Int
    var maxAgents: Int
    var repositoryPath: String
    var maxWorktrees: Int
    var maxParallelAgents: Int
    var defaultBaseBranch: String
    var worktreesCleanupHours: Int
    var mcpCommand: String
    var mcpArguments: String
    var mcpCWD: String
    var mcpTimeoutSeconds: Double
    var mcpProtocolVersion: String

    init(
        provider: AxiAgentPlatformProvider = .minimax,
        minimaxAPIKey: String = "",
        minimaxAPIURL: String = Self.defaultMiniMaxAPIURL,
        minimaxDefaultModel: String = Self.defaultMiniMaxModel,
        openAIAPIKey: String = "",
        openAIDefaultModel: String = Self.defaultOpenAIModel,
        qwenAPIKey: String = "",
        qwenAPIURL: String = Self.defaultQwenAPIURL,
        qwenDefaultModel: String = Self.defaultQwenModel,
        defaultTemperature: Double = Self.defaultTemperature,
        defaultMaxTokens: Int = Self.defaultMaxTokens,
        maxAgents: Int = Self.defaultMaxAgents,
        repositoryPath: String = Self.defaultRepositoryPath,
        maxWorktrees: Int = Self.defaultMaxWorktrees,
        maxParallelAgents: Int = Self.defaultMaxParallelAgents,
        defaultBaseBranch: String = Self.defaultBaseBranch,
        worktreesCleanupHours: Int = Self.defaultWorktreesCleanupHours,
        mcpCommand: String = Self.defaultMCPCommand,
        mcpArguments: String = "",
        mcpCWD: String = "",
        mcpTimeoutSeconds: Double = Self.defaultMCPTimeoutSeconds,
        mcpProtocolVersion: String = Self.defaultMCPProtocolVersion
    ) {
        self.provider = provider
        self.minimaxAPIKey = minimaxAPIKey
        self.minimaxAPIURL = minimaxAPIURL
        self.minimaxDefaultModel = minimaxDefaultModel
        self.openAIAPIKey = openAIAPIKey
        self.openAIDefaultModel = openAIDefaultModel
        self.qwenAPIKey = qwenAPIKey
        self.qwenAPIURL = qwenAPIURL
        self.qwenDefaultModel = qwenDefaultModel
        self.defaultTemperature = defaultTemperature
        self.defaultMaxTokens = defaultMaxTokens
        self.maxAgents = maxAgents
        self.repositoryPath = repositoryPath
        self.maxWorktrees = maxWorktrees
        self.maxParallelAgents = maxParallelAgents
        self.defaultBaseBranch = defaultBaseBranch
        self.worktreesCleanupHours = worktreesCleanupHours
        self.mcpCommand = mcpCommand
        self.mcpArguments = mcpArguments
        self.mcpCWD = mcpCWD
        self.mcpTimeoutSeconds = mcpTimeoutSeconds
        self.mcpProtocolVersion = mcpProtocolVersion
    }

    var selectedProviderAPIKey: String {
        switch provider {
        case .minimax:
            return minimaxAPIKey
        case .openAI:
            return openAIAPIKey
        case .qwen:
            return qwenAPIKey
        }
    }

    var selectedProviderBaseURL: String {
        switch provider {
        case .minimax:
            return minimaxAPIURL
        case .openAI:
            return ""
        case .qwen:
            return qwenAPIURL
        }
    }

    var selectedProviderModel: String {
        switch provider {
        case .minimax:
            return minimaxDefaultModel
        case .openAI:
            return openAIDefaultModel
        case .qwen:
            return qwenDefaultModel
        }
    }
}
