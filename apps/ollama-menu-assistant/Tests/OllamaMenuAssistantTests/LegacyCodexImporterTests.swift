import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func legacyCodexImporterCopiesResourcesOnceIntoAssistantDataPaths() throws {
    let fixture = try LegacyImportFixture()
    defer { fixture.cleanup() }
    try fixture.writeLegacyResources()

    let legacyConfigBefore = try String(contentsOf: fixture.legacyRootURL.appending(path: "config.toml"), encoding: .utf8)
    let state = try LegacyCodexImporter(paths: fixture.paths, legacyRootURL: fixture.legacyRootURL).runIfNeeded()

    #expect(state.completed)
    #expect(state.importedCounts["skills"] == 1)
    #expect(state.importedCounts["pets"] == 1)
    #expect(state.importedCounts["automations"] == 1)
    #expect(state.importedCounts["plugins"] == 1)
    #expect(FileManager.default.fileExists(atPath: fixture.paths.skillsURL.appending(path: "diagnose/SKILL.md").path))
    #expect(FileManager.default.fileExists(atPath: fixture.paths.petsURL.appending(path: "miku/pet.json").path))
    #expect(FileManager.default.fileExists(atPath: fixture.paths.automationsURL.appending(path: "daily/automation.toml").path))

    let plugins = PluginLibrary.default(paths: fixture.paths).discoverPlugins()
    let plugin = try #require(plugins.first(where: { $0.pluginID == "fixture-plugin@local-market" }))
    #expect(plugin.marketplace == "imported")
    #expect(plugin.displayName == "Fixture Plugin")
    #expect(plugin.skillCount == 1)
    #expect(plugin.hasMCPServer)
    #expect(plugin.isEnabled)
    #expect(PluginStateStore(configURL: fixture.paths.runtimeConfigURL).load().pluginEnabled[plugin.pluginID] == true)

    let legacyConfigAfter = try String(contentsOf: fixture.legacyRootURL.appending(path: "config.toml"), encoding: .utf8)
    #expect(legacyConfigAfter == legacyConfigBefore)

    try FileManager.default.createDirectory(
        at: fixture.legacyRootURL.appending(path: "skills/late", directoryHint: .isDirectory),
        withIntermediateDirectories: true
    )
    try "late".write(to: fixture.legacyRootURL.appending(path: "skills/late/SKILL.md"), atomically: true, encoding: .utf8)
    try FileManager.default.createDirectory(
        at: fixture.legacyRootURL.appending(path: "pets/late-pet", directoryHint: .isDirectory),
        withIntermediateDirectories: true
    )
    try """
    {
      "id": "late-pet",
      "displayName": "Late Pet",
      "spritesheetPath": "spritesheet.webp"
    }
    """.write(to: fixture.legacyRootURL.appending(path: "pets/late-pet/pet.json"), atomically: true, encoding: .utf8)
    _ = try LegacyCodexImporter(paths: fixture.paths, legacyRootURL: fixture.legacyRootURL).runIfNeeded()
    #expect(!FileManager.default.fileExists(atPath: fixture.paths.skillsURL.appending(path: "late/SKILL.md").path))
    #expect(FileManager.default.fileExists(atPath: fixture.paths.petsURL.appending(path: "late-pet/pet.json").path))
}

private struct LegacyImportFixture {
    let rootURL: URL
    let paths: AppDataPaths
    let legacyRootURL: URL

    init() throws {
        rootURL = FileManager.default.temporaryDirectory
            .appending(path: "OllamaMenuAssistantLegacyImport-\(UUID().uuidString)", directoryHint: .isDirectory)
        paths = AppDataPaths(rootURL: rootURL.appending(path: "AppSupport", directoryHint: .isDirectory))
        legacyRootURL = rootURL.appending(path: ".codex", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: legacyRootURL, withIntermediateDirectories: true)
    }

    func cleanup() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    func writeLegacyResources() throws {
        try writeText("skill", to: legacyRootURL.appending(path: "skills/diagnose/SKILL.md"))
        try writeText(#"{"id":"miku","displayName":"Miku","spritesheetPath":"spritesheet.webp"}"#, to: legacyRootURL.appending(path: "pets/miku/pet.json"))
        try writeText("name = \"Daily\"", to: legacyRootURL.appending(path: "automations/daily/automation.toml"))
        try writeText(
            """
            [plugins."fixture-plugin@local-market"]
            enabled = true
            """,
            to: legacyRootURL.appending(path: "config.toml")
        )

        let pluginRoot = legacyRootURL
            .appending(path: "plugins/cache/local-market/fixture-plugin/0.1.0", directoryHint: .isDirectory)
        try writeText("plugin skill", to: pluginRoot.appending(path: "skills/fixture/SKILL.md"))
        try writeText(
            """
            {
              "mcpServers": {
                "fixture": {
                  "type": "http",
                  "url": "https://mcp.fixture.test/call"
                }
              }
            }
            """,
            to: pluginRoot.appending(path: "mcp.json")
        )
        try writeText(
            """
            {
              "name": "fixture-plugin",
              "version": "0.1.0",
              "description": "Legacy fixture plugin",
              "author": { "name": "Fixture Dev" },
              "skills": "skills",
              "mcpServers": "mcp.json",
              "interface": {
                "displayName": "Fixture Plugin",
                "shortDescription": "Imported fixture",
                "developerName": "Fixture Dev",
                "category": "Testing",
                "brandColor": "#2563EB",
                "capabilities": ["testing"]
              }
            }
            """,
            to: pluginRoot.appending(path: ".codex-plugin/plugin.json")
        )
    }

    private func writeText(_ text: String, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try text.write(to: url, atomically: true, encoding: .utf8)
    }
}
