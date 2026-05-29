import Testing
@testable import OllamaMenuAssistant

@Test
func chatDisplayTextExtractsLeadingPluginInvocation() {
    let display = ChatDisplayText.parse("[@电脑](plugin://computer-use@openai-bundled) 继续调试滚动")

    #expect(display.invocations == [ChatDisplayInvocation(kind: .plugin, name: "电脑")])
    #expect(display.body == "继续调试滚动")
}

@Test
func chatDisplayTextExtractsTruncatedPluginTitleWithoutShowingRawMarkup() {
    let display = ChatDisplayText.parse("[@电脑](plugin://computer-use@open")

    #expect(display.invocations == [ChatDisplayInvocation(kind: .plugin, name: "电脑")])
    #expect(display.body.isEmpty)
    #expect(display.titleSource == "电脑")
}

@Test
func chatDisplayTextExtractsLeadingSkillButKeepsAbsolutePaths() {
    let skills = [
        SkillSummary(name: "diagnose", description: "Debug", relativePath: "diagnose/SKILL.md"),
    ]

    let skillDisplay = ChatDisplayText.parse("/diagnose 继续分析", skills: skills)
    let pathDisplay = ChatDisplayText.parse("/Volumes/code/workspace 继续分析", skills: skills)

    #expect(skillDisplay.invocations == [ChatDisplayInvocation(kind: .skill, name: "diagnose")])
    #expect(skillDisplay.body == "继续分析")
    #expect(pathDisplay.invocations.isEmpty)
    #expect(pathDisplay.body == "/Volumes/code/workspace 继续分析")
}

@Test
func chatDisplayTextExtractsInvocationOnlyLines() {
    let skills = [
        SkillSummary(name: "diagnose", description: "Debug", relativePath: "diagnose/SKILL.md"),
    ]

    let display = ChatDisplayText.parse(
        """
        继续整理项目状态

        [@Notion](plugin://notion@openai-curated)
        /diagnose
        """,
        skills: skills
    )

    #expect(display.invocations == [
        ChatDisplayInvocation(kind: .plugin, name: "Notion"),
        ChatDisplayInvocation(kind: .skill, name: "diagnose"),
    ])
    #expect(display.body == "继续整理项目状态")
}

@Test
func chatDisplayTextExtractsMultipleInvocationTokensOnOneLine() {
    let display = ChatDisplayText.parse(
        """
        继续整理项目状态
        [@电脑](plugin://computer-use@openai-bundled) [@GitHub](plugin://github@openai-curated)
        """
    )

    #expect(display.invocations == [
        ChatDisplayInvocation(kind: .plugin, name: "电脑"),
        ChatDisplayInvocation(kind: .plugin, name: "GitHub"),
    ])
    #expect(display.body == "继续整理项目状态")
}

@Test
func storedConversationTitleIgnoresLeadingInvocationToken() {
    var conversation = StoredConversation(
        model: "main:latest",
        messages: [
            ChatMessage(role: .user, content: "[@电脑](plugin://computer-use@openai-bundled) 重新检查 UI"),
        ]
    )

    conversation.updateMetadata()

    #expect(conversation.title == "重新检查 UI")
}
