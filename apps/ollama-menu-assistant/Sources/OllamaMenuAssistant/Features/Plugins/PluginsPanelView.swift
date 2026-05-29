import AppKit
import SwiftUI

enum PluginPanelTab: String, CaseIterable, Identifiable {
    case plugins
    case skills

    var id: String { rawValue }

    func title(language: AppLanguage) -> String {
        switch self {
        case .plugins:
            language == .english ? "Plugins" : "插件"
        case .skills:
            language == .english ? "Skills" : "技能"
        }
    }
}

private enum PluginManagementTab: String, CaseIterable, Identifiable {
    case plugins
    case apps
    case mcp
    case skills
    case imported

    var id: String { rawValue }

    func title(language: AppLanguage) -> String {
        switch self {
        case .plugins:
            language == .english ? "Plugins" : "插件"
        case .apps:
            language == .english ? "Apps" : "应用"
        case .mcp:
            "MCP"
        case .skills:
            language == .english ? "Skills" : "技能"
        case .imported:
            language == .english ? "Imported" : "已导入"
        }
    }
}

private enum PluginSourceFilter: String, CaseIterable, Identifiable {
    case all
    case local
    case imported

    var id: String { rawValue }

    func title(language: AppLanguage) -> String {
        switch self {
        case .all:
            language == .english ? "All sources" : "全部来源"
        case .local:
            language == .english ? "Local" : "本地"
        case .imported:
            language == .english ? "Imported" : "已导入"
        }
    }
}

struct PluginsPanelView: View {
    @Binding var selectedTab: PluginPanelTab

    let plugins: [PluginSummary]
    let skills: [SkillSummary]
    let errorMessage: String?
    let onRefresh: () -> Void

    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @State private var searchText = ""
    @State private var sourceFilter: PluginSourceFilter = .all
    @State private var categoryFilter = ""
    @State private var isDeveloperFilterPresented = false
    @State private var isCategoryFilterPresented = false

    private let contentMaxWidth: CGFloat = 1320
    private let contentHorizontalPadding: CGFloat = 84
    private let gridColumns = [
        GridItem(.flexible(minimum: 280), spacing: 56, alignment: .top),
        GridItem(.flexible(minimum: 280), spacing: 56, alignment: .top),
    ]

    var body: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(alignment: .center, spacing: 0) {
                Text(tr("让 Assistant 按你的方式工作", "Make Assistant work your way"))
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                    .padding(.top, 52)

                controls
                    .padding(.top, 36)

                if let errorMessage {
                    InlineNotice(text: errorMessage, tint: AppTheme.destructive)
                        .padding(.top, 18)
                }

                listContent
                    .padding(.top, 34)
            }
            .frame(maxWidth: contentMaxWidth, alignment: .top)
            .padding(.horizontal, contentHorizontalPadding)
            .padding(.bottom, 56)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .background(AppTheme.canvas)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plugins.panel")
    }

    private var controls: some View {
        HStack(spacing: 12) {
            PluginSearchField(
                text: $searchText,
                placeholder: selectedTab == .plugins ? tr("搜索插件", "Search plugins") : tr("搜索技能", "Search skills")
            )
            .frame(minWidth: 180, maxWidth: .infinity)
            .layoutPriority(1)

            if selectedTab == .plugins {
                sourceFilterButton
                    .fixedSize(horizontal: true, vertical: false)
                categoryFilterButton
                    .fixedSize(horizontal: true, vertical: false)
            } else {
                Button(action: onRefresh) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                        .foregroundStyle(AppTheme.textTertiary)
                        .frame(width: DesignTokens.ControlSize.standardButton, height: DesignTokens.ControlSize.standardButton)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(tr("刷新", "Refresh"))
                .accessibilityLabel(tr("刷新", "Refresh"))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var sourceFilterButton: some View {
        Button {
            isCategoryFilterPresented = false
            isDeveloperFilterPresented.toggle()
        } label: {
            PluginFilterLabel(title: sourceFilter.title(language: appLanguage))
        }
        .buttonStyle(.plain)
        .popover(isPresented: $isDeveloperFilterPresented, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 2) {
                ForEach(PluginSourceFilter.allCases) { filter in
                    filterPopoverRow(
                        title: filter.title(language: appLanguage),
                        isSelected: sourceFilter == filter
                    ) {
                        sourceFilter = filter
                        isDeveloperFilterPresented = false
                    }
                }
            }
            .padding(DesignTokens.Spacing.control)
            .frame(width: 196, alignment: .leading)
            .background(AppTheme.surface)
        }
    }

    private var categoryFilterButton: some View {
        Button {
            isDeveloperFilterPresented = false
            isCategoryFilterPresented.toggle()
        } label: {
            PluginFilterLabel(title: categoryFilter.isEmpty ? tr("全部", "All") : categoryFilter)
        }
        .buttonStyle(.plain)
        .popover(isPresented: $isCategoryFilterPresented, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 2) {
                filterPopoverRow(title: tr("全部", "All"), isSelected: categoryFilter.isEmpty) {
                    categoryFilter = ""
                    isCategoryFilterPresented = false
                }

                ForEach(pluginCategories, id: \.self) { category in
                    filterPopoverRow(title: category, isSelected: categoryFilter == category) {
                        categoryFilter = category
                        isCategoryFilterPresented = false
                    }
                }
            }
            .padding(DesignTokens.Spacing.control)
            .frame(width: 176, alignment: .leading)
            .background(AppTheme.surface)
        }
    }

    private func filterPopoverRow(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(title)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Spacer(minLength: DesignTokens.Spacing.control)

                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.related)
            .frame(maxWidth: .infinity, minHeight: DesignTokens.ControlSize.menuRow, alignment: .leading)
            .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var listContent: some View {
        switch selectedTab {
        case .plugins:
            pluginStoreContent
        case .skills:
            skillStoreContent
        }
    }

    private var pluginStoreContent: some View {
        VStack(alignment: .leading, spacing: 30) {
            if let featuredPlugin {
                PluginFeatureBanner(plugin: featuredPlugin, language: appLanguage)
            }

            if filteredPlugins.isEmpty {
                emptyState(title: tr("没有找到插件", "No plugins found"))
            } else {
                ForEach(pluginSections, id: \.title) { section in
                    PluginGridSection(title: section.title, plugins: section.plugins, columns: gridColumns)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var skillStoreContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            sectionHeader(title: tr("Skills", "Skills"))

            if filteredSkills.isEmpty {
                emptyState(title: tr("没有找到技能", "No skills found"))
            } else {
                LazyVGrid(columns: gridColumns, alignment: .leading, spacing: 22) {
                    ForEach(filteredSkills) { skill in
                        PluginSkillRow(skill: skill)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sectionHeader(title: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .bold))
                .foregroundStyle(AppTheme.textPrimary)

            Rectangle()
                .fill(AppTheme.border)
                .frame(height: 1)
        }
    }

    private func emptyState(title: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "tray")
                .font(.system(size: DesignTokens.IconSize.large, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
                .frame(width: 28)

            Text(title)
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
        }
        .padding(.vertical, 18)
    }

    private var featuredPlugin: PluginSummary? {
        filteredPlugins.first(where: { $0.isEnabled }) ?? filteredPlugins.first
    }

    private var pluginSections: [(title: String, plugins: [PluginSummary])] {
        let featuredIDs = Set(filteredPlugins.filter(\.isEnabled).prefix(4).map(\.id))
        let featured = filteredPlugins.filter { featuredIDs.contains($0.id) }
        let remaining = filteredPlugins.filter { !featuredIDs.contains($0.id) }
        var sections: [(String, [PluginSummary])] = []

        if !featured.isEmpty {
            sections.append((tr("Featured", "Featured"), featured))
        }

        let grouped = Dictionary(grouping: remaining) { plugin in
            plugin.category.isEmpty ? tr("其他", "Other") : plugin.category
        }
        for title in grouped.keys.sorted(by: localizedSort) {
            sections.append((title, (grouped[title] ?? []).sorted(by: pluginSort)))
        }
        return sections
    }

    private var filteredPlugins: [PluginSummary] {
        let query = normalizedSearchText
        return plugins
            .filter { plugin in
                switch sourceFilter {
                case .all:
                    return true
                case .local:
                    return plugin.marketplace != "imported"
                case .imported:
                    return plugin.marketplace == "imported"
                }
            }
            .filter { plugin in
                categoryFilter.isEmpty || plugin.category == categoryFilter
            }
            .filter { plugin in
                guard !query.isEmpty else {
                    return true
                }
                return [
                    plugin.displayName,
                    plugin.description,
                    plugin.developerName,
                    plugin.category,
                    plugin.marketplace,
                    plugin.pluginID,
                ].contains { $0.localizedCaseInsensitiveContains(query) }
            }
            .sorted(by: pluginSort)
    }

    private var filteredSkills: [SkillSummary] {
        let query = normalizedSearchText
        guard !query.isEmpty else {
            return skills
        }

        return skills.filter { skill in
            [
                skill.name,
                skill.description,
                skill.directoryPath,
                skill.relativePath,
            ].contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }

    private var pluginCategories: [String] {
        Array(Set(plugins.map(\.category).filter { !$0.isEmpty })).sorted(by: localizedSort)
    }

    private func pluginSort(_ lhs: PluginSummary, _ rhs: PluginSummary) -> Bool {
        if lhs.isEnabled != rhs.isEnabled {
            return lhs.isEnabled && !rhs.isEnabled
        }
        if lhs.isInstalled != rhs.isInstalled {
            return lhs.isInstalled && !rhs.isInstalled
        }
        return localizedSort(lhs.displayName, rhs.displayName)
    }

    private func localizedSort(_ lhs: String, _ rhs: String) -> Bool {
        lhs.localizedCaseInsensitiveCompare(rhs) == .orderedAscending
    }

    private var normalizedSearchText: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }
}

struct PluginManagementPanelView: View {
    let plugins: [PluginSummary]
    let skills: [SkillSummary]
    let mcpServerStatuses: [MCPServerStatus]
    let errorMessage: String?
    let onBack: () -> Void
    let onRefresh: () -> Void
    let onTogglePlugin: (PluginSummary, Bool) -> Void

    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @State private var selectedTab: PluginManagementTab = .plugins
    @State private var searchText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            topRow
                .padding(.horizontal, 52)
                .padding(.top, 28)

            tabRow
                .padding(.horizontal, 52)
                .padding(.top, 38)

            if let errorMessage {
                InlineNotice(text: errorMessage, tint: AppTheme.destructive)
                    .padding(.horizontal, 52)
                    .padding(.top, 18)
            }

            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 0) {
                    managementContent
                }
                .frame(maxWidth: 980, alignment: .leading)
                .padding(.horizontal, 52)
                .padding(.top, 34)
                .padding(.bottom, 48)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(AppTheme.canvas)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plugins.management.panel")
    }

    private var topRow: some View {
        HStack(alignment: .center, spacing: 14) {
            Button(action: onBack) {
                Text(tr("插件", "Plugins"))
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)
            }
            .buttonStyle(.plain)

            Image(systemName: "chevron.right")
                .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)

            Text(tr("管理", "Manage"))
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .bold))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)

            Spacer(minLength: 20)

            PluginSearchField(
                text: $searchText,
                placeholder: selectedTab == .skills ? tr("搜索技能", "Search skills") : tr("搜索插件", "Search plugins")
            )
            .frame(width: 330)

            Button(action: onRefresh) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                    .foregroundStyle(AppTheme.textTertiary)
                    .frame(width: DesignTokens.ControlSize.standardButton, height: DesignTokens.ControlSize.standardButton)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help(tr("刷新", "Refresh"))
            .accessibilityLabel(tr("刷新", "Refresh"))
        }
    }

    private var tabRow: some View {
        PluginManagementSegmentedControl(
            tabs: PluginManagementTab.allCases,
            selection: $selectedTab,
            title: { $0.title(language: appLanguage) },
            count: count(for:)
        )
    }

    @ViewBuilder
    private var managementContent: some View {
        switch selectedTab {
        case .plugins:
            managedPluginList(filteredInstalledPlugins)
        case .apps:
            managedPluginList(filteredAppPlugins)
        case .mcp:
            managedMCPContent
        case .skills:
            managedSkillList
        case .imported:
            managedPluginList(filteredImportedPlugins)
        }
    }

    private var managedMCPContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            if !mcpServerStatuses.isEmpty {
                VStack(spacing: 0) {
                    ForEach(mcpServerStatuses) { status in
                        MCPServerStatusRow(status: status)
                    }
                }
            }
            managedPluginList(filteredMCPPlugins)
        }
    }

    private func managedPluginList(_ rows: [PluginSummary]) -> some View {
        VStack(spacing: 0) {
            if rows.isEmpty {
                emptyManagementState(title: tr("没有找到插件", "No plugins found"))
            } else {
                ForEach(rows) { plugin in
                    PluginManagementRow(
                        plugin: plugin,
                        enabled: Binding(
                            get: { plugin.isEnabled },
                            set: { onTogglePlugin(plugin, $0) }
                        )
                    )
                }
            }
        }
    }

    private var managedSkillList: some View {
        VStack(spacing: 0) {
            if filteredManagedSkills.isEmpty {
                emptyManagementState(title: tr("没有找到技能", "No skills found"))
            } else {
                ForEach(filteredManagedSkills) { skill in
                    PluginSkillRow(skill: skill)
                }
            }
        }
    }

    private func emptyManagementState(title: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "tray")
                .font(.system(size: DesignTokens.IconSize.large, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
                .frame(width: 28)
            Text(title)
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
        }
        .padding(.vertical, 18)
    }

    private func count(for tab: PluginManagementTab) -> Int {
        switch tab {
        case .plugins:
            installedPlugins.count
        case .apps:
            installedPlugins.filter(\.hasApp).count
        case .mcp:
            installedPlugins.filter(\.hasMCPServer).count
        case .skills:
            skills.count
        case .imported:
            installedPlugins.filter { $0.marketplace == "imported" }.count
        }
    }

    private var installedPlugins: [PluginSummary] {
        plugins.filter(\.isInstalled)
    }

    private var filteredInstalledPlugins: [PluginSummary] {
        filteredPlugins(installedPlugins)
    }

    private var filteredAppPlugins: [PluginSummary] {
        filteredPlugins(installedPlugins.filter(\.hasApp))
    }

    private var filteredMCPPlugins: [PluginSummary] {
        filteredPlugins(installedPlugins.filter(\.hasMCPServer))
    }

    private var filteredImportedPlugins: [PluginSummary] {
        filteredPlugins(installedPlugins.filter { $0.marketplace == "imported" })
    }

    private func filteredPlugins(_ source: [PluginSummary]) -> [PluginSummary] {
        let query = normalizedSearchText
        guard !query.isEmpty else {
            return source
        }

        return source.filter { plugin in
            [
                plugin.displayName,
                plugin.description,
                plugin.developerName,
                plugin.category,
                plugin.marketplace,
                plugin.pluginID,
            ].contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }

    private var filteredManagedSkills: [SkillSummary] {
        let query = normalizedSearchText
        guard !query.isEmpty else {
            return skills
        }

        return skills.filter { skill in
            [
                skill.name,
                skill.description,
                skill.directoryPath,
                skill.relativePath,
            ].contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }

    private var normalizedSearchText: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }
}

private struct PluginManagementSegmentedControl<Tab: Identifiable & Hashable>: View {
    let tabs: [Tab]
    @Binding var selection: Tab
    let title: (Tab) -> String
    let count: (Tab) -> Int

    var body: some View {
        HStack(spacing: 8) {
            ForEach(tabs) { tab in
                Button {
                    selection = tab
                } label: {
                    HStack(spacing: 7) {
                        Text(title(tab))
                            .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: isSelected(tab) ? .bold : .medium))
                        Text("\(count(tab))")
                            .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                            .foregroundStyle(isSelected(tab) ? AppTheme.textSecondary : AppTheme.textTertiary)
                    }
                    .foregroundStyle(isSelected(tab) ? AppTheme.textPrimary : AppTheme.textTertiary)
                    .padding(.horizontal, 13)
                    .frame(height: 36)
                    .background(isSelected(tab) ? AppTheme.surfaceHover : AppTheme.transparent)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func isSelected(_ tab: Tab) -> Bool {
        tab == selection
    }
}

private struct PluginSearchField: View {
    @Binding var text: String
    let placeholder: String

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: DesignTokens.IconSize.callout, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .frame(width: 18)

            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
        }
        .padding(.horizontal, 12)
        .frame(height: 36)
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous)
                .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
    }
}

private struct PluginFilterLabel: View {
    let title: String

    var body: some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
            Image(systemName: "chevron.down")
                .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
        }
        .padding(.horizontal, 14)
        .frame(height: 36)
        .background(AppTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
    }
}

private struct PluginFeatureBanner: View {
    let plugin: PluginSummary
    let language: AppLanguage

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card, style: .continuous)
                .fill(featureBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card, style: .continuous)
                        .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
                )

            VStack(spacing: 34) {
                HStack(spacing: 8) {
                    PluginIconView(plugin: plugin, size: 20)
                    Text("\(plugin.displayName)  \(language == .english ? "try it in a conversation" : "播放一个播放列表，帮我进入专注状态")")
                        .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                }
                .padding(.horizontal, 18)
                .frame(height: 46)
                .background(Color.black.opacity(0.42))
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium, style: .continuous))

                Button {
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: DesignTokens.IconSize.regular, weight: .medium))
                        Text(language == .english ? "Try in chat" : "在对话中试用")
                            .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                    }
                    .foregroundStyle(Color.black.opacity(0.88))
                    .padding(.horizontal, 20)
                    .frame(height: 42)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .frame(height: 248)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card, style: .continuous))
    }

    private var featureBackground: LinearGradient {
        LinearGradient(
            colors: [
                brandColor.opacity(0.58),
                Color(red: 0.09, green: 0.17, blue: 0.40).opacity(0.92),
                Color(red: 0.29, green: 0.22, blue: 0.47).opacity(0.88),
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var brandColor: Color {
        DesignTokens.color(fromHex: plugin.brandColorHex ?? "", fallback: DesignTokens.Theme.dark.accent)
    }
}

private struct PluginGridSection: View {
    let title: String
    let plugins: [PluginSummary]
    let columns: [GridItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 12) {
                Text(title)
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .bold))
                    .foregroundStyle(AppTheme.textPrimary)
                Rectangle()
                    .fill(AppTheme.border)
                    .frame(height: 1)
            }

            LazyVGrid(columns: columns, alignment: .leading, spacing: 28) {
                ForEach(plugins) { plugin in
                    PluginListRow(plugin: plugin)
                }
            }
        }
    }
}

private struct PluginListRow: View {
    let plugin: PluginSummary

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            PluginIconView(plugin: plugin, size: 44)

            VStack(alignment: .leading, spacing: 5) {
                Text(plugin.displayName)
                    .font(.system(size: DesignTokens.FontSize.callout, weight: .bold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Text(plugin.description)
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                HStack(spacing: 6) {
                    PluginMetadataChip(title: plugin.marketplace == "imported" ? "Imported" : "Local")
                    if plugin.hasMCPServer {
                        PluginMetadataChip(title: "MCP")
                    }
                    if plugin.skillCount > 0 {
                        PluginMetadataChip(title: "\(plugin.skillCount) skills")
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Image(systemName: plugin.isEnabled ? "checkmark" : "plus")
                .font(.system(size: plugin.isEnabled ? DesignTokens.IconSize.medium : DesignTokens.IconSize.large, weight: .semibold))
                .foregroundStyle(plugin.isEnabled ? AppTheme.textTertiary : AppTheme.textPrimary)
                .frame(width: DesignTokens.ControlSize.standardButton, height: DesignTokens.ControlSize.standardButton)
                .background(plugin.isEnabled ? AppTheme.transparent : AppTheme.surface)
                .clipShape(Circle())
        }
        .frame(minHeight: 58)
        .contentShape(Rectangle())
        .accessibilityIdentifier("plugins.row.\(plugin.pluginID)")
    }
}

private struct PluginManagementRow: View {
    let plugin: PluginSummary
    @Binding var enabled: Bool

    var body: some View {
        HStack(alignment: .center, spacing: 18) {
            PluginIconView(plugin: plugin, size: 44)

            VStack(alignment: .leading, spacing: 5) {
                Text(plugin.displayName)
                    .font(.system(size: DesignTokens.FontSize.callout, weight: .bold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    Text(plugin.description)
                        .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                        .lineLimit(1)
                        .truncationMode(.tail)

                    if plugin.skillCount > 0 {
                        PluginMetadataChip(title: "\(plugin.skillCount) skills")
                    }
                    if plugin.hasMCPServer {
                        PluginMetadataChip(title: "MCP")
                    }
                    PluginMetadataChip(title: plugin.marketplace == "imported" ? "Imported" : "Local")
                }
            }

            Spacer(minLength: 18)

            Toggle("", isOn: $enabled)
                .labelsHidden()
                .toggleStyle(.switch)
                .controlSize(.small)
                .accessibilityLabel(plugin.displayName)
        }
        .padding(.vertical, 16)
        .contentShape(Rectangle())
        .accessibilityIdentifier("plugins.management.row.\(plugin.pluginID)")
    }
}

private struct MCPServerStatusRow: View {
    let status: MCPServerStatus

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: status.state == .available ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                .foregroundStyle(status.state == .available ? AppTheme.accent : AppTheme.destructive)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 4) {
                Text("\(status.pluginID) / \(status.serverName)")
                    .font(.system(size: DesignTokens.FontSize.callout, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Text(status.message ?? "\(status.toolCount) tools")
                    .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)
            }

            Spacer(minLength: 12)

            PluginMetadataChip(title: status.state == .available ? "Available" : "Failed")
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

private struct PluginSkillRow: View {
    let skill: SkillSummary

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous)
                    .fill(AppTheme.accentSoft)
                Image(systemName: "wand.and.stars")
                    .font(.system(size: DesignTokens.IconSize.large, weight: .semibold))
                    .foregroundStyle(AppTheme.accent)
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 5) {
                Text(skill.name)
                    .font(.system(size: DesignTokens.FontSize.callout, weight: .bold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Text(skill.description)
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: 58)
        .contentShape(Rectangle())
        .accessibilityIdentifier("plugins.skill.row.\(skill.id)")
    }
}

private struct PluginIconView: View {
    let plugin: PluginSummary
    let size: CGFloat

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: iconCornerRadius, style: .continuous)
                .fill(brandColor.opacity(0.16))
                .overlay(
                    RoundedRectangle(cornerRadius: iconCornerRadius, style: .continuous)
                        .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
                )

            if let image = image {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(width: size, height: size)
                    .clipShape(RoundedRectangle(cornerRadius: iconCornerRadius, style: .continuous))
            } else {
                Image(systemName: fallbackSystemName)
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundStyle(brandColor)
            }
        }
        .frame(width: size, height: size)
    }

    private var image: NSImage? {
        guard let iconURL = plugin.iconURL else {
            return nil
        }
        return NSImage(contentsOf: iconURL)
    }

    private var brandColor: Color {
        DesignTokens.color(fromHex: plugin.brandColorHex ?? "", fallback: DesignTokens.Theme.dark.accent)
    }

    private var iconCornerRadius: CGFloat {
        min(DesignTokens.CornerRadius.control, size * 0.22)
    }

    private var fallbackSystemName: String {
        if plugin.hasApp {
            return "app.connected.to.app.below.fill"
        }
        if plugin.hasMCPServer {
            return "slider.horizontal.3"
        }
        if plugin.skillCount > 0 {
            return "wand.and.stars"
        }
        return "circle.grid.2x2"
    }
}

private struct PluginMetadataChip: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.system(size: DesignTokens.FontSize.metadata, weight: .semibold))
            .foregroundStyle(AppTheme.textTertiary)
            .lineLimit(1)
            .padding(.horizontal, 7)
            .frame(height: 20)
            .background(AppTheme.surfaceRaised.opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xSmall, style: .continuous))
    }
}
