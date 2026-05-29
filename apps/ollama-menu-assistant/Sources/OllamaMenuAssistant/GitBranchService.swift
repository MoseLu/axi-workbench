import Foundation

struct GitBranchInfo: Equatable, Identifiable, Sendable {
    let name: String
    let isCurrent: Bool

    var id: String { name }
}

struct GitBranchSnapshot: Equatable, Sendable {
    let projectPath: String
    let currentBranch: String?
    let branches: [GitBranchInfo]
    let dirtyFileCount: Int
}

enum GitBranchServiceError: LocalizedError, Sendable {
    case missingWorkspace
    case notGitRepository
    case commandFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingWorkspace:
            "No workspace folder is selected."
        case .notGitRepository:
            "The selected workspace is not a Git repository."
        case .commandFailed(let message):
            message
        }
    }
}

enum GitBranchService {
    static func load(projectPath: String) async throws -> GitBranchSnapshot {
        let root = try workspaceRoot(from: projectPath)
        let runner = SandboxedCommandRunner(outputLimitBytes: 32_000)

        try await verifyGitRepository(root: root, runner: runner)

        let currentResult = await runner.run(
            command: "git branch --show-current",
            cwd: root,
            timeoutSeconds: 5,
            useSandbox: false,
            workspaceRoot: root
        )
        guard currentResult.exitCode == 0 else {
            throw GitBranchServiceError.commandFailed(shortCommandError(from: currentResult.output))
        }
        let currentBranch = currentResult.output.trimmingCharacters(in: .whitespacesAndNewlines)

        let branchesResult = await runner.run(
            command: "git branch --format='%(refname:short)'",
            cwd: root,
            timeoutSeconds: 5,
            useSandbox: false,
            workspaceRoot: root
        )
        guard branchesResult.exitCode == 0 else {
            throw GitBranchServiceError.commandFailed(shortCommandError(from: branchesResult.output))
        }

        let dirtyResult = await runner.run(
            command: "git status --short",
            cwd: root,
            timeoutSeconds: 5,
            useSandbox: false,
            workspaceRoot: root
        )

        return GitBranchSnapshot(
            projectPath: root.path,
            currentBranch: currentBranch.isEmpty ? nil : currentBranch,
            branches: parseBranches(branchesResult.output, currentBranch: currentBranch),
            dirtyFileCount: dirtyResult.exitCode == 0 ? dirtyResult.output.nonEmptyLineCount : 0
        )
    }

    static func switchBranch(named branchName: String, projectPath: String) async throws {
        try await runGitSwitch(command: "git switch \(shellQuoted(branchName))", projectPath: projectPath)
    }

    static func createAndSwitchBranch(named branchName: String, projectPath: String) async throws {
        try await runGitSwitch(command: "git switch -c \(shellQuoted(branchName))", projectPath: projectPath)
    }

    static func parseBranches(_ output: String, currentBranch: String) -> [GitBranchInfo] {
        output
            .split(whereSeparator: \.isNewline)
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map { branch in
                GitBranchInfo(name: branch, isCurrent: branch == currentBranch)
            }
    }

    private static func runGitSwitch(command: String, projectPath: String) async throws {
        let root = try workspaceRoot(from: projectPath)
        let runner = SandboxedCommandRunner(outputLimitBytes: 32_000)
        try await verifyGitRepository(root: root, runner: runner)

        let result = await runner.run(
            command: command,
            cwd: root,
            timeoutSeconds: 20,
            useSandbox: false,
            workspaceRoot: root
        )
        guard result.exitCode == 0 else {
            throw GitBranchServiceError.commandFailed(shortCommandError(from: result.output))
        }
    }

    private static func verifyGitRepository(root: URL, runner: SandboxedCommandRunner) async throws {
        let result = await runner.run(
            command: "git rev-parse --is-inside-work-tree",
            cwd: root,
            timeoutSeconds: 5,
            useSandbox: false,
            workspaceRoot: root
        )
        guard result.exitCode == 0 else {
            throw GitBranchServiceError.notGitRepository
        }
    }

    private static func workspaceRoot(from projectPath: String) throws -> URL {
        let trimmedPath = projectPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPath.isEmpty else {
            throw GitBranchServiceError.missingWorkspace
        }

        let root = URL(fileURLWithPath: trimmedPath).standardizedFileURL
        guard FileManager.default.fileExists(atPath: root.path) else {
            throw GitBranchServiceError.missingWorkspace
        }
        return root
    }

    private static func shortCommandError(from output: String) -> String {
        let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return "Git command failed."
        }
        return trimmed
    }

    private static func shellQuoted(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
    }
}

extension Notification.Name {
    static let workspaceGitBranchDidChange = Notification.Name("workspaceGitBranchDidChange")
}

private extension String {
    var nonEmptyLineCount: Int {
        split(whereSeparator: \.isNewline)
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .count
    }
}
