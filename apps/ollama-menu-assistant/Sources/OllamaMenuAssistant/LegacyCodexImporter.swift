import Foundation

struct LegacyCodexImporter {
    var paths: AppDataPaths
    var legacyRootURL: URL
    var fileManager: FileManager = .default

    init(
        paths: AppDataPaths,
        legacyRootURL: URL = FileManager.default.homeDirectoryForCurrentUser.appending(path: ".codex", directoryHint: .isDirectory),
        fileManager: FileManager = .default
    ) {
        self.paths = paths
        self.legacyRootURL = legacyRootURL
        self.fileManager = fileManager
    }

    func runIfNeeded() throws -> LegacyImportState {
        if let state = loadState(), state.completed {
            syncLegacyPetsIfNeeded()
            return state
        }

        try paths.createBaseDirectories(fileManager: fileManager)
        var state = LegacyImportState(completed: true, importedAt: .now)
        var enabledStates: [String: Bool] = [:]

        importDirectoryContents(
            from: legacyRootURL.appending(path: "skills", directoryHint: .isDirectory),
            to: paths.skillsURL,
            label: "skills",
            state: &state
        )
        importDirectoryContents(
            from: legacyRootURL.appending(path: "pets", directoryHint: .isDirectory),
            to: paths.petsURL,
            label: "pets",
            state: &state
        )
        importDirectoryContents(
            from: legacyRootURL.appending(path: "automations", directoryHint: .isDirectory),
            to: paths.automationsURL,
            label: "automations",
            state: &state
        )
        importPlugins(enabledStates: &enabledStates, state: &state)

        do {
            try PluginStateStore(configURL: paths.runtimeConfigURL).mergeEnabledStates(enabledStates)
        } catch {
            state.errors.append("plugin state: \(error.localizedDescription)")
        }

        try saveState(state)
        return state
    }

    private func syncLegacyPetsIfNeeded() {
        var state = LegacyImportState(completed: true, importedAt: .now)
        importDirectoryContents(
            from: legacyRootURL.appending(path: "pets", directoryHint: .isDirectory),
            to: paths.petsURL,
            label: "pets",
            state: &state
        )
    }

    private func importDirectoryContents(
        from sourceURL: URL,
        to destinationURL: URL,
        label: String,
        state: inout LegacyImportState
    ) {
        guard fileManager.fileExists(atPath: sourceURL.path),
              let children = try? fileManager.contentsOfDirectory(
                at: sourceURL,
                includingPropertiesForKeys: [.isDirectoryKey],
                options: [.skipsHiddenFiles]
              ) else {
            return
        }

        for child in children {
            let destination = destinationURL.appending(path: child.lastPathComponent)
            do {
                try copyIfMissing(from: child, to: destination)
                state.importedCounts[label, default: 0] += 1
            } catch {
                state.errors.append("\(label): \(child.lastPathComponent): \(error.localizedDescription)")
            }
        }
    }

    private func importPlugins(
        enabledStates: inout [String: Bool],
        state: inout LegacyImportState
    ) {
        let cacheURL = legacyRootURL.appending(path: "plugins/cache", directoryHint: .isDirectory)
        enabledStates.merge(parseLegacyPluginEnabledStates()) { _, rhs in rhs }
        guard fileManager.fileExists(atPath: cacheURL.path),
              let enumerator = fileManager.enumerator(
                at: cacheURL,
                includingPropertiesForKeys: [.isRegularFileKey],
                options: [.skipsPackageDescendants]
              ) else {
            return
        }

        for case let manifestURL as URL in enumerator {
            guard manifestURL.lastPathComponent == "plugin.json",
                  manifestURL.deletingLastPathComponent().lastPathComponent == ".codex-plugin" else {
                continue
            }

            do {
                let imported = try importPlugin(manifestURL: manifestURL)
                enabledStates[imported.id] = enabledStates[imported.id] ?? false
                state.importedCounts["plugins", default: 0] += 1
            } catch {
                state.errors.append("plugin: \(manifestURL.path): \(error.localizedDescription)")
            }
        }
    }

    private func importPlugin(manifestURL: URL) throws -> LocalPluginManifest {
        let legacyRoot = manifestURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .standardizedFileURL
        let data = try Data(contentsOf: manifestURL)
        let manifest = try JSONDecoder().decode(LegacyPluginManifest.self, from: data)
        let marketplace = marketplaceName(for: legacyRoot)
        let pluginID = "\(manifest.name)@\(marketplace)"
        let destinationRoot = paths.pluginsURL.appending(path: sanitizePathComponent(pluginID), directoryHint: .isDirectory)

        try copyIfMissing(from: legacyRoot, to: destinationRoot)

        let interface = manifest.interface
        let mcpPath = try importMCPConfig(from: manifest.mcpServers?.value, legacyRoot: legacyRoot, destinationRoot: destinationRoot)
        let localManifest = LocalPluginManifest(
            id: pluginID,
            displayName: interface?.displayName?.value ?? manifest.name,
            description: interface?.shortDescription?.value ?? manifest.description?.value ?? "",
            version: manifest.version?.value ?? "",
            developerName: interface?.developerName?.value ?? manifest.author?.name ?? "",
            category: interface?.category?.value ?? "",
            iconPath: normalizeRelativePath(interface?.logo?.value ?? interface?.composerIcon?.value),
            brandColor: interface?.brandColor?.value,
            skillsPath: normalizeRelativePath(manifest.skills?.value),
            appsPath: normalizeRelativePath(manifest.apps?.value),
            mcpConfigPath: mcpPath,
            capabilityLabels: interface?.capabilities?.map(\.value) ?? [],
            source: "imported"
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let output = try encoder.encode(localManifest)
        try output.write(to: destinationRoot.appending(path: "plugin.json"), options: .atomic)
        return localManifest
    }

    private func importMCPConfig(
        from rawPath: String?,
        legacyRoot: URL,
        destinationRoot: URL
    ) throws -> String? {
        guard let rawPath = normalizeRelativePath(rawPath) else {
            return nil
        }
        let sourceURL = legacyRoot.appending(path: rawPath)
        guard fileManager.fileExists(atPath: sourceURL.path) else {
            return rawPath
        }
        let destinationURL = destinationRoot.appending(path: "mcp.json")
        try copyReplacingIfNeeded(from: sourceURL, to: destinationURL)
        return "mcp.json"
    }

    private func parseLegacyPluginEnabledStates() -> [String: Bool] {
        let configURL = legacyRootURL.appending(path: "config.toml")
        guard let text = try? String(contentsOf: configURL, encoding: .utf8) else {
            return [:]
        }

        var states: [String: Bool] = [:]
        var currentPluginID: String?
        for line in text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init) {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.hasPrefix("[plugins.\""), trimmed.hasSuffix("\"]") {
                let start = trimmed.index(trimmed.startIndex, offsetBy: "[plugins.\"".count)
                let end = trimmed.index(trimmed.endIndex, offsetBy: -"\"]".count)
                currentPluginID = String(trimmed[start..<end])
                if let currentPluginID {
                    states[currentPluginID] = states[currentPluginID] ?? false
                }
                continue
            }
            guard let currentPluginID,
                  trimmed.hasPrefix("enabled"),
                  let separator = trimmed.firstIndex(of: "=") else {
                continue
            }
            let rawValue = trimmed[trimmed.index(after: separator)...]
                .split(separator: "#", maxSplits: 1, omittingEmptySubsequences: false)
                .first?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            states[currentPluginID] = rawValue == "true"
        }
        return states
    }

    private func copyIfMissing(from sourceURL: URL, to destinationURL: URL) throws {
        guard !fileManager.fileExists(atPath: destinationURL.path) else {
            return
        }
        try fileManager.createDirectory(at: destinationURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try fileManager.copyItem(at: sourceURL, to: destinationURL)
    }

    private func copyReplacingIfNeeded(from sourceURL: URL, to destinationURL: URL) throws {
        try fileManager.createDirectory(at: destinationURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        if fileManager.fileExists(atPath: destinationURL.path) {
            try fileManager.removeItem(at: destinationURL)
        }
        try fileManager.copyItem(at: sourceURL, to: destinationURL)
    }

    private func marketplaceName(for legacyPluginRoot: URL) -> String {
        let cacheURL = legacyRootURL.appending(path: "plugins/cache", directoryHint: .isDirectory).standardizedFileURL.path
        let pluginPath = legacyPluginRoot.standardizedFileURL.path
        guard pluginPath.hasPrefix(cacheURL + "/") else {
            return "legacy"
        }
        let relativePath = String(pluginPath.dropFirst(cacheURL.count + 1))
        return relativePath.split(separator: "/").first.map(String.init) ?? "legacy"
    }

    private func sanitizePathComponent(_ value: String) -> String {
        value.unicodeScalars.map { scalar -> Character in
            if CharacterSet.alphanumerics.contains(scalar)
                || scalar.value == 45
                || scalar.value == 95
                || scalar.value == 64 {
                return Character(scalar)
            }
            return "_"
        }.reduce(into: "") { $0.append($1) }
    }

    private func normalizeRelativePath(_ value: String?) -> String? {
        guard var value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            return nil
        }
        if value.hasPrefix("./") {
            value.removeFirst(2)
        }
        return value
    }

    private func loadState() -> LegacyImportState? {
        guard let data = try? Data(contentsOf: paths.migrationStateURL) else {
            return nil
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(LegacyImportState.self, from: data)
    }

    private func saveState(_ state: LegacyImportState) throws {
        try fileManager.createDirectory(at: paths.migrationStateURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(state)
        try data.write(to: paths.migrationStateURL, options: .atomic)
    }
}

struct LegacyImportState: Codable, Hashable, Sendable {
    var completed: Bool
    var importedAt: Date
    var importedCounts: [String: Int]
    var errors: [String]

    init(
        completed: Bool = false,
        importedAt: Date = .now,
        importedCounts: [String: Int] = [:],
        errors: [String] = []
    ) {
        self.completed = completed
        self.importedAt = importedAt
        self.importedCounts = importedCounts
        self.errors = errors
    }
}

private struct LegacyPluginManifest: Decodable {
    var name: String
    var version: LossyString?
    var description: LossyString?
    var author: LegacyPluginManifestAuthor?
    var skills: LossyString?
    var apps: LossyString?
    var mcpServers: LossyString?
    var interface: LegacyPluginManifestInterface?
}

private struct LegacyPluginManifestAuthor: Decodable {
    var name: String

    init(from decoder: Decoder) throws {
        if let container = try? decoder.container(keyedBy: CodingKeys.self) {
            name = (try? container.decode(LossyString.self, forKey: .name).value) ?? ""
        } else {
            name = (try? LossyString(from: decoder).value) ?? ""
        }
    }

    private enum CodingKeys: String, CodingKey {
        case name
    }
}

private struct LegacyPluginManifestInterface: Decodable {
    var displayName: LossyString?
    var shortDescription: LossyString?
    var developerName: LossyString?
    var category: LossyString?
    var capabilities: [LossyString]?
    var composerIcon: LossyString?
    var logo: LossyString?
    var brandColor: LossyString?
}

private struct LossyString: Codable, Hashable, Sendable {
    var value: String

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(String.self) {
            self.value = value
        } else if let value = try? container.decode(Int.self) {
            self.value = String(value)
        } else if let value = try? container.decode(Double.self) {
            self.value = String(value)
        } else if let value = try? container.decode(Bool.self) {
            self.value = String(value)
        } else {
            self.value = ""
        }
    }
}
