import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func chooseDefaultModelPrefersStoredSelectionWhenAvailable() {
    let models = sampleModels()

    let selected = ModelCatalogService.chooseDefaultModel(from: models, storedSelection: "custom:latest")

    #expect(selected == "custom:latest")
}

@Test
func chooseDefaultModelFallsBackToMainAlias() {
    let models = sampleModels()

    let selected = ModelCatalogService.chooseDefaultModel(from: models, storedSelection: "missing:latest")

    #expect(selected == "main:latest")
}

@Test
func displayNameStripsLatestSuffix() {
    #expect(ModelCatalogService.displayName(for: "main:latest") == "main")
    #expect(ModelCatalogService.displayName(for: "qwen3.5:35b-a3b-q4_K_M") == "qwen3.5:35b-a3b-q4_K_M")
}

private func sampleModels() -> [ModelSummary] {
    [
        ModelSummary(
            name: "main:latest",
            displayName: "main",
            size: 1,
            capabilities: ["completion"],
            isLoaded: false,
            modifiedAt: .distantPast
        ),
        ModelSummary(
            name: "custom:latest",
            displayName: "custom",
            size: 1,
            capabilities: ["completion"],
            isLoaded: false,
            modifiedAt: .now
        ),
    ]
}
