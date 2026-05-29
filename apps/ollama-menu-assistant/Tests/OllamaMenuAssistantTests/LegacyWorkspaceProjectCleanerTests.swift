import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func legacyWorkspaceProjectCleanerKeepsGitWorkspacesAndDropsContainers() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "OllamaMenuAssistantCleaner-\(UUID().uuidString)", directoryHint: .isDirectory)
    defer { try? FileManager.default.removeItem(at: root) }

    let repo = root.appending(path: "repo", directoryHint: .isDirectory)
    let repoChild = repo.appending(path: "Sources", directoryHint: .isDirectory)
    let container = root.appending(path: "projects", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: repo.appending(path: ".git", directoryHint: .isDirectory), withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: repoChild, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: container, withIntermediateDirectories: true)

    let repoProject = ConversationProject(
        name: "Sources",
        path: repoChild.path,
        updatedAt: Date(timeIntervalSince1970: 20)
    )
    let duplicateRepoProject = ConversationProject(
        name: "repo",
        path: repo.path,
        updatedAt: Date(timeIntervalSince1970: 10)
    )
    let containerProject = ConversationProject(name: "projects", path: container.path)
    let unusedProject = ConversationProject(name: "unused", path: repo.path)
    let repoChat = StoredConversation(
        projectID: repoProject.id,
        title: "Repo chat",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 30)
    )
    let duplicateRepoChat = StoredConversation(
        projectID: duplicateRepoProject.id,
        title: "Duplicate repo chat",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 40)
    )
    let containerChat = StoredConversation(
        projectID: containerProject.id,
        title: "Container chat",
        model: "main:latest"
    )

    let cleaned = LegacyWorkspaceProjectCleaner.clean(
        ConversationLibrary(
            projects: [repoProject, duplicateRepoProject, containerProject, unusedProject],
            conversations: [repoChat, duplicateRepoChat, containerChat],
            activeConversationID: repoChat.id
        )
    )

    #expect(cleaned.projects.count == 1)
    #expect(cleaned.projects[0].name == "repo")
    #expect(cleaned.projects[0].path == repo.path)
    #expect(cleaned.conversations.first { $0.id == repoChat.id }?.projectID == cleaned.projects[0].id)
    #expect(cleaned.conversations.first { $0.id == duplicateRepoChat.id }?.projectID == cleaned.projects[0].id)
    #expect(cleaned.conversations.first { $0.id == containerChat.id }?.projectID == nil)
    #expect(cleaned.activeConversationID == repoChat.id)
}
