import SwiftUI

extension SettingsPanelView {
    var archivedConversationSettings: some View {
        let conversations = appModel.archivedConversations()

        return Group {
            if conversations.isEmpty {
                Text(tr("没有已归档对话", "No archived chats"))
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .frame(maxWidth: 672, alignment: .leading)
            } else {
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
        }
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
