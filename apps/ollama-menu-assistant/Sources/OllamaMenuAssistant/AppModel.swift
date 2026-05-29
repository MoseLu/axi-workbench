import AppKit
import Combine
import Foundation

private struct ContextWindowUsageCacheKey: Equatable {
    let modelName: String
    let modelDisplayName: String
    let modelContextLength: Int?
    let messageCount: Int
    let messageFingerprint: Int
    let draftFingerprint: Int
    let pendingAttachmentFingerprint: Int
    let projectID: UUID?
    let projectName: String?
    let projectPath: String?

    init(
        model: ModelSummary,
        messages: [ChatMessage],
        draft: String,
        pendingAttachments: [MessageAttachment],
        project: ConversationProject?
    ) {
        modelName = model.name
        modelDisplayName = model.displayName
        modelContextLength = model.contextLength
        messageCount = messages.count
        messageFingerprint = Self.messageFingerprint(messages)
        draftFingerprint = Self.stringFingerprint(draft)
        pendingAttachmentFingerprint = Self.attachmentFingerprint(pendingAttachments)
        projectID = project?.id
        projectName = project?.name
        projectPath = project?.path
    }

    private static func messageFingerprint(_ messages: [ChatMessage]) -> Int {
        var hasher = Hasher()
        for message in messages {
            hasher.combine(message.id)
            hasher.combine(message.role.rawValue)
            hasher.combine(message.timestamp)
            hasher.combine(message.content.utf8.count)
            hasher.combine(message.attachments.count)
            hasher.combine(attachmentFingerprint(message.attachments))
            hasher.combine(message.toolEvents.count)
            hasher.combine(message.changeSummary?.files.count ?? 0)
        }
        return hasher.finalize()
    }

    private static func attachmentFingerprint(_ attachments: [MessageAttachment]) -> Int {
        var hasher = Hasher()
        for attachment in attachments {
            hasher.combine(attachment.id)
            hasher.combine(attachment.name)
            hasher.combine(attachment.path)
            hasher.combine(attachment.kind.rawValue)
            hasher.combine(attachment.byteCount)
        }
        return hasher.finalize()
    }

    private static func stringFingerprint(_ value: String) -> Int {
        var hasher = Hasher()
        hasher.combine(value.utf8.count)
        hasher.combine(value)
        return hasher.finalize()
    }
}

enum SnapshotKind: String, CaseIterable, Sendable {
    case empty
    case chat
    case loading
    case offline
}

@MainActor
final class AppModel: ObservableObject {
    enum DefaultsKeys {
        static let selectedModelName = "selectedModelName"
        static let routingMode = "routingMode"
        static let toolPermissionMode = "toolPermissionMode"
        static let imBridgeEnabled = "imBridgeEnabled"
        static let imBridgeCredentialPath = "imBridgeCredentialPath"
        static let pet = AppPreferenceKeys.Settings.pet
        static let pets = AppPreferenceKeys.Settings.pets
    }

    @Published var availability: AppAvailability = .idle
    @Published var models: [ModelSummary] = []
    @Published var projects: [ConversationProject] = []
    @Published var conversations: [StoredConversation] = []
    @Published var isLaunchAtLoginEnabled = false
    @Published var hotkeyRegistrationFailed = false
    @Published var isAwaitingFirstToken = false
    @Published var didReceiveResponseChunk = false
    @Published var generatingConversationID: UUID?
    @Published var pendingAttachments: [MessageAttachment] = []
    @Published var isVoiceInputActive = false
    @Published var selectedProjectID: UUID?
    @Published var allowsNoProjectForCurrentNewConversation = true
    @Published var availableSkills: [SkillSummary] = []
    @Published var availablePlugins: [PluginSummary] = []
    @Published var mcpServerStatuses: [MCPServerStatus] = []
    @Published var pluginErrorMessage: String?
    @Published var runtimeTraces: [RuntimeTrace] = []
    @Published var isIMBridgeEnabled = false
    @Published var imBridgeStatus: WeChatIMBridgeStatus = .disabled
    @Published var availablePets: [PetDescriptor] = []
    @Published var petSelections: [PetSelection]
    @Published var petSelection: PetSelection
    @Published var isPetRunning = false
    @Published var petStatusMessage: String?
    @Published var routingMode: RoutingMode = .expert
    @Published var toolPermissionMode: ToolPermissionMode = .default
    @Published var selectedModelName: String = "main:latest"
    @Published var currentConversation: StoredConversation
    @Published var isCurrentConversationLoading = false
    @Published var navigationHistory = AppNavigationHistory()
    @Published var draft = ""
    @Published var errorMessage: String?

    let catalogService: ModelCatalogService
    let client: OllamaClient
    let conversationStore: ConversationStore
    let launchAtLoginCoordinator: LaunchAtLoginCoordinator
    let petRunnerController: PetRunnerController
    let petRootURL: URL
    let appDataPaths: AppDataPaths
    let speechInputCoordinator: SpeechInputCoordinator
    let toolRegistry: ToolRegistry
    let skillLibrary: SkillLibrary?
    let pluginLibrary: PluginLibrary
    let knowledgeStore: ProjectKnowledgeStore
    let mcpToolBroker: MCPToolBroker
    let runtimeTraceStore: RuntimeTraceStore
    let memoryStore: AssistantMemoryStore
    let defaults: UserDefaults
    let imCredentialStore: WeChatIMCredentialStore
    let imBindingStore: IMConversationBindingStore
    var imBridge: WeChatIMBridge?
    var imBridgeGeneration = UUID()
    var voiceDraftPrefix = ""
    var activeConversationID: UUID?
    var conversationDetailLoadGeneration = UUID()
    var conversationDetailCache: [UUID: StoredConversation] = [:]
    var cancellables = Set<AnyCancellable>()
    private var contextWindowUsageCacheKey: ContextWindowUsageCacheKey?
    private var contextWindowUsageCacheValue: ContextWindowUsage?

    init(
        client: OllamaClient,
        catalogService: ModelCatalogService,
        conversationStore: ConversationStore,
        launchAtLoginCoordinator: LaunchAtLoginCoordinator,
        petRunnerController: PetRunnerController = PetRunnerController(),
        petRootURL: URL? = nil,
        speechInputCoordinator: SpeechInputCoordinator = SpeechInputCoordinator(),
        defaults: UserDefaults = .standard
    ) {
        let appDataPaths = AppDataPaths.default()
        var initialPluginErrorMessage: String?
        do {
            try appDataPaths.createBaseDirectories()
            let importState = try LegacyCodexImporter(paths: appDataPaths).runIfNeeded()
            if !importState.errors.isEmpty {
                initialPluginErrorMessage = importState.errors.prefix(3).joined(separator: "\n")
            }
        } catch {
            initialPluginErrorMessage = error.localizedDescription
        }

        self.client = client
        self.catalogService = catalogService
        self.conversationStore = conversationStore
        self.launchAtLoginCoordinator = launchAtLoginCoordinator
        self.petRunnerController = petRunnerController
        self.appDataPaths = appDataPaths
        self.petRootURL = petRootURL ?? appDataPaths.petsURL
        self.speechInputCoordinator = speechInputCoordinator
        let skillLibrary = SkillLibrary.default(paths: appDataPaths)
        self.skillLibrary = skillLibrary
        self.pluginLibrary = PluginLibrary.default(paths: appDataPaths)
        self.knowledgeStore = ProjectKnowledgeStore()
        self.mcpToolBroker = MCPToolBroker()
        self.runtimeTraceStore = RuntimeTraceStore()
        self.memoryStore = AssistantMemoryStore(rootURL: appDataPaths.memoriesURL)
        var workspaceToolService = WorkspaceToolService()
        workspaceToolService.skillLibrary = skillLibrary
        self.toolRegistry = workspaceToolService.makeRegistry()
        self.defaults = defaults
        self.imCredentialStore = WeChatIMCredentialStore()
        self.imBindingStore = IMConversationBindingStore()

        let initialModel = defaults.string(forKey: DefaultsKeys.selectedModelName) ?? "main:latest"
        let initialMode = RoutingMode(rawValue: defaults.string(forKey: DefaultsKeys.routingMode) ?? "") ?? .expert
        let initialToolPermissionMode = ToolPermissionMode(rawValue: defaults.string(forKey: DefaultsKeys.toolPermissionMode) ?? "") ?? .default
        let initialAvailablePets = PetCatalog.loadAvailablePets(rootURL: self.petRootURL)
        let storedPetRoster = defaults.string(forKey: DefaultsKeys.pets)
        let storedPetSelection = defaults.string(forKey: DefaultsKeys.pet)
        let initialPetRoster = PetRoster(storedValue: storedPetRoster, legacyStoredValue: storedPetSelection)
        let initialPetSelection = initialPetRoster.primarySelection
        if storedPetRoster != initialPetRoster.storageValue {
            defaults.set(initialPetRoster.storageValue, forKey: DefaultsKeys.pets)
        }
        if storedPetSelection != initialPetSelection.storageValue {
            defaults.set(initialPetSelection.storageValue, forKey: DefaultsKeys.pet)
        }
        self.selectedModelName = initialModel
        self.routingMode = initialMode
        self.toolPermissionMode = initialToolPermissionMode
        self.availablePets = initialAvailablePets
        self.petSelections = initialPetRoster.selections
        self.petSelection = initialPetSelection
        self.isIMBridgeEnabled = defaults.bool(forKey: DefaultsKeys.imBridgeEnabled)
        self.currentConversation = StoredConversation(model: initialModel)
        self.availableSkills = skillLibrary?.discoverSkills() ?? []
        self.availablePlugins = pluginLibrary.discoverPlugins()
        self.pluginErrorMessage = initialPluginErrorMessage
        observePetRunnerLifecycle()
        refreshPetRunnerState()
    }

    var statusLabel: String {
        let tr = LocalizedStrings.current(defaults: defaults)
        switch availability {
        case .offline:
            return tr("离线", "Offline")
        case .idle:
            return tr("就绪", "Ready")
        case .generating:
            return isAwaitingFirstToken ? tr("模型加载中", "Loading model") : tr("生成中", "Generating")
        }
    }

    var canSubmit: Bool {
        (
            !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !pendingAttachments.isEmpty
        ) && !selectedModelName.isEmpty && availability != .generating && !isCurrentConversationLoading
    }

    var canRetry: Bool {
        availability != .generating && currentConversation.messages.last?.role == .assistant
    }

    func isConversationGenerating(_ conversationID: UUID) -> Bool {
        availability == .generating && generatingConversationID == conversationID
    }

    var activeModel: ModelSummary? {
        resolvedModel(for: currentConversation.messages.flatMap(\.attachments) + pendingAttachments)
    }

    var activeModelDisplayName: String {
        if let activeModel {
            return activeModel.displayName
        }
        return ModelCatalogService.displayName(for: selectedModelNameOrFallback())
    }

    var contextWindowUsage: ContextWindowUsage? {
        guard let activeModel else {
            contextWindowUsageCacheKey = nil
            contextWindowUsageCacheValue = nil
            return nil
        }

        let cacheKey = ContextWindowUsageCacheKey(
            model: activeModel,
            messages: currentConversation.messages,
            draft: draft,
            pendingAttachments: pendingAttachments,
            project: currentProject
        )

        if contextWindowUsageCacheKey == cacheKey {
            return contextWindowUsageCacheValue
        }

        let usage = ContextWindowEstimator.makeUsage(
            model: activeModel,
            messages: currentConversation.messages,
            draft: draft,
            pendingAttachments: pendingAttachments,
            project: currentProject
        )
        contextWindowUsageCacheKey = cacheKey
        contextWindowUsageCacheValue = usage
        return usage
    }

    var currentProject: ConversationProject? {
        guard let projectID = currentConversation.projectID ?? selectedProjectID else {
            return nil
        }
        return projects.first(where: { $0.id == projectID })
    }

    var currentProjectName: String? {
        currentProject?.name
    }

    var canNavigateBack: Bool {
        navigationHistory.canGoBack
    }

    var canNavigateForward: Bool {
        navigationHistory.canGoForward
    }

    func startup() async {
        do {
            isLaunchAtLoginEnabled = try launchAtLoginCoordinator.ensureDefaultEnabledIfNeeded()
        } catch {
            errorMessage = error.localizedDescription
        }

        await applyPetSelections(petSelections)

        do {
            let loadedLibrary = try await conversationStore.loadLibraryMetadata()
            let library = LegacyWorkspaceProjectCleaner.clean(loadedLibrary)
            projects = library.projects
            conversations = library.conversations
            restoreActiveConversation(from: library)
            if library != loadedLibrary {
                await persistLibrary()
            }
        } catch {
            errorMessage = localized("读取最近会话失败：\(error.localizedDescription)", "Failed to load recent chats: \(error.localizedDescription)")
        }

        do {
            try await imBindingStore.load()
        } catch {
            errorMessage = localized("读取 IM 会话绑定失败：\(error.localizedDescription)", "Failed to load IM chat bindings: \(error.localizedDescription)")
        }

        do {
            runtimeTraces = try await runtimeTraceStore.load()
        } catch {
            errorMessage = localized("读取运行时观测记录失败：\(error.localizedDescription)", "Failed to load runtime traces: \(error.localizedDescription)")
        }

        await refreshMCPBrokerStatus()
        await refreshModels()

        if isIMBridgeEnabled {
            startIMBridge()
        }
    }

    func setHotkeyRegistrationResult(success: Bool) {
        hotkeyRegistrationFailed = !success
    }

    func refreshModels() async {
        do {
            let snapshot = try await catalogService.fetchCatalog(storedSelection: defaults.string(forKey: DefaultsKeys.selectedModelName))
            models = snapshot.models
            availability = .idle
            errorMessage = nil

            if let selected = snapshot.selectedModel {
                applySelectedModel(selected)
            } else if models.isEmpty {
                selectedModelName = ""
            }
        } catch {
            availability = .offline
            errorMessage = error.localizedDescription
        }
    }

    func refreshPlugins() {
        availablePlugins = pluginLibrary.discoverPlugins()
        pluginErrorMessage = nil
        Task {
            await refreshMCPBrokerStatus()
        }
    }

    func setPluginEnabled(_ plugin: PluginSummary, enabled: Bool) {
        do {
            try pluginLibrary.setPluginEnabled(plugin.pluginID, enabled: enabled)
            refreshPlugins()
        } catch {
            pluginErrorMessage = localized(
                "更新插件失败：\(error.localizedDescription)",
                "Failed to update plugin: \(error.localizedDescription)"
            )
        }
    }

    func refreshMCPBrokerStatus() async {
        let snapshot = await mcpToolBroker.snapshot(for: availablePlugins)
        mcpServerStatuses = snapshot.serverStatuses
    }

}
