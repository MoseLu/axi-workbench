import Darwin
import Foundation

struct WorkspaceToolService: Sendable {
    static let ignoredDirectoryNames: Set<String> = [
        ".build",
        ".cache",
        ".git",
        ".pytest_cache",
        ".swiftpm",
        ".venv",
        "DerivedData",
        "__pycache__",
        "build",
        "coverage",
        "dist",
        "node_modules",
        "target",
    ]

    var runner: SandboxedCommandRunner = SandboxedCommandRunner()
    var skillLibrary: SkillLibrary? = SkillLibrary.default()

    func makeRegistry() -> ToolRegistry {
        ToolRegistry(tools: [
            tool("list_skills", "List assistant skills available to this app.", .read, listSkills),
            tool("read_skill", "Read an assistant skill entrypoint or a file inside a skill directory.", .read, readSkill),
            tool("list_dir", "List files and directories in the selected workspace.", .read, listDir),
            tool("read_file", "Read a UTF-8 text file from the selected workspace.", .read, readFile),
            tool("stat_path", "Return metadata for a file or directory.", .read, statPath),
            tool("glob_files", "Find workspace files using a glob pattern such as **/*.swift.", .read, globFiles),
            tool("find_files", "Find workspace files by name substring.", .read, findFiles),
            tool("search", "Search workspace files by filename, glob pattern, or text content.", .read, search),
            tool("search_rg", "Search workspace text with ripgrep-style line results.", .read, searchRG),
            tool("grep_text", "Search workspace text for a literal query.", .read, searchRG),
            tool("tree", "Return a compact workspace tree.", .read, tree),
            tool("shell_command", "Run a shell command with permission review and optional sandboxing.", .shell, shellCommand),
            tool("write_file", "Write text to a file.", .write, writeFile),
            tool("apply_patch", "Apply a standard unified diff patch.", .write, applyPatch),
            tool("move_path", "Move or rename a file or directory.", .write, movePath),
            tool("delete_path", "Delete a file or directory.", .delete, deletePath),
        ])
    }

    private func listSkills(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let skillLibrary else {
            return failure("list_skills", "skills_not_installed", "No assistant skills were found.")
        }

        let maxResults = max(1, min(call.arguments["maxResults"]?.intValue ?? 100, 500))
        let skills = skillLibrary.discoverSkills(limit: maxResults)
        let payload = skills.map { skill in
            "\(skill.name)\t\(skill.relativePath)\t\(skill.description)"
        }.joined(separator: "\n")
        return ToolResult(
            ok: true,
            toolName: "list_skills",
            content: payload.isEmpty ? "No assistant skills were found." : payload,
            metadata: ["count": .number(Double(skills.count))]
        )
    }

    private func readSkill(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let skillLibrary else {
            return failure("read_skill", "skills_not_installed", "No assistant skills were found.")
        }
        guard let skill = call.arguments["skill"]?.stringValue, !skill.isEmpty else {
            return failure("read_skill", "invalid_arguments", "Missing required argument: skill")
        }

        let result = skillLibrary.readSkillFile(
            skill: skill,
            relativeFile: call.arguments["file"]?.stringValue,
            maxBytes: call.arguments["maxBytes"]?.intValue ?? 50_000
        )
        switch result {
        case .success(let text):
            return ToolResult(ok: true, toolName: "read_skill", content: text)
        case .failure(let error):
            return failure("read_skill", error.code, error.message)
        }
    }

    private func tool(
        _ name: String,
        _ description: String,
        _ operation: WorkspaceToolOperation,
        _ execute: @escaping @Sendable (AgentToolCall, ToolExecutionContext) async -> ToolResult
    ) -> RegisteredTool {
        RegisteredTool(
            definition: ToolDefinition(
                name: name,
                description: description,
                parameters: Self.parametersSchema(for: name)
            ),
            operation: operation,
            execute: execute
        )
    }

    private func listDir(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        let url = resolvePath(call.arguments["path"]?.stringValue, context: context)
        let decision = review(.read, context: context, targetURLs: [url])
        guard decision.allowed else {
            return denied("list_dir", decision)
        }

        do {
            let children = try FileManager.default.contentsOfDirectory(
                at: url,
                includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey, .isSymbolicLinkKey],
                options: [.skipsHiddenFiles]
            )
            let lines = try children
                .filter { !Self.shouldIgnore($0) }
                .sorted(by: sortURLs)
                .map { child in
                    let values = try child.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey, .isSymbolicLinkKey])
                    let type = values.isDirectory == true ? "dir" : (values.isSymbolicLink == true ? "symlink" : "file")
                    let size = values.fileSize.map(String.init) ?? "-"
                    return "\(type)\t\(child.lastPathComponent)\t\(size)"
                }
            return ToolResult(ok: true, toolName: "list_dir", content: lines.joined(separator: "\n"))
        } catch {
            return failure("list_dir", "io_error", error.localizedDescription)
        }
    }

    private func readFile(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let path = call.arguments["path"]?.stringValue, !path.isEmpty else {
            return failure("read_file", "invalid_arguments", "Missing required argument: path")
        }

        let url = resolvePath(path, context: context)
        let decision = review(.read, context: context, targetURLs: [url])
        guard decision.allowed else {
            return denied("read_file", decision)
        }
        let relativePath = displayPath(url, context: context)
        let metadata: [String: JSONValue] = [
            "path": .string(relativePath),
            "paths": .array([.string(relativePath)]),
        ]

        let maxBytes = max(1_024, min(call.arguments["maxBytes"]?.intValue ?? 40_000, 256_000))
        do {
            let values = try url.resourceValues(forKeys: [.isDirectoryKey])
            guard values.isDirectory != true else {
                return ToolResult(ok: false, toolName: "read_file", content: "Path is a directory: \(relativePath)", errorCode: "not_a_file", metadata: metadata)
            }
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            let data = handle.readData(ofLength: maxBytes + 1)
            let truncated = data.count > maxBytes
            let prefix = truncated ? data.prefix(maxBytes) : data[...]
            guard let text = String(data: Data(prefix), encoding: .utf8) else {
                return ToolResult(ok: true, toolName: "read_file", content: "Binary or non-UTF-8 file: \(relativePath)", metadata: metadata)
            }
            let suffix = truncated ? "\n[truncated at \(maxBytes) bytes]" : ""
            return ToolResult(ok: true, toolName: "read_file", content: text + suffix, metadata: metadata)
        } catch {
            return ToolResult(ok: false, toolName: "read_file", content: error.localizedDescription, errorCode: "io_error", metadata: metadata)
        }
    }

    private func statPath(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let path = call.arguments["path"]?.stringValue, !path.isEmpty else {
            return failure("stat_path", "invalid_arguments", "Missing required argument: path")
        }

        let url = resolvePath(path, context: context)
        let decision = review(.read, context: context, targetURLs: [url])
        guard decision.allowed else {
            return denied("stat_path", decision)
        }

        do {
            let values = try url.resourceValues(forKeys: [
                .isDirectoryKey,
                .isRegularFileKey,
                .isSymbolicLinkKey,
                .fileSizeKey,
                .contentModificationDateKey,
            ])
            let metadata: [String: JSONValue] = [
                "path": .string(displayPath(url, context: context)),
                "isDirectory": .bool(values.isDirectory == true),
                "isRegularFile": .bool(values.isRegularFile == true),
                "isSymbolicLink": .bool(values.isSymbolicLink == true),
                "size": .number(Double(values.fileSize ?? 0)),
                "modifiedAt": .string(values.contentModificationDate?.ISO8601Format() ?? ""),
            ]
            return ToolResult(ok: true, toolName: "stat_path", content: encodeJSON(metadata), metadata: metadata)
        } catch {
            return failure("stat_path", "io_error", error.localizedDescription)
        }
    }

    private func globFiles(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let pattern = call.arguments["pattern"]?.stringValue, !pattern.isEmpty else {
            return failure("glob_files", "invalid_arguments", "Missing required argument: pattern")
        }
        guard let root = context.workspaceRootURL else {
            return failure("glob_files", "no_workspace", "No workspace is selected for this conversation.")
        }

        let decision = review(.read, context: context, targetURLs: [root])
        guard decision.allowed else {
            return denied("glob_files", decision)
        }

        let maxResults = max(1, min(call.arguments["maxResults"]?.intValue ?? 200, 1_000))
        let matches = collectFiles(root: root, maxDepth: call.arguments["maxDepth"]?.intValue ?? 8, maxResults: maxResults) { relativePath, _ in
            fnmatch(pattern, relativePath, FNM_PATHNAME) == 0
                || fnmatch(pattern, relativePath, 0) == 0
        }
        return ToolResult(ok: true, toolName: "glob_files", content: matches.joined(separator: "\n"))
    }

    private func findFiles(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let root = context.workspaceRootURL else {
            return failure("find_files", "no_workspace", "No workspace is selected for this conversation.")
        }

        let decision = review(.read, context: context, targetURLs: [root])
        guard decision.allowed else {
            return denied("find_files", decision)
        }

        let query = call.arguments["query"]?.stringValue?.lowercased()
        let maxDepth = max(1, min(call.arguments["maxDepth"]?.intValue ?? 6, 16))
        let maxResults = max(1, min(call.arguments["maxResults"]?.intValue ?? 200, 1_000))
        let matches = collectFiles(root: root, maxDepth: maxDepth, maxResults: maxResults) { _, url in
            guard let query, !query.isEmpty else {
                return true
            }
            return url.lastPathComponent.lowercased().contains(query)
        }
        return ToolResult(ok: true, toolName: "find_files", content: matches.joined(separator: "\n"))
    }

    private func search(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let query = call.arguments["query"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              !query.isEmpty else {
            return failure("search", "invalid_arguments", "Missing required argument: query")
        }

        let searchURL = resolvePath(call.arguments["path"]?.stringValue, context: context)
        let decision = review(.read, context: context, targetURLs: [searchURL])
        guard decision.allowed else {
            return denied("search", decision)
        }

        let mode = normalizedSearchMode(call.arguments["mode"]?.stringValue)
        let maxDepth = max(1, min(call.arguments["maxDepth"]?.intValue ?? 8, 16))
        let maxResults = max(1, min(call.arguments["maxResults"]?.intValue ?? 200, 1_000))
        let queryLooksLikeGlob = containsGlobSyntax(query)
        let shouldSearchFiles = mode != "content"
        let shouldSearchContent = mode == "content" || (mode == "auto" && !queryLooksLikeGlob)

        var remainingResults = maxResults
        var sections: [String] = []
        var metadata: [String: JSONValue] = [
            "mode": .string(mode),
            "query": .string(query),
        ]

        if shouldSearchFiles {
            let fileMode = mode == "glob" || queryLooksLikeGlob ? "glob" : "files"
            let fileMatches = searchFileMatches(
                query: query,
                root: searchURL,
                context: context,
                mode: fileMode,
                maxDepth: maxDepth,
                maxResults: remainingResults
            )
            remainingResults = max(0, remainingResults - fileMatches.count)
            metadata["fileResults"] = .number(Double(fileMatches.count))
            if !fileMatches.isEmpty {
                sections.append("[files]\n\(fileMatches.joined(separator: "\n"))")
            }
        }

        if shouldSearchContent, remainingResults > 0 {
            let result = await runContentSearch(
                query: query,
                path: searchURL,
                context: context,
                decision: decision,
                maxResults: remainingResults,
                timeoutSeconds: call.arguments["timeoutSeconds"]?.intValue ?? 30
            )
            let contentLines = result.output
                .split(separator: "\n", omittingEmptySubsequences: true)
                .prefix(remainingResults)
                .map(String.init)

            metadata["contentResults"] = .number(Double(contentLines.count))
            metadata["contentExitCode"] = .number(Double(result.exitCode))
            metadata["contentTruncated"] = .bool(result.didTruncate)

            if result.didTimeOut {
                return ToolResult(ok: false, toolName: "search", content: result.output, errorCode: "timeout", metadata: metadata)
            }

            if result.exitCode == 0, !contentLines.isEmpty {
                sections.append("[content]\n\(contentLines.joined(separator: "\n"))")
            } else if result.exitCode != 0,
                      result.exitCode != 1,
                      !result.output.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                if mode == "content" {
                    return ToolResult(ok: false, toolName: "search", content: result.output, errorCode: "command_failed", metadata: metadata)
                }
                sections.append("[content_error]\n\(result.output)")
            }
        }

        if sections.isEmpty {
            return ToolResult(ok: true, toolName: "search", content: "No results.", metadata: metadata)
        }
        return ToolResult(ok: true, toolName: "search", content: sections.joined(separator: "\n\n"), metadata: metadata)
    }

    private func searchRG(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        let toolName = call.name == "grep_text" ? "grep_text" : "search_rg"
        guard let query = call.arguments["query"]?.stringValue, !query.isEmpty else {
            return failure(toolName, "invalid_arguments", "Missing required argument: query")
        }

        let searchURL = resolvePath(call.arguments["path"]?.stringValue, context: context)
        let decision = review(.read, context: context, targetURLs: [searchURL])
        guard decision.allowed else {
            return denied(toolName, decision)
        }

        let maxResults = max(1, min(call.arguments["maxResults"]?.intValue ?? 200, 1_000))
        let command = makeRipgrepCommand(query: query, path: searchURL, maxResults: maxResults)
        let result = await runner.run(
            command: command,
            cwd: context.workspaceRootURL ?? searchURL,
            timeoutSeconds: call.arguments["timeoutSeconds"]?.intValue ?? 30,
            useSandbox: decision.useSandbox,
            workspaceRoot: context.workspaceRootURL
        )
        return commandResult(toolName, result)
    }

    private func tree(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        let url = resolvePath(call.arguments["path"]?.stringValue, context: context)
        let decision = review(.read, context: context, targetURLs: [url])
        guard decision.allowed else {
            return denied("tree", decision)
        }

        let maxDepth = max(1, min(call.arguments["maxDepth"]?.intValue ?? 3, 8))
        let maxEntries = max(1, min(call.arguments["maxEntries"]?.intValue ?? 200, 1_000))
        var lines: [String] = []
        collectTree(at: url, root: url, depth: 0, maxDepth: maxDepth, maxEntries: maxEntries, lines: &lines)
        return ToolResult(ok: true, toolName: "tree", content: lines.joined(separator: "\n"))
    }

    private func shellCommand(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let command = call.arguments["command"]?.stringValue, !command.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return failure("shell_command", "invalid_arguments", "Missing required argument: command")
        }

        let cwd = resolvePath(call.arguments["cwd"]?.stringValue, context: context)
        let decision = review(.shell, context: context, targetURLs: [cwd], command: command, cwd: cwd)
        guard decision.allowed else {
            return denied("shell_command", decision)
        }

        let result = await runner.run(
            command: command,
            cwd: cwd,
            timeoutSeconds: call.arguments["timeoutSeconds"]?.intValue ?? 60,
            useSandbox: decision.useSandbox,
            workspaceRoot: context.workspaceRootURL
        )
        return commandResult("shell_command", result)
    }

    private func writeFile(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let path = call.arguments["path"]?.stringValue, !path.isEmpty else {
            return failure("write_file", "invalid_arguments", "Missing required argument: path")
        }
        guard let content = call.arguments["content"]?.stringValue else {
            return failure("write_file", "invalid_arguments", "Missing required argument: content")
        }

        let url = resolvePath(path, context: context)
        let decision = review(.write, context: context, targetURLs: [url])
        guard decision.allowed else {
            return denied("write_file", decision)
        }
        let relativePath = displayPath(url, context: context)
        let didCreateFile = !FileManager.default.fileExists(atPath: url.path)

        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            if call.arguments["append"]?.boolValue == true,
               let handle = try? FileHandle(forWritingTo: url) {
                defer { try? handle.close() }
                try handle.seekToEnd()
                try handle.write(contentsOf: Data(content.utf8))
            } else {
                try content.write(to: url, atomically: true, encoding: .utf8)
            }
            return ToolResult(
                ok: true,
                toolName: "write_file",
                content: "Wrote \(content.utf8.count) bytes to \(relativePath).",
                metadata: [
                    "path": .string(relativePath),
                    "paths": .array([.string(relativePath)]),
                    "created": .bool(didCreateFile),
                    "byteCount": .number(Double(content.utf8.count)),
                ]
            )
        } catch {
            return ToolResult(
                ok: false,
                toolName: "write_file",
                content: error.localizedDescription,
                errorCode: "io_error",
                metadata: [
                    "path": .string(relativePath),
                    "paths": .array([.string(relativePath)]),
                    "created": .bool(didCreateFile),
                ]
            )
        }
    }

    private func applyPatch(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let patch = call.arguments["patch"]?.stringValue, !patch.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return failure("apply_patch", "invalid_arguments", "Missing required argument: patch")
        }

        let patchPaths = Array(Set(extractPatchPaths(patch))).sorted()
        let targetURLs = patchPaths.map { resolvePath($0, context: context) }
        let reviewTargets = targetURLs.isEmpty ? [context.workspaceRootURL].compactMap { $0 } : targetURLs
        let decision = review(.write, context: context, targetURLs: reviewTargets)
        guard decision.allowed else {
            return denied("apply_patch", decision)
        }

        guard let root = context.workspaceRootURL else {
            return failure("apply_patch", "no_workspace", "No workspace is selected for this conversation.")
        }

        if patch.contains("*** Begin Patch") {
            return failure("apply_patch", "unsupported_patch_format", "Use standard unified diff format for this app tool.")
        }

        let patchURL = FileManager.default.temporaryDirectory.appending(path: "ollama-menu-assistant-\(UUID().uuidString).patch")
        do {
            try patch.write(to: patchURL, atomically: true, encoding: .utf8)
            defer { try? FileManager.default.removeItem(at: patchURL) }
            let command = "/usr/bin/patch -p1 -i \(shellQuote(patchURL.path))"
            let result = await runner.run(command: command, cwd: root, timeoutSeconds: 60, useSandbox: false, workspaceRoot: context.workspaceRootURL)
            return commandResult(
                "apply_patch",
                result,
                metadata: ["paths": .array(patchPaths.map { .string($0) })]
            )
        } catch {
            return failure("apply_patch", "io_error", error.localizedDescription)
        }
    }

    private func movePath(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let from = call.arguments["from"]?.stringValue,
              let to = call.arguments["to"]?.stringValue,
              !from.isEmpty,
              !to.isEmpty else {
            return failure("move_path", "invalid_arguments", "Missing required arguments: from, to")
        }

        let fromURL = resolvePath(from, context: context)
        let toURL = resolvePath(to, context: context)
        let decision = review(.write, context: context, targetURLs: [fromURL, toURL])
        guard decision.allowed else {
            return denied("move_path", decision)
        }

        do {
            try FileManager.default.createDirectory(at: toURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try FileManager.default.moveItem(at: fromURL, to: toURL)
            let fromPath = displayPath(fromURL, context: context)
            let toPath = displayPath(toURL, context: context)
            return ToolResult(
                ok: true,
                toolName: "move_path",
                content: "Moved \(fromPath) to \(toPath).",
                metadata: [
                    "from": .string(fromPath),
                    "to": .string(toPath),
                    "paths": .array([.string(fromPath), .string(toPath)]),
                ]
            )
        } catch {
            return failure("move_path", "io_error", error.localizedDescription)
        }
    }

    private func deletePath(_ call: AgentToolCall, _ context: ToolExecutionContext) async -> ToolResult {
        guard let path = call.arguments["path"]?.stringValue, !path.isEmpty else {
            return failure("delete_path", "invalid_arguments", "Missing required argument: path")
        }

        let url = resolvePath(path, context: context)
        let decision = review(.delete, context: context, targetURLs: [url])
        guard decision.allowed else {
            return denied("delete_path", decision)
        }

        do {
            try FileManager.default.removeItem(at: url)
            let relativePath = displayPath(url, context: context)
            return ToolResult(
                ok: true,
                toolName: "delete_path",
                content: "Deleted \(relativePath).",
                metadata: [
                    "path": .string(relativePath),
                    "paths": .array([.string(relativePath)]),
                ]
            )
        } catch {
            return failure("delete_path", "io_error", error.localizedDescription)
        }
    }

}
