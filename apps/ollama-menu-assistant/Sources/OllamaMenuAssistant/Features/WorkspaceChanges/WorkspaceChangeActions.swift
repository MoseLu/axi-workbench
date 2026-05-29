import AppKit
import Foundation

enum WorkspaceChangedFileAction: Equatable, Sendable {
    case restore
    case stage

    func command(for file: WorkspaceChangedFile, quotedPath: String) -> String {
        switch self {
        case .restore:
            return file.status == .untracked
                ? "git clean -f -- \(quotedPath)"
                : "git restore --staged --worktree -- \(quotedPath)"
        case .stage:
            return "git add -- \(quotedPath)"
        }
    }
}

enum WorkspaceChangeActionFailure: Error, Equatable, Sendable {
    case missingProjectForFileAction
    case missingProjectForOpen
    case missingFile
    case editorUnavailable
    case commandFailed(String)
}

struct WorkspaceClipboard {
    func copy(_ text: String) {
        AppClipboard().copyText(text)
    }
}

struct WorkspaceFileOpener {
    func open(_ url: URL, target: DefaultEditorTarget) -> Bool {
        target.open(url)
    }

    func reveal(_ url: URL) {
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }
}

struct WorkspaceChangeActions {
    var commandRunner = SandboxedCommandRunner(outputLimitBytes: 16_000)
    var clipboard = WorkspaceClipboard()
    var fileOpener = WorkspaceFileOpener()

    func runFileAction(
        _ action: WorkspaceChangedFileAction,
        for file: WorkspaceChangedFile,
        projectRootURL: URL?
    ) async -> Result<WorkspaceChangedFileAction, WorkspaceChangeActionFailure> {
        guard let root = projectRootURL else {
            return .failure(.missingProjectForFileAction)
        }

        let command = action.command(for: file, quotedPath: shellQuoted(file.path))
        let result = await commandRunner.run(
            command: command,
            cwd: root,
            timeoutSeconds: 12,
            useSandbox: false,
            workspaceRoot: root
        )

        guard result.exitCode == 0 else {
            return .failure(.commandFailed(result.output))
        }
        return .success(action)
    }

    func openFile(
        _ file: WorkspaceChangedFile,
        projectRootURL: URL?,
        defaultEditorRaw: String
    ) -> WorkspaceChangeActionFailure? {
        guard let root = projectRootURL else {
            return .missingProjectForOpen
        }

        let fileURL = root.appending(path: file.path)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return .missingFile
        }

        let didOpen = fileOpener.open(fileURL, target: DefaultEditorTarget(storedValue: defaultEditorRaw))
        return didOpen ? nil : .editorUnavailable
    }

    func copyPath(_ path: String) {
        clipboard.copy(path)
    }

    func openFileURL(_ fileURL: URL?, defaultEditorRaw: String) -> WorkspaceChangeActionFailure? {
        guard let fileURL else {
            return .missingProjectForOpen
        }

        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return .missingFile
        }

        let didOpen = fileOpener.open(fileURL, target: DefaultEditorTarget(storedValue: defaultEditorRaw))
        return didOpen ? nil : .editorUnavailable
    }

    func copyGitApplyCommand(projectPath: String?) {
        guard let path = normalizedProjectPath(projectPath) else {
            return
        }
        clipboard.copy("cd \(shellQuoted(path)) && git diff --binary -- . | git apply")
    }

    func copyGitCommand(_ command: String, projectPath: String?) {
        guard let path = normalizedProjectPath(projectPath) else {
            clipboard.copy(command)
            return
        }
        clipboard.copy("cd \(shellQuoted(path)) && \(command)")
    }

    private func normalizedProjectPath(_ path: String?) -> String? {
        guard let path = path?.trimmingCharacters(in: .whitespacesAndNewlines), !path.isEmpty else {
            return nil
        }
        return path
    }

    private func shellQuoted(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
    }
}
