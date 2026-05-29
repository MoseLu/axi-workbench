import Foundation

struct SkillSummary: Identifiable, Codable, Hashable, Sendable {
    var id: String { relativePath }
    var name: String
    var description: String
    var relativePath: String

    var directoryPath: String {
        String(relativePath.dropLast("/SKILL.md".count))
    }
}

struct SkillLibrary: Sendable {
    var rootURLs: [URL]

    init(rootURL: URL) {
        self.rootURLs = [rootURL]
    }

    init(rootURLs: [URL]) {
        self.rootURLs = rootURLs
    }

    static func `default`() -> SkillLibrary? {
        Self.default(paths: .default())
    }

    static func `default`(paths: AppDataPaths) -> SkillLibrary? {
        var roots: [URL] = []
        if let resourceURL = Bundle.main.resourceURL?.appending(path: "Skills", directoryHint: .isDirectory),
           FileManager.default.fileExists(atPath: resourceURL.path) {
            roots.append(resourceURL)
        }

        let sourceURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appending(path: "Resources/Skills", directoryHint: .isDirectory)
            .standardizedFileURL
        if FileManager.default.fileExists(atPath: sourceURL.path) {
            roots.append(sourceURL)
        }

        if FileManager.default.fileExists(atPath: paths.skillsURL.path) {
            roots.append(paths.skillsURL)
        }

        return roots.isEmpty ? nil : SkillLibrary(rootURLs: roots)
    }

    func discoverSkills(limit: Int = 200) -> [SkillSummary] {
        var skills: [SkillSummary] = []
        for rootURL in rootURLs {
            guard skills.count < limit else {
                break
            }
            let root = rootURL.standardizedFileURL.resolvingSymlinksInPath()
            skills.append(contentsOf: discoverSkills(rootURL: root, limit: limit - skills.count))
        }

        return skills.sorted { lhs, rhs in
            if lhs.name == rhs.name {
                return lhs.relativePath < rhs.relativePath
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    private func discoverSkills(rootURL root: URL, limit: Int) -> [SkillSummary] {
        guard let enumerator = FileManager.default.enumerator(
            at: root,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsPackageDescendants]
        ) else {
            return []
        }

        var skills: [SkillSummary] = []
        for case let url as URL in enumerator {
            guard skills.count < limit,
                  url.lastPathComponent == "SKILL.md" else {
                continue
            }
            let normalized = url.standardizedFileURL.resolvingSymlinksInPath()
            guard ToolPermissionEngine.isPath(normalized, inside: root),
                  let summary = parseSkill(at: normalized, rootURL: root) else {
                continue
            }
            skills.append(summary)
        }

        return skills
    }

    func readSkillFile(
        skill: String,
        relativeFile: String? = nil,
        maxBytes: Int = 50_000
    ) -> Result<String, SkillReadError> {
        let query = skill.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return .failure(.invalidArguments("Missing required argument: skill"))
        }

        guard let match = skillMatch(query: query) else {
            return .failure(.notFound("No skill found for: \(skill)"))
        }
        let summary = match.summary
        let rootURL = match.rootURL

        let skillDirectory = rootURL.appending(path: summary.directoryPath, directoryHint: .isDirectory)
        let requestedFile = relativeFile?.trimmingCharacters(in: .whitespacesAndNewlines)
        let targetURL = requestedFile?.isEmpty == false
            ? skillDirectory.appending(path: requestedFile!)
            : skillDirectory.appending(path: "SKILL.md")
        let normalizedRoot = rootURL.standardizedFileURL.resolvingSymlinksInPath()
        let normalizedTarget = targetURL.standardizedFileURL.resolvingSymlinksInPath()
        guard ToolPermissionEngine.isPath(normalizedTarget, inside: normalizedRoot) else {
            return .failure(.outsideSkillsRoot("Requested skill file is outside the skills root."))
        }

        do {
            let handle = try FileHandle(forReadingFrom: normalizedTarget)
            defer { try? handle.close() }
            let byteLimit = max(1_024, min(maxBytes, 300_000))
            let data = handle.readData(ofLength: byteLimit + 1)
            let truncated = data.count > byteLimit
            let prefix = truncated ? data.prefix(byteLimit) : data[...]
            guard let text = String(data: Data(prefix), encoding: .utf8) else {
                return .failure(.notText("Skill file is not UTF-8 text: \(summary.directoryPath)"))
            }
            let suffix = truncated ? "\n[truncated at \(byteLimit) bytes]" : ""
            return .success(text + suffix)
        } catch {
            return .failure(.io(error.localizedDescription))
        }
    }

    func manifestText(limit: Int = 80) -> String {
        let skills = discoverSkills(limit: limit)
        guard !skills.isEmpty else {
            return "No local assistant skills were found."
        }

        return skills.map { skill in
            "- \(skill.name): \(skill.description) [\(skill.relativePath)]"
        }.joined(separator: "\n")
    }

    private func skillMatch(query: String) -> (summary: SkillSummary, rootURL: URL)? {
        for rootURL in rootURLs {
            let root = rootURL.standardizedFileURL.resolvingSymlinksInPath()
            let skills = discoverSkills(rootURL: root, limit: 200)
            if let summary = skills.first(where: { matches($0, query: query) }) {
                return (summary, root)
            }
        }
        return nil
    }

    private func parseSkill(at url: URL, rootURL: URL) -> SkillSummary? {
        guard let text = try? String(contentsOf: url, encoding: .utf8) else {
            return nil
        }
        let metadata = parseFrontMatter(text)
        let relativePath = url.path.replacingOccurrences(of: rootURL.path + "/", with: "")
        let fallbackName = url.deletingLastPathComponent().lastPathComponent
        let name = metadata["name"]?.isEmpty == false ? metadata["name"]! : fallbackName
        let description = metadata["description"]?.isEmpty == false ? metadata["description"]! : firstBodyLine(text)
        return SkillSummary(
            name: name,
            description: description,
            relativePath: relativePath
        )
    }

    private func parseFrontMatter(_ text: String) -> [String: String] {
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        guard lines.first?.trimmingCharacters(in: .whitespacesAndNewlines) == "---" else {
            return [:]
        }

        var metadata: [String: String] = [:]
        for line in lines.dropFirst() {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed == "---" {
                break
            }
            guard let separator = trimmed.firstIndex(of: ":") else {
                continue
            }
            let key = String(trimmed[..<separator]).trimmingCharacters(in: .whitespacesAndNewlines)
            let value = String(trimmed[trimmed.index(after: separator)...])
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
            if !key.isEmpty {
                metadata[key] = value
            }
        }
        return metadata
    }

    private func firstBodyLine(_ text: String) -> String {
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let bodyStart: Int
        if lines.first?.trimmingCharacters(in: .whitespacesAndNewlines) == "---",
           let closingIndex = lines.dropFirst().firstIndex(where: { $0.trimmingCharacters(in: .whitespacesAndNewlines) == "---" }) {
            bodyStart = lines.index(after: closingIndex)
        } else {
            bodyStart = lines.startIndex
        }

        return lines[bodyStart...]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first(where: { !$0.isEmpty && !$0.hasPrefix("#") }) ?? ""
    }

    private func matches(_ summary: SkillSummary, query: String) -> Bool {
        let normalizedQuery = query.lowercased()
        return summary.name.lowercased() == normalizedQuery
            || summary.directoryPath.lowercased() == normalizedQuery
            || summary.relativePath.lowercased() == normalizedQuery
            || summary.relativePath.lowercased().hasSuffix("/\(normalizedQuery)/SKILL.md")
    }
}

enum SkillReadError: Error, Hashable, Sendable {
    case invalidArguments(String)
    case notFound(String)
    case outsideSkillsRoot(String)
    case notText(String)
    case io(String)

    var code: String {
        switch self {
        case .invalidArguments:
            return "invalid_arguments"
        case .notFound:
            return "skill_not_found"
        case .outsideSkillsRoot:
            return "outside_skills_root"
        case .notText:
            return "not_text"
        case .io:
            return "io_error"
        }
    }

    var message: String {
        switch self {
        case .invalidArguments(let message),
             .notFound(let message),
             .outsideSkillsRoot(let message),
             .notText(let message),
             .io(let message):
            return message
        }
    }
}
