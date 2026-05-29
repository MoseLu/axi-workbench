import Foundation

struct WorkspaceFileReference: Hashable, Sendable {
    var path: String
    var line: Int?
    var column: Int?

    var id: String {
        navigationTarget
    }

    var displayName: String {
        URL(fileURLWithPath: path).lastPathComponent
    }

    var locationText: String? {
        guard let line else {
            return nil
        }
        if let column {
            return "line \(line):\(column)"
        }
        return "line \(line)"
    }

    var navigationTarget: String {
        guard let line else {
            return path
        }
        if let column {
            return "\(path):\(line):\(column)"
        }
        return "\(path):\(line)"
    }
}

enum WorkspaceFileReferenceInlineSegment: Equatable, Sendable {
    case text(String)
    case reference(WorkspaceFileReference)
}

enum WorkspaceFileReferenceInlineParser {
    static func segments(in text: String, projectRootPath: String?) -> [WorkspaceFileReferenceInlineSegment] {
        guard projectRootPath?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false else {
            return [.text(text)]
        }

        let matches = markdownLinkMatches(in: text)
        guard !matches.isEmpty else {
            return plainSegments(in: text, projectRootPath: projectRootPath)
        }

        var segments: [WorkspaceFileReferenceInlineSegment] = []
        var cursor = text.startIndex

        for match in matches {
            guard let fullRange = Range(match.range, in: text),
                  let targetRange = Range(match.range(at: 2), in: text) else {
                continue
            }

            appendPlainText(String(text[cursor..<fullRange.lowerBound]), to: &segments, projectRootPath: projectRootPath)

            let matchedText = String(text[fullRange])
            let target = String(text[targetRange])
            if !matchedText.hasPrefix("!"),
               let reference = WorkspacePathLinkExtractor.reference(from: target, projectRootPath: projectRootPath) {
                segments.append(.reference(reference))
            } else {
                appendText(matchedText, to: &segments)
            }

            cursor = fullRange.upperBound
        }

        appendPlainText(String(text[cursor...]), to: &segments, projectRootPath: projectRootPath)
        return segments.isEmpty ? [.text(text)] : segments
    }

    private static func markdownLinkMatches(in text: String) -> [NSTextCheckingResult] {
        let pattern = #"!?\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return []
        }
        return regex.matches(in: text, range: NSRange(text.startIndex..<text.endIndex, in: text))
    }

    private static func plainSegments(
        in text: String,
        projectRootPath: String?
    ) -> [WorkspaceFileReferenceInlineSegment] {
        let extensionPattern = WorkspacePathLinkExtractor.supportedFileExtensionPattern
        let pattern = #"(^|[^A-Za-z0-9_@+./-])(`?(?:(?:/|\./)?[A-Za-z0-9_@+.-]+/)*[A-Za-z0-9_@+.-]+\.(?:"# + extensionPattern + #")(?::(\d+)(?::(\d+))?)?(?:\s+\((?:line|Line|LINE|行)\s+(\d+)(?::(\d+))?\))?`?)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return [.text(text)]
        }

        var segments: [WorkspaceFileReferenceInlineSegment] = []
        var cursor = text.startIndex
        let matches = regex.matches(in: text, range: NSRange(text.startIndex..<text.endIndex, in: text))

        for match in matches {
            guard let referenceRange = Range(match.range(at: 2), in: text) else {
                continue
            }
            let rawReference = String(text[referenceRange])
            guard let reference = WorkspacePathLinkExtractor.reference(from: rawReference, projectRootPath: projectRootPath) else {
                continue
            }

            appendText(String(text[cursor..<referenceRange.lowerBound]), to: &segments)
            segments.append(.reference(reference))
            cursor = referenceRange.upperBound
        }

        appendText(String(text[cursor...]), to: &segments)
        return segments.isEmpty ? [.text(text)] : segments
    }

    private static func appendPlainText(
        _ text: String,
        to segments: inout [WorkspaceFileReferenceInlineSegment],
        projectRootPath: String?
    ) {
        for segment in plainSegments(in: text, projectRootPath: projectRootPath) {
            switch segment {
            case .text(let value):
                appendText(value, to: &segments)
            case .reference:
                segments.append(segment)
            }
        }
    }

    private static func appendText(
        _ text: String,
        to segments: inout [WorkspaceFileReferenceInlineSegment]
    ) {
        guard !text.isEmpty else {
            return
        }

        if case .text(let previous) = segments.last {
            segments[segments.count - 1] = .text(previous + text)
        } else {
            segments.append(.text(text))
        }
    }
}
