import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func gitSettingsDefaultsUseAssistantBranchPrefix() {
    let defaults = UserDefaults(suiteName: "OllamaMenuAssistantTests-\(UUID().uuidString)")!

    let snapshot = GitSettingsPreferences.snapshot(defaults: defaults)

    #expect(snapshot.branchPrefix == "assistant/")
    #expect(snapshot.pullRequestMergeMethod == .merge)
    #expect(snapshot.createsDraftPullRequest)
    #expect(snapshot.automaticDeleteLimit == 15)
}

@Test
func gitSettingsBuildsCommandsFromPreferences() {
    #expect(GitSettingsPreferences.createBranchCommand(branchPrefix: " feature/ ") == "git switch -c feature/<branch-name>")
    #expect(GitSettingsPreferences.pushCommand(forceWithLease: false) == "git push")
    #expect(GitSettingsPreferences.pushCommand(forceWithLease: true) == "git push --force-with-lease")
    #expect(GitSettingsPreferences.createPullRequestCommand(draft: true) == "gh pr create --draft --fill")
    #expect(GitSettingsPreferences.createPullRequestCommand(draft: false) == "gh pr create --fill")
    #expect(GitSettingsPreferences.mergePullRequestCommand(method: .squash) == "gh pr merge --squash")
}

@Test
func gitSettingsRuntimePromptIncludesSavedInstructions() {
    let snapshot = GitSettingsSnapshot(
        branchPrefix: "assistant/",
        pullRequestMergeMethod: .squash,
        showsPullRequestIcon: true,
        alwaysForcePush: true,
        createsDraftPullRequest: false,
        automaticallyDeletesOldWorktrees: true,
        automaticDeleteLimit: 7,
        commitInstructions: "Use imperative mood.",
        pullRequestInstructions: "Keep the summary brief."
    )

    let prompt = GitSettingsPreferences.runtimePrompt(snapshot: snapshot, language: .english)

    #expect(prompt.contains("assistant/"))
    #expect(prompt.contains("Squash"))
    #expect(prompt.contains("git push --force-with-lease"))
    #expect(prompt.contains("reviewable pull requests"))
    #expect(prompt.contains("Use imperative mood."))
    #expect(prompt.contains("Keep the summary brief."))
}

@Test
func gitSettingsSnapshotClampsAutomaticDeleteLimit() {
    let defaults = UserDefaults(suiteName: "OllamaMenuAssistantTests-\(UUID().uuidString)")!
    defaults.set(0, forKey: GitSettingsPreferences.automaticDeleteLimitKey)

    #expect(GitSettingsPreferences.snapshot(defaults: defaults).automaticDeleteLimit == 1)

    defaults.set(120, forKey: GitSettingsPreferences.automaticDeleteLimitKey)

    #expect(GitSettingsPreferences.snapshot(defaults: defaults).automaticDeleteLimit == 99)
}
