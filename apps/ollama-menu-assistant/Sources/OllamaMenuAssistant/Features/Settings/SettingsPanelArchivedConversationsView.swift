import SwiftUI

extension SettingsPanelView {
    var archivedConversationSettings: some View {
        let allConversations = appModel.archivedConversations()
        let conversations = appModel.archivedConversations(
            matching: archivedConversationQuery,
            projectFilter: archivedConversationProjectFilter,
            sortOption: archivedConversationSortOption
        )
        let isFiltering = !archivedConversationQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || archivedConversationProjectFilter != .all
            || archivedConversationSortOption != .updatedAt

        return VStack(alignment: .leading, spacing: 12) {
            ArchivedConversationToolbar(
                query: $archivedConversationQuery,
                projectFilter: $archivedConversationProjectFilter,
                sortOption: $archivedConversationSortOption,
                projects: archivedConversationProjectOptions(from: allConversations),
                projectTitle: archivedConversationProjectFilterTitle,
                sortTitle: { $0.title(language: appLanguage) },
                language: appLanguage
            )

            if allConversations.isEmpty {
                archivedConversationEmptyState(
                    title: tr("没有已归档对话", "No archived chats"),
                    systemName: "archivebox"
                )
            } else if conversations.isEmpty {
                archivedConversationEmptyState(
                    title: tr("没有匹配的已归档对话", "No matching archived chats"),
                    systemName: "magnifyingglass"
                )
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    if isFiltering {
                        Text(
                            tr(
                                "显示 \(conversations.count) / \(allConversations.count) 个对话",
                                "Showing \(conversations.count) of \(allConversations.count) chats"
                            )
                        )
                        .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                        .lineLimit(1)
                    }

                    VStack(spacing: 0) {
                        ForEach(Array(conversations.enumerated()), id: \.element.id) { index, conversation in
                            ArchivedConversationSettingsRow(
                                conversation: conversation,
                                title: archivedConversationTitle(conversation),
                                metadata: archivedConversationMetadata(conversation),
                                restoreTitle: tr("取消归档", "Unarchive"),
                                showDivider: index < conversations.count - 1,
                                onRestore: {
                                    appModel.unarchiveConversation(conversation)
                                }
                            )
                        }
                    }
                    .frame(maxWidth: 672, alignment: .leading)
                    .background(AppTheme.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                            .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
                }
                .frame(maxWidth: 672, alignment: .leading)
            }
        }
        .frame(maxWidth: 672, alignment: .leading)
    }

    func archivedConversationTitle(_ conversation: StoredConversation) -> String {
        let parsedTitle = ChatDisplayText.parse(conversation.title)
        let titleBody = parsedTitle.body.trimmingCharacters(in: .whitespacesAndNewlines)
        if !titleBody.isEmpty {
            return titleBody
        }

        if let firstUserMessage = conversation.messages.first(where: { $0.role == .user }) {
            let parsedMessage = ChatDisplayText.parse(firstUserMessage.content)
            let messageBody = parsedMessage.body.trimmingCharacters(in: .whitespacesAndNewlines)
            if !messageBody.isEmpty {
                return messageBody
            }
        }

        return conversation.title == "New Chat" ? tr("新聊天", "New chat") : conversation.title
    }

    func archivedConversationMetadata(_ conversation: StoredConversation) -> String {
        "\(formatArchivedConversationDate(conversation.updatedAt)) · \(archivedConversationProjectName(conversation))"
    }

    func archivedConversationProjectName(_ conversation: StoredConversation) -> String {
        guard let projectID = conversation.projectID,
              let project = appModel.projects.first(where: { $0.id == projectID }) else {
            return tr("无项目", "No project")
        }
        return project.name
    }

    func formatArchivedConversationDate(_ date: Date) -> String {
        if appLanguage == .english {
            return date.formatted(date: .abbreviated, time: .shortened)
        }

        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        let timeFormatter = DateFormatter()
        timeFormatter.locale = Locale(identifier: "zh_CN")
        timeFormatter.dateFormat = "HH:mm"
        return "\(components.year ?? 0)年\(components.month ?? 0)月\(components.day ?? 0)日，\(timeFormatter.string(from: date))"
    }

    func archivedConversationProjectOptions(from conversations: [StoredConversation]) -> [ConversationProject] {
        let archivedProjectIDs = Set(conversations.compactMap(\.projectID))
        return appModel.projects
            .filter { archivedProjectIDs.contains($0.id) }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    func archivedConversationProjectFilterTitle(_ filter: ArchivedConversationProjectFilter) -> String {
        switch filter {
        case .all:
            tr("全部项目", "All projects")
        case .noProject:
            tr("无项目", "No project")
        case .project(let projectID):
            appModel.projects.first { $0.id == projectID }?.name ?? tr("未知项目", "Unknown project")
        }
    }

    func archivedConversationEmptyState(title: String, systemName: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: systemName)
                .font(.system(size: DesignTokens.IconSize.regular, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .frame(width: DesignTokens.IconFrame.sidebar)
            Text(title)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .lineLimit(1)
                .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                .allowsTightening(true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .frame(maxWidth: 672, minHeight: 46, alignment: .leading)
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
    }
}

private struct ArchivedConversationToolbar: View {
    @Binding var query: String
    @Binding var projectFilter: ArchivedConversationProjectFilter
    @Binding var sortOption: ArchivedConversationSortOption
    let projects: [ConversationProject]
    let projectTitle: (ArchivedConversationProjectFilter) -> String
    let sortTitle: (ArchivedConversationSortOption) -> String
    let language: AppLanguage

    var body: some View {
        HStack(spacing: 8) {
            ArchivedConversationSearchField(query: $query, language: language)
                .frame(minWidth: 220, maxWidth: .infinity)

            ArchivedConversationMenuButton(
                title: sortTitle(sortOption),
                systemName: sortOption.systemName,
                width: 138
            ) {
                ForEach(ArchivedConversationSortOption.allCases) { option in
                    Button {
                        sortOption = option
                    } label: {
                        Label(sortTitle(option), systemImage: sortOption == option ? "checkmark" : option.systemName)
                    }
                }
            }

            ArchivedConversationMenuButton(
                title: projectTitle(projectFilter),
                systemName: "folder",
                width: 142
            ) {
                Button {
                    projectFilter = .all
                } label: {
                    Label(projectTitle(.all), systemImage: projectFilter == .all ? "checkmark" : "tray.full")
                }

                Button {
                    projectFilter = .noProject
                } label: {
                    Label(projectTitle(.noProject), systemImage: projectFilter == .noProject ? "checkmark" : "folder.badge.questionmark")
                }

                if !projects.isEmpty {
                    Divider()
                    ForEach(projects) { project in
                        Button {
                            projectFilter = .project(project.id)
                        } label: {
                            Label(project.name, systemImage: projectFilter == .project(project.id) ? "checkmark" : "folder")
                        }
                    }
                }
            }
        }
        .frame(maxWidth: 672, alignment: .leading)
        .accessibilityIdentifier("settings.archivedConversations.toolbar")
    }
}

private struct ArchivedConversationSearchField: View {
    @Binding var query: String
    let language: AppLanguage

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .frame(width: DesignTokens.IconFrame.sidebar)

            TextField(
                "",
                text: $query,
                prompt: Text(tr("搜索已归档聊天", "Search archived chats"))
            )
                .textFieldStyle(.plain)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)

            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                        .foregroundStyle(AppTheme.textTertiary)
                        .frame(width: DesignTokens.IconFrame.sidebar, height: DesignTokens.IconFrame.sidebar)
                }
                .buttonStyle(.plain)
                .help(tr("清除搜索", "Clear search"))
                .accessibilityLabel(tr("清除搜索", "Clear search"))
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 34)
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous)
                .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
        .accessibilityIdentifier("settings.archivedConversations.search")
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: language)
    }
}

private struct ArchivedConversationMenuButton<Content: View>: View {
    let title: String
    let systemName: String
    let width: CGFloat
    @ViewBuilder let content: () -> Content

    var body: some View {
        Menu {
            content()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: systemName)
                    .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(width: DesignTokens.IconFrame.sidebar)

                Text(title)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "chevron.down")
                    .font(.system(size: DesignTokens.IconSize.chevronSmall, weight: .bold))
                    .foregroundStyle(AppTheme.textTertiary)
            }
            .padding(.horizontal, 10)
            .frame(width: width, height: 34)
            .background(AppTheme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous)
                    .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
        }
        .menuStyle(.borderlessButton)
        .buttonStyle(.plain)
        .fixedSize(horizontal: true, vertical: false)
    }
}

private struct ArchivedConversationSettingsRow: View {
    let conversation: StoredConversation
    let title: String
    let metadata: String
    let restoreTitle: String
    let showDivider: Bool
    let onRestore: () -> Void
    @State private var isHovered = false

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Text(metadata)
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)

            Button(action: onRestore) {
                Text(restoreTitle)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .padding(.horizontal, 10)
                    .frame(minWidth: 74, minHeight: 30)
                    .background(AppTheme.surfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
            }
            .buttonStyle(.plain)
            .fixedSize(horizontal: true, vertical: false)
            .layoutPriority(2)
            .accessibilityLabel("\(restoreTitle): \(title)")
        }
        .padding(.horizontal, 16)
        .frame(height: 68)
        .background(isHovered ? AppTheme.surfaceHover : AppTheme.transparent)
        .overlay(alignment: .bottom) {
            if showDivider {
                Rectangle()
                    .fill(AppTheme.border)
                    .frame(height: DesignTokens.Stroke.hairline)
                    .padding(.leading, 16)
            }
        }
        .contentShape(Rectangle())
        .onHover { hovering in
            isHovered = hovering
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("settings.archivedConversation.\(conversation.id.uuidString)")
    }
}
