import Foundation

struct SlashCommandInvocation: Hashable, Sendable {
    var skill: SkillSummary
    var request: String
}

struct SlashCommandParser {
    static func parse(_ text: String, skills: [SkillSummary]) -> SlashCommandInvocation? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix("/") else {
            return nil
        }

        let withoutSlash = trimmed.dropFirst()
        let parts = withoutSlash.split(maxSplits: 1, whereSeparator: \.isWhitespace)
        guard let command = parts.first else {
            return nil
        }

        let commandText = String(command).lowercased()
        guard let skill = skills.first(where: { matches($0, command: commandText) }) else {
            return nil
        }

        let request = parts.dropFirst().first.map(String.init) ?? ""
        return SlashCommandInvocation(skill: skill, request: request.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    private static func matches(_ skill: SkillSummary, command: String) -> Bool {
        skill.name.lowercased() == command
            || skill.directoryPath.lowercased() == command
            || skill.relativePath.lowercased() == command
            || skill.relativePath.lowercased().hasSuffix("/\(command)/SKILL.md")
    }
}
