import Foundation

final class LaunchAtLoginCoordinator {
    private enum Constants {
        static let defaultsKey = "launchAtLoginEnabled"
        static let agentLabel = "com.mose.OllamaMenuAssistant.login"
    }

    private let fileManager: FileManager
    private let defaults: UserDefaults

    init(fileManager: FileManager = .default, defaults: UserDefaults = .standard) {
        self.fileManager = fileManager
        self.defaults = defaults
    }

    func ensureDefaultEnabledIfNeeded() throws -> Bool {
        if defaults.object(forKey: Constants.defaultsKey) == nil {
            try setEnabled(true)
        }
        return isEnabled
    }

    var isEnabled: Bool {
        defaults.bool(forKey: Constants.defaultsKey) || fileManager.fileExists(atPath: launchAgentURL.path())
    }

    func setEnabled(_ enabled: Bool) throws {
        if enabled {
            try installLaunchAgent()
        } else {
            try removeLaunchAgent()
        }
        defaults.set(enabled, forKey: Constants.defaultsKey)
    }

    private func installLaunchAgent() throws {
        let plist = try launchAgentPlist()
        let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try fileManager.createDirectory(at: launchAgentURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: launchAgentURL, options: .atomic)
    }

    private func removeLaunchAgent() throws {
        if fileManager.fileExists(atPath: launchAgentURL.path()) {
            try fileManager.removeItem(at: launchAgentURL)
        }
    }

    private var launchAgentURL: URL {
        fileManager.homeDirectoryForCurrentUser
            .appending(path: "Library", directoryHint: .isDirectory)
            .appending(path: "LaunchAgents", directoryHint: .isDirectory)
            .appending(path: "\(Constants.agentLabel).plist")
    }

    private func launchAgentPlist() throws -> [String: Any] {
        let arguments: [String]
        if Bundle.main.bundlePath.hasSuffix(".app") {
            arguments = ["/usr/bin/open", "-gj", Bundle.main.bundlePath]
        } else if let executablePath = Bundle.main.executableURL?.path() {
            arguments = [executablePath]
        } else {
            throw OllamaError.missingExecutablePath
        }

        return [
            "Label": Constants.agentLabel,
            "ProgramArguments": arguments,
            "RunAtLoad": true,
            "KeepAlive": false,
            "ProcessType": "Interactive",
        ]
    }
}
