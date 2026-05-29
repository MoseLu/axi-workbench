import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func fallbackToolCallParserParsesEnvelopeJSON() throws {
    let content = """
    {"tool_calls":[{"name":"list_dir","arguments":{"path":"."}},{"name":"read_file","arguments":{"path":"README.md","maxBytes":1024}}]}
    """

    let calls = ToolCallParser.parseFallbackToolCalls(in: content)

    #expect(calls.count == 2)
    #expect(calls[0].name == "list_dir")
    #expect(calls[0].arguments["path"]?.stringValue == ".")
    #expect(calls[1].name == "read_file")
    #expect(calls[1].arguments["maxBytes"]?.intValue == 1024)
}

@Test
func defaultPermissionAllowsWorkspaceReadAndRejectsWrites() async throws {
    let root = try makeFixtureWorkspace()
    defer { try? FileManager.default.removeItem(at: root) }

    let registry = WorkspaceToolService().makeRegistry()
    let context = ToolExecutionContext(
        project: ConversationProject(name: "Fixture", path: root.path),
        permissionMode: .default
    )

    let readResult = await registry.execute(
        AgentToolCall(name: "read_file", arguments: ["path": .string("README.md")]),
        context: context
    )
    let writeResult = await registry.execute(
        AgentToolCall(name: "write_file", arguments: ["path": .string("new.txt"), "content": .string("hello")]),
        context: context
    )

    #expect(readResult.ok)
    #expect(readResult.content.contains("fixture readme"))
    #expect(!writeResult.ok)
    #expect(writeResult.errorCode == "permission_denied")
    #expect(!FileManager.default.fileExists(atPath: root.appending(path: "new.txt").path))
}

@Test
func searchToolFindsFilesByNameAndGlob() async throws {
    let root = try makeFixtureWorkspace()
    defer { try? FileManager.default.removeItem(at: root) }
    try FileManager.default.createDirectory(at: root.appending(path: "Sources"), withIntermediateDirectories: true)
    try "final class AppModel {}".write(to: root.appending(path: "Sources/AppModel.swift"), atomically: true, encoding: .utf8)
    try "notes".write(to: root.appending(path: "Sources/SearchNotes.md"), atomically: true, encoding: .utf8)

    let registry = WorkspaceToolService().makeRegistry()
    let context = ToolExecutionContext(
        project: ConversationProject(name: "Fixture", path: root.path),
        permissionMode: .default
    )

    let nameResult = await registry.execute(
        AgentToolCall(name: "search", arguments: [
            "query": .string("AppModel"),
            "mode": .string("files"),
        ]),
        context: context
    )
    let globResult = await registry.execute(
        AgentToolCall(name: "search", arguments: [
            "query": .string("**/*.swift"),
            "mode": .string("glob"),
        ]),
        context: context
    )

    #expect(nameResult.ok)
    #expect(nameResult.content.contains("[files]"))
    #expect(nameResult.content.contains("Sources/AppModel.swift"))
    #expect(globResult.ok)
    #expect(globResult.content.contains("Sources/AppModel.swift"))
    #expect(!globResult.content.contains("Sources/SearchNotes.md"))
}

@Test
func defaultPermissionRejectsSymlinkOutsideWorkspace() async throws {
    let root = try makeFixtureWorkspace()
    let outside = FileManager.default.temporaryDirectory
        .appending(path: "OllamaMenuAssistantOutside-\(UUID().uuidString).txt")
    defer {
        try? FileManager.default.removeItem(at: root)
        try? FileManager.default.removeItem(at: outside)
    }
    try "outside".write(to: outside, atomically: true, encoding: .utf8)
    try FileManager.default.createSymbolicLink(at: root.appending(path: "outside-link.txt"), withDestinationURL: outside)

    let registry = WorkspaceToolService().makeRegistry()
    let context = ToolExecutionContext(
        project: ConversationProject(name: "Fixture", path: root.path),
        permissionMode: .default
    )

    let result = await registry.execute(
        AgentToolCall(name: "read_file", arguments: ["path": .string("outside-link.txt")]),
        context: context
    )

    #expect(!result.ok)
    #expect(result.errorCode == "outside_workspace")
}

@Test
func permissionEngineReviewsShellByMode() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "OllamaMenuAssistantPerms-\(UUID().uuidString)", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }

    let safeDefault = ToolPermissionEngine.review(
        operation: .shell,
        mode: .default,
        command: "ls .",
        cwd: root,
        workspaceRoot: root
    )
    let destructiveDefault = ToolPermissionEngine.review(
        operation: .shell,
        mode: .default,
        command: "rm -rf .",
        cwd: root,
        workspaceRoot: root
    )
    let destructiveFullAccess = ToolPermissionEngine.review(
        operation: .shell,
        mode: .fullAccess,
        command: "rm -rf .",
        cwd: root,
        workspaceRoot: root
    )

    #expect(safeDefault.allowed)
    #expect(safeDefault.useSandbox)
    #expect(!destructiveDefault.allowed)
    #expect(destructiveDefault.errorCode == "destructive_command")
    #expect(destructiveFullAccess.allowed)
    #expect(!destructiveFullAccess.useSandbox)
}

private func makeFixtureWorkspace() throws -> URL {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "OllamaMenuAssistantTools-\(UUID().uuidString)", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try "fixture readme".write(to: root.appending(path: "README.md"), atomically: true, encoding: .utf8)
    return root
}
