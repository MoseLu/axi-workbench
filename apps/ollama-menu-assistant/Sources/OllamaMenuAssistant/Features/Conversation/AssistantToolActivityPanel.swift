import SwiftUI

struct AssistantToolActivityPanel: View {
    let message: ChatMessage
    let projectRootPath: String?
    let isProcessing: Bool
    let startedAt: Date
    let completedAt: Date?
    @Binding var isExpanded: Bool
    let onPreviewFile: (String) -> Void
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    private var activity: AssistantToolActivity {
        AssistantToolActivity.make(
            events: message.toolEvents,
            changeSummary: message.changeSummary,
            projectRootPath: projectRootPath
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            if isExpanded, activity.hasDetails {
                Rectangle()
                    .fill(AppTheme.border)
                    .frame(height: DesignTokens.Stroke.hairline)

                details
            }
        }
        .background(AppTheme.transparent)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(tr("任务活动", "Task activity"))
    }

    private var header: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            Button {
                guard activity.hasDetails else {
                    return
                }
                withAnimation(.easeOut(duration: 0.16)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    Text("\(tr("已处理", "Processed")) \(elapsedText(at: context.date))")
                        .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)

                    if !activity.statsText(language: appLanguage).isEmpty {
                        Text(activity.statsText(language: appLanguage))
                            .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
                            .foregroundStyle(AppTheme.textTertiary)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }

                    if activity.hasDetails {
                        Image(systemName: "chevron.down")
                            .font(.system(size: DesignTokens.IconSize.chevronSmall, weight: .semibold))
                            .foregroundStyle(AppTheme.textTertiary)
                            .rotationEffect(.degrees(isExpanded ? 0 : -90))
                            .frame(width: DesignTokens.IconFrame.sidebar, height: DesignTokens.IconFrame.sidebar)
                    }

                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, minHeight: 30, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help(activity.hasDetails ? tr("展开或收起任务活动", "Expand or collapse task activity") : tr("任务正在处理中", "Task is processing"))
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(activity.events) { event in
                ToolActivityEventRow(event: event, onPreviewFile: onPreviewFile)
            }

            let createdLinks = activity.fileLinks.filter(\.isCreated)
            if !createdLinks.isEmpty {
                ToolActivityFileLinksRow(
                    title: tr("生成文件", "Created files"),
                    links: createdLinks,
                    onPreviewFile: onPreviewFile
                )
            }
        }
        .padding(.vertical, 4)
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }

    private func elapsedText(at now: Date) -> String {
        let endDate = isProcessing ? now : (completedAt ?? message.toolEvents.last?.timestamp ?? message.timestamp)
        return AssistantToolActivity.durationText(seconds: endDate.timeIntervalSince(startedAt))
    }
}

private struct ToolActivityEventRow: View {
    let event: AssistantToolActivityEvent
    let onPreviewFile: (String) -> Void
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: iconName)
                    .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                    .foregroundStyle(iconTint)
                    .frame(width: DesignTokens.IconFrame.sidebar)

                Text(title)
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                    .lineLimit(1)

                Text(event.toolName)
                    .font(.system(size: DesignTokens.FontSize.metadata, design: .monospaced))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)

                Spacer(minLength: 8)

                if event.status != .allowed {
                    Text(statusText)
                        .font(.system(size: DesignTokens.FontSize.metadata, weight: .semibold))
                        .foregroundStyle(statusTint)
                        .lineLimit(1)
                }
            }

            if !event.summary.isEmpty {
                Text(event.summary)
                    .font(.system(size: DesignTokens.FontSize.metadata))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(2)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, DesignTokens.IconFrame.sidebar + 8)
            }

            if !event.fileLinks.isEmpty {
                ToolActivityLinkChips(
                    links: Array(event.fileLinks.prefix(3)),
                    onPreviewFile: onPreviewFile
                )
                .padding(.leading, DesignTokens.IconFrame.sidebar + 8)
            }
        }
        .padding(.horizontal, MessageBubbleMetrics.assistantHorizontalPadding)
        .padding(.vertical, 7)
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }

    private var title: String {
        switch event.category {
        case .explore:
            return tr("已探索", "Explored")
        case .command:
            return tr("已运行命令", "Ran command")
        case .edit:
            return tr("已编辑", "Edited")
        case .skill:
            return tr("已读取技能", "Read skill")
        case .other:
            return tr("已使用工具", "Used tool")
        }
    }

    private var iconName: String {
        switch event.category {
        case .explore:
            return "doc.text.magnifyingglass"
        case .command:
            return "terminal"
        case .edit:
            return "square.and.pencil"
        case .skill:
            return "shippingbox"
        case .other:
            return "wrench.adjustable"
        }
    }

    private var iconTint: Color {
        event.status == .allowed ? AppTheme.textTertiary : statusTint
    }

    private var statusText: String {
        switch event.status {
        case .allowed:
            return tr("完成", "Done")
        case .denied:
            return tr("已拒绝", "Denied")
        case .failed:
            return tr("失败", "Failed")
        }
    }

    private var statusTint: Color {
        switch event.status {
        case .allowed:
            return AppTheme.textTertiary
        case .denied:
            return AppTheme.warning
        case .failed:
            return AppTheme.destructive
        }
    }
}

private struct ToolActivityFileLinksRow: View {
    let title: String
    let links: [WorkspaceFileLink]
    let onPreviewFile: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "doc.badge.plus")
                    .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                    .foregroundStyle(AppTheme.accent)
                    .frame(width: DesignTokens.IconFrame.sidebar)

                Text(title)
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)

                Spacer(minLength: 8)
            }

            ToolActivityLinkChips(links: links, onPreviewFile: onPreviewFile)
                .padding(.leading, DesignTokens.IconFrame.sidebar + 8)
        }
        .padding(.horizontal, MessageBubbleMetrics.assistantHorizontalPadding)
        .padding(.vertical, 7)
    }
}

private struct ToolActivityLinkChips: View {
    let links: [WorkspaceFileLink]
    let onPreviewFile: (String) -> Void

    var body: some View {
        HStack(spacing: 6) {
            ForEach(links) { link in
                Button {
                    onPreviewFile(link.path)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: link.isCreated ? "doc.badge.plus" : "doc.text")
                            .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                        Text(link.path)
                            .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                    .foregroundStyle(AppTheme.accent)
                    .padding(.horizontal, 7)
                    .frame(height: 22)
                    .background(AppTheme.accentSoft)
                    .clipShape(Capsule())
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(link.path)
            }
        }
    }
}
