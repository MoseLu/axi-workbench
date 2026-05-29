import Foundation

enum ResponseContentSanitizer {
    private static let openingTag = "<think>"
    private static let closingTag = "</think>"

    static func sanitize(_ text: String) -> String {
        var result = text
        let hadThinkingMarkup = text.contains(openingTag) || text.contains(closingTag)

        while let start = result.range(of: openingTag) {
            if let end = result.range(of: closingTag, range: start.lowerBound..<result.endIndex) {
                result.removeSubrange(start.lowerBound..<end.upperBound)
            } else {
                result.removeSubrange(start.lowerBound..<result.endIndex)
                break
            }
        }

        let partialSuffixes = thinkTagPrefixes.filter { prefix in
            prefix.count < openingTag.count && result.hasSuffix(prefix)
        }
        if let partial = partialSuffixes.max(by: { $0.count < $1.count }) {
            result.removeLast(partial.count)
        }

        let partialClosingSuffixes = closingTagPrefixes.filter { prefix in
            prefix.count < closingTag.count && result.hasSuffix(prefix)
        }
        if let partial = partialClosingSuffixes.max(by: { $0.count < $1.count }) {
            result.removeLast(partial.count)
        }

        if hadThinkingMarkup {
            result = result.replacingOccurrences(
                of: #"^\s+"#,
                with: "",
                options: .regularExpression
            )
        }

        return result
    }

    private static let thinkTagPrefixes = openingTag.prefixes
    private static let closingTagPrefixes = closingTag.prefixes
}

private extension String {
    var prefixes: [String] {
        (1...count).map { String(prefix($0)) }
    }
}
