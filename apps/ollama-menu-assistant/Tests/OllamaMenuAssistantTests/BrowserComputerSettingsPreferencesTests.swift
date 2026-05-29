import Testing
@testable import OllamaMenuAssistant

@Test
func settingsStringListCodecTrimsAndDeduplicatesValues() {
    let encoded = BrowserComputerSettingsPreferences.encodeStringList([" example.com ", "EXAMPLE.com", "", "openai.com"])
    let decoded = BrowserComputerSettingsPreferences.decodeStringList(encoded)

    #expect(decoded == ["example.com", "openai.com"])
}

@Test
func browserDomainNormalizationStripsSchemePathAndPort() {
    #expect(BrowserComputerSettingsPreferences.normalizedDomain("https://Example.com:443/docs") == "example.com")
    #expect(BrowserComputerSettingsPreferences.normalizedDomain("*.Example.com") == "*.example.com")
    #expect(BrowserComputerSettingsPreferences.normalizedDomain("  ") == nil)
}
