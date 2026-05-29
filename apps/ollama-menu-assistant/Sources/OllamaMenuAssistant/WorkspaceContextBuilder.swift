import Foundation

struct WorkspaceContextBuilder {
    private static let ignoredDirectoryNames: Set<String> = [
        ".build",
        ".DS_Store",
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

    private static let ignoredFileNames: Set<String> = [
        ".DS_Store",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
    ]

    private static let keyFileNames: Set<String> = [
        "AGENTS.md",
        "Cargo.toml",
        "Package.swift",
        "README.md",
        "README.zh-CN.md",
        "compose.yaml",
        "docker-compose.yml",
        "go.mod",
        "package.json",
        "pnpm-workspace.yaml",
        "pyproject.toml",
        "requirements.txt",
        "turbo.json",
        "vite.config.ts",
        "vite.config.js",
    ]

    static func makePrompt(
        project: ConversationProject,
        fileManager: FileManager = .default,
        language: AppLanguage = .simplifiedChinese
    ) -> String? {
        let tr = LocalizedStrings(language: language)
        let name = project.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let path = project.path?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty || path?.isEmpty == false else {
            return nil
        }

        var lines = [tr("当前会话关联到一个本地工作区。", "The current conversation is linked to a local workspace.")]
        if !name.isEmpty {
            lines.append(tr("项目名称：\(name)", "Project name: \(name)"))
        }
        if let path, !path.isEmpty {
            lines.append(tr("项目路径：\(path)", "Project path: \(path)"))

            let workspaceURL = URL(fileURLWithPath: path)
            let snapshot = makeSnapshot(at: workspaceURL, fileManager: fileManager, language: language)
            if !snapshot.treeEntries.isEmpty {
                lines.append(tr(
                    "工作区文件树快照（有限深度，已排除依赖和构建产物）：",
                    "Workspace file tree snapshot (limited depth, dependencies and build artifacts excluded):"
                ))
                lines.append(contentsOf: snapshot.treeEntries.map { "- \($0)" })
            }
            if !snapshot.fileSummaries.isEmpty {
                lines.append(tr("关键文件摘录：", "Key file excerpts:"))
                for summary in snapshot.fileSummaries {
                    lines.append("### \(summary.relativePath)")
                    lines.append(summary.content)
                }
            }
        }
        lines.append(tr(
            "你已经获得了上面这份从本地工作区读取到的只读快照。回答项目概览、技术栈、目录结构、启动方式等问题时，必须优先基于这些具体文件证据，不要只根据项目名猜测，也不要说完全看不到代码。",
            "You have the read-only snapshot above from the local workspace. When answering questions about the project overview, tech stack, directory structure, or startup flow, prioritize this concrete file evidence. Do not guess from the project name, and do not say you cannot see the code at all."
        ))
        lines.append(tr(
            "如果用户询问的细节不在这份快照中，再明确说明需要读取或附加对应文件。",
            "If the user asks for details that are not in this snapshot, say clearly that the relevant files need to be read or attached."
        ))
        return lines.joined(separator: "\n")
    }

    private static func makeSnapshot(at url: URL, fileManager: FileManager, language: AppLanguage) -> WorkspaceSnapshot {
        let rootURL = url.standardizedFileURL.resolvingSymlinksInPath()
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: rootURL.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            return WorkspaceSnapshot(treeEntries: [], fileSummaries: [])
        }

        var entries: [WorkspaceEntry] = []
        collectEntries(at: rootURL, rootURL: rootURL, depth: 0, fileManager: fileManager, entries: &entries)

        let treeEntries = entries
            .prefix(96)
            .map(\.displayPath)

        let fileSummaries = entries
            .filter { !$0.isDirectory && shouldSummarizeFile(relativePath: $0.relativePath, name: $0.name) }
            .prefix(12)
            .compactMap { makeFileSummary(for: $0.url, relativePath: $0.relativePath, language: language) }

        return WorkspaceSnapshot(treeEntries: Array(treeEntries), fileSummaries: Array(fileSummaries))
    }

    private static func collectEntries(
        at url: URL,
        rootURL: URL,
        depth: Int,
        fileManager: FileManager,
        entries: inout [WorkspaceEntry]
    ) {
        guard depth < 3, entries.count < 160 else {
            return
        }

        let children: [URL]
        do {
            children = try fileManager.contentsOfDirectory(
                at: url,
                includingPropertiesForKeys: [.isDirectoryKey],
                options: [.skipsHiddenFiles]
            )
        } catch {
            return
        }

        for child in sortedChildren(children) {
            guard entries.count < 160 else {
                return
            }

            let name = child.lastPathComponent
            let resourceValues = try? child.resourceValues(forKeys: [.isDirectoryKey])
            let isDirectory = resourceValues?.isDirectory == true
            if shouldIgnore(name: name, isDirectory: isDirectory) {
                continue
            }

            let normalizedChild = child.standardizedFileURL.resolvingSymlinksInPath()
            let relativePath = normalizedChild.path.replacingOccurrences(of: rootURL.path + "/", with: "")
            entries.append(WorkspaceEntry(url: child, relativePath: relativePath, name: name, isDirectory: isDirectory))

            if isDirectory {
                collectEntries(at: child, rootURL: rootURL, depth: depth + 1, fileManager: fileManager, entries: &entries)
            }
        }
    }

    private static func sortedChildren(_ urls: [URL]) -> [URL] {
        urls.sorted { lhs, rhs in
            let lhsIsDirectory = (try? lhs.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
            let rhsIsDirectory = (try? rhs.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
            if lhsIsDirectory != rhsIsDirectory {
                return lhsIsDirectory
            }
            return lhs.lastPathComponent.localizedCaseInsensitiveCompare(rhs.lastPathComponent) == .orderedAscending
        }
    }

    private static func shouldIgnore(name: String, isDirectory: Bool) -> Bool {
        if isDirectory {
            return ignoredDirectoryNames.contains(name)
        }
        return ignoredFileNames.contains(name)
    }

    private static func shouldSummarizeFile(relativePath: String, name: String) -> Bool {
        if keyFileNames.contains(name) {
            return true
        }
        return relativePath.split(separator: "/").count <= 2 && name.lowercased().hasPrefix("readme")
    }

    private static func makeFileSummary(for url: URL, relativePath: String, language: AppLanguage) -> FileSummary? {
        guard let text = try? String(contentsOf: url, encoding: .utf8) else {
            return nil
        }
        let sanitized = text
            .replacingOccurrences(of: #"\n{3,}"#, with: "\n\n", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sanitized.isEmpty else {
            return nil
        }
        return FileSummary(relativePath: relativePath, content: truncate(sanitized, limit: 1_800, language: language))
    }

    private static func truncate(_ text: String, limit: Int, language: AppLanguage) -> String {
        guard text.count > limit else {
            return text
        }
        return "\(text.prefix(limit))\n" + LocalizedStrings(language: language)("...（已截断）", "...[truncated]")
    }
}

private struct WorkspaceSnapshot {
    let treeEntries: [String]
    let fileSummaries: [FileSummary]
}

private struct WorkspaceEntry {
    let url: URL
    let relativePath: String
    let name: String
    let isDirectory: Bool

    var displayPath: String {
        isDirectory ? "\(relativePath)/" : relativePath
    }
}

private struct FileSummary {
    let relativePath: String
    let content: String
}
