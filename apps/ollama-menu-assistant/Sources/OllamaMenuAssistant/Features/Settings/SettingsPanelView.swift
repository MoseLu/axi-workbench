import AppKit
import SwiftUI

enum SettingsSection: String, CaseIterable, Identifiable {
    case general
    case appearance
    case configuration
    case personalization
    case mcpServers
    case git
    case environment
    case workspace
    case browserUsage
    case computerControl
    case archivedConversations
    case usage

    var id: String { rawValue }

    var title: String {
        title(language: .simplifiedChinese)
    }

    func title(language: AppLanguage) -> String {
        switch self {
        case .general: language == .english ? "General" : "常规"
        case .appearance: language == .english ? "Appearance" : "外观"
        case .configuration: language == .english ? "Configuration" : "配置"
        case .personalization: language == .english ? "Personalization" : "个性化"
        case .mcpServers: language == .english ? "MCP Servers" : "MCP 服务器"
        case .git: "Git"
        case .environment: language == .english ? "Environment" : "环境"
        case .workspace: language == .english ? "Worktrees" : "工作树"
        case .browserUsage: language == .english ? "Browser Usage" : "浏览器使用"
        case .computerControl: language == .english ? "Computer Control" : "电脑操控"
        case .archivedConversations: language == .english ? "Archived Chats" : "已归档对话"
        case .usage: language == .english ? "Usage" : "使用情况"
        }
    }

    var systemName: String {
        switch self {
        case .general: "gearshape"
        case .appearance: "sun.max"
        case .configuration: "speedometer"
        case .personalization: "clock"
        case .mcpServers: "paperclip"
        case .git: "point.3.connected.trianglepath.dotted"
        case .environment: "macwindow"
        case .workspace: "arrow.triangle.branch"
        case .browserUsage: "rectangle.on.rectangle"
        case .computerControl: "sparkles"
        case .archivedConversations: "archivebox"
        case .usage: "gauge.with.dots.needle.bottom.50percent"
        }
    }
}

enum SettingsPanelMetrics {
    static let sidebarWidth: CGFloat = 300
    static let sidebarHorizontalPadding: CGFloat = 20
    static let sidebarContentWidth: CGFloat = sidebarWidth - (sidebarHorizontalPadding * 2)
    static let sidebarTopPadding: CGFloat = 34
    static let sidebarBackListSpacing: CGFloat = 14
    static let sidebarRowHeight: CGFloat = 30
    static let sidebarRowCornerRadius: CGFloat = 8
    static let sidebarRowHorizontalInset: CGFloat = 10
    static let pageWidth: CGFloat = 760
    static let scrollAnchor = "settings.content.top"
    static let scrollGutter: CGFloat = 18
    static let contentLeadingPadding: CGFloat = 40
    static let contentTrailingPadding: CGFloat = 28
    static let titleBodySpacing: CGFloat = 20
    static let contentBottomPadding: CGFloat = 24
    static let scrollbarWidth: CGFloat = 8
    static let scrollbarTrailingInset: CGFloat = 3
    static let scrollbarVerticalInset: CGFloat = 8
    static let scrollbarMinimumHeight: CGFloat = 34
    static let switchScale: CGFloat = 0.86
    static let switchFrameWidth: CGFloat = 44
    static let switchFrameHeight: CGFloat = 24
    static let textMinimumScale: CGFloat = 0.88
    static let segmentedOptionMinWidth: CGFloat = 56
    static let petRosterGroupListWidth: CGFloat = 190
    static let petRosterCharacterListWidth: CGFloat = 128
    static let petRosterBrowserMaxHeight: CGFloat = 284
}

struct SettingsPanelChromeMetrics: Equatable {
    var titleBarHeight: CGFloat = 32
}

struct SettingsPanelChromeMetricsReader: NSViewRepresentable {
    @Binding var metrics: SettingsPanelChromeMetrics

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        view.isHidden = true
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            updateMetrics(from: nsView)
        }
    }

    func updateMetrics(from view: NSView) {
        guard let window = view.window else {
            return
        }

        let titleBarHeight = max(28, window.frame.height - window.contentLayoutRect.height)
        let updated = SettingsPanelChromeMetrics(titleBarHeight: titleBarHeight)

        guard updated != metrics else {
            return
        }

        metrics = updated
    }
}

struct SettingsPanelView: View {
    @Environment(\.colorScheme) var colorScheme
    @EnvironmentObject var appModel: AppModel
    @Binding var isPresented: Bool
    let isLaunchAtLoginEnabled: Bool
    let onToggleLaunchAtLogin: (Bool) -> Void
    let onRefreshModels: () -> Void

    @AppStorage(AppPreferenceKeys.appearanceMode) var appearanceModeRaw = AppearanceMode.system.rawValue
    @AppStorage(AppPreferenceKeys.Settings.workMode) var workMode = "coding"
    @AppStorage(AppPreferenceKeys.Settings.defaultPermission) var defaultPermissionEnabled = true
    @AppStorage(AppPreferenceKeys.Settings.autoReview) var autoReviewEnabled = true
    @AppStorage(AppPreferenceKeys.Settings.fullAccess) var fullAccessEnabled = true
    @AppStorage(DefaultEditorTarget.storageKey) var defaultOpenTarget = DefaultEditorTarget.finder.rawValue
    @AppStorage(AppPreferenceKeys.Settings.language) var language = AppLanguageOption.auto.storageValue
    @AppStorage(AppPreferenceKeys.Settings.showInMenuBar) var showInMenuBar = true
    @AppStorage(AppPreferenceKeys.Settings.preventSystemSleep) var preventSystemSleep = false
    @AppStorage(AppPreferenceKeys.Settings.enterToSend) var enterToSend = false
    @AppStorage(AppPreferenceKeys.Settings.speed) var speed = "标准"
    @AppStorage(AppPreferenceKeys.Settings.followBehavior) var followBehavior = "排队"
    @AppStorage(AppPreferenceKeys.Settings.codeReview) var codeReview = "行内视图"
    @AppStorage(AppPreferenceKeys.Settings.suggestions) var suggestionsEnabled = true
    @AppStorage(AppPreferenceKeys.Settings.listenHotkey) var listenHotkeyEnabled = false
    @AppStorage(AppPreferenceKeys.Settings.toggleListenHotkey) var toggleListenHotkeyEnabled = false
    @AppStorage(AppPreferenceKeys.Settings.notificationTiming) var notificationTiming = "仅当应用失焦时"
    @AppStorage(AppPreferenceKeys.Settings.permissionNotifications) var permissionNotifications = true
    @AppStorage(AppPreferenceKeys.Settings.questionNotifications) var questionNotifications = true
    @AppStorage(AppPreferenceKeys.Settings.themePreset) var themePreset = "Assistant"
    @AppStorage(AppPreferenceKeys.Settings.themeAccentHex) var themeAccentHex = AppTheme.themeAccentDefaultHex
    @AppStorage(AppPreferenceKeys.Settings.themeBackgroundHex) var themeBackgroundHex = AppTheme.themeBackgroundDefaultHex
    @AppStorage(AppPreferenceKeys.Settings.themeForegroundHex) var themeForegroundHex = AppTheme.themeForegroundDefaultHex
    @AppStorage(AppPreferenceKeys.Settings.translucentSidebar) var translucentSidebar = true
    @AppStorage(AppPreferenceKeys.Settings.contrast) var contrast = 45.0
    @AppStorage(AppPreferenceKeys.Settings.pointerCursor) var pointerCursor = false
    @AppStorage(AppPreferenceKeys.Settings.uiFontSize) var uiFontSize = 14.0
    @AppStorage(AppPreferenceKeys.Settings.codeFontSize) var codeFontSize = 12.0
    @AppStorage(AppPreferenceKeys.Settings.fontSmoothing) var fontSmoothing = true
    @AppStorage(GitSettingsPreferences.branchPrefixKey) var gitBranchPrefix = GitSettingsPreferences.defaultBranchPrefix
    @AppStorage(GitSettingsPreferences.pullRequestMergeMethodKey) var gitPullRequestMergeMethod = GitSettingsPreferences.defaultPullRequestMergeMethod
    @AppStorage(GitSettingsPreferences.showsPullRequestIconKey) var gitShowsPullRequestIcon = GitSettingsPreferences.defaultShowsPullRequestIcon
    @AppStorage(GitSettingsPreferences.alwaysForcePushKey) var gitAlwaysForcePush = GitSettingsPreferences.defaultAlwaysForcePush
    @AppStorage(GitSettingsPreferences.createsDraftPullRequestKey) var gitCreatesDraftPullRequest = GitSettingsPreferences.defaultCreatesDraftPullRequest
    @AppStorage(GitSettingsPreferences.automaticallyDeletesOldWorktreesKey) var gitAutomaticallyDeletesOldWorktrees = GitSettingsPreferences.defaultAutomaticallyDeletesOldWorktrees
    @AppStorage(GitSettingsPreferences.automaticDeleteLimitKey) var gitAutomaticDeleteLimit = GitSettingsPreferences.defaultAutomaticDeleteLimit
    @AppStorage(GitSettingsPreferences.commitInstructionsKey) var gitCommitInstructions = ""
    @AppStorage(GitSettingsPreferences.pullRequestInstructionsKey) var gitPullRequestInstructions = ""
    @AppStorage(BrowserComputerSettingsPreferences.browserNavigationApprovalKey) var browserNavigationApproval = BrowserComputerSettingsPreferences.PermissionPolicy.alwaysAsk.rawValue
    @AppStorage(BrowserComputerSettingsPreferences.browserHistoryApprovalKey) var browserHistoryApproval = BrowserComputerSettingsPreferences.PermissionPolicy.alwaysAsk.rawValue
    @AppStorage(BrowserComputerSettingsPreferences.browserBlockedDomainsKey) var browserBlockedDomainsRaw = "[]"
    @AppStorage(BrowserComputerSettingsPreferences.browserAllowedDomainsKey) var browserAllowedDomainsRaw = "[]"
    @AppStorage(BrowserComputerSettingsPreferences.computerAlwaysAllowedAppsKey) var computerAlwaysAllowedAppsRaw = "[]"
    @AppStorage(AssistantSettingsPreferences.configScopeKey) var configurationScope = AssistantSettingsPreferences.ConfigScope.user.rawValue
    @AppStorage(AssistantSettingsPreferences.approvalPolicyKey) var configurationApprovalPolicy = AssistantSettingsPreferences.ApprovalPolicy.onRequest.rawValue
    @AppStorage(AssistantSettingsPreferences.sandboxModeKey) var configurationSandboxMode = AssistantSettingsPreferences.SandboxMode.readOnly.rawValue
    @AppStorage(AssistantSettingsPreferences.bundledDependenciesEnabledKey) var bundledDependenciesEnabled = true
    @AppStorage(AssistantSettingsPreferences.personalityToneKey) var personalityTone = AssistantSettingsPreferences.PersonalityTone.warm.rawValue
    @AppStorage(AssistantSettingsPreferences.customInstructionsKey) var customInstructions = ""
    @AppStorage(AssistantSettingsPreferences.memoryEnabledKey) var memoryEnabled = false
    @AppStorage(AssistantSettingsPreferences.skipToolAssistedMemoryKey) var skipToolAssistedMemory = false
    @State var chromeMetrics = SettingsPanelChromeMetrics()
    @State var scrollMetrics = AppScrollMetrics()
    @State var scrollController = AppScrollController()
    @State var selectedSection: SettingsSection = .general
    @State var selectedPetGroupID: String?
    @State var selectedPetCharacterID: String?
    @State var isAutoRefreshEnabled = true
    @State var isThemePresetMenuPresented = false
    @State var hoveredThemePreset: String?
    @State var gitCommitInstructionsDraft = ""
    @State var gitPullRequestInstructionsDraft = ""
    @State var browserDataStatusMessage: String?
    @State var configurationStatusMessage: String?
    @State var customInstructionsDraft = ""
    @State var personalizationStatusMessage: String?
    @State var selectedEnvironmentProjectID: UUID?
    @State var isEnvironmentEditorPresented = false
    @State var environmentDraft: ProjectLocalEnvironment?
    @State var setupScriptScope = ProjectEnvironmentScriptScope.default
    @State var cleanupScriptScope = ProjectEnvironmentScriptScope.default
    @State var environmentStatusMessage: String?

    var body: some View {
        ScrollViewReader { scrollProxy in
            HStack(alignment: .top, spacing: 0) {
                settingsSidebar(scrollProxy: scrollProxy)
                settingsContent(scrollProxy: scrollProxy)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(translucentSidebar ? AppTheme.transparent : AppTheme.canvas)
            .background(
                SettingsPanelChromeMetricsReader(metrics: $chromeMetrics)
                    .frame(width: 0, height: 0)
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .accessibilityIdentifier("settings.panel")
        .onAppear {
            appModel.refreshPetCatalog()
            appModel.refreshPetRunnerState()
        }
    }

    func settingsSidebar(scrollProxy: ScrollViewProxy) -> some View {
        SettingsPanelSidebarView(
            selectedSection: selectedSection,
            language: appLanguage,
            isTranslucent: translucentSidebar,
            onBack: {
                isPresented = false
            },
            onSelect: { section in
                selectSection(section, scrollProxy: scrollProxy)
            }
        )
    }

    func settingsContent(scrollProxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            settingsContentHeader
            settingsContentBody(scrollProxy: scrollProxy)
        }
        .background(AppTheme.canvas)
        .frame(minWidth: 0, maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .layoutPriority(0)
        .clipped()
        .transaction { transaction in
            transaction.animation = nil
        }
    }

    var settingsContentHeader: some View {
        VStack(alignment: .leading, spacing: 18) {
            environmentHeaderNavigation

            Text(selectedSection.title(language: appLanguage))
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(AppTheme.textPrimary)
        }
            .padding(.top, settingsPanelTopInset)
            .padding(.leading, SettingsPanelMetrics.contentLeadingPadding)
            .padding(.trailing, SettingsPanelMetrics.contentTrailingPadding + SettingsPanelMetrics.scrollGutter)
            .padding(.bottom, SettingsPanelMetrics.titleBodySpacing)
            .frame(maxWidth: SettingsPanelMetrics.pageWidth, alignment: .topLeading)
            .frame(maxWidth: .infinity, alignment: .center)
    }

    func settingsContentBody(scrollProxy: ScrollViewProxy) -> some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                AppTheme.transparent
                    .frame(height: 0)
                    .id(SettingsPanelMetrics.scrollAnchor)

                selectedSettingsContent
                    .transaction { transaction in
                        transaction.animation = nil
                    }
            }
            .padding(.leading, SettingsPanelMetrics.contentLeadingPadding)
            .padding(.trailing, SettingsPanelMetrics.contentTrailingPadding + SettingsPanelMetrics.scrollGutter)
            .padding(.bottom, SettingsPanelMetrics.contentBottomPadding)
            .frame(minWidth: 0, maxWidth: SettingsPanelMetrics.pageWidth, alignment: .topLeading)
            .frame(maxWidth: .infinity, alignment: .center)
            .background(
                AppScrollMetricsReader(
                    metrics: $scrollMetrics,
                    controller: scrollController
                )
            )
        }
        .overlay(alignment: .topTrailing) {
            settingsScrollThumb
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    var settingsScrollThumb: some View {
        AppVerticalScrollIndicator(
            metrics: scrollMetrics,
            controller: scrollController,
            width: SettingsPanelMetrics.scrollbarWidth,
            trailingInset: SettingsPanelMetrics.scrollbarTrailingInset,
            verticalInset: SettingsPanelMetrics.scrollbarVerticalInset,
            minimumThumbHeight: SettingsPanelMetrics.scrollbarMinimumHeight
        )
    }

    @ViewBuilder
    var selectedSettingsContent: some View {
        SettingsPanelRouteView(
            selectedSection: selectedSection,
            general: { generalSettings },
            appearance: { appearanceSettings },
            configuration: { configurationSettings },
            personalization: { personalizationSettings },
            mcpServers: { mcpServersSettings },
            git: { gitSettings },
            environment: { environmentSettings },
            browserUsage: { browserUsageSettings },
            computerControl: { computerControlSettings },
            archivedConversations: { archivedConversationSettings },
            usage: {
            RuntimeTracePanelView(
                traces: appModel.runtimeTraces,
                onClear: appModel.clearRuntimeTraces,
                language: appLanguage
            )
            }
        )
    }


    func selectSection(_ section: SettingsSection, scrollProxy: ScrollViewProxy) {
        guard section != selectedSection else {
            return
        }

        var transaction = Transaction()
        transaction.animation = nil

        withTransaction(transaction) {
            selectedSection = section
            if section != .environment {
                resetEnvironmentNavigation()
            }
        }

        withTransaction(transaction) {
            scrollProxy.scrollTo(SettingsPanelMetrics.scrollAnchor, anchor: .top)
        }
    }
}
