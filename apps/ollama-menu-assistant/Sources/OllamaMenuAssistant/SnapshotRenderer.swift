import AppKit
import SwiftUI

@MainActor
enum SnapshotRenderer {
    static func handleCommandLineIfNeeded() -> Bool {
        let arguments = CommandLine.arguments
        guard arguments.count >= 4, arguments[1] == "--snapshot" else {
            return false
        }

        guard let kind = SnapshotKind(rawValue: arguments[2]) else {
            fputs("Unknown snapshot kind: \(arguments[2])\n", stderr)
            Foundation.exit(2)
        }

        let outputURL = URL(fileURLWithPath: arguments[3])

        do {
            try render(kind: kind, to: outputURL)
            print(outputURL.path)
            Foundation.exit(0)
        } catch {
            fputs("Snapshot render failed: \(error.localizedDescription)\n", stderr)
            Foundation.exit(1)
        }
    }

    static func render(kind: SnapshotKind, to outputURL: URL) throws {
        let model = AppModel.snapshotPreview(kind: kind)
        let content = AssistantPanelView()
            .environmentObject(model)
            .frame(width: 1180, height: 780)

        let renderer = ImageRenderer(content: content)
        renderer.scale = 2

        guard let nsImage = renderer.nsImage,
              let tiff = nsImage.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            throw SnapshotError.encodingFailed
        }

        try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try png.write(to: outputURL, options: .atomic)
    }
}

private enum SnapshotError: LocalizedError {
    case encodingFailed

    var errorDescription: String? {
        switch self {
        case .encodingFailed:
            return LocalizedStrings.current()("无法把视图编码成 PNG。", "Could not encode the view as PNG.")
        }
    }
}
