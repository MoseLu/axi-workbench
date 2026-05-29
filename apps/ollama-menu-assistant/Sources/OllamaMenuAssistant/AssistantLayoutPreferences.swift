import Foundation

enum AssistantLayoutPreferences {
    static let sidebarCollapsedKey = AppPreferenceKeys.Layout.sidebarCollapsed
    static let changesSidebarCollapsedKey = AppPreferenceKeys.Layout.changesSidebarCollapsed
    static let terminalPanelCollapsedKey = AppPreferenceKeys.Layout.terminalPanelCollapsed
    static let changesSidebarWidthRatioKey = AppPreferenceKeys.Layout.changesSidebarWidthRatio

    static func resetForAppLaunch(defaults: UserDefaults = .standard) {
        defaults.set(false, forKey: sidebarCollapsedKey)
        defaults.set(true, forKey: changesSidebarCollapsedKey)
        defaults.set(true, forKey: terminalPanelCollapsedKey)
        defaults.removeObject(forKey: changesSidebarWidthRatioKey)
    }
}
