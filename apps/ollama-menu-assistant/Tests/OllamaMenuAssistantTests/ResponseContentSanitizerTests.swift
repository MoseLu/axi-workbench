import Testing
@testable import OllamaMenuAssistant

@Test
func sanitizerRemovesCompleteThinkBlocks() {
    let sanitized = ResponseContentSanitizer.sanitize("<think>内部推理</think>\n\n火车")

    #expect(sanitized == "火车")
}

@Test
func sanitizerDropsDanglingThinkPrefix() {
    let sanitized = ResponseContentSanitizer.sanitize("答案<think>不要展示")

    #expect(sanitized == "答案")
}
