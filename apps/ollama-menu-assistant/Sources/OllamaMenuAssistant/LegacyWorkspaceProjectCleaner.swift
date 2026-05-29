import Foundation

enum LegacyWorkspaceProjectCleaner {
    static func clean(_ library: ConversationLibrary, fileManager: FileManager = .default) -> ConversationLibrary {
        var keeperByPath = [String: ConversationProject]()
        var remappedProjectIDs = [UUID: UUID]()

        for project in library.projects {
            guard let workspaceURL = workspaceURL(for: project, fileManager: fileManager) else {
                continue
            }

            let path = workspaceURL.path
            if var existing = keeperByPath[path] {
                existing.updatedAt = max(existing.updatedAt, project.updatedAt)
                existing.createdAt = min(existing.createdAt, project.createdAt)
                keeperByPath[path] = existing
                remappedProjectIDs[project.id] = existing.id
            } else {
                var normalized = project
                normalized.name = displayName(for: workspaceURL)
                normalized.path = path
                keeperByPath[path] = normalized
                remappedProjectIDs[project.id] = normalized.id
            }
        }

        var conversations = library.conversations.map { conversation in
            var updated = conversation
            if let projectID = conversation.projectID {
                updated.projectID = remappedProjectIDs[projectID]
            }
            return updated
        }

        let visibleProjectIDs = Set(
            conversations
                .filter { !$0.isArchived }
                .compactMap(\.projectID)
        )

        var projects = Array(keeperByPath.values)
            .filter { visibleProjectIDs.contains($0.id) }

        let keptProjectIDs = Set(projects.map(\.id))
        conversations = conversations.map { conversation in
            var updated = conversation
            if let projectID = updated.projectID,
               !keptProjectIDs.contains(projectID) {
                updated.projectID = nil
            }
            return updated
        }

        projects = projects.map { project in
            var updated = project
            let projectConversations = conversations.filter { $0.projectID == project.id }
            updated.updatedAt = projectConversations.map(\.updatedAt).max() ?? project.updatedAt
            return updated
        }
        .sorted { lhs, rhs in
            if lhs.updatedAt == rhs.updatedAt {
                return lhs.id.uuidString > rhs.id.uuidString
            }
            return lhs.updatedAt > rhs.updatedAt
        }

        let conversationIDs = Set(conversations.map(\.id))
        let activeConversationID = library.activeConversationID.flatMap { conversationIDs.contains($0) ? $0 : nil }
        return ConversationLibrary(
            projects: projects,
            conversations: conversations,
            activeConversationID: activeConversationID
        )
    }

    static func workspaceURL(for url: URL, fileManager: FileManager = .default) -> URL? {
        let standardized = url.standardizedFileURL.resolvingSymlinksInPath()
        guard !isGeneratedLegacyPath(standardized),
              !isContainerPath(standardized) else {
            return nil
        }

        return gitRoot(containing: standardized, fileManager: fileManager)
    }

    private static func workspaceURL(for project: ConversationProject, fileManager: FileManager) -> URL? {
        guard let path = project.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !path.isEmpty else {
            return nil
        }
        return workspaceURL(for: URL(fileURLWithPath: path), fileManager: fileManager)
    }

    private static func gitRoot(containing url: URL, fileManager: FileManager) -> URL? {
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory) else {
            return nil
        }

        var cursor = isDirectory.boolValue ? url : url.deletingLastPathComponent()
        while true {
            let gitPath = cursor.appending(path: ".git").path
            if fileManager.fileExists(atPath: gitPath) {
                return cursor.standardizedFileURL.resolvingSymlinksInPath()
            }

            let parent = cursor.deletingLastPathComponent()
            guard parent.path != cursor.path else {
                return nil
            }
            cursor = parent
        }
    }

    private static func isGeneratedLegacyPath(_ url: URL) -> Bool {
        let path = url.path
        let home = URL(fileURLWithPath: NSHomeDirectory()).standardizedFileURL.resolvingSymlinksInPath().path
        let codexDocuments = "\(home)/Documents/Codex/"
        let codexWorktrees = "\(home)/.codex/worktrees/"
        return path == "\(home)/Documents/Codex"
            || path.hasPrefix(codexDocuments)
            || path == "\(home)/.codex/worktrees"
            || path.hasPrefix(codexWorktrees)
            || path.hasPrefix("/tmp/codex-")
            || path.hasPrefix("/private/tmp/codex-")
    }

    private static func isContainerPath(_ url: URL) -> Bool {
        let path = url.path
        let home = URL(fileURLWithPath: NSHomeDirectory()).standardizedFileURL.resolvingSymlinksInPath().path
        guard path != "/" && path != home else {
            return true
        }

        let lastComponent = url.lastPathComponent.lowercased()
        return ["code", "projects", "workspaces", "repos"].contains(lastComponent)
    }

    private static func displayName(for url: URL) -> String {
        let path = url.path
        return url.lastPathComponent.isEmpty ? path : url.lastPathComponent
    }
}
