import Foundation

extension AppModel {
    static func snapshotPreview(kind: SnapshotKind) -> AppModel {
        let client = OllamaClient()
        let catalogService = ModelCatalogService(client: client)
        let tempRoot = FileManager.default.temporaryDirectory.appending(path: "OllamaMenuAssistantSnapshots", directoryHint: .isDirectory)
        let conversationStore = ConversationStore(rootURL: tempRoot)
        let launchAtLoginCoordinator = LaunchAtLoginCoordinator()

        let model = AppModel(
            client: client,
            catalogService: catalogService,
            conversationStore: conversationStore,
            launchAtLoginCoordinator: launchAtLoginCoordinator
        )

        let models: [ModelSummary] = [
            ModelSummary(
                name: "main:latest",
                displayName: "main",
                size: 23_869_191_742,
                capabilities: ["completion"],
                contextLength: 262_144,
                isLoaded: true,
                modifiedAt: .now
            ),
            ModelSummary(
                name: "qwen3.5-9b-opus:latest",
                displayName: "qwen3.5-9b-opus",
                size: 5_627_041_461,
                capabilities: ["completion"],
                contextLength: 131_072,
                isLoaded: false,
                modifiedAt: Date(timeIntervalSinceNow: -86_400)
            ),
            ModelSummary(
                name: "gemma3:12b",
                displayName: "gemma3:12b",
                size: 8_149_190_253,
                capabilities: ["completion"],
                contextLength: 131_072,
                isLoaded: false,
                modifiedAt: Date(timeIntervalSinceNow: -172_800)
            ),
        ]

        let snapshotProjects = makeSnapshotProjects()
        let recent = makeSnapshotRecentConversations(projects: snapshotProjects)
        model.prepareSnapshotScaffold(models: models, recent: recent, projects: snapshotProjects)
        model.prepareSnapshotSkills()

        switch kind {
        case .empty:
            model.setSnapshotStatus(.idle)
            model.currentConversation = StoredConversation(model: "main:latest")
            model.prepareSnapshotScaffold(models: models, recent: recent, projects: snapshotProjects)
            model.currentConversation = StoredConversation(model: "main:latest")
        case .chat:
            model.setSnapshotStatus(.idle)
            model.currentConversation = recent[0]
        case .loading:
            model.setSnapshotStatus(.generating, awaitingFirstToken: true)
            model.currentConversation = recent[1]
            model.currentConversation.messages.append(
                ChatMessage(role: .user, content: "帮我把这段会议纪要压缩成 5 条要点。")
            )
            model.currentConversation.messages.append(
                ChatMessage(role: .assistant, content: "")
            )
            model.currentConversation.updateMetadata()
        case .offline:
            model.setSnapshotStatus(.offline)
            model.currentConversation = StoredConversation(model: "main:latest")
            model.errorMessage = "无法连接到本地 Ollama 服务，请先启动 Ollama.app。"
        }

        return model
    }

    func prepareSnapshotScaffold(
        models: [ModelSummary],
        recent: [StoredConversation],
        projects: [ConversationProject] = []
    ) {
        self.models = models
        self.projects = projects
        selectedModelName = "main:latest"
        routingMode = .expert
        isLaunchAtLoginEnabled = true
        isIMBridgeEnabled = false
        imBridgeStatus = .disabled
        hotkeyRegistrationFailed = false
        errorMessage = nil
        draft = ""
        conversations = recent
        currentConversation = recent.first ?? StoredConversation(model: "main:latest")
        selectedProjectID = currentConversation.projectID
    }

    func prepareSnapshotSkills() {
        availableSkills = [
            SkillSummary(
                name: "diagnose",
                description: "Disciplined debugging workflow",
                relativePath: "matt-pocock-skills/references/upstream/skills/engineering/diagnose/SKILL.md"
            ),
            SkillSummary(
                name: "karpathy-guidelines",
                description: "Use auto-triggered engineering guidelines",
                relativePath: "karpathy-guidelines/SKILL.md"
            ),
            SkillSummary(
                name: "summary",
                description: "Write a concise summary",
                relativePath: "summary/SKILL.md"
            ),
        ]
    }

    func setSnapshotStatus(_ availability: AppAvailability, awaitingFirstToken: Bool = false) {
        self.availability = availability
        self.isAwaitingFirstToken = awaitingFirstToken
    }
}

private func makeSnapshotProjects() -> [ConversationProject] {
    let now = Date()
    return [
        ConversationProject(name: "ollama-menu-assistant", path: "workspace://project/axi-workbench/apps/ollama-menu-assistant", updatedAt: now.addingTimeInterval(-180)),
        ConversationProject(name: "ielts-vocab", path: "workspace://project/ielts-vocab", updatedAt: now.addingTimeInterval(-86_000)),
    ]
}

private func makeSnapshotRecentConversations(projects: [ConversationProject]) -> [StoredConversation] {
    let now = Date()
    let primaryProjectID = projects.first?.id
    let secondaryProjectID = projects.dropFirst().first?.id

    var first = StoredConversation(
        projectID: primaryProjectID,
        title: "整理本地 Ollama 主力模型方案",
        model: "main:latest",
        createdAt: now.addingTimeInterval(-3_600),
        updatedAt: now.addingTimeInterval(-180),
        messages: [
            ChatMessage(role: .user, content: "本地已有 ollama，帮我看看在线开源模型中适合本地跑的速度能力平衡较好的模型", timestamp: now.addingTimeInterval(-3_500)),
            ChatMessage(role: .assistant, content: "如果你要兼顾速度、中文能力和本地部署体验，Qwen 这一系会是更稳的起点。", timestamp: now.addingTimeInterval(-3_300)),
            ChatMessage(role: .user, content: "qwen3.5-34b q4_k_m 怎么样", timestamp: now.addingTimeInterval(-3_100)),
            ChatMessage(role: .assistant, content: "这档位很适合作为主力模型，能力明显强于 7B/9B，同时还没重到完全失去桌面交互性。", timestamp: now.addingTimeInterval(-2_900)),
        ]
    )
    first.updateMetadata(now: now.addingTimeInterval(-180))

    var second = StoredConversation(
        projectID: primaryProjectID,
        title: "把最近会议纪要压缩成要点",
        model: "main:latest",
        createdAt: now.addingTimeInterval(-7_200),
        updatedAt: now.addingTimeInterval(-900),
        messages: [
            ChatMessage(role: .user, content: "帮我把这段会议纪要压缩成 5 条要点。", timestamp: now.addingTimeInterval(-1_100)),
            ChatMessage(role: .assistant, content: "1. 先统一桌面入口。 2. 主力模型维持 main 别名。 3. 默认关闭思考输出。 4. 后续补齐 UI 与截图自动化。 5. 保持本地运行。", timestamp: now.addingTimeInterval(-900)),
        ]
    )
    second.updateMetadata(now: now.addingTimeInterval(-900))

    var third = StoredConversation(
        projectID: secondaryProjectID,
        title: "写一个 Bash 脚本清理下载目录",
        model: "qwen3.5-9b-opus:latest",
        createdAt: now.addingTimeInterval(-86_400),
        updatedAt: now.addingTimeInterval(-86_000),
        messages: [
            ChatMessage(role: .user, content: "写一个 Bash 脚本，把下载目录里 7 天前的 zip 搬到 archive。", timestamp: now.addingTimeInterval(-86_100)),
            ChatMessage(role: .assistant, content: "可以，我先给你一个安全模式版本，只移动文件、不删除。", timestamp: now.addingTimeInterval(-86_000)),
        ]
    )
    third.updateMetadata(now: now.addingTimeInterval(-86_000))

    return [first, second, third]
}
