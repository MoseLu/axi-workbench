import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func slashCommandParserMatchesSkillByNameAndKeepsRequest() throws {
    let skills = [
        SkillSummary(
            name: "diagnose",
            description: "Disciplined debugging",
            relativePath: "matt-pocock-skills/references/upstream/skills/engineering/diagnose/SKILL.md"
        ),
    ]

    let invocation = try #require(SlashCommandParser.parse("/diagnose 继续分析启动失败", skills: skills))

    #expect(invocation.skill.name == "diagnose")
    #expect(invocation.request == "继续分析启动失败")
}

@Test
func slashCommandParserIgnoresUnknownCommands() throws {
    let skills = [
        SkillSummary(name: "summary", description: "Write a summary", relativePath: "summary/SKILL.md"),
    ]

    #expect(SlashCommandParser.parse("/unknown test", skills: skills) == nil)
    #expect(SlashCommandParser.parse("not a slash command", skills: skills) == nil)
}
