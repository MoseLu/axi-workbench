import AppKit
import Foundation

enum DefaultEditorTarget: String, CaseIterable, Identifiable {
    case finder
    case terminal
    case xcode

    static let storageKey = AppPreferenceKeys.Settings.defaultOpenTarget

    var id: String { rawValue }

    init(storedValue: String?) {
        let normalized = (storedValue ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        switch normalized {
        case "terminal", "终端":
            self = .terminal
        case "xcode":
            self = .xcode
        case "finder", "访达", "default app", "defaultapp", "default":
            self = .finder
        default:
            self = .finder
        }
    }

    func title(language _: AppLanguage) -> String {
        switch self {
        case .finder:
            "Finder"
        case .terminal:
            "Terminal"
        case .xcode:
            "Xcode"
        }
    }

    var fallbackSystemName: String {
        switch self {
        case .finder:
            "folder"
        case .terminal:
            "terminal"
        case .xcode:
            "hammer"
        }
    }

    var iconImage: NSImage? {
        guard let url = applicationURL else {
            return nil
        }
        return NSWorkspace.shared.icon(forFile: url.path)
    }

    @discardableResult
    func open(_ url: URL) -> Bool {
        switch self {
        case .finder:
            NSWorkspace.shared.activateFileViewerSelecting([url])
            return true
        case .terminal:
            return openWithApplication(directoryURL(for: url))
        case .xcode:
            return openWithApplication(url) || NSWorkspace.shared.open(url)
        }
    }

    private var applicationURL: URL? {
        switch self {
        case .finder:
            return URL(fileURLWithPath: "/System/Library/CoreServices/Finder.app")
        case .terminal:
            return NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Terminal")
                ?? existingApplicationURL(at: "/System/Applications/Utilities/Terminal.app")
                ?? existingApplicationURL(at: "/Applications/Utilities/Terminal.app")
        case .xcode:
            return NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.dt.Xcode")
                ?? existingApplicationURL(at: "/Applications/Xcode.app")
        }
    }

    private func openWithApplication(_ url: URL) -> Bool {
        guard let applicationURL else {
            return false
        }

        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        NSWorkspace.shared.open([url], withApplicationAt: applicationURL, configuration: configuration)
        return true
    }

    private func existingApplicationURL(at path: String) -> URL? {
        FileManager.default.fileExists(atPath: path) ? URL(fileURLWithPath: path) : nil
    }

    private func directoryURL(for url: URL) -> URL {
        var isDirectory: ObjCBool = false
        if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory),
           isDirectory.boolValue {
            return url
        }
        return url.deletingLastPathComponent()
    }
}
