import SwiftUI

struct AssistantPanelTitleBarView: View {
    let sidebarState: AssistantPanelLayout.ResponsiveSidebarState
    let language: AppLanguage
    let headerHeight: CGFloat
    let leadingPadding: CGFloat
    let titleMaxWidth: CGFloat
    let currentTitle: String
    let currentProjectName: String?
    let currentConversation: StoredConversation
    let currentProject: ConversationProject?
    @Binding var selectedDestination: AssistantPanelDestination
    @Binding var selectedPluginPanelTab: PluginPanelTab
    @Binding var isPluginCreateMenuPresented: Bool
    @Binding var isPluginMoreMenuPresented: Bool
    @Binding var isCurrentConversationMenuPresented: Bool
    @Binding var defaultEditorRaw: String
    @Binding var isTerminalPanelCollapsed: Bool
    @Binding var isChangesSidebarExpanded: Bool
    @Binding var isChangesSidebarCollapsed: Bool
    @Binding var filePreviewSelection: WorkspaceFilePreviewSelection?
    let onRefreshPlugins: () -> Void
    let onPrefillCreateCommand: (String) -> Void
    let onOpenProjectRunSettings: () -> Void
    let onTogglePinConversation: (StoredConversation) -> Void
    let onRenameConversation: (StoredConversation) -> Void
    let onArchiveConversation: (StoredConversation) -> Void
    let onCopyWorkspacePath: () -> Void
    let onCopyConversationID: (StoredConversation) -> Void
    let onCopyDeepLink: (StoredConversation) -> Void
    let onCopyMarkdown: (StoredConversation, String) -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            if selectedDestination == .plugins {
                pluginTitleTabs
                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                    .clipped()

                pluginTitleActions
                    .fixedSize()
            } else {
                titleBarTitleGroup
                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                    .clipped()
            }

            if selectedDestination == .conversation {
                HStack(spacing: 4) {
                    projectRunSettingsButton
                        .fixedSize()

                    DefaultEditorPickerButton(selection: defaultEditorSelection)
                        .fixedSize()

                    terminalPanelToggleButton
                        .fixedSize()
                }
                .fixedSize()

                changesSidebarControlGroup(isRightSidebarCollapsed: sidebarState.isRightSidebarCollapsed)
                    .fixedSize()
            }
        }
        .padding(.leading, leadingPadding)
        .padding(.trailing, 20)
        .frame(height: headerHeight)
        .background(AppTheme.canvas)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("header")
    }

    private var pluginTitleTabs: some View {
        HStack(spacing: 4) {
            ForEach(PluginPanelTab.allCases) { tab in
                Button {
                    selectedPluginPanelTab = tab
                } label: {
                    Text(tab.title(language: language))
                        .font(.system(size: DesignTokens.FontSize.body, weight: selectedPluginPanelTab == tab ? .bold : .medium))
                        .foregroundStyle(selectedPluginPanelTab == tab ? AppTheme.textPrimary : AppTheme.textTertiary)
                        .padding(.horizontal, 10)
                        .frame(height: DesignTokens.ControlSize.standardButton)
                        .background(selectedPluginPanelTab == tab ? AppTheme.surfaceHover : AppTheme.transparent)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
                        .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("header.plugins.tab.\(tab.rawValue)")
            }
        }
    }

    private var pluginTitleActions: some View {
        HStack(spacing: 6) {
            Button {
                selectedDestination = .pluginManagement
                onRefreshPlugins()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "gearshape")
                        .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
                    Text(tr("管理", "Manage"))
                        .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                }
                .foregroundStyle(AppTheme.textPrimary)
                .padding(.horizontal, 10)
                .frame(height: DesignTokens.ControlSize.standardButton)
                .background(AppTheme.surfaceHover)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("header.plugins.manage")

            Button {
                isPluginCreateMenuPresented.toggle()
            } label: {
                HStack(spacing: 6) {
                    Text(tr("创建", "Create"))
                        .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                    Image(systemName: "chevron.down")
                        .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                }
                .foregroundStyle(AppTheme.textPrimary)
                .padding(.horizontal, 10)
                .frame(height: DesignTokens.ControlSize.standardButton)
                .background(isPluginCreateMenuPresented ? AppTheme.surfaceHover : AppTheme.transparent)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous)
                        .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
                )
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
            }
            .buttonStyle(.plain)
            .popover(isPresented: $isPluginCreateMenuPresented, arrowEdge: .bottom) {
                pluginCreateMenuPanel
            }
            .accessibilityIdentifier("header.plugins.create")

            AppIconButton(
                systemName: "ellipsis",
                accessibilityLabel: tr("更多", "More"),
                help: tr("更多", "More"),
                hoverStyle: .titleBar,
                tint: AppTheme.textTertiary
            ) {
                isPluginMoreMenuPresented.toggle()
            }
            .popover(isPresented: $isPluginMoreMenuPresented, arrowEdge: .bottom) {
                pluginMoreMenuPanel
            }
            .accessibilityIdentifier("header.plugins.more")
        }
    }

    private var pluginCreateMenuPanel: some View {
        VStack(alignment: .leading, spacing: 2) {
            pluginMenuActionRow(title: tr("创建插件", "Create plugin"), systemName: "square.grid.2x2") {
                isPluginCreateMenuPresented = false
                onPrefillCreateCommand("/plugin-creator ")
            }
            pluginMenuActionRow(title: tr("创建技能", "Create skill"), systemName: "wand.and.stars") {
                isPluginCreateMenuPresented = false
                onPrefillCreateCommand("/skill-creator ")
            }
        }
        .padding(DesignTokens.Spacing.control)
        .frame(width: 176, alignment: .leading)
        .background(AppTheme.surface)
    }

    private var pluginMoreMenuPanel: some View {
        VStack(alignment: .leading, spacing: 2) {
            pluginMenuActionRow(title: tr("刷新", "Refresh"), systemName: "arrow.clockwise") {
                isPluginMoreMenuPresented = false
                onRefreshPlugins()
            }
        }
        .padding(DesignTokens.Spacing.control)
        .frame(width: 144, alignment: .leading)
        .background(AppTheme.surface)
    }

    private func pluginMenuActionRow(title: String, systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: systemName)
                    .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(width: DesignTokens.IconFrame.sidebar)

                Text(title)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Spacer(minLength: DesignTokens.Spacing.control)
            }
            .padding(.horizontal, DesignTokens.Spacing.related)
            .frame(maxWidth: .infinity, minHeight: DesignTokens.ControlSize.menuRow, alignment: .leading)
            .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
        }
        .buttonStyle(.plain)
    }

    private var titleBarTitleGroup: some View {
        HStack(spacing: 8) {
            Text(titleBarTitle)
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .bold))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: titleBarTitleMaxWidth, alignment: .leading)
                .layoutPriority(1)
                .accessibilityIdentifier("header.title")

            if selectedDestination == .conversation {
                currentConversationMenuButton

                if let currentProjectName {
                    Text(currentProjectName)
                        .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .accessibilityIdentifier("header.project")
                }
            }

            Spacer(minLength: 0)
        }
        .onChange(of: currentConversation.id) { _, _ in
            isCurrentConversationMenuPresented = false
        }
    }

    private var titleBarTitle: String {
        switch selectedDestination {
        case .conversation:
            currentTitle
        case .plugins:
            tr("插件", "Plugins")
        case .pluginManagement:
            tr("管理插件", "Manage plugins")
        case .automations:
            tr("自动化", "Automations")
        }
    }

    private var titleBarTitleMaxWidth: CGFloat? {
        selectedDestination == .conversation ? titleMaxWidth : nil
    }

    private var currentConversationMenuButton: some View {
        ConversationTitleMenuButton(
            conversation: currentConversation,
            project: currentProject,
            isPresented: $isCurrentConversationMenuPresented,
            onTogglePin: { onTogglePinConversation(currentConversation) },
            onRename: { onRenameConversation(currentConversation) },
            onArchive: { onArchiveConversation(currentConversation) },
            onCopyWorkspacePath: onCopyWorkspacePath,
            onCopyConversationID: { onCopyConversationID(currentConversation) },
            onCopyDeepLink: { onCopyDeepLink(currentConversation) },
            onCopyMarkdown: { onCopyMarkdown(currentConversation, currentTitle) }
        )
        .fixedSize()
        .accessibilityIdentifier("header.conversationMenu")
    }

    private var defaultEditorSelection: Binding<DefaultEditorTarget> {
        Binding(
            get: {
                DefaultEditorTarget(storedValue: defaultEditorRaw)
            },
            set: { target in
                defaultEditorRaw = target.rawValue
            }
        )
    }

    private var projectRunSettingsButton: some View {
        AppIconButton(
            systemName: "play",
            accessibilityLabel: tr("设置运行操作", "Set run action"),
            help: tr("设置运行操作", "Set run action"),
            hoverStyle: .titleBar,
            tint: currentProject?.startupCommand == nil ? AppTheme.textTertiary : AppTheme.accent,
            isEnabled: currentProject != nil,
            keyboardShortcut: KeyboardShortcut("r", modifiers: [.command, .shift]),
            action: onOpenProjectRunSettings
        )
        .accessibilityIdentifier("header.projectRun.settings")
    }

    private var terminalPanelToggleButton: some View {
        AppIconButton(
            systemName: "terminal",
            accessibilityLabel: tr("切换终端", "Toggle terminal"),
            help: tr("切换终端", "Toggle terminal"),
            hoverStyle: .titleBar,
            tint: isTerminalPanelCollapsed ? AppTheme.textTertiary : AppTheme.accent,
            keyboardShortcut: KeyboardShortcut("j", modifiers: .command)
        ) {
            withAnimation(terminalPanelAnimation) {
                isTerminalPanelCollapsed.toggle()
            }
        }
        .accessibilityIdentifier("header.terminal.toggle")
    }

    private func changesSidebarControlGroup(isRightSidebarCollapsed: Bool) -> some View {
        HStack(spacing: 4) {
            if !isRightSidebarCollapsed {
                changesSidebarExpandButton
            }
            changesSidebarToggleButton
        }
        .accessibilityElement(children: .contain)
    }

    private var changesSidebarExpandButton: some View {
        PanelExpansionButton(
            isExpanded: isChangesSidebarExpanded,
            accessibilityLabel: isChangesSidebarExpanded ? tr("还原右侧面板", "Restore changes panel") : tr("展开右侧面板", "Expand changes panel"),
            help: isChangesSidebarExpanded ? tr("还原右侧面板", "Restore changes panel") : tr("展开右侧面板", "Expand changes panel")
        ) {
            isChangesSidebarExpanded.toggle()
        }
        .accessibilityIdentifier("header.changesSidebar.expand")
    }

    private var changesSidebarToggleButton: some View {
        AppIconButton(
            systemName: "sidebar.right",
            accessibilityLabel: rightSidebarToggleLabel,
            help: rightSidebarToggleLabel,
            hoverStyle: .titleBar,
            tint: AppTheme.textTertiary,
            keyboardShortcut: KeyboardShortcut("j", modifiers: [.command, .shift])
        ) {
            if filePreviewSelection != nil {
                filePreviewSelection = nil
                if isChangesSidebarCollapsed {
                    isChangesSidebarExpanded = false
                }
                return
            }
            if !isChangesSidebarCollapsed {
                isChangesSidebarExpanded = false
            }
            isChangesSidebarCollapsed.toggle()
        }
        .accessibilityIdentifier("header.changesSidebar.toggle")
    }

    private var rightSidebarToggleLabel: String {
        if filePreviewSelection != nil {
            return tr("收起文件预览", "Close file preview")
        }
        return isChangesSidebarCollapsed ? tr("展开修改栏", "Expand changes sidebar") : tr("收起修改栏", "Collapse changes sidebar")
    }

    private var terminalPanelAnimation: Animation {
        .easeInOut(duration: 0.2)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: language)
    }
}
