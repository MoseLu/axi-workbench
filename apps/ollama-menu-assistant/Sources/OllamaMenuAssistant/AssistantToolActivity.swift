import Foundation

enum AssistantToolActivityCategory: String, Sendable {
    case explore
    case command
    case edit
    case skill
    case other
}

struct WorkspaceFileLink: Identifiable, Hashable, Sendable {
    var path: String
    var isCreated: Bool

    var id: String {
        path
    }

    var displayName: String {
        URL(fileURLWithPath: path).lastPathComponent
    }
}

struct AssistantToolActivityEvent: Identifiable, Hashable, Sendable {
    var id: UUID
    var toolName: String
    var status: ToolExecutionStatus
    var summary: String
    var timestamp: Date
    var category: AssistantToolActivityCategory
    var fileLinks: [WorkspaceFileLink]
}

struct AssistantToolActivity: Equatable, Sendable {
    var events: [AssistantToolActivityEvent]
    var fileLinks: [WorkspaceFileLink]
    var exploredFileCount: Int
    var commandCount: Int
    var editCount: Int
    var createdFileCount: Int

    var hasDetails: Bool {
        !events.isEmpty || !fileLinks.isEmpty
    }

    static func make(
        events: [ToolExecutionEvent],
        changeSummary: AssistantChangeSummary? = nil,
        projectRootPath: String?
    ) -> AssistantToolActivity {
        let activityEvents = events.map { event in
            AssistantToolActivityEvent(
                id: event.id,
                toolName: event.toolName,
                status: event.status,
                summary: event.summary,
                timestamp: event.timestamp,
                category: category(for: event.toolName),
                fileLinks: fileLinks(for: event, projectRootPath: projectRootPath)
            )
        }

        var links = activityEvents.flatMap(\.fileLinks)
        if let changeSummary {
            links.append(contentsOf: changeSummary.files.compactMap { file in
                guard file.state == .untracked,
                      let path = WorkspacePathLinkExtractor.normalizedPath(file.path, projectRootPath: projectRootPath) else {
                    return nil
                }
                return WorkspaceFileLink(path: path, isCreated: true)
            })
        }
        links = uniqueLinks(links)

        let exploredLinks = Set(activityEvents
            .filter { $0.category == .explore }
            .flatMap(\.fileLinks)
            .map(\.path))
        let exploreEventsWithoutLinks = activityEvents.filter { $0.category == .explore && $0.fileLinks.isEmpty }.count
        let commandCount = activityEvents.filter { $0.category == .command }.count
        let editCount = activityEvents.filter { $0.category == .edit }.count
        let createdFileCount = links.filter(\.isCreated).count

        return AssistantToolActivity(
            events: activityEvents,
            fileLinks: links,
            exploredFileCount: exploredLinks.count + exploreEventsWithoutLinks,
            commandCount: commandCount,
            editCount: editCount,
            createdFileCount: createdFileCount
        )
    }

    static func category(for toolName: String) -> AssistantToolActivityCategory {
        switch toolName {
        case "list_dir", "read_file", "stat_path", "glob_files", "find_files", "search", "search_rg", "grep_text", "tree":
            return .explore
        case "shell_command":
            return .command
        case "write_file", "apply_patch", "move_path", "delete_path":
            return .edit
        case "list_skills", "read_skill":
            return .skill
        default:
            return .other
        }
    }

    static func durationText(seconds: TimeInterval) -> String {
        let totalSeconds = max(0, Int(seconds.rounded(.down)))
        let hours = totalSeconds / 3_600
        let minutes = (totalSeconds % 3_600) / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return "\(hours)h \(minutes)m \(seconds)s"
        }
        if minutes > 0 {
            return "\(minutes)m \(seconds)s"
        }
        return "\(seconds)s"
    }

    func statsText(language: AppLanguage) -> String {
        var parts: [String] = []
        if exploredFileCount > 0 {
            parts.append(language == .english ? "explored \(exploredFileCount)" : "已探索 \(exploredFileCount) 个文件")
        }
        if commandCount > 0 {
            parts.append(language == .english ? "ran \(commandCount) command\(commandCount == 1 ? "" : "s")" : "已运行 \(commandCount) 条命令")
        }
        if editCount > 0 {
            parts.append(language == .english ? "edited \(editCount)" : "已编辑 \(editCount) 次")
        }
        if createdFileCount > 0 {
            parts.append(language == .english ? "created \(createdFileCount)" : "已创建 \(createdFileCount) 个文件")
        }
        return parts.joined(separator: language == .english ? ", " : "，")
    }

    private static func fileLinks(for event: ToolExecutionEvent, projectRootPath: String?) -> [WorkspaceFileLink] {
        let isCreated = event.metadata["created"]?.boolValue == true
        var paths = metadataPaths(event.metadata)
        if paths.isEmpty || event.toolName == "apply_patch" || event.toolName == "shell_command" {
            paths.append(contentsOf: WorkspacePathLinkExtractor.paths(in: event.summary, projectRootPath: projectRootPath))
        }

        return uniqueLinks(paths.compactMap { path in
            guard let normalized = WorkspacePathLinkExtractor.normalizedPath(path, projectRootPath: projectRootPath) else {
                return nil
            }
            return WorkspaceFileLink(
                path: normalized,
                isCreated: isCreated || event.toolName == "write_file"
            )
        })
    }

    private static func metadataPaths(_ metadata: [String: JSONValue]) -> [String] {
        var paths: [String] = []
        if let path = metadata["path"]?.stringValue {
            paths.append(path)
        }
        if let from = metadata["from"]?.stringValue {
            paths.append(from)
        }
        if let to = metadata["to"]?.stringValue {
            paths.append(to)
        }
        if let values = metadata["paths"]?.arrayValue {
            paths.append(contentsOf: values.compactMap(\.stringValue))
        }
        return paths
    }

    private static func uniqueLinks(_ links: [WorkspaceFileLink]) -> [WorkspaceFileLink] {
        var indexesByPath = [String: Int]()
        var result: [WorkspaceFileLink] = []
        for link in links {
            if let index = indexesByPath[link.path] {
                if link.isCreated {
                    result[index].isCreated = true
                }
                continue
            }
            indexesByPath[link.path] = result.count
            result.append(link)
        }
        return result
    }
}

enum WorkspacePathLinkExtractor {
    static let supportedFileExtensionPattern = #"swift|md|markdown|json|txt|yaml|yml|toml|plist|html|css|js|mjs|ts|tsx|jsx|py|sh|sql|sqlite|sqlite3|png|jpg|jpeg|gif|webp|svg"#
    private static let pathExtensionPattern = #"[A-Za-z0-9][A-Za-z0-9._-]*"#
    private static let pathLikePattern = #"(?:(?:/|\./)?[A-Za-z0-9_@+.-]+/)+[A-Za-z0-9_@+.-]+\."# + pathExtensionPattern
    private static let basenamePattern = #"\b[A-Za-z0-9_@+.-]+\.(?:"# + supportedFileExtensionPattern + #")\b"#

    static func paths(in text: String, projectRootPath: String?) -> [String] {
        let pathLikeMatches = matches(pattern: pathLikePattern, in: text)
        let basenameMatches = matches(pattern: basenamePattern, in: text)
        var seen = Set<String>()
        var paths: [String] = []

        func append(_ rawPath: String, skipsIfContainedBasename: Bool = false) {
            guard let path = normalizedPath(rawPath, projectRootPath: projectRootPath),
                  !seen.contains(path) else {
                return
            }
            if skipsIfContainedBasename,
               paths.contains(where: { $0 == path || $0.hasSuffix("/" + path) }) {
                return
            }
            seen.insert(path)
            paths.append(path)
        }

        pathLikeMatches.forEach { append($0) }
        basenameMatches.forEach { append($0, skipsIfContainedBasename: true) }
        return paths
    }

    static func normalizedPath(_ rawPath: String, projectRootPath: String?) -> String? {
        var path = rawPath
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "`'\"([{<"))
            .trimmingCharacters(in: CharacterSet(charactersIn: ".,;:)]}>'\"`"))
            .removingPercentEncoding ?? rawPath

        if path.hasPrefix("file://"),
           let url = URL(string: path) {
            path = url.path
        }

        if let range = path.range(of: #":\d+(?::\d+)?$"#, options: .regularExpression) {
            path.removeSubrange(range)
        }

        guard !path.isEmpty, path != "." else {
            return nil
        }

        if let projectRootPath,
           !projectRootPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let root = URL(fileURLWithPath: projectRootPath)
                .standardizedFileURL
                .resolvingSymlinksInPath()

            if path.hasPrefix("/") {
                let url = URL(fileURLWithPath: path)
                    .standardizedFileURL
                    .resolvingSymlinksInPath()
                guard isPath(url, inside: root) else {
                    return nil
                }
                if url.path == root.path {
                    return nil
                }
                return String(url.path.dropFirst(root.path.count + 1))
            }
        } else if path.hasPrefix("/") {
            return path
        }

        while path.hasPrefix("./") {
            path.removeFirst(2)
        }

        guard !path.hasPrefix("../"),
              !path.contains("/../"),
              path.range(of: #"[A-Za-z0-9]\.[A-Za-z0-9]"#, options: .regularExpression) != nil else {
            return nil
        }
        return path
    }

    static func reference(from rawPath: String, projectRootPath: String?) -> WorkspaceFileReference? {
        let location = pathLocation(in: rawPath)
        guard let path = normalizedPath(location.path, projectRootPath: projectRootPath) else {
            return nil
        }
        return WorkspaceFileReference(path: path, line: location.line, column: location.column)
    }

    private static func pathLocation(in rawPath: String) -> (path: String, line: Int?, column: Int?) {
        var path = rawPath
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "`'\"([{<"))
            .trimmingCharacters(in: CharacterSet(charactersIn: ".,;:]}>'\"`"))

        var line: Int?
        var column: Int?

        if let match = firstMatch(pattern: #"\s+\((?:line|Line|LINE|行)\s+(\d+)(?::(\d+))?\)\s*$"#, in: path),
           let matchRange = Range(match.range, in: path),
           let lineRange = Range(match.range(at: 1), in: path) {
            line = Int(path[lineRange])
            if match.numberOfRanges > 2,
               let columnRange = Range(match.range(at: 2), in: path) {
                column = Int(path[columnRange])
            }
            path.removeSubrange(matchRange)
        }

        if line == nil,
           let match = firstMatch(pattern: #":(\d+)(?::(\d+))?$"#, in: path),
           let matchRange = Range(match.range, in: path),
           let lineRange = Range(match.range(at: 1), in: path) {
            line = Int(path[lineRange])
            if match.numberOfRanges > 2,
               let columnRange = Range(match.range(at: 2), in: path) {
                column = Int(path[columnRange])
            }
            path.removeSubrange(matchRange)
        }

        return (path, line, column)
    }

    private static func matches(pattern: String, in text: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return []
        }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return regex.matches(in: text, range: range).compactMap { match in
            guard let range = Range(match.range, in: text) else {
                return nil
            }
            return String(text[range])
        }
    }

    private static func firstMatch(pattern: String, in text: String) -> NSTextCheckingResult? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return nil
        }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return regex.firstMatch(in: text, range: range)
    }

    private static func isPath(_ url: URL, inside root: URL) -> Bool {
        url.path == root.path || url.path.hasPrefix(root.path + "/")
    }
}
