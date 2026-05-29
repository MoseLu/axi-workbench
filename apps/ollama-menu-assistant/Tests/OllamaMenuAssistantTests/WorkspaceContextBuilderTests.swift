import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func workspaceContextBuilderIncludesProjectPathAndTopLevelEntries() throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: root.appending(path: "Sources", directoryHint: .isDirectory), withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: root.appending(path: ".git", directoryHint: .isDirectory), withIntermediateDirectories: true)
    try Data("test".utf8).write(to: root.appending(path: "Package.swift"))
    try Data("# Demo\n\nA real project readme.".utf8).write(to: root.appending(path: "README.md"))

    let project = ConversationProject(name: "demo", path: root.path)
    let prompt = try #require(WorkspaceContextBuilder.makePrompt(project: project))

    #expect(prompt.contains("项目名称：demo"))
    #expect(prompt.contains("项目路径：\(root.path)"))
    #expect(prompt.contains("工作区文件树快照"))
    #expect(prompt.contains("关键文件摘录"))
    #expect(prompt.contains("Package.swift"))
    #expect(prompt.contains("Sources/"))
    #expect(prompt.contains("### README.md"))
    #expect(prompt.contains("A real project readme."))
    #expect(!prompt.contains(".git"))
    #expect(prompt.contains("不要只根据项目名猜测"))
}

@Test
func workspaceContextBuilderFallsBackToProjectNameWithoutPath() throws {
    let project = ConversationProject(name: "scratch", path: nil)
    let prompt = try #require(WorkspaceContextBuilder.makePrompt(project: project))

    #expect(prompt.contains("项目名称：scratch"))
    #expect(!prompt.contains("项目路径"))
}
