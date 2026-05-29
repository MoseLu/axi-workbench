import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func workspaceChangesParserBuildsFilesStatsAndHunks() {
    let numstat = """
    2\t1\tSources/Foo.swift
    1\t0\tSources/Bar.swift
    """
    let diff = """
    diff --git a/Sources/Foo.swift b/Sources/Foo.swift
    index 1111111..2222222 100644
    --- a/Sources/Foo.swift
    +++ b/Sources/Foo.swift
    @@ -3,3 +3,4 @@ struct Foo {
         let id: UUID
    -    let title: String
    +    let title: String?
    +    let count: Int
     }
    """

    let snapshot = WorkspaceChangesLoader.parse(
        projectPath: "/tmp/project",
        numstat: numstat,
        diff: diff,
        loadedAt: Date(timeIntervalSince1970: 0)
    )

    #expect(snapshot.fileCount == 2)
    #expect(snapshot.totalAdditions == 3)
    #expect(snapshot.totalDeletions == 1)
    #expect(snapshot.files[0].path == "Sources/Foo.swift")
    #expect(snapshot.files[0].additions == 2)
    #expect(snapshot.files[0].deletions == 1)
    #expect(snapshot.files[0].hunks.count == 1)
    #expect(snapshot.files[0].hunks[0].lines.map(\.kind) == [.context, .deletion, .addition, .addition, .context])
    #expect(snapshot.files[1].path == "Sources/Bar.swift")
    #expect(snapshot.files[1].hunks.isEmpty)
}

@Test
func workspaceChangesParserIncludesUntrackedFiles() {
    let snapshot = WorkspaceChangesLoader.parse(
        projectPath: "/tmp/project",
        numstat: "",
        diff: "",
        untracked: "README.md\nSources/New.swift\n",
        loadedAt: Date(timeIntervalSince1970: 0)
    )

    #expect(snapshot.files.map(\.path) == ["README.md", "Sources/New.swift"])
    #expect(snapshot.files.allSatisfy { $0.status == .untracked })
}

@Test
func assistantChangeSummaryOnlyIncludesFilesChangedDuringReply() throws {
    let before = WorkspaceChangesLoader.parse(
        projectPath: "/tmp/project",
        numstat: "1\t0\tSources/Foo.swift\n",
        diff: "",
        loadedAt: Date(timeIntervalSince1970: 0)
    )
    let unchanged = WorkspaceChangesLoader.parse(
        projectPath: "/tmp/project",
        numstat: "1\t0\tSources/Foo.swift\n",
        diff: "",
        loadedAt: Date(timeIntervalSince1970: 1)
    )
    #expect(AssistantChangeSummary.make(before: before, after: unchanged) == nil)

    let after = WorkspaceChangesLoader.parse(
        projectPath: "/tmp/project",
        numstat: "2\t1\tSources/Foo.swift\n",
        diff: "",
        untracked: "Sources/New.swift\n",
        didTruncate: true,
        loadedAt: Date(timeIntervalSince1970: 2)
    )

    let summary = try #require(AssistantChangeSummary.make(before: before, after: after))
    #expect(summary.fileCount == 2)
    #expect(summary.totalAdditions == 2)
    #expect(summary.totalDeletions == 1)
    #expect(summary.didTruncate)
    #expect(summary.files[0] == AssistantChangedFileSummary(path: "Sources/Foo.swift", state: .modified, additions: 2, deletions: 1))
    #expect(summary.files[1] == AssistantChangedFileSummary(path: "Sources/New.swift", state: .untracked, additions: 0, deletions: 0))
}

@Test
func workspaceChangesLoaderReadsRealGitRepository() async throws {
    let root = try await makeGitFixtureRepository()
    defer { try? FileManager.default.removeItem(at: root) }

    try """
    struct Foo {
        let title: String?
        let count: Int
    }
    """.write(to: root.appending(path: "Sources/Foo.swift"), atomically: true, encoding: .utf8)
    try "new file".write(to: root.appending(path: "Sources/New File.swift"), atomically: true, encoding: .utf8)

    let snapshot = try await WorkspaceChangesLoader.load(projectPath: root.path)
    let foo = try #require(snapshot.files.first { $0.path == "Sources/Foo.swift" })
    let untracked = try #require(snapshot.files.first { $0.path == "Sources/New File.swift" })

    #expect(snapshot.fileCount == 2)
    #expect(snapshot.totalAdditions == 2)
    #expect(snapshot.totalDeletions == 1)
    #expect(foo.status == .modified)
    #expect(foo.additions == 2)
    #expect(foo.deletions == 1)
    #expect(foo.hunks.count == 1)
    #expect(foo.hunks[0].lines.contains { $0.kind == .deletion && $0.text.contains("let title: String") })
    #expect(untracked.status == .untracked)
}

@Test
func workspaceGitFileActionsUseRealGitCommands() async throws {
    let root = try await makeGitFixtureRepository()
    defer { try? FileManager.default.removeItem(at: root) }

    let trackedURL = root.appending(path: "Sources/Foo.swift")
    let untrackedURL = root.appending(path: "Sources/Scratch.swift")
    try "struct Foo { let changed = true }\n".write(to: trackedURL, atomically: true, encoding: .utf8)
    try "scratch\n".write(to: untrackedURL, atomically: true, encoding: .utf8)

    try await runGit("git add -- Sources/Foo.swift", cwd: root)
    let staged = try await runGit("git diff --cached --name-only", cwd: root)
    #expect(staged.output.trimmingCharacters(in: .whitespacesAndNewlines) == "Sources/Foo.swift")

    try await runGit("git restore --staged --worktree -- Sources/Foo.swift", cwd: root)
    let trackedStatus = try await runGit("git status --short -- Sources/Foo.swift", cwd: root)
    #expect(trackedStatus.output.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

    try await runGit("git clean -f -- Sources/Scratch.swift", cwd: root)
    #expect(!FileManager.default.fileExists(atPath: untrackedURL.path))
}

private func makeGitFixtureRepository() async throws -> URL {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "OllamaMenuAssistantGit-\(UUID().uuidString)", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: root.appending(path: "Sources"), withIntermediateDirectories: true)
    try """
    struct Foo {
        let title: String
    }
    """.write(to: root.appending(path: "Sources/Foo.swift"), atomically: true, encoding: .utf8)
    try "fixture readme\n".write(to: root.appending(path: "README.md"), atomically: true, encoding: .utf8)

    try await runGit("git init -b main", cwd: root)
    try await runGit("git config user.email test@example.com", cwd: root)
    try await runGit("git config user.name Test", cwd: root)
    try await runGit("git add README.md Sources/Foo.swift", cwd: root)
    try await runGit("git commit -m initial", cwd: root)
    return root
}

@discardableResult
private func runGit(_ command: String, cwd: URL) async throws -> SandboxedCommandResult {
    let result = await SandboxedCommandRunner(outputLimitBytes: 20_000).run(
        command: command,
        cwd: cwd,
        timeoutSeconds: 20,
        useSandbox: false,
        workspaceRoot: cwd
    )
    #expect(result.exitCode == 0, "\(command) failed: \(result.output)")
    return result
}
