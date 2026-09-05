import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
@MainActor
func appModelSeparatesPinnedVisibleAndArchivedConversations() async throws {
    let model = makeConversationTestAppModel()
    let project = ConversationProject(name: "workspace", path: "/tmp/workspace")
    let pinned = StoredConversation(
        projectID: project.id,
        title: "Pinned",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 3_000),
        isPinned: true
    )
    let projectChat = StoredConversation(
        projectID: project.id,
        title: "Project chat",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 2_000)
    )
    let noProjectChat = StoredConversation(
        title: "No project chat",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 1_000)
    )
    let archived = StoredConversation(
        projectID: project.id,
        title: "Archived",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 4_000),
        isArchived: true
    )

    model.projects = [project]
    model.conversations = [archived, pinned, projectChat, noProjectChat]

    #expect(model.pinnedConversations().map(\.id) == [pinned.id])
    #expect(model.visibleConversations(for: project.id).map(\.id) == [projectChat.id])
    #expect(model.visibleConversations(for: nil).map(\.id) == [noProjectChat.id])
    #expect(model.archivedConversations().map(\.id) == [archived.id])

    model.togglePinConversation(pinned)
    #expect(model.conversations.first { $0.id == pinned.id }?.isPinned == false)
    model.togglePinConversation(pinned)
    #expect(model.conversations.first { $0.id == pinned.id }?.isPinned == true)

    model.archiveConversation(projectChat)
    #expect(model.conversations.first { $0.id == projectChat.id }?.isArchived == true)
    model.unarchiveConversation(projectChat)
    #expect(model.conversations.first { $0.id == projectChat.id }?.isArchived == false)
}

@Test
@MainActor
func appModelFiltersAndSortsArchivedConversations() async throws {
    let model = makeConversationTestAppModel()
    let docsProject = ConversationProject(name: "Axi Docs", path: "/tmp/axi-docs")
    let coderProject = ConversationProject(name: "Axi Coder", path: "/tmp/axi-coder")
    let docsChat = StoredConversation(
        projectID: docsProject.id,
        title: "Workspace adapter",
        model: "main:latest",
        createdAt: Date(timeIntervalSince1970: 1_000),
        updatedAt: Date(timeIntervalSince1970: 4_000),
        isArchived: true,
        messages: [ChatMessage(role: .user, content: "fix the adapter search")]
    )
    let coderChat = StoredConversation(
        projectID: coderProject.id,
        title: "Skill progression map",
        model: "main:latest",
        createdAt: Date(timeIntervalSince1970: 3_000),
        updatedAt: Date(timeIntervalSince1970: 2_000),
        isArchived: true,
        messages: [ChatMessage(role: .assistant, content: "handoff summary")]
    )
    let noProjectChat = StoredConversation(
        title: "Loose note",
        model: "main:latest",
        createdAt: Date(timeIntervalSince1970: 2_000),
        updatedAt: Date(timeIntervalSince1970: 3_000),
        isArchived: true,
        messages: [ChatMessage(role: .user, content: "browser startup")]
    )
    let visibleChat = StoredConversation(
        projectID: docsProject.id,
        title: "Visible adapter",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 5_000)
    )

    model.projects = [docsProject, coderProject]
    model.conversations = [docsChat, coderChat, noProjectChat, visibleChat]

    #expect(model.archivedConversations().map(\.id) == [docsChat.id, noProjectChat.id, coderChat.id])
    #expect(
        model.archivedConversations(matching: "adapter", projectFilter: .all, sortOption: .updatedAt)
            .map(\.id) == [docsChat.id]
    )
    #expect(
        model.archivedConversations(matching: "axi coder", projectFilter: .all, sortOption: .updatedAt)
            .map(\.id) == [coderChat.id]
    )
    #expect(
        model.archivedConversations(matching: "", projectFilter: .project(docsProject.id), sortOption: .updatedAt)
            .map(\.id) == [docsChat.id]
    )
    #expect(
        model.archivedConversations(matching: "", projectFilter: .noProject, sortOption: .updatedAt)
            .map(\.id) == [noProjectChat.id]
    )
    #expect(
        model.archivedConversations(matching: "", projectFilter: .all, sortOption: .createdAt)
            .map(\.id) == [coderChat.id, noProjectChat.id, docsChat.id]
    )
    #expect(
        model.archivedConversations(matching: "", projectFilter: .all, sortOption: .titleAscending)
            .map(\.id) == [noProjectChat.id, coderChat.id, docsChat.id]
    )
}

@Test
@MainActor
func appModelTracksGeneratingConversationByID() async throws {
    let model = makeConversationTestAppModel()
    let running = StoredConversation(title: "Running", model: "main:latest")
    let idle = StoredConversation(title: "Idle", model: "main:latest")

    model.availability = .generating
    model.generatingConversationID = running.id

    #expect(model.isConversationGenerating(running.id))
    #expect(!model.isConversationGenerating(idle.id))

    model.availability = .idle
    #expect(!model.isConversationGenerating(running.id))
}

@Test
@MainActor
func appModelMigratesLegacyPetSelectionDefaultToMiku() async throws {
    let defaults = UserDefaults(suiteName: "OllamaMenuAssistantTests-\(UUID().uuidString)")!
    defaults.set("Codex", forKey: AppModel.DefaultsKeys.pet)

    let model = makeConversationTestAppModel(defaults: defaults)

    #expect(model.petSelection == .miku)
    #expect(model.petSelections == [.miku])
    #expect(defaults.string(forKey: AppModel.DefaultsKeys.pet) == "miku")
    #expect(defaults.string(forKey: AppModel.DefaultsKeys.pets) == "miku")
}

@Test
@MainActor
func appModelNavigatesConversationHistoryContinuously() async throws {
    let model = makeConversationTestAppModel()
    let first = StoredConversation(title: "First", model: "main:latest")
    let second = StoredConversation(title: "Second", model: "main:latest")
    let third = StoredConversation(title: "Third", model: "main:latest")
    let fourth = StoredConversation(title: "Fourth", model: "main:latest")
    let library = ConversationLibrary(
        conversations: [first, second, third, fourth],
        activeConversationID: first.id
    )

    model.conversations = library.conversations
    model.restoreActiveConversation(from: library)
    model.openConversation(second)
    model.openConversation(third)

    #expect(model.currentConversation.id == third.id)
    #expect(model.canNavigateBack)
    #expect(!model.canNavigateForward)

    model.navigateBack()
    #expect(model.currentConversation.id == second.id)
    #expect(model.canNavigateBack)
    #expect(model.canNavigateForward)

    model.navigateBack()
    #expect(model.currentConversation.id == first.id)
    #expect(!model.canNavigateBack)
    #expect(model.canNavigateForward)

    model.navigateForward()
    #expect(model.currentConversation.id == second.id)

    model.openConversation(fourth)
    #expect(model.currentConversation.id == fourth.id)
    #expect(!model.canNavigateForward)

    model.navigateBack()
    #expect(model.currentConversation.id == second.id)

    model.navigateForward()
    #expect(model.currentConversation.id == fourth.id)
}

@Test
@MainActor
func appModelShowsEmptySkeletonBeforeApplyingCachedConversationDetail() async throws {
    let model = makeConversationTestAppModel()
    let conversation = StoredConversation(
        title: "Cached",
        model: "main:latest",
        messages: [
            ChatMessage(role: .user, content: "cached detail")
        ]
    )

    model.conversations = [conversation.metadataOnly]
    model.cacheConversationDetailIfEligible(conversation)
    model.openConversation(conversation.metadataOnly)

    #expect(model.currentConversation.id == conversation.id)
    #expect(model.currentConversation.messages.isEmpty)
    #expect(model.isCurrentConversationLoading)

    await waitForConversationDetail(
        model,
        id: conversation.id,
        expectedMessages: ["cached detail"]
    )

    #expect(model.currentConversation.messages.map(\.content) == ["cached detail"])
    #expect(!model.isCurrentConversationLoading)
}

@Test
@MainActor
func appModelReplacesDraftNavigationRouteAfterPersistingConversation() async throws {
    let model = makeConversationTestAppModel()
    let first = StoredConversation(title: "First", model: "main:latest")
    let library = ConversationLibrary(conversations: [first], activeConversationID: first.id)

    model.conversations = library.conversations
    model.restoreActiveConversation(from: library)
    model.startNewConversation()
    model.currentConversation.messages.append(ChatMessage(role: .user, content: "hello"))

    await model.persistCurrentConversationIfNeeded()
    let savedConversationID = model.currentConversation.id

    model.openConversation(first)
    model.navigateBack()
    await waitForConversationDetail(
        model,
        id: savedConversationID,
        expectedMessages: ["hello"]
    )

    #expect(model.currentConversation.id == savedConversationID)
    #expect(model.currentConversation.messages.map(\.content) == ["hello"])
}

@MainActor
private func waitForConversationDetail(
    _ model: AppModel,
    id: UUID,
    expectedMessages: [String],
    timeoutNanoseconds: UInt64 = 1_000_000_000
) async {
    let stepNanoseconds: UInt64 = 20_000_000
    let attempts = max(Int(timeoutNanoseconds / stepNanoseconds), 1)

    for _ in 0..<attempts {
        if model.currentConversation.id == id,
           !model.isCurrentConversationLoading,
           model.currentConversation.messages.map(\.content) == expectedMessages {
            return
        }
        try? await Task.sleep(nanoseconds: stepNanoseconds)
    }
}

@MainActor
private func makeConversationTestAppModel(
    defaults: UserDefaults? = nil,
    petRootURL: URL? = nil
) -> AppModel {
    let defaults = defaults ?? UserDefaults(suiteName: "OllamaMenuAssistantTests-\(UUID().uuidString)")!
    let root = FileManager.default.temporaryDirectory
        .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let petRootURL = petRootURL ?? root.appending(path: "pets", directoryHint: .isDirectory)
    let client = OllamaClient(baseURL: URL(string: "http://127.0.0.1:9")!)
    return AppModel(
        client: client,
        catalogService: ModelCatalogService(client: client),
        conversationStore: ConversationStore(rootURL: root, limit: 20),
        launchAtLoginCoordinator: LaunchAtLoginCoordinator(defaults: defaults),
        petRootURL: petRootURL,
        defaults: defaults
    )
}
