import Testing
@testable import OllamaMenuAssistant

@Test
func refusalDetectorFlagsChineseRefusals() {
    #expect(ResponseRefusalDetector.shouldUseFallback(for: "抱歉，我不能协助完成这个请求。"))
    #expect(ResponseRefusalDetector.shouldUseFallback(for: "我无法提供这类内容。"))
}

@Test
func refusalDetectorFlagsEnglishRefusals() {
    #expect(ResponseRefusalDetector.shouldUseFallback(for: "Sorry, I can't assist with that request."))
    #expect(ResponseRefusalDetector.shouldUseFallback(for: "I cannot provide that information."))
}

@Test
func refusalDetectorDoesNotFlagNormalAnswers() {
    let answer = "可以。这里有两个可行方案：先用 qwen3.5:9b 做快速响应，再用 qwen3.5:35b-a3b 处理复杂任务。"

    #expect(!ResponseRefusalDetector.shouldUseFallback(for: answer))
}

@Test
func refusalDetectorTreatsEmptyAnswersAsFallbackWorthy() {
    #expect(ResponseRefusalDetector.shouldUseFallback(for: "   \n"))
}
