import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func expertModePrefersMainAlias() {
    let selected = RoutingModelResolver.resolve(
        mode: .expert,
        models: sampleModels(),
        preferredExpertModelName: "main:latest"
    )

    #expect(selected?.name == "main:latest")
}

@Test
func quickModePrefersQwenNineB() {
    let selected = RoutingModelResolver.resolve(
        mode: .quick,
        models: sampleModels(),
        preferredExpertModelName: "main:latest"
    )

    #expect(selected?.name == "qwen3.5:9b")
}

@Test
func balancedModePrefersQwenTwentySevenB() {
    let selected = RoutingModelResolver.resolve(
        mode: .balanced,
        models: sampleModels(),
        preferredExpertModelName: "main:latest"
    )

    #expect(selected?.name == "qwen3.5:27b")
}

@Test
func imageAttachmentsPreferStrongVisionModels() {
    let selected = RoutingModelResolver.resolve(
        mode: .expert,
        models: sampleModels(),
        preferredExpertModelName: "main:latest",
        attachments: [sampleImageAttachment()]
    )

    #expect(selected?.name == "qwen3-vl:32b")
}

@Test
func quickImageRequestsUseEightBVisionFloor() {
    let selected = RoutingModelResolver.resolve(
        mode: .quick,
        models: sampleModels(),
        preferredExpertModelName: "main:latest",
        attachments: [sampleImageAttachment()]
    )

    #expect(selected?.name == "qwen3-vl:8b")
}

@Test
func textRoutingSkipsVisionEmbeddingAndUncensoredModels() {
    let stableNames = RoutingModelResolver.stableCompletionModels(from: sampleModels()).map(\.name)

    #expect(stableNames.contains("main:latest"))
    #expect(stableNames.contains("qwen3.5:35b-a3b"))
    #expect(stableNames.contains("qwen3.5:27b"))
    #expect(stableNames.contains("qwen3.5:9b"))
    #expect(!stableNames.contains("qwen3-vl:8b"))
    #expect(!stableNames.contains("moondream:latest"))
    #expect(!stableNames.contains("dolphin-llama3:latest"))
    #expect(!stableNames.contains("qwen3.5-35b-a3b-uncensored:q4_k_m"))
    #expect(!stableNames.contains("nomic-embed-text:latest"))
}

@Test
func visionRoutingKeepsSevenBPlusVisionModelsAvailable() {
    let stableNames = RoutingModelResolver.stableCompletionModels(
        from: sampleModels(),
        requiringVision: true
    ).map(\.name)

    #expect(stableNames.contains("qwen3-vl:32b"))
    #expect(stableNames.contains("qwen3-vl:8b"))
    #expect(stableNames.contains("gemma3:12b"))
    #expect(stableNames.contains("llava:7b"))
    #expect(!stableNames.contains("moondream:latest"))
    #expect(!stableNames.contains("main:latest"))
    #expect(!stableNames.contains("huihui_ai/qwen3-vl-abliterated:32b-instruct"))
    #expect(!stableNames.contains("nomic-embed-text:latest"))
}

@Test
func expertTextFallbackPrefersUncensoredQwenThirtyFiveB() {
    let selected = RoutingModelResolver.resolveUncensoredFallback(
        mode: .expert,
        models: sampleModels()
    )

    #expect(selected?.name == "qwen3.5-35b-a3b-uncensored:q4_k_m")
}

@Test
func quickTextFallbackPrefersEightBDolphin() {
    let selected = RoutingModelResolver.resolveUncensoredFallback(
        mode: .quick,
        models: sampleModels()
    )

    #expect(selected?.name == "dolphin-llama3:latest")
}

@Test
func expertVisionFallbackPrefersAbliteratedQwenVisionThirtyTwoB() {
    let selected = RoutingModelResolver.resolveUncensoredFallback(
        mode: .expert,
        models: sampleModels(),
        attachments: [sampleImageAttachment()]
    )

    #expect(selected?.name == "huihui_ai/qwen3-vl-abliterated:32b-instruct")
}

@Test
func quickVisionFallbackPrefersSevenBAndSkipsThreeB() {
    let selected = RoutingModelResolver.resolveUncensoredFallback(
        mode: .quick,
        models: sampleModels(),
        attachments: [sampleImageAttachment()]
    )

    #expect(selected?.name == "redule26/huihui_ai_qwen2.5-vl-7b-abliterated:latest")
}

private func sampleModels() -> [ModelSummary] {
    [
        model("main:latest", size: 23_869_191_742),
        model("qwen3.5:35b-a3b", size: 23_869_191_742),
        model("qwen3.5:27b", size: 17_000_000_000),
        model("qwen3.5:9b", size: 5_900_000_000),
        model("qwen3.5-9b-opus:latest", size: 5_627_041_461),
        model("gemma3:12b", size: 8_149_190_253, capabilities: ["completion", "vision"]),
        model("qwen3-vl:32b", size: 20_000_000_000, capabilities: ["completion", "vision", "tools", "thinking"]),
        model("qwen3-vl:8b", size: 6_140_415_879, capabilities: ["completion", "vision", "tools", "thinking"]),
        model("llava:7b", size: 4_700_000_000, capabilities: ["completion", "vision"]),
        model("moondream:latest", size: 1_700_000_000, capabilities: ["completion", "vision"]),
        model("qwen3.5-35b-a3b-uncensored:q4_k_m", size: 21_169_117_248),
        model("dolphin-llama3:latest", size: 4_700_000_000),
        model("dolphin-mistral:latest", size: 4_100_000_000),
        model("huihui_ai/qwen3-vl-abliterated:32b-instruct", size: 20_000_000_000, capabilities: ["completion", "vision"]),
        model("redule26/huihui_ai_qwen2.5-vl-7b-abliterated:latest", size: 4_700_000_000, capabilities: ["completion", "vision"]),
        model("huihui_ai/qwen2.5-vl-abliterated:3b", size: 2_200_000_000, capabilities: ["completion", "vision"]),
        model("deepseek-r1:8b", size: 5_200_000_000),
        model("nomic-embed-text:latest", size: 274_000_000, capabilities: ["embedding"]),
    ]
}

private func model(
    _ name: String,
    size: Int64,
    capabilities: [String] = ["completion"]
) -> ModelSummary {
    ModelSummary(
        name: name,
        displayName: name,
        size: size,
        capabilities: capabilities,
        isLoaded: false,
        modifiedAt: .now
    )
}

private func sampleImageAttachment() -> MessageAttachment {
    MessageAttachment(
        name: "image.png",
        path: "/tmp/image.png",
        kind: .image,
        byteCount: 1_024
    )
}
