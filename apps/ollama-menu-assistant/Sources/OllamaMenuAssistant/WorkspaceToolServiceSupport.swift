import Darwin
import Foundation

extension WorkspaceToolService {
    func resolvePath(_ rawPath: String?, context: ToolExecutionContext) -> URL {
        let trimmed = rawPath?.trimmingCharacters(in: .whitespacesAndNewlines)
        let path = trimmed?.isEmpty == false ? trimmed! : "."
        if path.hasPrefix("/") {
            return URL(fileURLWithPath: path).standardizedFileURL.resolvingSymlinksInPath()
        }

        let root = context.workspaceRootURL ?? URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        return root.appending(path: path).standardizedFileURL.resolvingSymlinksInPath()
    }

    func review(
        _ operation: WorkspaceToolOperation,
        context: ToolExecutionContext,
        targetURLs: [URL],
        command: String? = nil,
        cwd: URL? = nil
    ) -> ToolPermissionDecision {
        ToolPermissionEngine.review(
            operation: operation,
            mode: context.permissionMode,
            targetURLs: targetURLs,
            command: command,
            cwd: cwd,
            workspaceRoot: context.workspaceRootURL
        )
    }

    func collectFiles(
        root: URL,
        maxDepth: Int,
        maxResults: Int,
        predicate: (String, URL) -> Bool
    ) -> [String] {
        var results: [String] = []
        collectFiles(at: root, root: root, depth: 0, maxDepth: maxDepth, maxResults: maxResults, results: &results, predicate: predicate)
        return results
    }

    func collectFiles(
        at url: URL,
        root: URL,
        depth: Int,
        maxDepth: Int,
        maxResults: Int,
        results: inout [String],
        predicate: (String, URL) -> Bool
    ) {
        guard depth <= maxDepth, results.count < maxResults else {
            return
        }

        let children = (try? FileManager.default.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )) ?? []

        for child in children.sorted(by: sortURLs) where results.count < maxResults && !Self.shouldIgnore(child) {
            let values = try? child.resourceValues(forKeys: [.isDirectoryKey])
            let relativePath = child.path.replacingOccurrences(of: root.path + "/", with: "")
            if values?.isDirectory == true {
                collectFiles(at: child, root: root, depth: depth + 1, maxDepth: maxDepth, maxResults: maxResults, results: &results, predicate: predicate)
            } else if predicate(relativePath, child) {
                results.append(relativePath)
            }
        }
    }

    func collectTree(
        at url: URL,
        root: URL,
        depth: Int,
        maxDepth: Int,
        maxEntries: Int,
        lines: inout [String]
    ) {
        guard depth <= maxDepth, lines.count < maxEntries else {
            return
        }

        let children = (try? FileManager.default.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )) ?? []

        for child in children.sorted(by: sortURLs) where lines.count < maxEntries && !Self.shouldIgnore(child) {
            let values = try? child.resourceValues(forKeys: [.isDirectoryKey])
            let relativePath = child.path.replacingOccurrences(of: root.path + "/", with: "")
            lines.append(values?.isDirectory == true ? "\(relativePath)/" : relativePath)
            if values?.isDirectory == true {
                collectTree(at: child, root: root, depth: depth + 1, maxDepth: maxDepth, maxEntries: maxEntries, lines: &lines)
            }
        }
    }

    func searchFileMatches(
        query: String,
        root: URL,
        context: ToolExecutionContext,
        mode: String,
        maxDepth: Int,
        maxResults: Int
    ) -> [String] {
        let loweredQuery = query.lowercased()
        let basePath = displayPath(root, context: context)
        let workspaceRoot = context.workspaceRootURL

        let matches = collectFiles(root: root, maxDepth: maxDepth, maxResults: maxResults) { relativePath, url in
            let workspaceRelativePath = workspaceRoot.map {
                url.path.replacingOccurrences(of: $0.path + "/", with: "")
            } ?? relativePath

            if mode == "glob" {
                return fnmatch(query, relativePath, FNM_PATHNAME) == 0
                    || fnmatch(query, relativePath, 0) == 0
                    || fnmatch(query, workspaceRelativePath, FNM_PATHNAME) == 0
                    || fnmatch(query, workspaceRelativePath, 0) == 0
                    || fnmatch(query, url.lastPathComponent, 0) == 0
            }

            return url.lastPathComponent.lowercased().contains(loweredQuery)
                || relativePath.lowercased().contains(loweredQuery)
                || workspaceRelativePath.lowercased().contains(loweredQuery)
        }

        guard basePath != "." else {
            return matches
        }
        return matches.map { "\(basePath)/\($0)" }
    }

    func runContentSearch(
        query: String,
        path: URL,
        context: ToolExecutionContext,
        decision: ToolPermissionDecision,
        maxResults: Int,
        timeoutSeconds: Int
    ) async -> SandboxedCommandResult {
        await runner.run(
            command: makeRipgrepCommand(query: query, path: path, maxResults: maxResults),
            cwd: context.workspaceRootURL ?? path,
            timeoutSeconds: timeoutSeconds,
            useSandbox: decision.useSandbox,
            workspaceRoot: context.workspaceRootURL
        )
    }

    func makeRipgrepCommand(query: String, path: URL, maxResults: Int) -> String {
        let ignoredGlobs = Self.ignoredDirectoryNames
            .sorted()
            .map { "--glob \(shellQuote("!**/\($0)/**"))" }
            .joined(separator: " ")
        return "\(rgExecutable()) --line-number --column --no-heading --color never --max-count \(maxResults) \(ignoredGlobs) -- \(shellQuote(query)) \(shellQuote(path.path))"
    }

    func normalizedSearchMode(_ rawValue: String?) -> String {
        let mode = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch mode {
        case "files", "content", "glob":
            return mode ?? "auto"
        default:
            return "auto"
        }
    }

    func containsGlobSyntax(_ query: String) -> Bool {
        query.contains("*") || query.contains("?") || query.contains("[")
    }

    func commandResult(
        _ toolName: String,
        _ result: SandboxedCommandResult,
        metadata extraMetadata: [String: JSONValue] = [:]
    ) -> ToolResult {
        var metadata = extraMetadata
        metadata["exitCode"] = .number(Double(result.exitCode))
        metadata["truncated"] = .bool(result.didTruncate)

        if result.didTimeOut {
            return ToolResult(ok: false, toolName: toolName, content: result.output, errorCode: "timeout", metadata: metadata)
        }
        let ok = result.exitCode == 0
        return ToolResult(
            ok: ok,
            toolName: toolName,
            content: result.output,
            errorCode: ok ? nil : "command_failed",
            metadata: metadata
        )
    }

    func denied(_ toolName: String, _ decision: ToolPermissionDecision) -> ToolResult {
        ToolResult(ok: false, toolName: toolName, content: decision.message, errorCode: decision.errorCode ?? "permission_denied")
    }

    func failure(_ toolName: String, _ code: String, _ message: String) -> ToolResult {
        ToolResult(ok: false, toolName: toolName, content: message, errorCode: code)
    }

    func sortURLs(_ lhs: URL, _ rhs: URL) -> Bool {
        let lhsIsDirectory = (try? lhs.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
        let rhsIsDirectory = (try? rhs.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
        if lhsIsDirectory != rhsIsDirectory {
            return lhsIsDirectory
        }
        return lhs.lastPathComponent.localizedCaseInsensitiveCompare(rhs.lastPathComponent) == .orderedAscending
    }

    static func shouldIgnore(_ url: URL) -> Bool {
        let name = url.lastPathComponent
        let isDirectory = (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
        return isDirectory && ignoredDirectoryNames.contains(name)
    }

    func displayPath(_ url: URL, context: ToolExecutionContext) -> String {
        guard let root = context.workspaceRootURL,
              ToolPermissionEngine.isPath(url, inside: root) else {
            return url.path
        }
        if url.path == root.path {
            return "."
        }
        return url.path.replacingOccurrences(of: root.path + "/", with: "")
    }

    func extractPatchPaths(_ patch: String) -> [String] {
        patch
            .split(separator: "\n")
            .compactMap { line -> String? in
                let text = String(line)
                let prefixes = ["+++ b/", "--- a/", "+++ ", "--- ", "*** Update File: ", "*** Add File: ", "*** Delete File: "]
                for prefix in prefixes where text.hasPrefix(prefix) {
                    let path = String(text.dropFirst(prefix.count)).trimmingCharacters(in: .whitespacesAndNewlines)
                    if path.isEmpty || path == "/dev/null" {
                        return nil
                    }
                    return path
                }
                return nil
            }
    }

    func rgExecutable() -> String {
        return "rg"
    }

    func shellQuote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }

    func encodeJSON<T: Encodable>(_ value: T) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(value),
              let text = String(data: data, encoding: .utf8) else {
            return String(describing: value)
        }
        return text
    }
}
