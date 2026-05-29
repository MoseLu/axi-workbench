import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func pluginLibraryDiscoversLocalPluginsAndState() throws {
    let fixture = try PluginLibraryFixture()
    defer { fixture.cleanup() }

    try fixture.writePlugin(
        id: "documents.local",
        displayName: "Documents",
        shortDescription: "Create and edit document artifacts",
        skills: ["documents"],
        mcp: true
    )
    try fixture.writePlugin(
        id: "unused.local",
        displayName: "Unused",
        shortDescription: "Should be disabled",
        skills: [],
        mcp: false
    )
    try fixture.library.setPluginEnabled("documents.local", enabled: true)

    let plugins = fixture.library.discoverPlugins()
    let documents = try #require(plugins.first(where: { $0.pluginID == "documents.local" }))
    let unused = try #require(plugins.first(where: { $0.pluginID == "unused.local" }))

    #expect(plugins.count == 2)
    #expect(documents.displayName == "Documents")
    #expect(documents.description == "Create and edit document artifacts")
    #expect(documents.skillCount == 1)
    #expect(documents.hasMCPServer)
    #expect(documents.isInstalled)
    #expect(documents.isEnabled)
    #expect(unused.isInstalled)
    #expect(!unused.isEnabled)
}

@Test
func pluginStateStorePersistsEnabledStates() throws {
    let fixture = try PluginLibraryFixture()
    defer { fixture.cleanup() }

    try fixture.writePlugin(
        id: "github.local",
        displayName: "GitHub",
        shortDescription: "Repository tools",
        skills: [],
        mcp: false
    )
    try fixture.library.setPluginEnabled("github.local", enabled: true)
    #expect(fixture.library.discoverPlugins().first?.isEnabled == true)

    try fixture.library.setPluginEnabled("github.local", enabled: false)
    #expect(fixture.library.discoverPlugins().first?.isEnabled == false)

    let config = fixture.stateStore.load()
    #expect(config.pluginEnabled["github.local"] == false)
    #expect(config.pluginOrder == ["github.local"])
}

private struct PluginLibraryFixture {
    let rootURL: URL
    let pluginsURL: URL
    let configURL: URL
    let stateStore: PluginStateStore
    let library: PluginLibrary

    init() throws {
        rootURL = FileManager.default.temporaryDirectory
            .appending(path: "ollama-menu-assistant-plugin-tests-\(UUID().uuidString)", directoryHint: .isDirectory)
        pluginsURL = rootURL.appending(path: "Plugins", directoryHint: .isDirectory)
        configURL = rootURL.appending(path: "runtime-config.json")
        stateStore = PluginStateStore(configURL: configURL)
        library = PluginLibrary(pluginsRootURL: pluginsURL, stateStore: stateStore)
        try FileManager.default.createDirectory(at: pluginsURL, withIntermediateDirectories: true)
    }

    func cleanup() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    func writePlugin(
        id: String,
        displayName: String,
        shortDescription: String,
        skills: [String],
        mcp: Bool
    ) throws {
        let pluginRoot = pluginsURL.appending(path: id, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: pluginRoot, withIntermediateDirectories: true)

        let manifest = LocalPluginManifest(
            id: id,
            displayName: displayName,
            description: shortDescription,
            version: "1.0.0",
            developerName: "Local",
            category: "Productivity",
            iconPath: "assets/logo.png",
            brandColor: "#2563EB",
            skillsPath: skills.isEmpty ? nil : "skills",
            appsPath: nil,
            mcpConfigPath: mcp ? "mcp.json" : nil,
            capabilityLabels: ["productivity"],
            source: "local"
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(manifest).write(to: pluginRoot.appending(path: "plugin.json"), options: .atomic)

        if mcp {
            try """
            {
              "mcpServers": {
                "fixture": {
                  "type": "http",
                  "url": "https://mcp.fixture.test/call"
                }
              }
            }
            """.write(to: pluginRoot.appending(path: "mcp.json"), atomically: true, encoding: .utf8)
        }

        for skill in skills {
            let skillDirectory = pluginRoot
                .appending(path: "skills", directoryHint: .isDirectory)
                .appending(path: skill, directoryHint: .isDirectory)
            try FileManager.default.createDirectory(at: skillDirectory, withIntermediateDirectories: true)
            try """
            ---
            name: \(skill)
            description: Test skill
            ---
            """.write(to: skillDirectory.appending(path: "SKILL.md"), atomically: true, encoding: .utf8)
        }
    }
}
