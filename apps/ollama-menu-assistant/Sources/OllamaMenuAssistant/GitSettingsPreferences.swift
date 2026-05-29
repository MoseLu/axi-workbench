import Foundation

enum GitPullRequestMergeMethod: String, CaseIterable, Sendable {
    case merge
    case squash

    init(storedValue: String) {
        self = Self(rawValue: storedValue) ?? .merge
    }

    func title(language: AppLanguage) -> String {
        switch self {
        case .merge:
            return language == .english ? "Merge" : "合并"
        case .squash:
            return language == .english ? "Squash" : "压缩"
        }
    }

    var ghMergeFlag: String {
        switch self {
        case .merge:
            return "--merge"
        case .squash:
            return "--squash"
        }
    }
}

struct GitSettingsSnapshot: Equatable, Sendable {
    var branchPrefix: String
    var pullRequestMergeMethod: GitPullRequestMergeMethod
    var showsPullRequestIcon: Bool
    var alwaysForcePush: Bool
    var createsDraftPullRequest: Bool
    var automaticallyDeletesOldWorktrees: Bool
    var automaticDeleteLimit: Int
    var commitInstructions: String
    var pullRequestInstructions: String
}

enum GitSettingsPreferences {
    static let branchPrefixKey = AppPreferenceKeys.Git.branchPrefix
    static let pullRequestMergeMethodKey = AppPreferenceKeys.Git.pullRequestMergeMethod
    static let showsPullRequestIconKey = AppPreferenceKeys.Git.showsPullRequestIcon
    static let alwaysForcePushKey = AppPreferenceKeys.Git.alwaysForcePush
    static let createsDraftPullRequestKey = AppPreferenceKeys.Git.createsDraftPullRequest
    static let automaticallyDeletesOldWorktreesKey = AppPreferenceKeys.Git.automaticallyDeletesOldWorktrees
    static let automaticDeleteLimitKey = AppPreferenceKeys.Git.automaticDeleteLimit
    static let commitInstructionsKey = AppPreferenceKeys.Git.commitInstructions
    static let pullRequestInstructionsKey = AppPreferenceKeys.Git.pullRequestInstructions

    static let defaultBranchPrefix = "assistant/"
    static let defaultPullRequestMergeMethod = GitPullRequestMergeMethod.merge.rawValue
    static let defaultShowsPullRequestIcon = false
    static let defaultAlwaysForcePush = false
    static let defaultCreatesDraftPullRequest = true
    static let defaultAutomaticallyDeletesOldWorktrees = true
    static let defaultAutomaticDeleteLimit = 15

    static func snapshot(defaults: UserDefaults = .standard) -> GitSettingsSnapshot {
        GitSettingsSnapshot(
            branchPrefix: branchPrefix(defaults: defaults),
            pullRequestMergeMethod: GitPullRequestMergeMethod(
                storedValue: defaults.string(forKey: pullRequestMergeMethodKey) ?? defaultPullRequestMergeMethod
            ),
            showsPullRequestIcon: boolValue(
                defaults: defaults,
                key: showsPullRequestIconKey,
                defaultValue: defaultShowsPullRequestIcon
            ),
            alwaysForcePush: boolValue(
                defaults: defaults,
                key: alwaysForcePushKey,
                defaultValue: defaultAlwaysForcePush
            ),
            createsDraftPullRequest: boolValue(
                defaults: defaults,
                key: createsDraftPullRequestKey,
                defaultValue: defaultCreatesDraftPullRequest
            ),
            automaticallyDeletesOldWorktrees: boolValue(
                defaults: defaults,
                key: automaticallyDeletesOldWorktreesKey,
                defaultValue: defaultAutomaticallyDeletesOldWorktrees
            ),
            automaticDeleteLimit: automaticDeleteLimit(defaults: defaults),
            commitInstructions: trimmedMultiline(defaults.string(forKey: commitInstructionsKey) ?? ""),
            pullRequestInstructions: trimmedMultiline(defaults.string(forKey: pullRequestInstructionsKey) ?? "")
        )
    }

    static func branchPrefix(defaults: UserDefaults = .standard) -> String {
        normalizedBranchPrefix(defaults.string(forKey: branchPrefixKey) ?? defaultBranchPrefix)
    }

    static func normalizedBranchPrefix(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func pushCommand(forceWithLease: Bool) -> String {
        forceWithLease ? "git push --force-with-lease" : "git push"
    }

    static func createPullRequestCommand(draft: Bool) -> String {
        draft ? "gh pr create --draft --fill" : "gh pr create --fill"
    }

    static func mergePullRequestCommand(method: GitPullRequestMergeMethod) -> String {
        "gh pr merge \(method.ghMergeFlag)"
    }

    static func createBranchCommand(branchPrefix: String) -> String {
        "git switch -c \(normalizedBranchPrefix(branchPrefix))<branch-name>"
    }

    static func runtimePrompt(defaults: UserDefaults = .standard, language: AppLanguage) -> String {
        runtimePrompt(snapshot: snapshot(defaults: defaults), language: language)
    }

    static func runtimePrompt(snapshot: GitSettingsSnapshot, language: AppLanguage) -> String {
        let tr = LocalizedStrings(language: language)
        let branchPrefix = snapshot.branchPrefix.isEmpty ? tr("无", "none") : snapshot.branchPrefix
        var lines = [
            tr("Git 设置：", "Git settings:"),
            tr("- 新建分支默认使用前缀：\(branchPrefix)", "- Use this prefix for new branches by default: \(branchPrefix)"),
            tr(
                "- 拉取请求合并方法：\(snapshot.pullRequestMergeMethod.title(language: language))",
                "- Pull request merge method: \(snapshot.pullRequestMergeMethod.title(language: language))"
            ),
            tr(
                snapshot.alwaysForcePush
                    ? "- 推送时默认使用 `git push --force-with-lease`。"
                    : "- 推送时默认使用普通 `git push`；除非用户明确要求，不要强制推送。",
                snapshot.alwaysForcePush
                    ? "- Use `git push --force-with-lease` by default when pushing."
                    : "- Use ordinary `git push` by default; do not force push unless the user explicitly asks."
            ),
            tr(
                snapshot.createsDraftPullRequest
                    ? "- 创建拉取请求时默认创建草稿 PR。"
                    : "- 创建拉取请求时默认创建可审阅 PR，而不是草稿。",
                snapshot.createsDraftPullRequest
                    ? "- Create draft pull requests by default."
                    : "- Create reviewable pull requests by default, not drafts."
            ),
            tr(
                snapshot.automaticallyDeletesOldWorktrees
                    ? "- 自动清理旧工作树已启用，最多保留 \(snapshot.automaticDeleteLimit) 个 Assistant 工作树。"
                    : "- 自动清理旧工作树已关闭。",
                snapshot.automaticallyDeletesOldWorktrees
                    ? "- Automatic old worktree cleanup is enabled; keep up to \(snapshot.automaticDeleteLimit) Assistant worktrees."
                    : "- Automatic old worktree cleanup is off."
            ),
        ]

        if !snapshot.commitInstructions.isEmpty {
            lines.append(tr("- 生成提交信息时遵循这些指令：", "- Follow these instructions when generating commit messages:"))
            lines.append(snapshot.commitInstructions)
        }

        if !snapshot.pullRequestInstructions.isEmpty {
            lines.append(tr("- 生成 PR 标题和描述时遵循这些指令：", "- Follow these instructions when generating pull request titles and descriptions:"))
            lines.append(snapshot.pullRequestInstructions)
        }

        return lines.joined(separator: "\n")
    }

    private static func boolValue(defaults: UserDefaults, key: String, defaultValue: Bool) -> Bool {
        guard defaults.object(forKey: key) != nil else {
            return defaultValue
        }
        return defaults.bool(forKey: key)
    }

    private static func automaticDeleteLimit(defaults: UserDefaults) -> Int {
        guard defaults.object(forKey: automaticDeleteLimitKey) != nil else {
            return defaultAutomaticDeleteLimit
        }
        return min(99, max(1, defaults.integer(forKey: automaticDeleteLimitKey)))
    }

    private static func trimmedMultiline(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
