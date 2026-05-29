import Foundation

struct ContextWindowUsage: Equatable, Sendable {
    let modelDisplayName: String
    let usedTokens: Int
    let maxTokens: Int?

    var usedFraction: Double? {
        guard let maxTokens, maxTokens > 0 else {
            return nil
        }
        return min(1, Double(usedTokens) / Double(maxTokens))
    }

    var usedPercent: Int? {
        usedFraction.map { Int(($0 * 100).rounded()) }
    }
}

enum ContextWindowEstimator {
    static func makeUsage(
        model: ModelSummary,
        messages: [ChatMessage],
        draft: String,
        pendingAttachments: [MessageAttachment],
        project: ConversationProject?
    ) -> ContextWindowUsage {
        var tokenCount = 0

        for message in messages {
            tokenCount += 8
            tokenCount += estimatedTokens(in: message.role.rawValue)
            tokenCount += estimatedContentTokens(in: message.content)
            tokenCount += estimatedAttachmentTokens(message.attachments)
        }

        let trimmedDraft = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedDraft.isEmpty || !pendingAttachments.isEmpty {
            tokenCount += 8
            tokenCount += estimatedTokens(in: "user")
            tokenCount += estimatedContentTokens(in: trimmedDraft)
            tokenCount += estimatedAttachmentTokens(pendingAttachments)
        }

        if let project {
            tokenCount += estimatedProjectContextTokens(project)
        }

        return ContextWindowUsage(
            modelDisplayName: model.displayName,
            usedTokens: max(0, tokenCount),
            maxTokens: model.contextLength
        )
    }

    static func estimatedContentTokens(in text: String) -> Int {
        guard !text.isEmpty else {
            return 0
        }

        var tokens = 0
        var imageCount = 0
        var isSuppressingImageBlock = false
        var openFence: String?

        text.enumerateSubstrings(in: text.startIndex..<text.endIndex, options: [.byLines]) { substring, _, _, _ in
            guard let line = substring else {
                return
            }

            let lineSlice = line[...]
            let trimmed = trimmingWhitespace(in: lineSlice)

            if isSuppressingImageBlock {
                if trimmed.hasPrefix("</image>") {
                    isSuppressingImageBlock = false
                }
                return
            }

            if let fence = openFence {
                tokens += estimatedTokens(in: lineSlice)
                if isClosingFence(trimmed, marker: fence) {
                    openFence = nil
                }
                return
            }

            if let fence = fenceMarker(in: trimmed) {
                openFence = fence
                tokens += estimatedTokens(in: lineSlice)
                return
            }

            if trimmed.hasPrefix("<image") {
                tokens += estimatedTokens(in: "image attachment")
                imageCount += 1
                if !trimmed.contains("</image>") {
                    isSuppressingImageBlock = true
                }
                return
            }

            if isInlineImagePayload(trimmed) {
                tokens += estimatedTokens(in: "image attachment")
                imageCount += 1
                return
            }

            tokens += estimatedTokens(in: lineSlice)
        }

        return tokens + imageCount * imageTokenBudget
    }

    static func estimatedTokens(in text: String) -> Int {
        estimatedTokens(in: text[...])
    }

    private static func estimatedTokens(in text: Substring) -> Int {
        guard !text.isEmpty else {
            return 0
        }

        var tokens = 0
        var asciiRunLength = 0

        func flushASCII() {
            guard asciiRunLength > 0 else {
                return
            }
            tokens += max(1, Int(ceil(Double(asciiRunLength) / 4.0)))
            asciiRunLength = 0
        }

        for scalar in text.unicodeScalars {
            if CharacterSet.whitespacesAndNewlines.contains(scalar) {
                flushASCII()
            } else if scalar.value < 128 {
                asciiRunLength += 1
            } else {
                flushASCII()
                tokens += 1
            }
        }
        flushASCII()

        return max(1, tokens)
    }

    private static let imageTokenBudget = 512

    private static func isInlineImagePayload(_ trimmedLine: Substring) -> Bool {
        trimmedLine.hasPrefix("[Image: data:image/")
            || trimmedLine.hasPrefix("![")
                && trimmedLine.contains("](data:image/")
    }

    private static func fenceMarker(in trimmedLine: Substring) -> String? {
        if trimmedLine.hasPrefix("```") {
            return "```"
        }
        if trimmedLine.hasPrefix("~~~") {
            return "~~~"
        }
        return nil
    }

    private static func isClosingFence(_ trimmedLine: Substring, marker: String) -> Bool {
        trimmedLine.hasPrefix(marker)
    }

    private static func trimmingWhitespace(in line: Substring) -> Substring {
        var start = line.startIndex
        var end = line.endIndex

        while start < end, line[start].isWhitespace {
            start = line.index(after: start)
        }

        while start < end {
            let previous = line.index(before: end)
            guard line[previous].isWhitespace else {
                break
            }
            end = previous
        }

        return line[start..<end]
    }

    private static func estimatedAttachmentTokens(_ attachments: [MessageAttachment]) -> Int {
        var textPreviewBudget: Int64 = 24_000
        var tokens = 0

        for attachment in attachments {
            tokens += estimatedTokens(in: attachment.name)
            switch attachment.kind {
            case .text:
                guard textPreviewBudget > 0 else {
                    continue
                }
                let previewBytes = min(8_000, min(attachment.byteCount, textPreviewBudget))
                textPreviewBudget -= previewBytes
                tokens += Int(ceil(Double(previewBytes) / 4.0))
            case .image:
                tokens += imageTokenBudget
            case .file:
                tokens += 12
            }
        }

        return tokens
    }

    private static func estimatedProjectContextTokens(_ project: ConversationProject) -> Int {
        var tokens = 64
        tokens += estimatedTokens(in: project.name)
        if let path = project.path {
            tokens += estimatedTokens(in: path)
        }
        return tokens
    }
}
