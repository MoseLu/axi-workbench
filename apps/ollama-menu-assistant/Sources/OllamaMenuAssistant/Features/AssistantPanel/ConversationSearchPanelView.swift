import SwiftUI

struct ConversationSearchPanelView: View {
    @Binding var query: String
    let conversations: [StoredConversation]
    let isFiltering: Bool
    let language: AppLanguage
    let currentConversationID: UUID
    let title: (StoredConversation) -> String
    let projectName: (StoredConversation) -> String?
    let isGenerating: (StoredConversation) -> Bool
    let onOpen: (StoredConversation) -> Void
    let onClose: () -> Void
    @FocusState private var isSearchFocused: Bool
    private let maxShortcutCount = 9

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            searchField
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 10)

            if conversations.isEmpty {
                emptyState
                    .padding(.bottom, 8)
            } else {
                resultList
            }
        }
        .frame(width: 470, alignment: .topLeading)
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.popover, style: .continuous)
                .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.popover, style: .continuous))
        .shadow(color: Color.black.opacity(0.24), radius: 24, x: 0, y: 14)
        .onAppear {
            DispatchQueue.main.async {
                isSearchFocused = true
            }
        }
        .onExitCommand(perform: onClose)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sidebar.search.panel")
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            TextField(
                "",
                text: $query,
                prompt: Text(tr("搜索对话", "Search chats"))
            )
                .textFieldStyle(.plain)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .focused($isSearchFocused)
                .onSubmit {
                    if let firstConversation = conversations.first {
                        onOpen(firstConversation)
                    }
                }

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
        .frame(height: 24)
        .accessibilityIdentifier("sidebar.search.field")
    }

    private var emptyState: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
                .frame(width: DesignTokens.IconFrame.sidebar)
            Text(isFiltering ? tr("没有匹配的会话", "No matching chats") : tr("还没有历史记录", "No history yet"))
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var resultList: some View {
        ScrollView(.vertical, showsIndicators: true) {
            LazyVStack(alignment: .leading, spacing: 8) {
                ForEach(resultSections) { section in
                    resultSection(section)
                }
            }
            .padding(.bottom, 8)
        }
        .frame(maxHeight: 336)
    }

    private func resultSection(_ section: SearchSection) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(section.title)
                .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .lineLimit(1)
                .padding(.horizontal, 16)

            LazyVStack(alignment: .leading, spacing: 1) {
                ForEach(section.entries) { entry in
                    resultButton(for: entry)
                }
            }
        }
    }

    @ViewBuilder
    private func resultButton(for entry: SearchEntry) -> some View {
        let button = Button {
            onOpen(entry.conversation)
        } label: {
            resultRow(for: entry)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("sidebar.search.result.\(entry.conversation.id.uuidString)")
        .accessibilityLabel(title(entry.conversation))

        if let shortcut = entry.shortcut,
           let keyEquivalent = shortcutKeyEquivalent(for: shortcut) {
            button.keyboardShortcut(keyEquivalent, modifiers: .command)
        } else {
            button
        }
    }

    private func resultRow(for entry: SearchEntry) -> some View {
        let conversation = entry.conversation

        return HStack(spacing: 8) {
            Image(systemName: "laptopcomputer")
                .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
                .frame(width: DesignTokens.IconFrame.sidebar, height: DesignTokens.IconFrame.sidebar)

            Text(title(conversation))
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

            if isGenerating(conversation) {
                ProgressView()
                    .controlSize(.small)
                    .scaleEffect(0.72)
                    .frame(width: DesignTokens.IconFrame.sidebar, height: DesignTokens.IconFrame.sidebar)
            }

            Text(trailingMetadataText(for: conversation))
                .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(width: 104, alignment: .trailing)

            if let shortcut = entry.shortcut {
                shortcutBadge(shortcut)
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 34)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous)
                .fill(conversation.id == currentConversationID ? AppTheme.surfaceHover : AppTheme.transparent)
        )
        .padding(.horizontal, 6)
    }

    private func shortcutBadge(_ shortcut: Int) -> some View {
        Text("⌘\(shortcut)")
            .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
            .foregroundStyle(AppTheme.textSecondary)
            .lineLimit(1)
            .padding(.horizontal, 7)
            .frame(minWidth: 30, minHeight: 20)
            .background(AppTheme.surfaceHover)
            .clipShape(Capsule())
    }

    private func trailingMetadataText(for conversation: StoredConversation) -> String {
        if let project = projectName(conversation), !project.isEmpty {
            return project
        }
        return SidebarConversationRow.relativeAgeText(for: conversation.updatedAt, language: language)
    }

    private var resultSections: [SearchSection] {
        let pinned = conversations.filter(\.isPinned)
        let others = conversations.filter { !$0.isPinned }
        var shortcut = 1
        var sections = [SearchSection]()

        if !pinned.isEmpty {
            sections.append(
                SearchSection(
                    id: "pinned",
                    title: tr("置顶对话", "Pinned chats"),
                    entries: entries(for: pinned, nextShortcut: &shortcut)
                )
            )
        }

        if !others.isEmpty {
            sections.append(
                SearchSection(
                    id: isFiltering ? "results" : "recent",
                    title: isFiltering ? tr("搜索结果", "Search results") : tr("近期对话", "Recent chats"),
                    entries: entries(for: others, nextShortcut: &shortcut)
                )
            )
        }

        return sections
    }

    private func entries(for conversations: [StoredConversation], nextShortcut: inout Int) -> [SearchEntry] {
        conversations.map { conversation in
            defer { nextShortcut += 1 }
            return SearchEntry(
                conversation: conversation,
                shortcut: nextShortcut <= maxShortcutCount ? nextShortcut : nil
            )
        }
    }

    private func shortcutKeyEquivalent(for shortcut: Int) -> KeyEquivalent? {
        guard let character = "\(shortcut)".first else {
            return nil
        }
        return KeyEquivalent(character)
    }

    private struct SearchSection: Identifiable {
        let id: String
        let title: String
        let entries: [SearchEntry]
    }

    private struct SearchEntry: Identifiable {
        let conversation: StoredConversation
        let shortcut: Int?

        var id: UUID {
            conversation.id
        }
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: language)
    }
}
