import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func defaultRuntimePathsUseAssistantApplicationSupport() {
    let paths = AppDataPaths.default()
    let legacyDotDirectory = ".co" + "dex"

    #expect(paths.rootURL.path.contains("Library/Application Support/OllamaMenuAssistant"))
    #expect(paths.pluginsURL.lastPathComponent == "Plugins")
    #expect(paths.skillsURL.lastPathComponent == "Skills")
    #expect(paths.petsURL.lastPathComponent == "Pets")
    #expect(paths.automationsURL.lastPathComponent == "Automations")
    #expect(paths.memoriesURL.lastPathComponent == "Memories")
    #expect(paths.configTomlURL.lastPathComponent == "config.toml")
    #expect(paths.runtimeConfigURL.lastPathComponent == "runtime-config.json")
    #expect(paths.migrationStateURL.lastPathComponent == "migration-state.json")
    #expect(!paths.rootURL.path.contains(legacyDotDirectory))
    #expect(!AutomationStore.defaultRootURL.path.contains(legacyDotDirectory))
    #expect(!PetCatalog.defaultRootDirectory.path.contains(legacyDotDirectory))
}

@Test
func assistantSkillLibraryIncludesOwnLocalSkillsDirectory() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "OllamaMenuAssistantPathTests-\(UUID().uuidString)", directoryHint: .isDirectory)
    defer {
        try? FileManager.default.removeItem(at: root)
    }

    let paths = AppDataPaths(rootURL: root)
    try paths.createBaseDirectories()
    let library = try #require(SkillLibrary.default(paths: paths))
    let legacyDotDirectory = ".co" + "dex"

    #expect(library.rootURLs.contains(paths.skillsURL))
    #expect(library.rootURLs.allSatisfy { !$0.path.contains(legacyDotDirectory) })
}
