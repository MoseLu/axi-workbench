import Foundation

enum AppPreferenceKeys {
    static let appearanceMode = "appearanceMode"

    enum Layout {
        static let sidebarCollapsed = "sidebarCollapsed"
        static let changesSidebarCollapsed = "changesSidebarCollapsed"
        static let terminalPanelCollapsed = "terminalPanelCollapsed"
        static let changesSidebarWidthRatio = "changesSidebarWidthRatio"
    }

    enum Settings {
        static let workMode = "settings.workMode"
        static let defaultPermission = "settings.defaultPermission"
        static let autoReview = "settings.autoReview"
        static let fullAccess = "settings.fullAccess"
        static let defaultOpenTarget = "settings.defaultOpenTarget"
        static let language = "settings.language"
        static let showInMenuBar = "settings.showInMenuBar"
        static let preventSystemSleep = "settings.preventSystemSleep"
        static let enterToSend = "settings.enterToSend"
        static let speed = "settings.speed"
        static let followBehavior = "settings.followBehavior"
        static let codeReview = "settings.codeReview"
        static let suggestions = "settings.suggestions"
        static let listenHotkey = "settings.listenHotkey"
        static let toggleListenHotkey = "settings.toggleListenHotkey"
        static let notificationTiming = "settings.notificationTiming"
        static let permissionNotifications = "settings.permissionNotifications"
        static let questionNotifications = "settings.questionNotifications"
        static let themePreset = "settings.themePreset"
        static let themeAccentHex = "settings.themeAccentHex"
        static let themeBackgroundHex = "settings.themeBackgroundHex"
        static let themeForegroundHex = "settings.themeForegroundHex"
        static let translucentSidebar = "settings.translucentSidebar"
        static let contrast = "settings.contrast"
        static let pointerCursor = "settings.pointerCursor"
        static let uiFontSize = "settings.uiFontSize"
        static let codeFontSize = "settings.codeFontSize"
        static let fontSmoothing = "settings.fontSmoothing"
        static let pet = "settings.pet"
        static let pets = "settings.pets"
    }

    enum Git {
        static let branchPrefix = "settings.git.branchPrefix"
        static let pullRequestMergeMethod = "settings.git.pullRequestMergeMethod"
        static let showsPullRequestIcon = "settings.git.showsPullRequestIcon"
        static let alwaysForcePush = "settings.git.alwaysForcePush"
        static let createsDraftPullRequest = "settings.git.createsDraftPullRequest"
        static let automaticallyDeletesOldWorktrees = "settings.git.automaticallyDeletesOldWorktrees"
        static let automaticDeleteLimit = "settings.git.automaticDeleteLimit"
        static let commitInstructions = "settings.git.commitInstructions"
        static let pullRequestInstructions = "settings.git.pullRequestInstructions"
    }

    enum BrowserComputer {
        static let browserNavigationApproval = "settings.browser.navigationApproval"
        static let browserHistoryApproval = "settings.browser.historyApproval"
        static let browserBlockedDomains = "settings.browser.blockedDomains"
        static let browserAllowedDomains = "settings.browser.allowedDomains"
        static let computerAlwaysAllowedApps = "settings.computer.alwaysAllowedApps"
    }

    enum AssistantConfiguration {
        static let configScope = "settings.configuration.scope"
        static let approvalPolicy = "settings.configuration.approvalPolicy"
        static let sandboxMode = "settings.configuration.sandboxMode"
        static let bundledDependenciesEnabled = "settings.configuration.bundledDependenciesEnabled"
    }

    enum Personalization {
        static let personalityTone = "settings.personalization.tone"
        static let customInstructions = "settings.personalization.customInstructions"
        static let memoryEnabled = "settings.personalization.memoryEnabled"
        static let skipToolAssistedMemory = "settings.personalization.skipToolAssistedMemory"
    }
}
