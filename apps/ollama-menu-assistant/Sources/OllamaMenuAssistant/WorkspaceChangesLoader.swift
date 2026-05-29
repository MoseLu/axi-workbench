import Foundation

enum WorkspaceChangeFileStatus: String, Equatable, Sendable {
    case modified
    case untracked
}

struct WorkspaceDiffLine: Equatable, Sendable, Identifiable {
    enum Kind: Equatable, Sendable {
        case context
        case addition
        case deletion
        case metadata
    }

    let id: Int
    let oldLineNumber: Int?
    let newLineNumber: Int?
    let text: String
    let kind: Kind
}

struct WorkspaceDiffHunk: Equatable, Sendable, Identifiable {
    let id: Int
    let header: String
    let lines: [WorkspaceDiffLine]
}

struct WorkspaceChangedFile: Equatable, Sendable, Identifiable {
    let path: String
    let status: WorkspaceChangeFileStatus
    let additions: Int
    let deletions: Int
    let hunks: [WorkspaceDiffHunk]

    var id: String { path }
}

struct WorkspaceChangeSnapshot: Equatable, Sendable {
    let projectPath: String
    let files: [WorkspaceChangedFile]
    let loadedAt: Date
    let didTruncate: Bool

    var fileCount: Int {
        files.count
    }

    var totalAdditions: Int {
        files.reduce(0) { $0 + $1.additions }
    }

    var totalDeletions: Int {
        files.reduce(0) { $0 + $1.deletions }
    }
}

enum WorkspaceChangesLoaderError: LocalizedError, Sendable {
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

enum WorkspaceChangesLoader {
    private static let diffOutputLimitBytes = 700_000

    static func load(projectPath: String) async throws -> WorkspaceChangeSnapshot {
        let trimmedPath = projectPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPath.isEmpty else {
            throw WorkspaceChangesLoaderError.missingWorkspace
        }

        return try await Task.detached(priority: .utility) {
            let root = URL(fileURLWithPath: trimmedPath).standardizedFileURL
            guard FileManager.default.fileExists(atPath: root.path) else {
                throw WorkspaceChangesLoaderError.missingWorkspace
            }

            let runner = SandboxedCommandRunner(outputLimitBytes: diffOutputLimitBytes)
            let insideWorkTree = await runner.run(
                command: "git rev-parse --is-inside-work-tree",
                cwd: root,
                timeoutSeconds: 5,
                useSandbox: false,
                workspaceRoot: root
            )
            guard insideWorkTree.exitCode == 0 else {
                throw WorkspaceChangesLoaderError.notGitRepository
            }

            let numstatWithHead = await runner.run(
                command: "git -c core.quotepath=false diff --no-ext-diff --numstat HEAD -- .",
                cwd: root,
                timeoutSeconds: 8,
                useSandbox: false,
                workspaceRoot: root
            )
            let hasHeadRevision = numstatWithHead.exitCode == 0
            let numstatResult: SandboxedCommandResult
            if hasHeadRevision {
                numstatResult = numstatWithHead
            } else {
                numstatResult = await runner.run(
                    command: "git -c core.quotepath=false diff --no-ext-diff --numstat -- .",
                    cwd: root,
                    timeoutSeconds: 8,
                    useSandbox: false,
                    workspaceRoot: root
                )
            }

            guard numstatResult.exitCode == 0 else {
                throw WorkspaceChangesLoaderError.commandFailed(shortCommandError(from: numstatResult.output))
            }

            let diffCommand = hasHeadRevision
                ? "git -c core.quotepath=false diff --no-ext-diff --no-color --unified=6 HEAD -- ."
                : "git -c core.quotepath=false diff --no-ext-diff --no-color --unified=6 -- ."
            let diffResult = await runner.run(
                command: diffCommand,
                cwd: root,
                timeoutSeconds: 10,
                useSandbox: false,
                workspaceRoot: root
            )
            guard diffResult.exitCode == 0 else {
                throw WorkspaceChangesLoaderError.commandFailed(shortCommandError(from: diffResult.output))
            }

            let untrackedResult = await runner.run(
                command: "git -c core.quotepath=false ls-files --others --exclude-standard",
                cwd: root,
                timeoutSeconds: 5,
                useSandbox: false,
                workspaceRoot: root
            )

            return parse(
                projectPath: root.path,
                numstat: numstatResult.output,
                diff: diffResult.output,
                untracked: untrackedResult.exitCode == 0 ? untrackedResult.output : "",
                didTruncate: numstatResult.didTruncate || diffResult.didTruncate || untrackedResult.didTruncate
            )
        }.value
    }

    static func parse(
        projectPath: String,
        numstat: String,
        diff: String,
        untracked: String = "",
        didTruncate: Bool = false,
        loadedAt: Date = .now
    ) -> WorkspaceChangeSnapshot {
        let stats = parseNumstat(numstat)
        let diffFiles = parseUnifiedDiff(diff)
        var files = [WorkspaceChangedFile]()
        var seenPaths = Set<String>()

        for file in diffFiles {
            let stat = stats[file.path] ?? (additions: file.additions, deletions: file.deletions)
            files.append(
                WorkspaceChangedFile(
                    path: file.path,
                    status: .modified,
                    additions: stat.additions,
                    deletions: stat.deletions,
                    hunks: file.hunks
                )
            )
            seenPaths.insert(file.path)
        }

        for path in stats.keys.sorted() where !seenPaths.contains(path) {
            let stat = stats[path] ?? (additions: 0, deletions: 0)
            files.append(
                WorkspaceChangedFile(
                    path: path,
                    status: .modified,
                    additions: stat.additions,
                    deletions: stat.deletions,
                    hunks: []
                )
            )
            seenPaths.insert(path)
        }

        for path in parseUntracked(untracked) where !seenPaths.contains(path) {
            files.append(
                WorkspaceChangedFile(
                    path: path,
                    status: .untracked,
                    additions: 0,
                    deletions: 0,
                    hunks: []
                )
            )
            seenPaths.insert(path)
        }

        return WorkspaceChangeSnapshot(
            projectPath: projectPath,
            files: files,
            loadedAt: loadedAt,
            didTruncate: didTruncate
        )
    }

    private static func parseNumstat(_ output: String) -> [String: (additions: Int, deletions: Int)] {
        var stats = [String: (additions: Int, deletions: Int)]()
        for rawLine in output.components(separatedBy: .newlines) {
            let parts = rawLine.split(separator: "\t", maxSplits: 2, omittingEmptySubsequences: false)
            guard parts.count == 3,
                  let additions = Int(parts[0]),
                  let deletions = Int(parts[1]) else {
                continue
            }

            let path = String(parts[2]).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !path.isEmpty else {
                continue
            }
            stats[path] = (additions, deletions)
        }
        return stats
    }

    private static func parseUnifiedDiff(_ diff: String) -> [WorkspaceChangedFile] {
        var files = [WorkspaceChangedFile]()
        var currentPath: String?
        var hunks = [WorkspaceDiffHunk]()
        var currentHunkHeader: String?
        var currentLines = [WorkspaceDiffLine]()
        var oldLineNumber = 0
        var newLineNumber = 0
        var hunkID = 0
        var lineID = 0

        func flushHunk() {
            guard let header = currentHunkHeader else {
                return
            }

            hunks.append(WorkspaceDiffHunk(id: hunkID, header: header, lines: currentLines))
            hunkID += 1
            currentHunkHeader = nil
            currentLines = []
        }

        func flushFile() {
            flushHunk()
            guard let path = currentPath else {
                return
            }

            files.append(
                WorkspaceChangedFile(
                    path: path,
                    status: .modified,
                    additions: 0,
                    deletions: 0,
                    hunks: hunks
                )
            )
            currentPath = nil
            hunks = []
            hunkID = 0
            lineID = 0
        }

        for rawLine in diff.components(separatedBy: .newlines) {
            if rawLine.hasPrefix("diff --git ") {
                flushFile()
                currentPath = parseDiffGitPath(rawLine)
                continue
            }

            guard currentPath != nil else {
                continue
            }

            if rawLine.hasPrefix("@@") {
                flushHunk()
                currentHunkHeader = rawLine
                let starts = parseHunkLineStarts(rawLine)
                oldLineNumber = starts.old
                newLineNumber = starts.new
                continue
            }

            guard currentHunkHeader != nil else {
                continue
            }

            if rawLine.hasPrefix("+"), !rawLine.hasPrefix("+++") {
                currentLines.append(
                    WorkspaceDiffLine(
                        id: lineID,
                        oldLineNumber: nil,
                        newLineNumber: newLineNumber,
                        text: String(rawLine.dropFirst()),
                        kind: .addition
                    )
                )
                newLineNumber += 1
            } else if rawLine.hasPrefix("-"), !rawLine.hasPrefix("---") {
                currentLines.append(
                    WorkspaceDiffLine(
                        id: lineID,
                        oldLineNumber: oldLineNumber,
                        newLineNumber: nil,
                        text: String(rawLine.dropFirst()),
                        kind: .deletion
                    )
                )
                oldLineNumber += 1
            } else if rawLine.hasPrefix("\\") {
                currentLines.append(
                    WorkspaceDiffLine(
                        id: lineID,
                        oldLineNumber: nil,
                        newLineNumber: nil,
                        text: rawLine,
                        kind: .metadata
                    )
                )
            } else {
                currentLines.append(
                    WorkspaceDiffLine(
                        id: lineID,
                        oldLineNumber: oldLineNumber,
                        newLineNumber: newLineNumber,
                        text: rawLine.hasPrefix(" ") ? String(rawLine.dropFirst()) : rawLine,
                        kind: .context
                    )
                )
                oldLineNumber += 1
                newLineNumber += 1
            }
            lineID += 1
        }

        flushFile()
        return files
    }

    private static func parseDiffGitPath(_ line: String) -> String? {
        let prefix = "diff --git a/"
        guard line.hasPrefix(prefix) else {
            return nil
        }

        let remainder = String(line.dropFirst(prefix.count))
        guard let separatorRange = remainder.range(of: " b/") else {
            return nil
        }
        return String(remainder[separatorRange.upperBound...])
    }

    private static func parseHunkLineStarts(_ header: String) -> (old: Int, new: Int) {
        let parts = header.split(separator: " ")
        let oldToken = parts.first { $0.hasPrefix("-") }.map(String.init) ?? "-0"
        let newToken = parts.first { $0.hasPrefix("+") }.map(String.init) ?? "+0"
        return (
            old: parseHunkStartToken(oldToken),
            new: parseHunkStartToken(newToken)
        )
    }

    private static func parseHunkStartToken(_ token: String) -> Int {
        let trimmed = token.dropFirst()
        let startText = trimmed.split(separator: ",", maxSplits: 1).first.map(String.init) ?? "0"
        return Int(startText) ?? 0
    }

    private static func parseUntracked(_ output: String) -> [String] {
        output.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && !$0.hasPrefix("[stderr]") }
            .sorted()
    }

    private static func shortCommandError(from output: String) -> String {
        let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return "Unable to read workspace changes."
        }

        return String(trimmed.prefix(240))
    }
}
