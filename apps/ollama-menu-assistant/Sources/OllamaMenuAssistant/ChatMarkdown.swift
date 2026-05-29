import Foundation

struct ChatMarkdownDocument: Equatable, Sendable {
    var blocks: [ChatMarkdownBlock]

    static func parse(_ text: String) -> ChatMarkdownDocument {
        var parser = ChatMarkdownParser(text: text)
        return ChatMarkdownDocument(blocks: parser.parse())
    }
}

enum ChatMarkdownBlock: Equatable, Sendable {
    case paragraph(String)
    case heading(level: Int, text: String)
    case unorderedList([ChatMarkdownListItem])
    case orderedList([ChatMarkdownListItem])
    case codeBlock(language: String?, code: String)
    case table(ChatMarkdownTable)
    case quote(String)
    case divider
}

struct ChatMarkdownListItem: Equatable, Sendable {
    var marker: String
    var text: String
    var depth: Int
}

struct ChatMarkdownTable: Equatable, Sendable {
    var headers: [String]
    var alignments: [ChatMarkdownTableAlignment]
    var rows: [[String]]
}

enum ChatMarkdownTableAlignment: Equatable, Sendable {
    case leading
    case center
    case trailing
}

enum AssistantDisplayContent {
    static func visibleText(from text: String) -> String {
        ChatMessageDisplayContent.visibleText(from: text)
    }
}

enum ChatMessageDisplayContent {
    static func visibleText(from text: String) -> String {
        stripDisplayArtifacts(from: text)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func visiblePreview(from text: String, maxCharacters: Int) -> String {
        guard maxCharacters > 0 else {
            return ""
        }

        let prefixSlice = text.prefix(maxCharacters)
        let wasTruncated = prefixSlice.endIndex != text.endIndex
        let prefix = String(prefixSlice)
        let preview = visibleText(from: prefix)
        guard wasTruncated else {
            return preview
        }
        return "\(preview)\n\n...\n[Message truncated for performance]"
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func stripDisplayArtifacts(from text: String) -> String {
        let lines = normalizedLines(from: text)
        var output: [String] = []
        var openFence: String?
        var suppressedTag: String?
        var isSuppressingImageBlock = false

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)

            if isSuppressingImageBlock {
                if trimmed.hasPrefix("</image>") {
                    isSuppressingImageBlock = false
                }
                continue
            }

            if let tag = suppressedTag {
                if trimmed.contains("</\(tag)>") {
                    suppressedTag = nil
                }
                continue
            }

            if let fence = openFence {
                output.append(line)
                if isClosingFence(line, marker: fence) {
                    openFence = nil
                }
                continue
            }

            if let fence = fenceMarker(in: line) {
                openFence = fence
                output.append(line)
                continue
            }

            if let imageLabel = imageBlockLabel(in: trimmed) {
                output.append(imageLabel)
                if !trimmed.contains("</image>") {
                    isSuppressingImageBlock = true
                }
                continue
            }

            if isInlineImagePayload(trimmed) {
                output.append("图片附件")
                continue
            }

            if let tag = internalBlockTag(in: trimmed) {
                if !trimmed.contains("</\(tag)>") {
                    suppressedTag = tag
                }
                continue
            }

            if isInternalDirective(trimmed) {
                continue
            }

            output.append(line)
        }

        return output.joined(separator: "\n")
    }

    private static func imageBlockLabel(in trimmedLine: String) -> String? {
        guard trimmedLine.hasPrefix("<image") else {
            return nil
        }

        if let nameRange = trimmedLine.range(of: #"name=\[([^\]]+)\]"#, options: .regularExpression) {
            let nameChunk = String(trimmedLine[nameRange])
                .replacingOccurrences(of: "name=[", with: "")
                .replacingOccurrences(of: "]", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !nameChunk.isEmpty {
                return "图片附件：\(nameChunk)"
            }
        }

        return "图片附件"
    }

    private static func isInlineImagePayload(_ trimmedLine: String) -> Bool {
        trimmedLine.hasPrefix("[Image: data:image/")
            || trimmedLine.hasPrefix("![")
                && trimmedLine.contains("](data:image/")
    }

    private static func internalBlockTag(in trimmedLine: String) -> String? {
        for tag in ["oai-mem-citation", "citation_entries", "rollout_ids"] where trimmedLine.hasPrefix("<\(tag)") {
            return tag
        }
        return nil
    }

    private static func isInternalDirective(_ trimmedLine: String) -> Bool {
        let names = [
            "archive",
            "code-comment",
            "git-commit",
            "git-create-branch",
            "git-create-pr",
            "git-push",
            "git-stage",
        ]
        return names.contains { name in
            trimmedLine.hasPrefix("::\(name){") && trimmedLine.hasSuffix("}")
        }
    }

    private static func normalizedLines(from text: String) -> [String] {
        text.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
    }

    private static func fenceMarker(in line: String) -> String? {
        let trimmed = line.trimmingLeadingWhitespace()
        if trimmed.hasPrefix("```") {
            return "```"
        }
        if trimmed.hasPrefix("~~~") {
            return "~~~"
        }
        return nil
    }

    private static func isClosingFence(_ line: String, marker: String) -> Bool {
        line.trimmingLeadingWhitespace().hasPrefix(marker)
    }
}

private struct ChatMarkdownParser {
    private var lines: [String]
    private var index = 0

    init(text: String) {
        lines = text.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
    }

    mutating func parse() -> [ChatMarkdownBlock] {
        var blocks: [ChatMarkdownBlock] = []

        while index < lines.count {
            if isBlank(lines[index]) {
                index += 1
                continue
            }

            if let block = parseCodeBlock() {
                blocks.append(block)
                continue
            }

            if let block = parseTable() {
                blocks.append(block)
                continue
            }

            if let block = parseList() {
                blocks.append(block)
                continue
            }

            if let block = parseHeading() {
                blocks.append(block)
                continue
            }

            if let block = parseQuote() {
                blocks.append(block)
                continue
            }

            if isDivider(lines[index]) {
                blocks.append(.divider)
                index += 1
                continue
            }

            blocks.append(parseParagraph())
        }

        return blocks
    }

    private mutating func parseCodeBlock() -> ChatMarkdownBlock? {
        guard let fence = Self.fenceStart(in: lines[index]) else {
            return nil
        }

        index += 1
        var codeLines: [String] = []
        while index < lines.count {
            if Self.isClosingFence(lines[index], marker: fence.marker) {
                index += 1
                break
            }
            codeLines.append(lines[index])
            index += 1
        }

        let language = fence.info.isEmpty ? nil : fence.info
        return .codeBlock(language: language, code: codeLines.joined(separator: "\n"))
    }

    private mutating func parseTable() -> ChatMarkdownBlock? {
        guard let table = tableAt(index) else {
            return nil
        }

        index = table.nextIndex
        return .table(table.value)
    }

    private mutating func parseList() -> ChatMarkdownBlock? {
        guard let first = Self.listItem(in: lines[index]) else {
            return nil
        }

        let ordered = first.isOrdered
        var items: [ChatMarkdownListItem] = []

        while index < lines.count {
            if isBlank(lines[index]) {
                break
            }

            guard let item = Self.listItem(in: lines[index]), item.isOrdered == ordered else {
                if let continuation = parseListContinuationLine(), !items.isEmpty {
                    items[items.count - 1].text += "\n" + continuation
                    index += 1
                    continue
                }
                break
            }

            items.append(ChatMarkdownListItem(marker: item.marker, text: item.text, depth: item.depth))
            index += 1
        }

        return ordered ? .orderedList(items) : .unorderedList(items)
    }

    private mutating func parseHeading() -> ChatMarkdownBlock? {
        let trimmed = lines[index].trimmingLeadingWhitespace()
        let level = trimmed.prefix { $0 == "#" }.count
        guard (1...6).contains(level) else {
            return nil
        }

        let afterHashes = trimmed.index(trimmed.startIndex, offsetBy: level)
        guard afterHashes < trimmed.endIndex, trimmed[afterHashes].isWhitespace else {
            return nil
        }

        let text = trimmed[afterHashes...].trimmingCharacters(in: .whitespacesAndNewlines)
        index += 1
        return .heading(level: level, text: text)
    }

    private mutating func parseQuote() -> ChatMarkdownBlock? {
        guard Self.quoteText(in: lines[index]) != nil else {
            return nil
        }

        var quoteLines: [String] = []
        while index < lines.count, let text = Self.quoteText(in: lines[index]) {
            quoteLines.append(text)
            index += 1
        }

        return .quote(quoteLines.joined(separator: "\n"))
    }

    private mutating func parseParagraph() -> ChatMarkdownBlock {
        var paragraphLines: [String] = []

        while index < lines.count, !isBlank(lines[index]), !startsBlock(at: index) {
            paragraphLines.append(lines[index].trimmingCharacters(in: .whitespacesAndNewlines))
            index += 1
        }

        return .paragraph(paragraphLines.joined(separator: "\n"))
    }

    private func parseListContinuationLine() -> String? {
        let line = lines[index]
        let leadingColumns = Self.leadingWhitespaceColumns(in: line)
        guard leadingColumns >= 2, !startsBlock(at: index) else {
            return nil
        }
        return line.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func startsBlock(at lineIndex: Int) -> Bool {
        Self.fenceStart(in: lines[lineIndex]) != nil
            || tableAt(lineIndex) != nil
            || Self.listItem(in: lines[lineIndex]) != nil
            || Self.heading(in: lines[lineIndex]) != nil
            || Self.quoteText(in: lines[lineIndex]) != nil
            || isDivider(lines[lineIndex])
    }

    private func tableAt(_ lineIndex: Int) -> (value: ChatMarkdownTable, nextIndex: Int)? {
        guard lineIndex + 1 < lines.count,
              Self.looksLikeTableRow(lines[lineIndex]),
              let alignments = Self.tableSeparator(in: lines[lineIndex + 1]) else {
            return nil
        }

        let headers = Self.normalizedTableCells(Self.splitTableRow(lines[lineIndex]), count: alignments.count)
        guard !headers.isEmpty else {
            return nil
        }

        var rowIndex = lineIndex + 2
        var rows: [[String]] = []
        while rowIndex < lines.count, Self.looksLikeTableRow(lines[rowIndex]) {
            rows.append(Self.normalizedTableCells(Self.splitTableRow(lines[rowIndex]), count: headers.count))
            rowIndex += 1
        }

        let table = ChatMarkdownTable(headers: headers, alignments: alignments, rows: rows)
        return (table, rowIndex)
    }

    private func isBlank(_ line: String) -> Bool {
        line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func isDivider(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 3 else {
            return false
        }
        let characters = Set(trimmed)
        return characters == ["-"] || characters == ["*"] || characters == ["_"]
    }

    private static func fenceStart(in line: String) -> (marker: String, info: String)? {
        let trimmed = line.trimmingLeadingWhitespace()
        if trimmed.hasPrefix("```") {
            return ("```", String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespacesAndNewlines))
        }
        if trimmed.hasPrefix("~~~") {
            return ("~~~", String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespacesAndNewlines))
        }
        return nil
    }

    private static func isClosingFence(_ line: String, marker: String) -> Bool {
        line.trimmingLeadingWhitespace().hasPrefix(marker)
    }

    private static func listItem(in line: String) -> (isOrdered: Bool, marker: String, text: String, depth: Int)? {
        let leadingColumns = leadingWhitespaceColumns(in: line)
        let trimmed = line.trimmingLeadingWhitespace()
        guard !trimmed.isEmpty else {
            return nil
        }

        if let first = trimmed.first, ["-", "*", "+"].contains(first) {
            let afterMarker = trimmed.index(after: trimmed.startIndex)
            guard afterMarker < trimmed.endIndex, trimmed[afterMarker].isWhitespace else {
                return nil
            }
            let text = trimmed[afterMarker...].trimmingCharacters(in: .whitespacesAndNewlines)
            return (false, "•", text, min(leadingColumns / 2, 4))
        }

        var digitEnd = trimmed.startIndex
        while digitEnd < trimmed.endIndex, trimmed[digitEnd].isNumber {
            digitEnd = trimmed.index(after: digitEnd)
        }
        guard digitEnd > trimmed.startIndex,
              digitEnd < trimmed.endIndex,
              trimmed[digitEnd] == "." || trimmed[digitEnd] == ")" else {
            return nil
        }

        let afterMarker = trimmed.index(after: digitEnd)
        guard afterMarker < trimmed.endIndex, trimmed[afterMarker].isWhitespace else {
            return nil
        }

        let marker = String(trimmed[trimmed.startIndex...digitEnd])
        let text = trimmed[afterMarker...].trimmingCharacters(in: .whitespacesAndNewlines)
        return (true, marker, text, min(leadingColumns / 2, 4))
    }

    private static func heading(in line: String) -> (level: Int, text: String)? {
        let trimmed = line.trimmingLeadingWhitespace()
        let level = trimmed.prefix { $0 == "#" }.count
        guard (1...6).contains(level) else {
            return nil
        }
        let afterHashes = trimmed.index(trimmed.startIndex, offsetBy: level)
        guard afterHashes < trimmed.endIndex, trimmed[afterHashes].isWhitespace else {
            return nil
        }
        return (level, trimmed[afterHashes...].trimmingCharacters(in: .whitespacesAndNewlines))
    }

    private static func quoteText(in line: String) -> String? {
        let trimmed = line.trimmingLeadingWhitespace()
        guard trimmed.hasPrefix(">") else {
            return nil
        }
        return trimmed.dropFirst().trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func looksLikeTableRow(_ line: String) -> Bool {
        line.contains("|")
    }

    private static func tableSeparator(in line: String) -> [ChatMarkdownTableAlignment]? {
        let cells = splitTableRow(line)
        guard !cells.isEmpty else {
            return nil
        }

        var alignments: [ChatMarkdownTableAlignment] = []
        for cell in cells {
            let normalized = cell.replacingOccurrences(of: " ", with: "")
            guard normalized.count >= 3,
                  normalized.allSatisfy({ $0 == ":" || $0 == "-" }),
                  normalized.contains("-") else {
                return nil
            }

            let leadingColon = normalized.hasPrefix(":")
            let trailingColon = normalized.hasSuffix(":")
            if leadingColon && trailingColon {
                alignments.append(.center)
            } else if trailingColon {
                alignments.append(.trailing)
            } else {
                alignments.append(.leading)
            }
        }

        return alignments
    }

    private static func splitTableRow(_ line: String) -> [String] {
        var value = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.first == "|" {
            value.removeFirst()
        }
        if value.last == "|" {
            value.removeLast()
        }

        var cells: [String] = []
        var current = ""
        var isEscaping = false

        for character in value {
            if isEscaping {
                current.append(character)
                isEscaping = false
            } else if character == "\\" {
                isEscaping = true
            } else if character == "|" {
                cells.append(current.trimmingCharacters(in: .whitespacesAndNewlines))
                current = ""
            } else {
                current.append(character)
            }
        }

        if isEscaping {
            current.append("\\")
        }
        cells.append(current.trimmingCharacters(in: .whitespacesAndNewlines))
        return cells
    }

    private static func normalizedTableCells(_ cells: [String], count: Int) -> [String] {
        if cells.count == count {
            return cells
        }
        if cells.count < count {
            return cells + Array(repeating: "", count: count - cells.count)
        }
        guard count > 1 else {
            return [cells.joined(separator: " | ")]
        }
        return Array(cells.prefix(count - 1)) + [cells.dropFirst(count - 1).joined(separator: " | ")]
    }

    private static func leadingWhitespaceColumns(in line: String) -> Int {
        var columns = 0
        for character in line {
            if character == " " {
                columns += 1
            } else if character == "\t" {
                columns += 4
            } else {
                break
            }
        }
        return columns
    }
}

private extension String {
    func trimmingLeadingWhitespace() -> String {
        guard let firstNonWhitespace = firstIndex(where: { !$0.isWhitespace }) else {
            return ""
        }
        return String(self[firstNonWhitespace...])
    }
}
