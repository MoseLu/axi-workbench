import AppKit
import SwiftUI

struct AssistantPanelView: View {
    @EnvironmentObject var appModel: AppModel
    @AppStorage(AppPreferenceKeys.appearanceMode) var appearanceModeRaw = AppearanceMode.system.rawValue
    @AppStorage(AssistantLayoutPreferences.sidebarCollapsedKey) var isSidebarCollapsed = false
    @AppStorage(AssistantLayoutPreferences.changesSidebarCollapsedKey) var isChangesSidebarCollapsed = true
    @AppStorage(AssistantLayoutPreferences.terminalPanelCollapsedKey) var isTerminalPanelCollapsed = true
    @AppStorage(AppPreferenceKeys.Settings.language) var languageRaw = AppLanguageOption.auto.storageValue
    @AppStorage(DefaultEditorTarget.storageKey) var defaultEditorRaw = DefaultEditorTarget.finder.rawValue
    @AppStorage(AssistantLayoutPreferences.changesSidebarWidthRatioKey) var storedChangesSidebarWidthRatio = 0.0
    @AppStorage(AppPreferenceKeys.Settings.translucentSidebar) var translucentSidebar = true
    @State var windowChromeMetrics = WindowChromeMetrics()
    @State var isMainContentDropTargeted = false
    @State var isSidebarSettingsMenuPresented = false
    @State var isSettingsPanelPresented = false
    @State var isPluginCreateMenuPresented = false
    @State var isPluginMoreMenuPresented = false
    @State var isProjectRunSettingsPresented = false
    @State var isNoProjectFilterPresented = false
    @State var isConversationSearchPresented = false
    @State var conversationSearchQuery = ""
    @State var isCurrentConversationMenuPresented = false
    @State var transcriptScrollMetrics = AppScrollMetrics()
    @State var transcriptScrollController = AppScrollController()
    @State var isChangesSidebarExpanded = false
    @State var filePreviewSelection: WorkspaceFilePreviewSelection?
    @State var terminalCommandRequest: ProjectTerminalCommandRequest?
    @State var selectedDestination: AssistantPanelDestination = .conversation
    @State var automations: [AutomationTask] = []
    @State var isAutomationLoading = false
    @State var automationErrorMessage: String?
    @State var isAutomationCreatePanelPresented = false
    @State var selectedPluginPanelTab: PluginPanelTab = .plugins
    let collapsedTitleBarLeadingPadding: CGFloat = 224
    let titleBarConversationTitleMaxWidth: CGFloat = 360

    var body: some View {
        GeometryReader { geometry in
            let sidebarState = AssistantPanelLayout.responsiveSidebarState(
                availableWidth: geometry.size.width,
                prefersSidebarCollapsed: isSidebarCollapsed,
                prefersRightSidebarCollapsed: prefersRightSidebarCollapsed
            )
            let mainPanelLeadingOffset = mainPanelLeadingOffset(isSidebarCollapsed: sidebarState.isSidebarCollapsed)

            ZStack(alignment: .leading) {
                sidebar(isCollapsed: sidebarState.isSidebarCollapsed)
                    .frame(width: AssistantPanelLayout.expandedSidebarWidth, height: geometry.size.height, alignment: .leading)
                    .zIndex(0)

                mainPanel(sidebarState: sidebarState)
                    .frame(
                        width: max(0, geometry.size.width - mainPanelLeadingOffset),
                        height: geometry.size.height,
                        alignment: .topLeading
                    )
                    .offset(x: mainPanelLeadingOffset)
                    .zIndex(1)

                overlayLayer(size: geometry.size)
            }
        }
        .frame(
            minWidth: AssistantPanelLayout.responsiveMinimumWindowWidth,
            minHeight: AssistantPanelLayout.minimumWindowHeight
        )
        .background(translucentSidebar ? AppTheme.transparent : AppTheme.canvas)
        .background(
            WindowChromeMetricsReader(metrics: $windowChromeMetrics)
                .frame(width: 0, height: 0)
        )
        .ignoresSafeArea(.container, edges: .top)
        .animation(terminalPanelAnimation, value: isTerminalPanelCollapsed)
        .preferredColorScheme(appearanceMode.preferredColorScheme)
        .onChange(of: isSettingsPanelPresented) { _, isPresented in
            if isPresented {
                isSidebarSettingsMenuPresented = false
                isNoProjectFilterPresented = false
                closeConversationSearch()
                isProjectRunSettingsPresented = false
                isAutomationCreatePanelPresented = false
            }
        }
        .onChange(of: isConversationSearchPresented) { _, isPresented in
            if !isPresented {
                conversationSearchQuery = ""
            }
        }
        .onChange(of: isChangesSidebarCollapsed) { _, isCollapsed in
            if isCollapsed {
                isChangesSidebarExpanded = false
            }
        }
        .onChange(of: appModel.currentConversation.id) { _, _ in
            filePreviewSelection = nil
        }
        .task {
            await loadAutomationTasks()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("main.content")
    }

    var appearanceMode: AppearanceMode {
        AppearanceMode(storedValue: appearanceModeRaw)
    }

    var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }

    private func overlayLayer(size: CGSize) -> some View {
        AssistantPanelOverlayLayerView(
            size: size,
            isSettingsPanelPresented: $isSettingsPanelPresented,
            isProjectRunSettingsPresented: $isProjectRunSettingsPresented,
            isAutomationCreatePanelPresented: $isAutomationCreatePanelPresented,
            conversationSearchQuery: $conversationSearchQuery,
            isConversationSearchPresented: isConversationSearchPresented,
            isLaunchAtLoginEnabled: appModel.isLaunchAtLoginEnabled,
            currentProject: appModel.currentProject,
            projects: appModel.projects,
            selectedModelName: appModel.selectedModelName,
            conversationSearchResults: conversationSearchResults,
            isConversationSearchFiltering: !conversationSearchQueryText.isEmpty,
            language: appLanguage,
            currentConversationID: appModel.currentConversation.id,
            title: displayTitle(for:),
            projectName: projectName(for:),
            isGenerating: { appModel.isConversationGenerating($0.id) },
            onToggleLaunchAtLogin: { appModel.toggleLaunchAtLogin($0) },
            onRefreshModels: { Task { await appModel.refreshModels() } },
            onSaveAndRunProjectCommand: saveAndRunProjectCommand,
            onCreateAutomation: createAutomation,
            onCloseConversationSearch: closeConversationSearch,
            onOpenConversationFromSearch: openConversationFromSearch
        )
    }

    private func mainPanel(sidebarState: AssistantPanelLayout.ResponsiveSidebarState) -> some View {
        AssistantPanelMainPanelView(
            sidebarState: sidebarState,
            selectedDestination: selectedDestination,
            isChangesSidebarExpanded: isChangesSidebarExpanded,
            isTerminalPanelCollapsed: $isTerminalPanelCollapsed,
            storedChangesSidebarWidthRatio: $storedChangesSidebarWidthRatio,
            terminalCommandRequest: terminalCommandRequest,
            currentProject: appModel.currentProject,
            terminalPanelAnimation: terminalPanelAnimation
        ) {
            titleBar(sidebarState: sidebarState)
        } automationsContent: {
            automationsContentArea
        } pluginsContent: {
            pluginsContentArea
        } pluginManagementContent: {
            pluginManagementContentArea
        } conversationContent: {
            conversationContentArea
        } rightSidebarContent: {
            rightSidebarContent
        }
    }

    private var automationsContentArea: some View {
        AutomationsPanelView(
            automations: automations,
            projects: appModel.projects,
            isLoading: isAutomationLoading,
            errorMessage: automationErrorMessage,
            onRefresh: {
                Task {
                    await loadAutomationTasks()
                }
            },
            onCreate: {
                isAutomationCreatePanelPresented = true
            }
        )
    }

    private var pluginsContentArea: some View {
        PluginsPanelView(
            selectedTab: $selectedPluginPanelTab,
            plugins: appModel.availablePlugins,
            skills: appModel.availableSkills,
            errorMessage: appModel.pluginErrorMessage,
            onRefresh: {
                appModel.refreshPlugins()
            }
        )
    }

    private var pluginManagementContentArea: some View {
        PluginManagementPanelView(
            plugins: appModel.availablePlugins,
            skills: appModel.availableSkills,
            mcpServerStatuses: appModel.mcpServerStatuses,
            errorMessage: appModel.pluginErrorMessage,
            onBack: {
                selectedDestination = .plugins
            },
            onRefresh: {
                appModel.refreshPlugins()
            },
            onTogglePlugin: { plugin, enabled in
                appModel.setPluginEnabled(plugin, enabled: enabled)
            }
        )
    }

    private var terminalPanelAnimation: Animation {
        .easeInOut(duration: 0.2)
    }

    @ViewBuilder
    private var rightSidebarContent: some View {
        ZStack(alignment: .leading) {
            if let filePreviewSelection {
                WorkspaceFilePreviewSidebarView(
                    selection: filePreviewSelection,
                    onClose: {
                        self.filePreviewSelection = nil
                        if isChangesSidebarCollapsed {
                            isChangesSidebarExpanded = false
                        }
                    }
                )
                .transition(.opacity)
            } else if !isChangesSidebarCollapsed {
                WorkspaceChangesSidebarView(
                    project: appModel.currentProject,
                    isCollapsed: $isChangesSidebarCollapsed
                )
                .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .clipped()
    }

    private var conversationContentArea: some View {
        AssistantPanelConversationContentView(
            conversation: appModel.currentConversation,
            currentTitle: currentTitle,
            isCurrentConversationLoading: appModel.isCurrentConversationLoading,
            errorMessage: appModel.errorMessage,
            hotkeyRegistrationFailed: appModel.hotkeyRegistrationFailed,
            language: appLanguage,
            newConversationPromptTitle: newConversationPromptTitle,
            messageContext: appModel.messageBubbleContext,
            messageActions: appModel.messageBubbleActions,
            isDropTargeted: $isMainContentDropTargeted,
            transcriptScrollMetrics: $transcriptScrollMetrics,
            transcriptScrollController: transcriptScrollController,
            onPreviewWorkspaceFile: previewWorkspaceFile,
            onDrop: handleMainContentDrop(providers:)
        ) {
            composer
        }
    }

    private func titleBar(sidebarState: AssistantPanelLayout.ResponsiveSidebarState) -> some View {
        AssistantPanelTitleBarView(
            sidebarState: sidebarState,
            language: appLanguage,
            headerHeight: headerHeight,
            leadingPadding: titleBarLeadingPadding(isSidebarCollapsed: sidebarState.isSidebarCollapsed),
            titleMaxWidth: titleBarConversationTitleMaxWidth,
            currentTitle: currentTitle,
            currentProjectName: appModel.currentProjectName,
            currentConversation: appModel.currentConversation,
            currentProject: appModel.currentProject,
            selectedDestination: $selectedDestination,
            selectedPluginPanelTab: $selectedPluginPanelTab,
            isPluginCreateMenuPresented: $isPluginCreateMenuPresented,
            isPluginMoreMenuPresented: $isPluginMoreMenuPresented,
            isCurrentConversationMenuPresented: $isCurrentConversationMenuPresented,
            defaultEditorRaw: $defaultEditorRaw,
            isTerminalPanelCollapsed: $isTerminalPanelCollapsed,
            isChangesSidebarExpanded: $isChangesSidebarExpanded,
            isChangesSidebarCollapsed: $isChangesSidebarCollapsed,
            filePreviewSelection: $filePreviewSelection,
            onRefreshPlugins: { appModel.refreshPlugins() },
            onPrefillCreateCommand: prefillCreateCommand,
            onOpenProjectRunSettings: presentProjectRunSettings,
            onTogglePinConversation: { appModel.togglePinConversation($0) },
            onRenameConversation: { appModel.renameConversationWithPrompt($0) },
            onArchiveConversation: { appModel.archiveConversation($0) },
            onCopyWorkspacePath: { appModel.copyCurrentConversationWorkspacePath() },
            onCopyConversationID: { appModel.copyConversationID($0) },
            onCopyDeepLink: { appModel.copyConversationDeepLink($0) },
            onCopyMarkdown: { conversation, title in appModel.copyConversationAsMarkdown(conversation, title: title) }
        )
    }

    private func prefillCreateCommand(_ command: String) {
        selectedDestination = .conversation
        appModel.draft = command
    }

    private func presentProjectRunSettings() {
        isSidebarSettingsMenuPresented = false
        isNoProjectFilterPresented = false
        isProjectRunSettingsPresented = true
    }

    private func saveAndRunProjectCommand(_ command: String) {
        guard let project = appModel.currentProject else {
            return
        }

        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return
        }

        appModel.updateProjectStartupCommand(project, command: trimmed)
        terminalCommandRequest = ProjectTerminalCommandRequest(command: trimmed)
        isProjectRunSettingsPresented = false
        withAnimation(terminalPanelAnimation) {
            isTerminalPanelCollapsed = false
        }
    }

    private var composer: some View {
        ComposerBarView(
            draft: $appModel.draft,
            routingMode: appModel.routingMode,
            toolPermissionMode: appModel.toolPermissionMode,
            attachments: appModel.pendingAttachments,
            projects: appModel.projects,
            skills: appModel.availableSkills,
            selectedProjectID: appModel.currentConversation.projectID ?? appModel.selectedProjectID,
            showsWorkspacePicker: appModel.currentConversation.messages.isEmpty && !appModel.isCurrentConversationLoading,
            allowsNoProjectSelection: appModel.allowsNoProjectForCurrentNewConversation,
            isVoiceInputActive: appModel.isVoiceInputActive,
            canSubmit: appModel.canSubmit,
            contextWindowUsage: appModel.contextWindowUsage,
            onPickAttachments: { appModel.pickAttachments() },
            onDropAttachments: { appModel.addPendingAttachments(from: $0) },
            onDropTargetChange: { isMainContentDropTargeted = $0 },
            onRemoveAttachment: { appModel.removePendingAttachment($0) },
            onSelectWorkspace: { appModel.setWorkspaceForCurrentNewConversation($0) },
            onPickWorkspaceFolder: { appModel.pickWorkspaceFolder(preserveCurrentDraft: true) },
            onSetRoutingMode: { appModel.setRoutingMode($0) },
            onSetToolPermissionMode: { appModel.setToolPermissionMode($0) },
            onToggleVoiceInput: { Task { await appModel.toggleVoiceInput() } },
            onSubmit: { Task { await appModel.submitDraft() } }
        )
    }

    private var prefersRightSidebarCollapsed: Bool {
        filePreviewSelection == nil && isChangesSidebarCollapsed
    }

    private func previewWorkspaceFile(_ rawPath: String) {
        guard let project = appModel.currentProject,
              let projectPath = project.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !projectPath.isEmpty,
              let reference = WorkspacePathLinkExtractor.reference(from: rawPath, projectRootPath: projectPath) else {
            return
        }

        filePreviewSelection = WorkspaceFilePreviewSelection(
            projectID: project.id,
            projectName: project.name,
            projectPath: projectPath,
            path: reference.path,
            line: reference.line,
            column: reference.column
        )
        isChangesSidebarExpanded = false
    }

    private var currentTitle: String {
        appModel.currentConversation.title == "New Chat" ? tr("新聊天", "New chat") : displayTitle(for: appModel.currentConversation)
    }

    func displayTitle(for conversation: StoredConversation) -> String {
        AssistantPanelConversationTitleFormatter.title(
            for: conversation,
            skills: appModel.availableSkills,
            language: appLanguage
        )
    }

    private var newConversationPromptTitle: String {
        appModel.currentConversation.projectID != nil || appModel.selectedProjectID != nil ? tr("我们该构建什么？", "What should we build?") : tr("我们该做什么？", "What should we do?")
    }

    var sidebarTopInset: CGFloat { max(headerHeight + 6, windowChromeMetrics.titleBarHeight + 8) }

    var headerHeight: CGFloat { max(40, min(44, windowChromeMetrics.titleBarHeight + 4)) }

    private func titleBarLeadingPadding(isSidebarCollapsed: Bool) -> CGFloat { isSidebarCollapsed ? collapsedTitleBarLeadingPadding : 20 }

    private func mainPanelLeadingOffset(isSidebarCollapsed: Bool) -> CGFloat { isSidebarCollapsed ? 0 : AssistantPanelLayout.expandedSidebarWidth + AssistantPanelLayout.sidebarDividerWidth }

    private func loadAutomationTasks() async {
        isAutomationLoading = true
        do {
            let loaded = try await Task.detached {
                try AutomationStore().loadAutomations()
            }.value
            automations = loaded
            automationErrorMessage = nil
        } catch {
            automationErrorMessage = localizedAutomationError(error.localizedDescription)
        }
        isAutomationLoading = false
    }

    private func createAutomation(_ draft: AutomationDraft) {
        guard draft.canCreate else {
            return
        }

        Task {
            do {
                let created = try await Task.detached {
                    try AutomationStore().createAutomation(draft)
                }.value
                automations = (automations + [created]).sorted { lhs, rhs in
                    if lhs.createdAtMilliseconds == rhs.createdAtMilliseconds {
                        return lhs.id < rhs.id
                    }
                    return lhs.createdAtMilliseconds < rhs.createdAtMilliseconds
                }
                automationErrorMessage = nil
                isAutomationCreatePanelPresented = false
                selectedDestination = .automations
                NotificationCenter.default.post(name: .automationTasksDidChange, object: nil)
            } catch {
                automationErrorMessage = localizedAutomationError(error.localizedDescription)
            }
        }
    }

    private func localizedAutomationError(_ message: String) -> String {
        AssistantPanelAutomationErrorFormatter.localized(message, language: appLanguage)
    }

    private func handleMainContentDrop(providers: [NSItemProvider]) -> Bool {
        AssistantPanelDropHandler.handleFileDrop(
            providers: providers,
            addAttachments: appModel.addPendingAttachments(from:)
        )
    }
}
