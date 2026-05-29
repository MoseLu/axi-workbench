import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func personalizationRuntimePromptUsesAssistantToneAndCustomInstructions() throws {
    let defaults = try #require(UserDefaults(suiteName: "AssistantSettingsPreferencesTests-\(UUID().uuidString)"))
    defaults.set(AssistantSettingsPreferences.PersonalityTone.pragmatic.rawValue, forKey: AssistantSettingsPreferences.personalityToneKey)
    defaults.set("Prefer short answers.", forKey: AssistantSettingsPreferences.customInstructionsKey)

    let prompt = try #require(AssistantSettingsPreferences.runtimePrompt(defaults: defaults, language: .english))

    #expect(prompt.contains("concise"))
    #expect(prompt.contains("Prefer short answers."))
    #expect(!prompt.localizedCaseInsensitiveContains("Codex"))
}

@Test
func defaultConfigTomlUsesAssistantSettingsValues() {
    let text = AssistantSettingsPreferences.defaultConfigToml(
        approvalPolicy: .onRequest,
        sandboxMode: .readOnly,
        bundledDependenciesEnabled: true
    )

    #expect(text.contains(#"approval_policy = "onRequest""#))
    #expect(text.contains(#"sandbox_mode = "readOnly""#))
    #expect(text.contains("bundled_dependencies = true"))
}
