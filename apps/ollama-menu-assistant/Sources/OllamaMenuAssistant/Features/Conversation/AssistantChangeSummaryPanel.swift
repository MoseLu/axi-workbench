import SwiftUI

struct AssistantChangeSummaryPanel: View {
    let summary: AssistantChangeSummary
    @Binding var isExpanded: Bool
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            if isExpanded {
                Rectangle()
                    .fill(AppTheme.border)
                    .frame(height: DesignTokens.Stroke.hairline)

                VStack(alignment: .leading, spacing: 0) {
                    ForEach(summary.files) { file in
                        fileRow(file)
                    }

                    if summary.didTruncate {
                        truncationNotice
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(tr("AI 修改摘要", "AI change summary"))
        .accessibilityValue(fileCountText)
    }

    private var header: some View {
        Button {
            withAnimation(.easeOut(duration: 0.16)) {
                isExpanded.toggle()
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "square.and.pencil")
                    .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(width: DesignTokens.IconFrame.sidebar)

                Text(tr("AI 修改", "AI changes"))
                    .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Text(fileCountText)
                    .font(.system(size: DesignTokens.FontSize.metadata, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                    .padding(.horizontal, 7)
                    .frame(height: 22)
                    .background(AppTheme.surfaceRaised)
                    .clipShape(Capsule())

                Spacer(minLength: 8)

                if summary.totalAdditions > 0 || summary.totalDeletions > 0 {
                    Text("+\(summary.totalAdditions)")
                        .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                        .foregroundStyle(AppTheme.diffAddedText)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)

                    Text("-\(summary.totalDeletions)")
                        .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                        .foregroundStyle(AppTheme.diffRemovedText)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                }

                Image(systemName: "chevron.down")
                    .font(.system(size: DesignTokens.IconSize.chevronSmall, weight: .semibold))
                    .foregroundStyle(AppTheme.textTertiary)
                    .rotationEffect(.degrees(isExpanded ? 0 : -90))
                    .frame(width: DesignTokens.IconFrame.sidebar, height: DesignTokens.IconFrame.sidebar)
            }
            .padding(.horizontal, DesignTokens.Spacing.content)
            .frame(maxWidth: .infinity, minHeight: 38, maxHeight: 38, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(isExpanded ? tr("收起 AI 修改摘要", "Collapse AI change summary") : tr("展开 AI 修改摘要", "Expand AI change summary"))
        .accessibilityLabel(isExpanded ? tr("收起 AI 修改摘要", "Collapse AI change summary") : tr("展开 AI 修改摘要", "Expand AI change summary"))
    }

    private func fileRow(_ file: AssistantChangedFileSummary) -> some View {
        HStack(spacing: 8) {
            Image(systemName: iconName(for: file))
                .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                .foregroundStyle(iconTint(for: file))
                .frame(width: DesignTokens.IconFrame.sidebar)

            Text(file.path)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                .truncationMode(.middle)

            Spacer(minLength: 8)

            fileChangeLabel(file)
        }
        .padding(.horizontal, DesignTokens.Spacing.content)
        .frame(maxWidth: .infinity, minHeight: 32, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func fileChangeLabel(_ file: AssistantChangedFileSummary) -> some View {
        if file.state == .cleaned || (file.additions == 0 && file.deletions == 0) {
            Text(stateText(for: file))
                .font(.system(size: DesignTokens.FontSize.metadata, weight: .semibold))
                .foregroundStyle(AppTheme.textSecondary)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
        } else {
            HStack(spacing: 6) {
                Text("+\(file.additions)")
                    .foregroundStyle(AppTheme.diffAddedText)

                Text("-\(file.deletions)")
                    .foregroundStyle(AppTheme.diffRemovedText)
            }
            .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
        }
    }

    private var truncationNotice: some View {
        Text(tr("差异较大，摘要可能不完整。", "Large diff; summary may be incomplete."))
            .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
            .foregroundStyle(AppTheme.warning)
            .padding(.horizontal, DesignTokens.Spacing.content)
            .padding(.top, 3)
            .padding(.bottom, 5)
    }

    private var fileCountText: String {
        if appLanguage == .english {
            return summary.fileCount == 1 ? "1 file" : "\(summary.fileCount) files"
        }
        return "\(summary.fileCount) 个文件"
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }

    private func stateText(for file: AssistantChangedFileSummary) -> String {
        switch file.state {
        case .modified:
            return tr("已修改", "Modified")
        case .untracked:
            return tr("新文件", "New file")
        case .cleaned:
            return tr("已清理", "Cleaned")
        }
    }

    private func iconName(for file: AssistantChangedFileSummary) -> String {
        switch file.state {
        case .modified:
            return "doc.text"
        case .untracked:
            return "doc.badge.plus"
        case .cleaned:
            return "arrow.uturn.backward"
        }
    }

    private func iconTint(for file: AssistantChangedFileSummary) -> Color {
        switch file.state {
        case .modified:
            return AppTheme.textSecondary
        case .untracked:
            return AppTheme.accent
        case .cleaned:
            return AppTheme.textTertiary
        }
    }
}
