import SwiftUI

struct AssistantSidebarFilterPanelView: View {
    let language: AppLanguage
    @Binding var organization: SidebarConversationOrganization
    @Binding var sortOption: SidebarConversationSortOption
    @Binding var displayScope: SidebarConversationDisplayScope

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            filterSectionTitle(tr("整理", "Organize"))
            filterChoiceRow(
                title: organizationTitle(.byProject),
                systemName: SidebarConversationOrganization.byProject.systemName,
                isSelected: organization == .byProject,
                action: { organization = .byProject }
            )
            filterChoiceRow(
                title: organizationTitle(.recentProjects),
                systemName: SidebarConversationOrganization.recentProjects.systemName,
                isSelected: organization == .recentProjects,
                action: { organization = .recentProjects }
            )
            filterChoiceRow(
                title: organizationTitle(.chronological),
                systemName: SidebarConversationOrganization.chronological.systemName,
                isSelected: organization == .chronological,
                action: {
                    organization = .chronological
                    sortOption = .createdAt
                }
            )
            filterDisabledRow(title: tr("上移", "Move up"), systemName: "arrow.up")

            Divider()
                .padding(.vertical, DesignTokens.Spacing.compact)

            filterSectionTitle(tr("排序条件", "Sort by"))
            filterChoiceRow(
                title: sortOptionTitle(.createdAt),
                systemName: SidebarConversationSortOption.createdAt.systemName,
                isSelected: sortOption == .createdAt,
                action: { sortOption = .createdAt }
            )
            filterChoiceRow(
                title: sortOptionTitle(.updatedAt),
                systemName: SidebarConversationSortOption.updatedAt.systemName,
                isSelected: sortOption == .updatedAt,
                action: { sortOption = .updatedAt }
            )

            Divider()
                .padding(.vertical, DesignTokens.Spacing.compact)

            filterSectionTitle(tr("显示", "Show"))
            filterChoiceRow(
                title: displayScopeTitle(.all),
                systemName: SidebarConversationDisplayScope.all.systemName,
                isSelected: displayScope == .all,
                action: { displayScope = .all }
            )
            filterChoiceRow(
                title: displayScopeTitle(.related),
                systemName: SidebarConversationDisplayScope.related.systemName,
                isSelected: displayScope == .related,
                action: { displayScope = .related }
            )
        }
        .padding(DesignTokens.Spacing.control)
        .frame(width: 176, alignment: .leading)
        .background(AppTheme.surface)
    }

    private func organizationTitle(_ option: SidebarConversationOrganization) -> String {
        option.title(language: language)
    }

    private func sortOptionTitle(_ option: SidebarConversationSortOption) -> String {
        option.title(language: language)
    }

    private func displayScopeTitle(_ option: SidebarConversationDisplayScope) -> String {
        option.title(language: language)
    }

    private func filterSectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
            .foregroundStyle(AppTheme.textTertiary)
            .padding(.horizontal, DesignTokens.Spacing.related)
            .padding(.top, DesignTokens.Spacing.xSmall)
    }

    private func filterChoiceRow(
        title: String,
        systemName: String,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: systemName)
                    .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(width: DesignTokens.IconFrame.sidebar)
                Text(title)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                Spacer(minLength: 8)
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.related)
            .padding(.vertical, DesignTokens.Spacing.compact)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func filterDisabledRow(title: String, systemName: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemName)
                .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                .frame(width: DesignTokens.IconFrame.sidebar)
            Text(title)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .lineLimit(1)
            Spacer(minLength: 8)
        }
        .foregroundStyle(AppTheme.textTertiary)
        .padding(.horizontal, DesignTokens.Spacing.related)
        .padding(.vertical, DesignTokens.Spacing.compact)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: language)
    }
}
