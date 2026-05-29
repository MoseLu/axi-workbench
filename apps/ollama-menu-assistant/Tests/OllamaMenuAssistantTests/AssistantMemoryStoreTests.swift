import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func assistantMemoryStorePersistsLayeredFilesAndRuntimePrompt() async throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "AssistantMemoryStoreTests-\(UUID().uuidString)", directoryHint: .isDirectory)
    defer {
        try? FileManager.default.removeItem(at: root)
    }

    let store = AssistantMemoryStore(rootURL: root)
    let project = ConversationProject(name: "Menu Assistant", path: "/Volumes/code/workspace/projects/axi-workbench/apps/ollama-menu-assistant")
    let userMessage = ChatMessage(role: .user, content: "记住：这个项目里要把旧品牌文案替换成 Assistant。")
    let assistantMessage = ChatMessage(role: .assistant, content: "已记录，后续设置页文案会优先使用 Assistant。")
    let conversation = StoredConversation(
        projectID: project.id,
        title: "替换品牌文案",
        model: "main:latest",
        messages: [userMessage, assistantMessage]
    )

    let captured = try await store.capture(
        conversation: conversation,
        project: project,
        assistantMessageID: assistantMessage.id,
        skipToolAssisted: false,
        now: Date(timeIntervalSince1970: 1_777_777_777)
    )

    let record = try #require(captured)
    #expect(record.kind == .preference)
    #expect(record.projectPath == "/Volumes/code/workspace/projects/axi-workbench/apps/ollama-menu-assistant")

    let records = try await store.loadRecords()
    #expect(records.count == 1)
    #expect(FileManager.default.fileExists(atPath: root.appending(path: "raw_memories.md").path))
    #expect(FileManager.default.fileExists(atPath: root.appending(path: "memory_summary.md").path))
    #expect(FileManager.default.fileExists(atPath: root.appending(path: "MEMORY.md").path))
    #expect(FileManager.default.fileExists(
        atPath: root
            .appending(path: "rollout_summaries", directoryHint: .isDirectory)
            .appending(path: record.rolloutSummaryFileName)
            .path
    ))

    let handbook = try String(contentsOf: root.appending(path: "MEMORY.md"), encoding: .utf8)
    #expect(handbook.contains("Agent Memory Handbook"))
    #expect(handbook.contains("Assistant"))

    let runtimePrompt = try #require(try await store.runtimePrompt(language: .simplifiedChinese))
    #expect(runtimePrompt.contains("长期记忆"))
    #expect(runtimePrompt.contains("Assistant"))
}

@Test
func assistantMemoryStoreSkipsToolAssistedChatsWhenConfigured() async throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "AssistantMemoryStoreSkipTests-\(UUID().uuidString)", directoryHint: .isDirectory)
    defer {
        try? FileManager.default.removeItem(at: root)
    }

    let store = AssistantMemoryStore(rootURL: root)
    let userMessage = ChatMessage(role: .user, content: "Remember that I prefer concise replies.")
    let assistantMessage = ChatMessage(
        role: .assistant,
        content: "Noted.",
        toolEvents: [
            ToolExecutionEvent(toolName: "web_search", status: .allowed, summary: "Searched the web"),
        ]
    )
    let conversation = StoredConversation(
        title: "Tool assisted memory",
        model: "main:latest",
        messages: [userMessage, assistantMessage]
    )

    let captured = try await store.capture(
        conversation: conversation,
        project: nil,
        assistantMessageID: assistantMessage.id,
        skipToolAssisted: true
    )

    #expect(captured == nil)
    #expect(try await store.loadRecords().isEmpty)
}
