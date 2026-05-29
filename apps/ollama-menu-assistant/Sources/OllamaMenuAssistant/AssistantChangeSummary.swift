import Foundation

enum AssistantChangedFileState: String, Codable, Hashable, Sendable {
    case modified
    case untracked
    case cleaned
}

struct AssistantChangedFileSummary: Identifiable, Codable, Hashable, Sendable {
    var path: String
    var state: AssistantChangedFileState
    var additions: Int
    var deletions: Int

    var id: String { path }
}

struct AssistantChangeSummary: Codable, Hashable, Sendable {
    var files: [AssistantChangedFileSummary]
    var didTruncate: Bool

    var fileCount: Int {
        files.count
    }

    var totalAdditions: Int {
        files.reduce(0) { $0 + $1.additions }
    }

    var totalDeletions: Int {
        files.reduce(0) { $0 + $1.deletions }
    }

    static func make(
        before: WorkspaceChangeSnapshot?,
        after: WorkspaceChangeSnapshot?
    ) -> AssistantChangeSummary? {
        guard let before, let after else {
            return nil
        }

        let beforeFilesByPath = Dictionary(uniqueKeysWithValues: before.files.map { ($0.path, $0) })
        let afterFilesByPath = Dictionary(uniqueKeysWithValues: after.files.map { ($0.path, $0) })
        var changedFiles = [AssistantChangedFileSummary]()

        for file in after.files where beforeFilesByPath[file.path] != file {
            changedFiles.append(
                AssistantChangedFileSummary(
                    path: file.path,
                    state: file.status == .untracked ? .untracked : .modified,
                    additions: file.additions,
                    deletions: file.deletions
                )
            )
        }

        for file in before.files where afterFilesByPath[file.path] == nil {
            changedFiles.append(
                AssistantChangedFileSummary(
                    path: file.path,
                    state: .cleaned,
                    additions: 0,
                    deletions: 0
                )
            )
        }

        let sortedFiles = changedFiles.sorted {
            $0.path.localizedCaseInsensitiveCompare($1.path) == .orderedAscending
        }
        guard !sortedFiles.isEmpty else {
            return nil
        }

        return AssistantChangeSummary(
            files: sortedFiles,
            didTruncate: before.didTruncate || after.didTruncate
        )
    }
}
