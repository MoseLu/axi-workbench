import SwiftUI

extension SettingsPanelView {
    var gitSettings: some View {
        VStack(alignment: .leading, spacing: 30) {
            settingsGroup(title: "Git") {
                settingsCard {
                    gitBranchPrefixRow
                    divider
                    settingsSegmentedRow(
                        title: tr("拉取请求合并方法", "Pull request merge method"),
                        description: tr("选择 Assistant 合并拉取请求的方法", "Choose how Assistant merges pull requests"),
                        selection: gitPullRequestMergeMethodSelection,
                        options: gitPullRequestMergeMethodOptions
                    )
                    divider
                    settingsToggleRow(
                        title: tr("在侧边栏显示 PR 图标", "Show PR icon in sidebar"),
                        description: tr("在侧边栏的对话行中显示 PR 状态图标", "Show PR status icons in sidebar conversation rows"),
                        isOn: $gitShowsPullRequestIcon
                    )
                    divider
                    settingsToggleRow(
                        title: tr("始终强制推送", "Always force push"),
                        description: tr("从 Assistant 推送时使用 --force-with-lease 参数", "Use --force-with-lease when Assistant pushes"),
                        isOn: $gitAlwaysForcePush
                    )
                    divider
                    settingsToggleRow(
                        title: tr("创建草稿拉取请求", "Create draft pull request"),
                        description: tr("从 Assistant 创建 PR 时默认使用草稿拉取请求", "Create draft pull requests by default from Assistant"),
                        isOn: $gitCreatesDraftPullRequest
                    )
                    divider
                    settingsToggleRow(
                        title: tr("自动删除旧工作树", "Automatically delete old worktrees"),
                        description: tr("推荐大多数用户启用。仅当你需要手动管理旧工作树和磁盘使用空间时，再关闭此功能。", "Recommended for most users. Disable only when you need to manually manage old worktrees and disk usage."),
                        isOn: $gitAutomaticallyDeletesOldWorktrees
                    )
                    divider
                    gitAutomaticDeleteLimitRow
                }
            }

            gitInstructionSection(
                title: tr("提交指令", "Commit Instructions"),
                description: tr("已添加到提交信息生成提示中", "Added to commit message generation prompts"),
                placeholder: tr("添加提交消息指引...", "Add commit message instructions..."),
                draft: $gitCommitInstructionsDraft,
                storedValue: gitCommitInstructions,
                save: {
                    gitCommitInstructions = gitCommitInstructionsDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                    gitCommitInstructionsDraft = gitCommitInstructions
                }
            )

            gitInstructionSection(
                title: tr("拉取请求指令", "Pull Request Instructions"),
                description: tr("已添加到 PR 标题/描述生成提示中", "Added to PR title and description generation prompts"),
                placeholder: tr("添加拉取请求指引...", "Add pull request instructions..."),
                draft: $gitPullRequestInstructionsDraft,
                storedValue: gitPullRequestInstructions,
                save: {
                    gitPullRequestInstructions = gitPullRequestInstructionsDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                    gitPullRequestInstructionsDraft = gitPullRequestInstructions
                }
            )
        }
        .onAppear {
            resetGitInstructionDrafts()
        }
    }

    private var gitBranchPrefixRow: some View {
        HStack(alignment: .center, spacing: 16) {
            settingsRowText(
                title: tr("分支前缀", "Branch prefix"),
                description: tr("在 Assistant 中创建新分支时使用的前缀", "Prefix used when Assistant creates new branches")
            )
            Spacer(minLength: 18)

            TextField("", text: gitBranchPrefixBinding)
                .textFieldStyle(.plain)
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                .padding(.horizontal, 10)
                .frame(width: 224, height: 34)
                .background(AppTheme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.borderStrong, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .accessibilityLabel(tr("分支前缀", "Branch prefix"))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }

    private var gitAutomaticDeleteLimitRow: some View {
        HStack(alignment: .center, spacing: 16) {
            settingsRowText(
                title: tr("自动删除限制", "Automatic delete limit"),
                description: tr("自动清理我们应保留的 Assistant 工作树数量。Assistant 会在删除前为工作树创建快照，因此被清理的工作树应始终可恢复。", "Number of Assistant worktrees to keep during automatic cleanup. Assistant snapshots worktrees before deleting them so cleaned worktrees should remain restorable.")
            )
            Spacer(minLength: 18)

            TextField("", value: gitAutomaticDeleteLimitBinding, formatter: gitAutomaticDeleteLimitFormatter)
                .textFieldStyle(.plain)
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                .multilineTextAlignment(.leading)
                .padding(.horizontal, 10)
                .frame(width: 96, height: 34)
                .background(AppTheme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.borderStrong, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .accessibilityLabel(tr("自动删除限制", "Automatic delete limit"))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }

    private func gitInstructionSection(
        title: String,
        description: String,
        placeholder: String,
        draft: Binding<String>,
        storedValue: String,
        save: @escaping () -> Void
    ) -> some View {
        let canSave = draft.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines) != storedValue

        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                    Text(description)
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Button(tr("保存", "Save"), action: save)
                    .buttonStyle(.plain)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(canSave ? AppTheme.textPrimary : AppTheme.textTertiary)
                    .padding(.horizontal, 10)
                    .frame(height: 28)
                    .background(canSave ? AppTheme.surfaceHover : AppTheme.surfaceRaised.opacity(0.64))
                    .clipShape(Capsule())
                    .disabled(!canSave)
            }

            ZStack(alignment: .topLeading) {
                if draft.wrappedValue.isEmpty {
                    Text(placeholder)
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.textTertiary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 11)
                        .allowsHitTesting(false)
                }

                TextEditor(text: draft)
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.textPrimary)
                    .scrollContentBackground(.hidden)
                    .background(AppTheme.transparent)
                    .padding(7)
            }
            .frame(height: 120)
            .background(AppTheme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(AppTheme.borderStrong, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .accessibilityLabel(title)
        }
    }

    private var gitBranchPrefixBinding: Binding<String> {
        Binding(
            get: { gitBranchPrefix },
            set: { gitBranchPrefix = $0 }
        )
    }

    private var gitPullRequestMergeMethodOptions: [String] {
        GitPullRequestMergeMethod.allCases.map { $0.title(language: appLanguage) }
    }

    private var gitPullRequestMergeMethodSelection: Binding<String> {
        Binding(
            get: {
                GitPullRequestMergeMethod(storedValue: gitPullRequestMergeMethod).title(language: appLanguage)
            },
            set: { newValue in
                let selected = GitPullRequestMergeMethod.allCases.first { $0.title(language: appLanguage) == newValue } ?? .merge
                gitPullRequestMergeMethod = selected.rawValue
            }
        )
    }

    private var gitAutomaticDeleteLimitBinding: Binding<Int> {
        Binding(
            get: { min(99, max(1, gitAutomaticDeleteLimit)) },
            set: { gitAutomaticDeleteLimit = min(99, max(1, $0)) }
        )
    }

    private var gitAutomaticDeleteLimitFormatter: NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .none
        formatter.minimum = 1 as NSNumber
        formatter.maximum = 99 as NSNumber
        return formatter
    }

    private func resetGitInstructionDrafts() {
        gitCommitInstructionsDraft = gitCommitInstructions
        gitPullRequestInstructionsDraft = gitPullRequestInstructions
    }
}
