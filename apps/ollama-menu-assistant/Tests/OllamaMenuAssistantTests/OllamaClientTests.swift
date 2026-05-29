import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func parseChatChunkKeepsContentSeparateFromThinking() throws {
    let line = #"{"message":{"role":"assistant","content":"你好！","thinking":"internal trace"},"done":false}"#

    let chunk = try OllamaClient.parseChatChunk(line)

    #expect(chunk.message?.content == "你好！")
    #expect(chunk.message?.thinking == "internal trace")
    #expect(chunk.done == false)
}

@Test
func parseChatChunkDecodesNativeToolCalls() throws {
    let line = #"{"message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"list_dir","arguments":{"path":"."}}}]},"done":false}"#

    let chunk = try OllamaClient.parseChatChunk(line)
    let call = try #require(chunk.message?.toolCalls?.first)

    #expect(call.function.name == "list_dir")
    #expect(call.agentCall.arguments["path"]?.stringValue == ".")
}

@Test
func decoderParsesFractionalModifiedAtDates() throws {
    let data = Data(#"{"models":[{"name":"main:latest","size":123,"modified_at":"2026-04-23T21:19:37.490817602+08:00"}]}"#.utf8)

    let response = try OllamaClient.makeDecoder().decode(TagsFixture.self, from: data)

    #expect(response.models.count == 1)
    #expect(response.models[0].name == "main:latest")
}

@Test
func modelDetailsExtractsContextLengthFromModelInfo() throws {
    let data = Data(#"{"capabilities":["completion"],"model_info":{"qwen3.context_length":262144}}"#.utf8)

    let details = try JSONDecoder().decode(OllamaModelDetails.self, from: data)

    #expect(details.contextLength == 262_144)
}

@Test
func modelDetailsPrefersModelInfoContextLengthOverConfiguredNumCtx() throws {
    let data = Data(#"{"capabilities":["completion"],"parameters":"temperature 0.7\nnum_ctx 32768","model_info":{"llama.context_length":131072}}"#.utf8)

    let details = try JSONDecoder().decode(OllamaModelDetails.self, from: data)

    #expect(details.contextLength == 131_072)
}

@Test
func modelDetailsFallsBackToConfiguredNumCtxWhenModelInfoIsMissing() throws {
    let data = Data(#"{"capabilities":["completion"],"parameters":"temperature 0.7\nnum_ctx 32768"}"#.utf8)

    let details = try JSONDecoder().decode(OllamaModelDetails.self, from: data)

    #expect(details.contextLength == 32_768)
}

@Test
func chatRequestEncodesContextLengthAsNumCtxOption() throws {
    let request = try ChatRequest(
        model: "main:latest",
        messages: [ChatMessage(role: .user, content: "hello")],
        contextLength: 262_144,
        stream: false
    )

    let data = try JSONEncoder().encode(request)
    let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let options = try #require(json["options"] as? [String: Any])

    #expect(options["num_ctx"] as? Int == 262_144)
}

@Test
func chatRequestOmitsInvalidContextLengthOption() throws {
    let request = try ChatRequest(
        model: "main:latest",
        messages: [ChatMessage(role: .user, content: "hello")],
        contextLength: 0,
        stream: false
    )

    let data = try JSONEncoder().encode(request)
    let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])

    #expect(json["options"] == nil)
}

private struct TagsFixture: Decodable {
    let models: [OllamaTaggedModel]
}
