import CoreGraphics
import Foundation

struct DesktopWindowSnapshot: Equatable {
    var ownerName: String
    var windowName: String
    var layer: Int
    var bounds: CGRect
}

enum DesktopClickPolicy {
    static let transparentOwners: Set<String> = [
        "Ollama Pet Runner",
        "OllamaPetRunner",
        "Window Server",
    ]

    static let systemUIOwners: Set<String> = [
        "Dock",
        "Control Center",
        "SystemUIServer",
    ]

    static func shouldHandleDesktopClick(
        at point: CGPoint,
        visibleFrame: CGRect? = nil,
        windows: [DesktopWindowSnapshot]
    ) -> Bool {
        if let visibleFrame, !visibleFrame.contains(point) {
            return false
        }

        return !windows.contains { window in
            guard window.bounds.width > 8, window.bounds.height > 8 else {
                return false
            }
            guard window.bounds.contains(point) else {
                return false
            }
            if systemUIOwners.contains(window.ownerName) {
                return true
            }
            guard window.layer == 0 else {
                return false
            }
            guard !transparentOwners.contains(window.ownerName) else {
                return false
            }
            if window.ownerName == "Finder", window.windowName.localizedCaseInsensitiveContains("desktop") {
                return false
            }
            return true
        }
    }
}
