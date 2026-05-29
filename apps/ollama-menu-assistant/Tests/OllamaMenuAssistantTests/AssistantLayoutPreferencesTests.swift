import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func assistantLayoutPreferencesResetOnAppLaunch() {
    let defaults = UserDefaults(suiteName: "OllamaMenuAssistantTests-\(UUID().uuidString)")!
    defaults.set(true, forKey: AssistantLayoutPreferences.sidebarCollapsedKey)
    defaults.set(false, forKey: AssistantLayoutPreferences.changesSidebarCollapsedKey)
    defaults.set(false, forKey: AssistantLayoutPreferences.terminalPanelCollapsedKey)
    defaults.set(0.42, forKey: AssistantLayoutPreferences.changesSidebarWidthRatioKey)

    AssistantLayoutPreferences.resetForAppLaunch(defaults: defaults)

    #expect(defaults.bool(forKey: AssistantLayoutPreferences.sidebarCollapsedKey) == false)
    #expect(defaults.bool(forKey: AssistantLayoutPreferences.changesSidebarCollapsedKey) == true)
    #expect(defaults.bool(forKey: AssistantLayoutPreferences.terminalPanelCollapsedKey) == true)
    #expect(defaults.object(forKey: AssistantLayoutPreferences.changesSidebarWidthRatioKey) == nil)
}
