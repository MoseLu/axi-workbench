import Foundation

enum AgentTaskKind: String, Codable, Hashable, Sendable {
    case chat
    case coding
    case codebaseSearch
    case toolHeavy
    case vision
    case summarization
    case imReply
    case longContext
}

struct TaskClassification: Codable, Hashable, Sendable {
    var primaryKind: AgentTaskKind
    var labels: [AgentTaskKind]
    var query: String
    var requiresVision: Bool
    var prefersTools: Bool
    var estimatedTokens: Int

    init(
        primaryKind: AgentTaskKind,
        labels: [AgentTaskKind],
        query: String,
        requiresVision: Bool,
        prefersTools: Bool,
        estimatedTokens: Int
    ) {
        self.primaryKind = primaryKind
        self.labels = labels
        self.query = query
        self.requiresVision = requiresVision
        self.prefersTools = prefersTools
        self.estimatedTokens = estimatedTokens
    }
}

struct ModelPerformanceStats: Codable, Hashable, Sendable {
    var averageLatencySeconds: Double?
    var failureRate: Double
    var toolSuccessRate: Double?

    init(
        averageLatencySeconds: Double? = nil,
        failureRate: Double = 0,
        toolSuccessRate: Double? = nil
    ) {
        self.averageLatencySeconds = averageLatencySeconds
        self.failureRate = failureRate
        self.toolSuccessRate = toolSuccessRate
    }
}

struct ModelRouteScore: Codable, Hashable, Sendable {
    var modelName: String
    var score: Double
    var reasons: [String]
}

struct ModelRouteDecision: Codable, Hashable, Sendable {
    var selectedModelName: String
    var selectedDisplayName: String
    var mode: RoutingMode
    var scores: [ModelRouteScore]
    var fallbackModelName: String?
    var reason: String
}

enum CapabilityKind: String, Codable, Hashable, Sendable {
    case workspaceTool
    case skill
    case knowledgeSource
    case pluginMCPTool
}

enum CapabilityRisk: String, Codable, Hashable, Sendable {
    case read
    case write
    case delete
    case shell
    case network
    case external
}

struct CapabilityDescriptor: Identifiable, Codable, Hashable, Sendable {
    var id: String
    var kind: CapabilityKind
    var name: String
    var description: String
    var risk: CapabilityRisk
    var source: String
    var isEnabled: Bool
    var schema: JSONValue?
    var invocationCount: Int
    var failureCount: Int

    init(
        id: String,
        kind: CapabilityKind,
        name: String,
        description: String,
        risk: CapabilityRisk,
        source: String,
        isEnabled: Bool = true,
        schema: JSONValue? = nil,
        invocationCount: Int = 0,
        failureCount: Int = 0
    ) {
        self.id = id
        self.kind = kind
        self.name = name
        self.description = description
        self.risk = risk
        self.source = source
        self.isEnabled = isEnabled
        self.schema = schema
        self.invocationCount = invocationCount
        self.failureCount = failureCount
    }
}

struct CapabilityInvocation: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var capabilityName: String
    var kind: CapabilityKind?
    var status: ToolExecutionStatus
    var summary: String
    var timestamp: Date
    var metadata: [String: JSONValue]

    init(
        id: UUID = UUID(),
        capabilityName: String,
        kind: CapabilityKind? = nil,
        status: ToolExecutionStatus,
        summary: String,
        timestamp: Date = .now,
        metadata: [String: JSONValue] = [:]
    ) {
        self.id = id
        self.capabilityName = capabilityName
        self.kind = kind
        self.status = status
        self.summary = summary
        self.timestamp = timestamp
        self.metadata = metadata
    }
}

struct KnowledgeHit: Identifiable, Codable, Hashable, Sendable {
    var id: String { "\(projectID):\(path):\(source)" }
    var projectID: UUID
    var path: String
    var snippet: String
    var score: Double
    var source: String
}

struct RuntimeTrace: Identifiable, Codable, Hashable, Sendable {
    var id: UUID
    var conversationID: UUID
    var startedAt: Date
    var finishedAt: Date?
    var task: TaskClassification
    var modelDecision: ModelRouteDecision
    var selectedCapabilities: [CapabilityDescriptor]
    var knowledgeHits: [KnowledgeHit]
    var invocations: [CapabilityInvocation]
    var fallbackModelName: String?
    var errorMessage: String?
    var rawPayloadSummary: String

    init(
        id: UUID = UUID(),
        conversationID: UUID,
        startedAt: Date = .now,
        finishedAt: Date? = nil,
        task: TaskClassification,
        modelDecision: ModelRouteDecision,
        selectedCapabilities: [CapabilityDescriptor],
        knowledgeHits: [KnowledgeHit],
        invocations: [CapabilityInvocation] = [],
        fallbackModelName: String? = nil,
        errorMessage: String? = nil,
        rawPayloadSummary: String
    ) {
        self.id = id
        self.conversationID = conversationID
        self.startedAt = startedAt
        self.finishedAt = finishedAt
        self.task = task
        self.modelDecision = modelDecision
        self.selectedCapabilities = selectedCapabilities
        self.knowledgeHits = knowledgeHits
        self.invocations = invocations
        self.fallbackModelName = fallbackModelName
        self.errorMessage = errorMessage
        self.rawPayloadSummary = rawPayloadSummary
    }
}

struct AgentRuntimeResult: Sendable {
    var content: String
    var trace: RuntimeTrace
}

struct AgentRequest: Sendable {
    var conversationID: UUID
    var routingMode: RoutingMode
    var selectedModelName: String
    var models: [ModelSummary]
    var messages: [ChatMessage]
    var baseSystemPrompt: String?
    var project: ConversationProject?
    var permissionMode: ToolPermissionMode
    var plugins: [PluginSummary]
    var onFinalDelta: @Sendable (String) async -> Void
    var onToolEvent: @Sendable (ToolExecutionEvent) async -> Void
    var onFallback: @Sendable (ModelRouteDecision) async -> Void
}
