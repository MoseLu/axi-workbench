import Foundation

struct ChatDisplayInvocation: Hashable, Sendable {
    enum Kind: Hashable, Sendable {
        case plugin
        case skill
    }

    var kind: Kind
    var name: String
}

struct ChatDisplayText: Hashable, Sendable {
    var invocations: [ChatDisplayInvocation]
    var body: String

    var titleSource: String {
        let trimmedBody = body.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedBody.isEmpty {
            return trimmedBody
        }
        return invocations.first?.name ?? ""
    }

    static func parse(_ text: String, skills: [SkillSummary] = []) -> ChatDisplayText {
        var remaining = text
        var invocations: [ChatDisplayInvocation] = []

        while true {
            let trimmed = remaining.trimmingLeadingWhitespaceAndNewlines()

            if let match = parsePluginPrefix(in: trimmed) {
                invocations.append(ChatDisplayInvocation(kind: .plugin, name: match.name))
                remaining = match.remaining
                continue
            }

            if let match = parseSkillPrefix(in: trimmed, skills: skills) {
                invocations.append(ChatDisplayInvocation(kind: .skill, name: match.name))
                remaining = match.remaining
                continue
            }

            remaining = trimmed
            break
        }

        let extracted = extractInvocationOnlyLines(from: remaining, skills: skills)
        invocations.append(contentsOf: extracted.invocations)
        return ChatDisplayText(invocations: invocations, body: extracted.body.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    static func titleText(from text: String, skills: [SkillSummary] = []) -> String {
        parse(text, skills: skills).titleSource
    }

    private static func parsePluginPrefix(in text: String) -> (name: String, remaining: String)? {
        guard text.hasPrefix("[@") else {
            return nil
        }

        let afterMarker = text.index(text.startIndex, offsetBy: 2)
        guard let closingBracket = text[afterMarker...].firstIndex(of: "]") else {
            return nil
        }

        let name = String(text[afterMarker..<closingBracket]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            return nil
        }

        let afterBracket = text.index(after: closingBracket)
        guard text[afterBracket...].hasPrefix("(plugin://") else {
            return nil
        }

        if let closingParen = text[afterBracket...].firstIndex(of: ")") {
            let remainingStart = text.index(after: closingParen)
            return (name, String(text[remainingStart...]))
        }

        let firstBoundary = text[afterBracket...].firstIndex(where: \.isWhitespace) ?? text.endIndex
        return (name, String(text[firstBoundary...]))
    }

    private static func parseSkillPrefix(in text: String, skills: [SkillSummary]) -> (name: String, remaining: String)? {
        guard let marker = text.first, marker == "/" || marker == "$" else {
            return nil
        }

        let commandStart = text.index(after: text.startIndex)
        guard commandStart < text.endIndex else {
            return nil
        }

        let commandEnd = text[commandStart...].firstIndex(where: \.isWhitespace) ?? text.endIndex
        let command = String(text[commandStart..<commandEnd])
        guard isLikelySkillCommand(command, skills: skills) else {
            return nil
        }

        let displayName = skills.first(where: { matchesSkill($0, command: command) })?.name ?? command
        return (displayName, String(text[commandEnd...]))
    }

    private static func extractInvocationOnlyLines(
        from text: String,
        skills: [SkillSummary]
    ) -> (invocations: [ChatDisplayInvocation], body: String) {
        var invocations: [ChatDisplayInvocation] = []
        var bodyLines: [String] = []

        for line in text.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                bodyLines.append(line)
                continue
            }

            if let parsed = parseInvocationOnlyLine(trimmed, skills: skills) {
                invocations.append(contentsOf: parsed)
            } else {
                bodyLines.append(line)
            }
        }

        return (invocations, bodyLines.joined(separator: "\n"))
    }

    private static func parseInvocationOnlyLine(
        _ line: String,
        skills: [SkillSummary]
    ) -> [ChatDisplayInvocation]? {
        var remaining = line
        var invocations: [ChatDisplayInvocation] = []

        while true {
            let trimmed = remaining.trimmingLeadingWhitespaceAndNewlines()
            if trimmed.isEmpty {
                return invocations.isEmpty ? nil : invocations
            }

            if let match = parsePluginPrefix(in: trimmed) {
                invocations.append(ChatDisplayInvocation(kind: .plugin, name: match.name))
                remaining = match.remaining
                continue
            }

            if let match = parseSkillPrefix(in: trimmed, skills: skills) {
                invocations.append(ChatDisplayInvocation(kind: .skill, name: match.name))
                remaining = match.remaining
                continue
            }

            return nil
        }
    }

    private static func isLikelySkillCommand(_ command: String, skills: [SkillSummary]) -> Bool {
        guard !command.isEmpty,
              command.range(of: #"^[A-Za-z][A-Za-z0-9._-]*$"#, options: .regularExpression) != nil else {
            return false
        }

        if skills.isEmpty {
            return true
        }
        return skills.contains(where: { matchesSkill($0, command: command) })
    }

    private static func matchesSkill(_ skill: SkillSummary, command: String) -> Bool {
        let normalized = command.lowercased()
        return skill.name.lowercased() == normalized
            || skill.directoryPath.lowercased() == normalized
            || skill.relativePath.lowercased() == normalized
            || skill.relativePath.lowercased().hasSuffix("/\(normalized)/SKILL.md")
    }
}

private extension String {
    func trimmingLeadingWhitespaceAndNewlines() -> String {
        guard let firstNonWhitespace = firstIndex(where: { !$0.isWhitespace }) else {
            return ""
        }
        return String(self[firstNonWhitespace...])
    }
}
