import Foundation

struct PluginSummary: Identifiable, Codable, Hashable, Sendable {
    var id: String { pluginID }

    var pluginID: String
    var name: String
    var displayName: String
    var description: String
    var developerName: String
    var category: String
    var version: String
    var marketplace: String
    var rootPath: String
    var iconPath: String?
    var brandColorHex: String?
    var mcpConfigPath: String?
    var skillCount: Int
    var hasApp: Bool
    var hasMCPServer: Bool
    var isInstalled: Bool
    var isEnabled: Bool
    var capabilityLabels: [String]

    var iconURL: URL? {
        iconPath.map { URL(fileURLWithPath: $0) }
    }
}

struct LocalPluginManifest: Codable, Hashable, Sendable {
    var id: String
    var displayName: String
    var description: String
    var version: String
    var developerName: String
    var category: String
    var iconPath: String?
    var brandColor: String?
    var skillsPath: String?
    var appsPath: String?
    var mcpConfigPath: String?
    var capabilityLabels: [String]
    var source: String?
}

struct PluginStateStore: Sendable {
    var configURL: URL

    func load() -> RuntimePluginConfig {
        guard let data = try? Data(contentsOf: configURL),
              let config = try? JSONDecoder().decode(RuntimePluginConfig.self, from: data) else {
            return RuntimePluginConfig()
        }
        return config
    }

    func save(_ config: RuntimePluginConfig) throws {
        try FileManager.default.createDirectory(at: configURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(config)
        try data.write(to: configURL, options: .atomic)
    }

    func setPluginEnabled(_ pluginID: String, enabled: Bool) throws {
        var config = load()
        config.pluginEnabled[pluginID] = enabled
        if !config.pluginOrder.contains(pluginID) {
            config.pluginOrder.append(pluginID)
        }
        try save(config)
    }

    func mergeEnabledStates(_ enabledByID: [String: Bool]) throws {
        guard !enabledByID.isEmpty else {
            return
        }
        var config = load()
        for pluginID in enabledByID.keys.sorted() {
            config.pluginEnabled[pluginID] = enabledByID[pluginID] ?? false
            if !config.pluginOrder.contains(pluginID) {
                config.pluginOrder.append(pluginID)
            }
        }
        try save(config)
    }
}

struct RuntimePluginConfig: Codable, Hashable, Sendable {
    var pluginEnabled: [String: Bool] = [:]
    var pluginOrder: [String] = []
}

struct PluginLibrary: Sendable {
    var pluginsRootURL: URL
    var stateStore: PluginStateStore

    static func `default`() -> PluginLibrary {
        Self.default(paths: .default())
    }

    static func `default`(paths: AppDataPaths) -> PluginLibrary {
        PluginLibrary(
            pluginsRootURL: paths.pluginsURL,
            stateStore: PluginStateStore(configURL: paths.runtimeConfigURL)
        )
    }

    func discoverPlugins(limit: Int = 200) -> [PluginSummary] {
        let config = stateStore.load()
        let order = Dictionary(uniqueKeysWithValues: config.pluginOrder.enumerated().map { ($1, $0) })
        let manifestURLs = findPluginManifestURLs(limit: limit)

        return manifestURLs
            .compactMap { parsePluginManifest(at: $0, config: config) }
            .sorted { lhs, rhs in
                if let lhsOrder = order[lhs.pluginID],
                   let rhsOrder = order[rhs.pluginID] {
                    return lhsOrder < rhsOrder
                }
                if lhs.isEnabled != rhs.isEnabled {
                    return lhs.isEnabled && !rhs.isEnabled
                }
                return lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
            }
    }

    func setPluginEnabled(_ pluginID: String, enabled: Bool) throws {
        try stateStore.setPluginEnabled(pluginID, enabled: enabled)
    }

    private func findPluginManifestURLs(limit: Int) -> [URL] {
        guard FileManager.default.fileExists(atPath: pluginsRootURL.path),
              let children = try? FileManager.default.contentsOfDirectory(
                at: pluginsRootURL,
                includingPropertiesForKeys: [.isDirectoryKey],
                options: [.skipsHiddenFiles]
              ) else {
            return []
        }

        return children
            .filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true }
            .map { $0.appending(path: "plugin.json") }
            .filter { FileManager.default.fileExists(atPath: $0.path) }
            .prefix(limit)
            .map { $0 }
    }

    private func parsePluginManifest(at manifestURL: URL, config: RuntimePluginConfig) -> PluginSummary? {
        guard let data = try? Data(contentsOf: manifestURL),
              let manifest = try? JSONDecoder().decode(LocalPluginManifest.self, from: data) else {
            return nil
        }

        let pluginRootURL = manifestURL.deletingLastPathComponent().standardizedFileURL
        let pluginID = manifest.id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !pluginID.isEmpty else {
            return nil
        }

        let skillsURL = resolveRelativePath(manifest.skillsPath, from: pluginRootURL)
        let appsURL = resolveRelativePath(manifest.appsPath, from: pluginRootURL)
        let mcpURL = resolveRelativePath(manifest.mcpConfigPath, from: pluginRootURL)
        let iconURL = resolveRelativePath(manifest.iconPath, from: pluginRootURL)

        return PluginSummary(
            pluginID: pluginID,
            name: pluginID,
            displayName: manifest.displayName.isEmpty ? pluginID : manifest.displayName,
            description: manifest.description,
            developerName: manifest.developerName,
            category: manifest.category,
            version: manifest.version,
            marketplace: manifest.source ?? "local",
            rootPath: pluginRootURL.path,
            iconPath: iconURL?.path,
            brandColorHex: manifest.brandColor,
            mcpConfigPath: mcpURL?.path,
            skillCount: countSkillFiles(in: skillsURL),
            hasApp: fileExists(at: appsURL),
            hasMCPServer: fileExists(at: mcpURL),
            isInstalled: true,
            isEnabled: config.pluginEnabled[pluginID] ?? false,
            capabilityLabels: manifest.capabilityLabels
        )
    }

    private func resolveRelativePath(_ value: String?, from rootURL: URL) -> URL? {
        guard var value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            return nil
        }
        if value.hasPrefix("./") {
            value.removeFirst(2)
        }
        if value.hasPrefix("/") {
            return URL(fileURLWithPath: value)
        }
        return rootURL.appending(path: value)
    }

    private func countSkillFiles(in rootURL: URL?) -> Int {
        guard let rootURL,
              FileManager.default.fileExists(atPath: rootURL.path),
              let enumerator = FileManager.default.enumerator(
                at: rootURL,
                includingPropertiesForKeys: [.isRegularFileKey],
                options: [.skipsPackageDescendants, .skipsHiddenFiles]
              ) else {
            return 0
        }

        var count = 0
        for case let url as URL in enumerator where url.lastPathComponent == "SKILL.md" {
            count += 1
        }
        return count
    }

    private func fileExists(at url: URL?) -> Bool {
        guard let url else {
            return false
        }
        return FileManager.default.fileExists(atPath: url.path)
    }
}
