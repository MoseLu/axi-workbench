import SwiftUI

struct AssistantPanelSidebarView: View {
    let snapshot: AssistantSidebarSnapshot
    let actions: AssistantSidebarActions
    let topInset: CGFloat
    let isCollapsed: Bool
    @Binding var isSettingsMenuPresented: Bool
    @Binding var isNoProjectFilterPresented: Bool

    @State private var sidebarScrollMetrics = AppScrollMetrics()
    @State private var sidebarScrollController = AppScrollController()
    @State private var expandedProjectIDs = Set<UUID>()
    @State private var collapsedProjectIDs = Set<UUID>()
    @State private var expandedProjectConversationListIDs = Set<UUID>()
    @State private var isNoProjectConversationListExpanded = false
    @State private var hoveredProjectID: UUID?
    @State private var noProjectOrganization: SidebarConversationOrganization = .byProject
    @State private var noProjectSortOption: SidebarConversationSortOption = .updatedAt
    @State private var noProjectDisplayScope: SidebarConversationDisplayScope = .all

    private let sidebarConversationPreviewLimit = 5

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            expandedSidebar

            if isSettingsMenuPresented {
                AppTheme.dismissalOverlay
                    .contentShape(Rectangle())
                    .onTapGesture {
                        isSettingsMenuPresented = false
                    }

                SidebarSettingsMenuPanel(
                    onOpenSettings: {
                        isSettingsMenuPresented = false
                        actions.openSettings()
                    },
                    onQuit: {
                        isSettingsMenuPresented = false
                        actions.quit()
                    }
                )
                .frame(width: AssistantPanelLayout.expandedSidebarWidth, alignment: .center)
                .padding(.bottom, 56)
                .zIndex(1)
            }
        }
        .frame(width: AssistantPanelLayout.expandedSidebarWidth, alignment: .leading)
        .clipped()
        .allowsHitTesting(!isCollapsed)
        .accessibilityHidden(isCollapsed)
        .background {
            SidebarBackgroundView(isTranslucent: snapshot.isTranslucent)
        }
        .onChange(of: snapshot.projectGroups.map(\.id)) { _, _ in
            pruneProjectExpansionState()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sidebar")
    }

    private var expandedSidebar: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.related) {
            sidebarPrimaryNavigation
                .padding(.horizontal, AssistantPanelLayout.sidebarContentHorizontalPadding)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.content) {
                    pinnedConversationSection
                    projectSection
                    noProjectConversationSection
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, AssistantPanelLayout.sidebarContentHorizontalPadding)
                .padding(.bottom, 8)
                .background(
                    AppScrollMetricsReader(
                        metrics: $sidebarScrollMetrics,
                        controller: sidebarScrollController
                    )
                )
            }
            .overlay(alignment: .topTrailing) {
                AppVerticalScrollIndicator(
                    metrics: sidebarScrollMetrics,
                    controller: sidebarScrollController,
                    width: 6,
                    trailingInset: 4,
                    verticalInset: 2,
                    minimumThumbHeight: 34
                )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .accessibilityIdentifier("sidebar.navigation")

            sidebarSettingsMenu
                .padding(.horizontal, AssistantPanelLayout.sidebarContentHorizontalPadding)
        }
        .padding(.top, topInset)
        .padding(.bottom, DesignTokens.Spacing.control)
    }

    private var sidebarSettingsMenu: some View {
        SidebarSettingsAnchorButton(
            isPresented: isSettingsMenuPresented,
            title: tr("设置", "Settings"),
            action: {
                isSettingsMenuPresented.toggle()
            }
        )
    }

    private var sidebarPrimaryNavigation: some View {
        VStack(alignment: .leading, spacing: 4) {
            SidebarPrimaryNavigationButton(
                title: tr("新对话", "New chat"),
                systemName: "square.and.pencil",
                accessibilityIdentifier: "sidebar.newChat",
                isSelected: snapshot.selectedDestination == .conversation
                    && snapshot.currentConversationIsEmpty
                    && !snapshot.isCurrentConversationLoading,
                action: actions.newChat
            )

            SidebarPrimaryNavigationButton(
                title: tr("搜索", "Search"),
                systemName: "magnifyingglass",
                accessibilityIdentifier: "sidebar.search",
                suppressHoverStyle: snapshot.isSearchPresented,
                action: actions.toggleSearch
            )

            SidebarPrimaryNavigationButton(
                title: tr("插件", "Plugins"),
                systemName: "circle.grid.2x2",
                accessibilityIdentifier: "sidebar.plugins",
                isSelected: snapshot.selectedDestination == .plugins || snapshot.selectedDestination == .pluginManagement,
                action: {
                    isSettingsMenuPresented = false
                    isNoProjectFilterPresented = false
                    actions.openPlugins()
                }
            )

            SidebarPrimaryNavigationButton(
                title: tr("自动化", "Automations"),
                systemName: "clock",
                accessibilityIdentifier: "sidebar.automations",
                isSelected: snapshot.selectedDestination == .automations,
                badgeText: snapshot.automationCount == 0 ? nil : "\(snapshot.automationCount)",
                action: {
                    isSettingsMenuPresented = false
                    isNoProjectFilterPresented = false
                    actions.openAutomations()
                }
            )
        }
    }

    @ViewBuilder
    private var pinnedConversationSection: some View {
        if !snapshot.pinnedConversations.isEmpty {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.related) {
                Text(tr("置顶", "Pinned"))
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .padding(.horizontal, AssistantPanelLayout.sidebarRowHorizontalPadding)

                ForEach(snapshot.pinnedConversations) { conversation in
                    conversationButton(conversation, indent: 0)
                }
            }
        }
    }

    private var projectSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.compact) {
            HStack {
                Text(tr("项目", "Projects"))
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .padding(.horizontal, AssistantPanelLayout.sidebarRowHorizontalPadding)
                Spacer()
            }

            if snapshot.projectGroups.isEmpty {
                Button {
                    actions.chooseWorkspaceFolder()
                } label: {
                    HStack(spacing: AssistantPanelLayout.sidebarIconTextSpacing) {
                        Image(systemName: "folder.badge.plus")
                            .font(.system(size: DesignTokens.IconSize.medium, weight: .semibold))
                            .frame(
                                width: AssistantPanelLayout.sidebarIconColumnWidth,
                                height: DesignTokens.ControlSize.standardButton
                            )
                        Text(tr("选择文件夹作为项目", "Choose a folder as a project"))
                            .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                        Spacer()
                    }
                    .foregroundStyle(AppTheme.textSecondary)
                    .padding(.horizontal, AssistantPanelLayout.sidebarRowHorizontalPadding)
                    .padding(.vertical, DesignTokens.Spacing.small)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tr("选择文件夹作为项目", "Choose a folder as a project"))
            } else {
                ForEach(snapshot.projectGroups) { group in
                    projectBlock(group)
                }
            }
        }
    }

    private func projectBlock(_ group: AssistantSidebarProjectGroup) -> some View {
        let project = group.project
        let projectConversations = group.conversations
        let isExpanded = isProjectExpanded(project)
        let isHovered = hoveredProjectID == project.id
        let isConversationListExpanded = expandedProjectConversationListIDs.contains(project.id)
        let visibleProjectConversations = isConversationListExpanded
            ? projectConversations
            : Array(projectConversations.prefix(sidebarConversationPreviewLimit))

        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.xSmall) {
            HStack(spacing: DesignTokens.Spacing.compact) {
                Button {
                    toggleProjectExpansion(project)
                } label: {
                    HStack(spacing: AssistantPanelLayout.sidebarIconTextSpacing) {
                        SidebarFolderIcon(isExpanded: isExpanded)
                            .foregroundStyle(AppTheme.textSecondary)
                        Text(project.name)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(AppTheme.textPrimary)
                            .lineLimit(1)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: DesignTokens.Spacing.compact) {
                    projectMenu(project)
                        .frame(
                            width: DesignTokens.ControlSize.standardButton,
                            height: DesignTokens.ControlSize.standardButton
                        )
                        .opacity(isHovered ? 1 : 0)
                        .allowsHitTesting(isHovered)
                        .accessibilityHidden(!isHovered)

                    AppIconButton(
                        systemName: "square.and.pencil",
                        accessibilityLabel: tr("在 \(project.name) 中新建对话", "New chat in \(project.name)"),
                        help: tr("在此项目中新建对话", "New chat in this project"),
                        hoverStyle: .titleBar,
                        tint: AppTheme.textSecondary
                    ) {
                        actions.newChatInProject(project.id)
                    }
                    .frame(width: AssistantPanelLayout.sidebarTrailingActionWidth, alignment: .trailing)
                }
                .frame(
                    width: DesignTokens.ControlSize.standardButton
                        + DesignTokens.Spacing.compact
                        + AssistantPanelLayout.sidebarTrailingActionWidth,
                    height: DesignTokens.ControlSize.standardButton,
                    alignment: .trailing
                )
            }
            .padding(.horizontal, AssistantPanelLayout.sidebarRowHorizontalPadding)
            .padding(.vertical, DesignTokens.Spacing.xSmall)
            .contentShape(Rectangle())
            .onHover { hovering in
                hoveredProjectID = hovering ? project.id : nil
            }

            if isExpanded {
                if projectConversations.isEmpty {
                    Text(tr("暂无对话", "No chats yet"))
                        .font(.system(size: 11))
                        .foregroundStyle(AppTheme.textTertiary)
                        .padding(.leading, 42)
                        .padding(.vertical, 2)
                } else {
                    ForEach(visibleProjectConversations) { conversation in
                        conversationButton(conversation, indent: 0)
                    }

                    if projectConversations.count > sidebarConversationPreviewLimit {
                        conversationListToggleButton(
                            title: isConversationListExpanded ? tr("折叠显示", "Show less") : tr("展开显示", "Show more"),
                            accessibilityLabel: isConversationListExpanded
                                ? tr("折叠显示会话", "Show fewer conversations")
                                : tr("展开显示更多会话", "Show more conversations")
                        ) {
                            if isConversationListExpanded {
                                expandedProjectConversationListIDs.remove(project.id)
                            } else {
                                expandedProjectConversationListIDs.insert(project.id)
                            }
                        }
                    }
                }
            }
        }
    }

    private func isProjectExpanded(_ project: ConversationProject) -> Bool {
        if expandedProjectIDs.contains(project.id) {
            return true
        }
        if collapsedProjectIDs.contains(project.id) {
            return false
        }
        return defaultExpandedProjectIDs.contains(project.id)
    }

    private func toggleProjectExpansion(_ project: ConversationProject) {
        if isProjectExpanded(project) {
            expandedProjectIDs.remove(project.id)
            collapsedProjectIDs.insert(project.id)
        } else {
            collapsedProjectIDs.remove(project.id)
            expandedProjectIDs.insert(project.id)
        }
    }

    private var defaultExpandedProjectIDs: Set<UUID> {
        var projectIDs = Set(snapshot.projectGroups.sorted { lhs, rhs in
            if lhs.project.updatedAt == rhs.project.updatedAt {
                return lhs.project.id.uuidString > rhs.project.id.uuidString
            }
            return lhs.project.updatedAt > rhs.project.updatedAt
        }.prefix(1).map(\.id))
        if let currentProjectID = snapshot.currentProjectID {
            projectIDs.insert(currentProjectID)
        }
        return projectIDs
    }

    private func pruneProjectExpansionState() {
        let validProjectIDs = Set(snapshot.projectGroups.map(\.id))
        expandedProjectIDs = expandedProjectIDs.intersection(validProjectIDs)
        collapsedProjectIDs = collapsedProjectIDs.intersection(validProjectIDs)
        expandedProjectConversationListIDs = expandedProjectConversationListIDs.intersection(validProjectIDs)
    }

    private func projectMenu(_ project: ConversationProject) -> some View {
        SidebarProjectMenuButton(
            project: project,
            onRename: { actions.renameProject(project) },
            onOpenInDefaultEditor: { actions.openProjectInDefaultEditor(project) },
            onDelete: { actions.deleteProject(project) }
        )
        .accessibilityLabel(tr("\(project.name) 项目操作", "\(project.name) project actions"))
    }

    private var noProjectConversationSection: some View {
        let conversations = noProjectConversations
        let visibleConversations = isNoProjectConversationListExpanded
            ? conversations
            : Array(conversations.prefix(sidebarConversationPreviewLimit))

        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.related) {
            HStack(spacing: DesignTokens.Spacing.compact) {
                Text(tr("对话", "Chats"))
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                Spacer()

                noProjectFilterButton

                AppIconButton(
                    systemName: "square.and.pencil",
                    accessibilityLabel: tr("新建无项目对话", "New chat without a project"),
                    help: tr("新建无项目对话", "New chat without a project"),
                    hoverStyle: .titleBar,
                    tint: AppTheme.textSecondary
                ) {
                    actions.newNoProjectChat()
                }
            }
            .frame(height: DesignTokens.ControlSize.standardButton, alignment: .center)
            .padding(.horizontal, AssistantPanelLayout.sidebarRowHorizontalPadding)

            if conversations.isEmpty {
                Text(tr("还没有历史记录", "No history yet"))
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.textTertiary)
                    .padding(.top, 4)
                    .accessibilityIdentifier("sidebar.recentList.empty")
            } else {
                ForEach(visibleConversations) { conversation in
                    conversationButton(conversation, indent: 0)
                }

                if conversations.count > sidebarConversationPreviewLimit {
                    conversationListToggleButton(
                        title: isNoProjectConversationListExpanded ? tr("折叠显示", "Show less") : tr("展开显示", "Show more"),
                        accessibilityLabel: isNoProjectConversationListExpanded
                            ? tr("折叠显示会话", "Show fewer conversations")
                            : tr("展开显示更多会话", "Show more conversations")
                    ) {
                        isNoProjectConversationListExpanded.toggle()
                    }
                }
            }
        }
    }

    private func conversationListToggleButton(
        title: String,
        accessibilityLabel: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: AssistantPanelLayout.sidebarIconTextSpacing) {
                AppTheme.transparent
                    .frame(
                        width: AssistantPanelLayout.sidebarIconColumnWidth,
                        height: DesignTokens.ControlSize.standardButton
                    )

                Text(title)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: DesignTokens.ControlSize.standardButton, alignment: .center)
            .padding(.horizontal, AssistantPanelLayout.sidebarRowHorizontalPadding)
            .padding(.vertical, DesignTokens.Spacing.xSmall)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }

    private var noProjectConversations: [StoredConversation] {
        let scopedConversations: [StoredConversation]
        switch noProjectDisplayScope {
        case .all:
            scopedConversations = snapshot.noProjectConversations
        case .related:
            let currentTitle = snapshot.currentConversationTitle.trimmingCharacters(in: .whitespacesAndNewlines)
            scopedConversations = snapshot.noProjectConversations.filter { conversation in
                conversation.id == snapshot.currentConversationID
                    || (!currentTitle.isEmpty && conversation.title.localizedCaseInsensitiveContains(currentTitle))
            }
        }

        return scopedConversations.sorted { lhs, rhs in
            switch noProjectSortOption {
            case .createdAt:
                if lhs.createdAt == rhs.createdAt {
                    return lhs.id.uuidString > rhs.id.uuidString
                }
                return lhs.createdAt > rhs.createdAt
            case .updatedAt:
                if lhs.updatedAt == rhs.updatedAt {
                    return lhs.id.uuidString > rhs.id.uuidString
                }
                return lhs.updatedAt > rhs.updatedAt
            }
        }
    }

    private var noProjectFilterButton: some View {
        AppIconGlyphButton(
            accessibilityLabel: tr("筛选对话", "Filter chats"),
            help: tr("筛选对话", "Filter chats"),
            hoverStyle: .titleBar,
            action: {
                isNoProjectFilterPresented.toggle()
            }
        ) {
            SidebarFilterIcon()
                .foregroundStyle(AppTheme.textTertiary)
        }
        .popover(isPresented: $isNoProjectFilterPresented, arrowEdge: .trailing) {
            AssistantSidebarFilterPanelView(
                language: snapshot.language,
                organization: $noProjectOrganization,
                sortOption: $noProjectSortOption,
                displayScope: $noProjectDisplayScope
            )
        }
    }

    private func conversationButton(_ conversation: StoredConversation, indent: CGFloat) -> some View {
        SidebarConversationRow(
            conversation: conversation,
            selected: conversation.id == snapshot.currentConversationID,
            isLoading: snapshot.isGenerating(conversation),
            contentIndent: indent,
            onOpen: {
                actions.openConversation(conversation)
            },
            onTogglePin: { actions.togglePinConversation(conversation) },
            onArchive: { actions.archiveConversation(conversation) }
        )
        .contextMenu {
            AssistantSidebarConversationContextMenu(
                conversation: conversation,
                snapshot: snapshot,
                actions: actions
            )
        }
        .accessibilityIdentifier("sidebar.conversation.\(conversation.id.uuidString)")
        .accessibilityLabel(snapshot.title(conversation))
        .accessibilityValue(conversationAccessibilityValue(conversation))
        .accessibilityHint(tr("打开最近会话", "Open recent chat"))
    }

    private func conversationAccessibilityValue(_ conversation: StoredConversation) -> String {
        let model = ModelCatalogService.displayName(for: conversation.model)
        if snapshot.isGenerating(conversation) {
            return "\(model)，\(tr("生成中", "Generating"))"
        }
        return "\(model)，\(SidebarConversationRow.relativeAgeText(for: conversation.updatedAt, language: snapshot.language))"
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: snapshot.language)
    }
}
