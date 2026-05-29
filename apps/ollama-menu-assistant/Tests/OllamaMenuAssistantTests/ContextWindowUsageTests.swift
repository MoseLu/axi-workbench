import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func contextWindowUsageTracksDraftAgainstModelLimit() {
    let model = ModelSummary(
        name: "qwen:latest",
        displayName: "qwen",
        size: 1,
        capabilities: ["completion"],
        contextLength: 1_000,
        isLoaded: true,
        modifiedAt: .now
    )
    let usage = ContextWindowEstimator.makeUsage(
        model: model,
        messages: [
            ChatMessage(role: .user, content: "你好"),
            ChatMessage(role: .assistant, content: "hello world")
        ],
        draft: String(repeating: "a", count: 400),
        pendingAttachments: [],
        project: nil
    )

    #expect(usage.maxTokens == 1_000)
    #expect(usage.usedTokens > 100)
    #expect(usage.usedPercent != nil)
}

@Test
func contextWindowUsageCollapsesEmbeddedImagePayloads() {
    let payload = String(repeating: "A", count: 40_000)
    let content = """
    看这张图：

    <image name=[Image #1]>
    [Image: data:image/png;base64,\(payload)]
    </image>
    """

    let rawTokens = ContextWindowEstimator.estimatedTokens(in: content)
    let contentTokens = ContextWindowEstimator.estimatedContentTokens(in: content)

    #expect(rawTokens > 10_000)
    #expect(contentTokens < 600)
}

@Test
func contextWindowUsageKeepsImagePayloadsInsideCodeFences() {
    let content = """
    ```text
    [Image: data:image/png;base64,AAAA]
    ```
    """

    #expect(ContextWindowEstimator.estimatedContentTokens(in: content) == ContextWindowEstimator.estimatedTokens(in: content))
}
