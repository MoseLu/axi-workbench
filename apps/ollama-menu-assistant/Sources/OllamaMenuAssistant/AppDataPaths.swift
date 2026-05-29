import Foundation

struct AppDataPaths: Sendable {
    var rootURL: URL

    static func `default`(
        fileManager: FileManager = .default
    ) -> AppDataPaths {
        let baseURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return AppDataPaths(rootURL: baseURL.appending(path: "OllamaMenuAssistant", directoryHint: .isDirectory))
    }

    var pluginsURL: URL {
        rootURL.appending(path: "Plugins", directoryHint: .isDirectory)
    }

    var skillsURL: URL {
        rootURL.appending(path: "Skills", directoryHint: .isDirectory)
    }

    var petsURL: URL {
        rootURL.appending(path: "Pets", directoryHint: .isDirectory)
    }

    var automationsURL: URL {
        rootURL.appending(path: "Automations", directoryHint: .isDirectory)
    }

    var runtimeConfigURL: URL {
        rootURL.appending(path: "runtime-config.json")
    }

    var configTomlURL: URL {
        rootURL.appending(path: "config.toml")
    }

    var memoriesURL: URL {
        rootURL.appending(path: "Memories", directoryHint: .isDirectory)
    }

    var migrationStateURL: URL {
        rootURL.appending(path: "migration-state.json")
    }

    func createBaseDirectories(fileManager: FileManager = .default) throws {
        try fileManager.createDirectory(at: rootURL, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: pluginsURL, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: skillsURL, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: petsURL, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: automationsURL, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: memoriesURL, withIntermediateDirectories: true)
    }
}
