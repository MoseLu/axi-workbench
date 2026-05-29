import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func conversationStorePersistsAllConversationsWithoutTrimming() async throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let store = ConversationStore(rootURL: root, limit: 2)

    let conversations = [
        makeConversation(index: 1, updatedAt: .distantPast),
        makeConversation(index: 2, updatedAt: .now),
        makeConversation(index: 3, updatedAt: Date(timeIntervalSinceNow: -60)),
    ]

    try await store.save(conversations)
    let loaded = try await store.load()

    #expect(FileManager.default.fileExists(atPath: root.appending(path: "conversations.sqlite3").path()))
    #expect(loaded.count == 3)
    #expect(loaded[0].title == "Conversation 2")
    #expect(loaded[1].title == "Conversation 3")
    #expect(loaded[2].title == "Conversation 1")
}

@Test
func conversationStorePersistsProjectsConversationMetadataAndActiveSelection() async throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let store = ConversationStore(rootURL: root, limit: 5)
    let project = ConversationProject(name: "workspace", path: "/tmp/workspace")
    let conversation = StoredConversation(
        projectID: project.id,
        title: "Pinned project chat",
        model: "main:latest",
        isPinned: true,
        isTitleManuallyEdited: true,
        messages: [
            ChatMessage(
                role: .user,
                content: "Hello",
                attachments: [
                    MessageAttachment(
                        name: "notes.md",
                        path: "/tmp/workspace/notes.md",
                        kind: .text,
                        byteCount: 128
                    )
                ]
            ),
            ChatMessage(
                role: .assistant,
                content: "World",
                toolEvents: [
                    ToolExecutionEvent(
                        toolName: "workspace.read",
                        status: .allowed,
                        summary: "Read notes.md",
                        metadata: ["paths": .array([.string("notes.md")])]
                    )
                ],
                changeSummary: AssistantChangeSummary(
                    files: [
                        AssistantChangedFileSummary(
                            path: "Sources/Foo.swift",
                            state: .modified,
                            additions: 2,
                            deletions: 1
                        )
                    ],
                    didTruncate: false
                )
            ),
        ]
    )

    try await store.saveLibrary(
        ConversationLibrary(
            projects: [project],
            conversations: [conversation],
            activeConversationID: conversation.id
        )
    )
    let loaded = try await store.loadLibrary()

    #expect(loaded.activeConversationID == conversation.id)
    #expect(loaded.projects.count == 1)
    #expect(loaded.projects[0].name == "workspace")
    #expect(loaded.conversations.count == 1)
    #expect(loaded.conversations[0].projectID == project.id)
    #expect(loaded.conversations[0].isPinned)
    #expect(loaded.conversations[0].isTitleManuallyEdited)
    #expect(loaded.conversations[0].messages[0].attachments[0].name == "notes.md")
    #expect(loaded.conversations[0].messages[1].toolEvents[0].toolName == "workspace.read")
    #expect(loaded.conversations[0].messages[1].toolEvents[0].metadata["paths"]?.arrayValue?.first?.stringValue == "notes.md")
    #expect(loaded.conversations[0].messages[1].changeSummary?.files[0].path == "Sources/Foo.swift")
    #expect(loaded.conversations[0].messages[1].changeSummary?.totalAdditions == 2)
}

@Test
func conversationStorePersistsProjectLocalEnvironment() async throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let store = ConversationStore(rootURL: root, limit: 5)
    let environment = ProjectLocalEnvironment(
        name: "workspace env",
        setupScripts: ProjectEnvironmentScripts(
            defaultScript: "npm install",
            macOS: "brew bundle",
            linux: "apt-get update",
            windows: "winget install"
        ),
        cleanupScripts: ProjectEnvironmentScripts(
            defaultScript: "docker compose down",
            macOS: "rm -rf .cache",
            linux: "rm -rf .cache",
            windows: "Remove-Item .cache"
        ),
        operations: [
            ProjectEnvironmentOperation(title: "Lint", command: "npm run lint")
        ]
    )
    let project = ConversationProject(
        name: "workspace",
        path: "/tmp/workspace",
        localEnvironment: environment
    )

    try await store.saveLibrary(ConversationLibrary(projects: [project]))
    let loaded = try await store.loadLibrary()

    #expect(loaded.projects.count == 1)
    #expect(loaded.projects[0].localEnvironment?.name == "workspace env")
    #expect(loaded.projects[0].localEnvironment?.setupScripts.macOS == "brew bundle")
    #expect(loaded.projects[0].localEnvironment?.cleanupScripts.defaultScript == "docker compose down")
    #expect(loaded.projects[0].localEnvironment?.operations.first?.title == "Lint")
}

@Test
func conversationStoreMigratesLegacyRecentConversations() async throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)

    let legacyConversations = [
        makeConversation(index: 1, updatedAt: .now)
    ]
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    let data = try encoder.encode(legacyConversations)
    try data.write(to: root.appending(path: "recent-conversations.json"))

    let store = ConversationStore(rootURL: root, limit: 5)
    let loaded = try await store.loadLibrary()

    #expect(loaded.projects.isEmpty)
    #expect(loaded.activeConversationID == legacyConversations[0].id)
    #expect(loaded.conversations.count == 1)
    #expect(loaded.conversations[0].projectID == nil)
    #expect(loaded.conversations[0].title == "Conversation 1")
    #expect(FileManager.default.fileExists(atPath: root.appending(path: "conversations.sqlite3").path()))
}

@Test
func conversationStoreUpdatesActiveConversationWithoutRewritingLibrary() async throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let store = ConversationStore(rootURL: root, limit: 5)
    let first = makeConversation(index: 1, updatedAt: Date(timeIntervalSince1970: 1_000))
    let second = makeConversation(index: 2, updatedAt: Date(timeIntervalSince1970: 2_000))

    try await store.saveLibrary(
        ConversationLibrary(
            conversations: [first, second],
            activeConversationID: first.id
        )
    )
    try await store.saveActiveConversationID(second.id)

    let loaded = try await store.loadLibrary()
    #expect(loaded.activeConversationID == second.id)
    #expect(loaded.conversations.map(\.id).contains(first.id))
    #expect(loaded.conversations.map(\.id).contains(second.id))
}

@Test
func conversationStoreLoadsMetadataSeparatelyFromConversationDetail() async throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let store = ConversationStore(rootURL: root, limit: 5)
    let conversation = makeConversation(index: 1, updatedAt: .now)

    try await store.saveLibrary(
        ConversationLibrary(
            conversations: [conversation],
            activeConversationID: conversation.id
        )
    )

    let metadata = try await store.loadLibraryMetadata()
    let detail = try await store.loadConversation(id: conversation.id)

    #expect(metadata.conversations.count == 1)
    #expect(metadata.conversations[0].id == conversation.id)
    #expect(metadata.conversations[0].messages.isEmpty)
    #expect(detail?.messages.map(\.content) == ["Hello 1", "World 1"])
}

@Test
func conversationStoreMetadataSavePreservesExistingMessages() async throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let store = ConversationStore(rootURL: root, limit: 5)
    let conversation = makeConversation(index: 1, updatedAt: .now)

    try await store.saveLibrary(
        ConversationLibrary(
            conversations: [conversation],
            activeConversationID: conversation.id
        )
    )

    var summary = conversation.metadataOnly
    summary.title = "Renamed"
    summary.isTitleManuallyEdited = true
    summary.updatedAt = Date(timeIntervalSince1970: 9_000)

    try await store.saveLibraryMetadata(
        ConversationLibrary(
            conversations: [summary],
            activeConversationID: conversation.id
        )
    )

    let loaded = try await store.loadLibrary()

    #expect(loaded.conversations.count == 1)
    #expect(loaded.conversations[0].title == "Renamed")
    #expect(loaded.conversations[0].isTitleManuallyEdited)
    #expect(loaded.conversations[0].messages.map(\.content) == ["Hello 1", "World 1"])
}

private func makeConversation(index: Int, updatedAt: Date) -> StoredConversation {
    StoredConversation(
        title: "Conversation \(index)",
        model: "main:latest",
        createdAt: updatedAt,
        updatedAt: updatedAt,
        messages: [
            ChatMessage(role: .user, content: "Hello \(index)", timestamp: updatedAt),
            ChatMessage(role: .assistant, content: "World \(index)", timestamp: updatedAt),
        ]
    )
}
