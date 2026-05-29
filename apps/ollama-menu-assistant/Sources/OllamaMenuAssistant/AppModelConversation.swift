import AppKit
import Foundation

private let conversationDetailCacheEntryByteLimit = 12_000_000
private let conversationDetailCacheTotalByteLimit = 36_000_000
private let conversationDetailSkeletonDelayNanoseconds: UInt64 = 80_000_000

extension AppModel {
    func selectModel(named name: String) {
        applySelectedModel(name)
        currentConversation.model = name
        Task {
            await persistCurrentConversationIfNeeded()
        }
    }

    func startNewConversation() {
        startNewConversation(in: nil, allowsNoProject: true)
    }

    func startNewConversation(in projectID: UUID?) {
        startNewConversation(in: projectID, allowsNoProject: projectID == nil)
    }

    private func startNewConversation(in projectID: UUID?, allowsNoProject: Bool) {
        recordNavigationTransition(to: .newConversation(projectID: projectID, allowsNoProject: allowsNoProject))
        applyNewConversationRoute(projectID: projectID, allowsNoProject: allowsNoProject)
    }

    private func applyNewConversationRoute(projectID: UUID?, allowsNoProject: Bool) {
        stopVoiceInputIfNeeded()
        conversationDetailLoadGeneration = UUID()
        isCurrentConversationLoading = false
        errorMessage = nil
        draft = ""
        pendingAttachments = []
        selectedProjectID = projectID
        allowsNoProjectForCurrentNewConversation = allowsNoProject
        currentConversation = StoredConversation(projectID: projectID, model: selectedModelNameOrFallback())
    }

    func clearCurrentConversation() {
        startNewConversation()
    }

    func openConversation(_ conversation: StoredConversation) {
        recordNavigationTransition(to: .conversation(conversation.id))
        applyConversationRoute(conversation)
    }

    private func applyConversationRoute(_ conversation: StoredConversation) {
        stopVoiceInputIfNeeded()
        let summary = conversation.metadataOnly
        let routeGeneration = UUID()
        conversationDetailLoadGeneration = routeGeneration
        cacheConversationDetailIfEligible(conversation)
        currentConversation = summary
        selectedProjectID = conversation.projectID
        allowsNoProjectForCurrentNewConversation = true
        activeConversationID = conversation.id
        draft = ""
        pendingAttachments = []
        errorMessage = nil
        if models.contains(where: { $0.name == summary.model }) {
            applySelectedModel(summary.model)
        }
        isCurrentConversationLoading = true
        Task {
            await loadConversationDetailAfterSkeleton(id: conversation.id, generation: routeGeneration)
        }

        Task {
            await persistActiveConversationSelection()
        }
    }

    func restoreActiveConversation(from library: ConversationLibrary) {
        let restored = library.activeConversationID
            .flatMap { activeID in library.conversations.first { $0.id == activeID && !$0.isArchived } }
            ?? library.conversations.filter { !$0.isArchived }.max(by: { $0.updatedAt < $1.updatedAt })

        guard let restored else {
            activeConversationID = nil
            selectedProjectID = nil
            allowsNoProjectForCurrentNewConversation = true
            conversationDetailLoadGeneration = UUID()
            isCurrentConversationLoading = false
            currentConversation = StoredConversation(model: selectedModelNameOrFallback())
            navigationHistory.reset(to: .newConversation(projectID: nil, allowsNoProject: true))
            return
        }

        applyConversationRoute(restored)
        navigationHistory.reset(to: .conversation(restored.id))
    }

    func pinnedConversations() -> [StoredConversation] {
        sortConversations(conversations.filter { $0.isPinned && !$0.isArchived })
    }

    func visibleConversations(for projectID: UUID?, includingPinned: Bool = false) -> [StoredConversation] {
        sortConversations(
            conversations.filter { conversation in
                conversation.projectID == projectID
                    && !conversation.isArchived
                    && (includingPinned || !conversation.isPinned)
            }
        )
    }

    func archivedConversations() -> [StoredConversation] {
        conversations
            .filter(\.isArchived)
            .sorted { lhs, rhs in
                lhs.updatedAt > rhs.updatedAt
            }
    }

    func selectProject(_ project: ConversationProject) {
        startNewConversation(in: project.id)
    }

    func useNoProject() {
        startNewConversation(in: nil)
    }

    func setWorkspaceForCurrentNewConversation(_ projectID: UUID?) {
        guard projectID != nil || allowsNoProjectForCurrentNewConversation else {
            return
        }

        if currentConversation.messages.isEmpty {
            selectedProjectID = projectID
            currentConversation.projectID = projectID
            currentConversation.model = selectedModelNameOrFallback()
            errorMessage = nil
        } else {
            startNewConversation(in: projectID)
        }
    }

    func pickWorkspaceFolder(preserveCurrentDraft: Bool = false) {
        let tr = LocalizedStrings.current(defaults: defaults)
        let panel = NSOpenPanel()
        panel.title = tr("选择项目文件夹", "Choose project folder")
        panel.message = tr("选择一个文件夹作为新会话的工作区。", "Choose a folder as the workspace for the new chat.")
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false

        guard panel.runModal() == .OK, let url = panel.urls.first else {
            return
        }

        let project = ensureProject(for: url)
        if preserveCurrentDraft {
            setWorkspaceForCurrentNewConversation(project.id)
        } else {
            startNewConversation(in: project.id)
        }
        Task {
            await persistLibrary()
        }
    }

    @discardableResult
    func addProjectFromSettings() -> ConversationProject? {
        let tr = LocalizedStrings.current(defaults: defaults)
        let panel = NSOpenPanel()
        panel.title = tr("添加项目", "Add project")
        panel.message = tr("选择一个文件夹添加到环境设置。", "Choose a folder to add to Environment settings.")
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false

        guard panel.runModal() == .OK, let url = panel.urls.first else {
            return nil
        }

        let project = ensureProject(for: url)
        Task {
            await persistLibrary()
        }
        return project
    }

    func renameProjectWithPrompt(_ project: ConversationProject) {
        guard let name = promptForName(
            title: localized("重命名项目", "Rename project"),
            message: localized("输入新的项目名称。", "Enter a new project name."),
            currentValue: project.name
        ) else {
            return
        }
        renameProject(project, to: name)
    }

    func renameProject(_ project: ConversationProject, to name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let index = projects.firstIndex(where: { $0.id == project.id }) else {
            return
        }
        projects[index].name = trimmed
        projects[index].updatedAt = .now
        Task {
            await persistLibrary()
        }
    }

    func updateProjectStartupCommand(_ project: ConversationProject, command: String) {
        guard let index = projects.firstIndex(where: { $0.id == project.id }) else {
            return
        }

        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        projects[index].startupCommand = trimmed.isEmpty ? nil : trimmed
        projects[index].updatedAt = .now
        Task {
            await persistLibrary()
        }
    }

    func updateProjectLocalEnvironment(_ project: ConversationProject, environment: ProjectLocalEnvironment?) {
        guard let index = projects.firstIndex(where: { $0.id == project.id }) else {
            return
        }

        projects[index].localEnvironment = environment
        projects[index].updatedAt = .now
        Task {
            await persistLibrary()
        }
    }

    func deleteProject(_ project: ConversationProject) {
        let tr = LocalizedStrings.current(defaults: defaults)
        let alert = NSAlert()
        alert.messageText = tr("删除项目？", "Delete project?")
        alert.informativeText = tr("这会从侧栏移除项目以及其中的会话记录，不会删除磁盘上的文件夹。", "This removes the project and its chat history from the sidebar. It will not delete the folder on disk.")
        alert.alertStyle = .warning
        alert.addButton(withTitle: tr("删除", "Delete"))
        alert.addButton(withTitle: tr("取消", "Cancel"))
        guard alert.runModal() == .alertFirstButtonReturn else {
            return
        }

        projects.removeAll(where: { $0.id == project.id })
        conversations.removeAll(where: { $0.projectID == project.id })
        if selectedProjectID == project.id || currentConversation.projectID == project.id {
            activeConversationID = nil
            startNewConversation(in: nil)
        } else if let activeConversationID,
                  conversations.contains(where: { $0.id == activeConversationID }) == false {
            self.activeConversationID = nil
        }
        Task {
            await persistLibrary()
        }
    }

    func openProjectInDefaultEditor(_ project: ConversationProject) {
        guard let path = project.path else {
            return
        }
        DefaultEditorTarget(storedValue: defaults.string(forKey: DefaultEditorTarget.storageKey))
            .open(URL(fileURLWithPath: path))
    }

    func openConversationWorkspaceInFinder(_ conversation: StoredConversation) {
        guard let path = conversationWorkspacePath(conversation) else {
            return
        }
        NSWorkspace.shared.open(URL(fileURLWithPath: path, isDirectory: true))
    }

    func copyCurrentConversationWorkspacePath() {
        copyConversationWorkspacePath(currentConversation)
    }

    func copyConversationWorkspacePath(_ conversation: StoredConversation) {
        guard let path = conversationWorkspacePath(conversation) else {
            return
        }
        copyConversationMenuText(path)
    }

    func copyConversationID(_ conversation: StoredConversation) {
        copyConversationMenuText(conversation.id.uuidString)
    }

    func copyConversationDeepLink(_ conversation: StoredConversation) {
        copyConversationMenuText("ollama-menu-assistant://conversation/\(conversation.id.uuidString)")
    }

    func copyConversationAsMarkdown(_ conversation: StoredConversation, title: String? = nil) {
        copyConversationMenuText(conversationMarkdown(conversation, title: title))
    }

    func conversationMarkdown(_ conversation: StoredConversation, title proposedTitle: String? = nil) -> String {
        let title = markdownTitle(for: conversation, proposedTitle: proposedTitle)
        let project = project(for: conversation)
        var lines = [
            "# \(title)",
            "",
            "- \(localized("会话 ID", "Chat ID")): `\(conversation.id.uuidString)`",
            "- \(localized("模型", "Model")): `\(conversation.model)`",
            "- \(localized("创建时间", "Created")): \(markdownDate(conversation.createdAt))",
            "- \(localized("更新时间", "Updated")): \(markdownDate(conversation.updatedAt))",
        ]

        if let project {
            lines.append("- \(localized("项目", "Project")): \(project.name)")
            if let path = project.path, !path.isEmpty {
                lines.append("- \(localized("工作目录", "Working directory")): `\(path)`")
            }
        }

        if conversation.messages.isEmpty {
            lines.append("")
            lines.append(localized("_当前会话还没有消息。_", "_This chat has no messages yet._"))
            return lines.joined(separator: "\n") + "\n"
        }

        for message in conversation.messages {
            lines.append("")
            lines.append("## \(markdownRoleTitle(for: message.role))")
            lines.append("")

            let content = message.content.trimmingCharacters(in: .whitespacesAndNewlines)
            lines.append(content.isEmpty ? localized("_空消息_", "_Empty message_") : content)

            if !message.attachments.isEmpty {
                lines.append("")
                lines.append("**\(localized("附件", "Attachments"))**")
                for attachment in message.attachments {
                    lines.append("- \(attachment.name) (`\(attachment.path)`)")
                }
            }
        }

        return lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines) + "\n"
    }

    func renameConversationWithPrompt(_ conversation: StoredConversation) {
        guard let title = promptForName(
            title: localized("重命名对话", "Rename chat"),
            message: localized("输入新的对话标题。", "Enter a new chat title."),
            currentValue: conversation.title
        ) else {
            return
        }
        renameConversation(conversation, to: title)
    }

    func renameConversation(_ conversation: StoredConversation, to title: String) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return
        }
        updateConversation(conversation.id) { updated in
            updated.title = trimmed
            updated.isTitleManuallyEdited = true
            updated.updatedAt = .now
        }
    }

    func togglePinConversation(_ conversation: StoredConversation) {
        updateConversation(conversation.id) { updated in
            updated.isPinned.toggle()
            updated.updatedAt = .now
        }
    }

    func archiveConversation(_ conversation: StoredConversation) {
        updateConversation(conversation.id) { updated in
            updated.isArchived = true
            updated.updatedAt = .now
        }
        if currentConversation.id == conversation.id {
            activeConversationID = nil
            startNewConversation(in: conversation.projectID)
            Task {
                await persistActiveConversationSelection()
            }
        }
    }

    func unarchiveConversation(_ conversation: StoredConversation) {
        updateConversation(conversation.id) { updated in
            updated.isArchived = false
            updated.updatedAt = .now
        }
    }

    func upsertConversationSummary(_ conversation: StoredConversation) {
        conversations.removeAll(where: { $0.id == conversation.id })
        conversations.append(conversation.metadataOnly)
        conversations = sortConversations(conversations)
    }

    func cacheConversationDetailIfEligible(_ conversation: StoredConversation) {
        guard !conversation.messages.isEmpty else {
            return
        }

        let byteCount = estimatedContentBytes(in: conversation)
        guard byteCount <= conversationDetailCacheEntryByteLimit else {
            conversationDetailCache.removeValue(forKey: conversation.id)
            return
        }

        conversationDetailCache[conversation.id] = conversation
        trimConversationDetailCache()
    }

    private func cachedConversationDetail(for summary: StoredConversation) -> StoredConversation? {
        guard let cached = conversationDetailCache[summary.id] else {
            return nil
        }
        return cached.mergingMetadata(from: summary)
    }

    private func loadConversationDetailAfterSkeleton(id conversationID: UUID, generation: UUID) async {
        try? await Task.sleep(nanoseconds: conversationDetailSkeletonDelayNanoseconds)
        guard conversationDetailLoadGeneration == generation,
              currentConversation.id == conversationID else {
            return
        }

        let summary = conversations.first(where: { $0.id == conversationID }) ?? currentConversation.metadataOnly
        if let cachedConversation = cachedConversationDetail(for: summary) {
            applyLoadedConversationDetail(cachedConversation, generation: generation)
            return
        }

        await loadConversationDetail(id: conversationID, generation: generation)
    }

    private func loadConversationDetail(id conversationID: UUID, generation: UUID) async {
        do {
            guard let loadedConversation = try await conversationStore.loadConversation(id: conversationID) else {
                guard conversationDetailLoadGeneration == generation,
                      currentConversation.id == conversationID else {
                    return
                }
                isCurrentConversationLoading = false
                return
            }

            guard conversationDetailLoadGeneration == generation,
                  currentConversation.id == conversationID else {
                return
            }

            let summary = conversations.first(where: { $0.id == conversationID }) ?? currentConversation.metadataOnly
            let conversation = loadedConversation.mergingMetadata(from: summary)
            applyLoadedConversationDetail(conversation, generation: generation)
        } catch {
            guard conversationDetailLoadGeneration == generation,
                  currentConversation.id == conversationID else {
                return
            }
            isCurrentConversationLoading = false
            errorMessage = localized("读取会话失败：\(error.localizedDescription)", "Failed to load chat: \(error.localizedDescription)")
        }
    }

    private func applyLoadedConversationDetail(_ conversation: StoredConversation, generation: UUID) {
        guard conversationDetailLoadGeneration == generation,
              currentConversation.id == conversation.id else {
            return
        }

        currentConversation = conversation
        selectedProjectID = conversation.projectID
        activeConversationID = conversation.id
        isCurrentConversationLoading = false
        cacheConversationDetailIfEligible(conversation)
        upsertConversationSummary(conversation)
        if models.contains(where: { $0.name == conversation.model }) {
            applySelectedModel(conversation.model)
        }
    }

    func persistCurrentConversationIfNeeded() async {
        guard !currentConversation.messages.isEmpty else {
            return
        }

        var updatedConversation = currentConversation
        updatedConversation.updateMetadata()
        currentConversation = updatedConversation
        activeConversationID = updatedConversation.id
        navigationHistory.replaceCurrent(with: .conversation(updatedConversation.id))

        upsertConversationSummary(updatedConversation)
        cacheConversationDetailIfEligible(updatedConversation)
        touchProjectIfNeeded(projectID: updatedConversation.projectID, date: updatedConversation.updatedAt)

        await persistConversation(updatedConversation)
    }

    func persistLibrary() async {
        do {
            try await conversationStore.saveLibraryMetadata(
                ConversationLibrary(
                    projects: projects,
                    conversations: conversations,
                    activeConversationID: activeConversationID
                )
            )
        } catch {
            errorMessage = localized("保存最近会话失败：\(error.localizedDescription)", "Failed to save recent chats: \(error.localizedDescription)")
        }
    }

    private func trimConversationDetailCache() {
        var totalBytes = conversationDetailCache.values.reduce(0) { total, conversation in
            total + estimatedContentBytes(in: conversation)
        }
        guard totalBytes > conversationDetailCacheTotalByteLimit else {
            return
        }

        let removableIDs = conversationDetailCache.values
            .filter { $0.id != currentConversation.id }
            .sorted { $0.updatedAt < $1.updatedAt }
            .map(\.id)

        for id in removableIDs {
            guard totalBytes > conversationDetailCacheTotalByteLimit,
                  let removed = conversationDetailCache.removeValue(forKey: id) else {
                return
            }
            totalBytes -= estimatedContentBytes(in: removed)
        }
    }

    private func estimatedContentBytes(in conversation: StoredConversation) -> Int {
        conversation.messages.reduce(0) { total, message in
            total
                + message.content.utf8.count
                + message.attachments.reduce(0) { $0 + $1.name.utf8.count + $1.path.utf8.count }
                + message.toolEvents.reduce(0) { $0 + $1.toolName.utf8.count + $1.summary.utf8.count }
        }
    }

    func persistConversation(_ conversation: StoredConversation) async {
        do {
            try await conversationStore.saveConversation(
                conversation,
                projects: projects,
                activeConversationID: activeConversationID
            )
        } catch {
            errorMessage = localized("保存最近会话失败：\(error.localizedDescription)", "Failed to save recent chats: \(error.localizedDescription)")
        }
    }

    func persistActiveConversationSelection() async {
        do {
            try await conversationStore.saveActiveConversationID(activeConversationID)
        } catch {
            errorMessage = localized("保存当前会话失败：\(error.localizedDescription)", "Failed to save current chat: \(error.localizedDescription)")
        }
    }

    func ensureProject(for url: URL) -> ConversationProject {
        let workspaceURL = LegacyWorkspaceProjectCleaner.workspaceURL(for: url) ?? url.standardizedFileURL.resolvingSymlinksInPath()
        let standardizedPath = workspaceURL.path
        if let existing = projects.first(where: { $0.path == standardizedPath }) {
            return existing
        }

        let project = ConversationProject(
            name: workspaceURL.lastPathComponent.isEmpty ? standardizedPath : workspaceURL.lastPathComponent,
            path: standardizedPath
        )
        projects.insert(project, at: 0)
        return project
    }

    func updateConversation(_ id: UUID, transform: (inout StoredConversation) -> Void) {
        var didUpdate = false
        if let index = conversations.firstIndex(where: { $0.id == id }) {
            if currentConversation.id == id {
                transform(&currentConversation)
                conversations[index] = currentConversation.metadataOnly
                cacheConversationDetailIfEligible(currentConversation)
                touchProjectIfNeeded(projectID: currentConversation.projectID, date: currentConversation.updatedAt)
            } else {
                transform(&conversations[index])
                conversations[index] = conversations[index].metadataOnly
                conversationDetailCache[id] = conversationDetailCache[id].map { cached in
                    var updated = conversations[index]
                    updated.messages = cached.messages
                    return updated
                }
                touchProjectIfNeeded(projectID: conversations[index].projectID, date: conversations[index].updatedAt)
            }
            conversations = sortConversations(conversations)
            didUpdate = true
        } else if currentConversation.id == id {
            transform(&currentConversation)
            upsertConversationSummary(currentConversation)
            cacheConversationDetailIfEligible(currentConversation)
            touchProjectIfNeeded(projectID: currentConversation.projectID, date: currentConversation.updatedAt)
            didUpdate = true
        }

        guard didUpdate else {
            return
        }

        Task {
            await persistLibrary()
        }
    }

    func touchProjectIfNeeded(projectID: UUID?, date: Date = .now) {
        guard let projectID,
              let index = projects.firstIndex(where: { $0.id == projectID }) else {
            return
        }
        projects[index].updatedAt = max(projects[index].updatedAt, date)
    }

    func sortConversations(_ conversations: [StoredConversation]) -> [StoredConversation] {
        conversations.sorted { lhs, rhs in
            if lhs.isPinned != rhs.isPinned {
                return lhs.isPinned && !rhs.isPinned
            }
            return lhs.updatedAt > rhs.updatedAt
        }
    }

    func navigateBack() {
        while let route = navigationHistory.goBack() {
            if applyNavigationRoute(route) {
                return
            }
        }
    }

    func navigateForward() {
        while let route = navigationHistory.goForward() {
            if applyNavigationRoute(route) {
                return
            }
        }
    }

    private func recordNavigationTransition(to route: AppNavigationRoute) {
        navigationHistory.ensureCurrentRoute(currentNavigationRoute())
        navigationHistory.record(route)
    }

    private func currentNavigationRoute() -> AppNavigationRoute {
        if conversations.contains(where: { $0.id == currentConversation.id && !$0.isArchived }) {
            return .conversation(currentConversation.id)
        }
        return .newConversation(
            projectID: currentConversation.projectID ?? selectedProjectID,
            allowsNoProject: allowsNoProjectForCurrentNewConversation
        )
    }

    @discardableResult
    private func applyNavigationRoute(_ route: AppNavigationRoute) -> Bool {
        switch route {
        case .conversation(let conversationID):
            guard let conversation = conversations.first(where: { $0.id == conversationID && !$0.isArchived }) else {
                return false
            }
            applyConversationRoute(conversation)
            return true
        case .newConversation(let projectID, let allowsNoProject):
            applyNewConversationRoute(projectID: projectID, allowsNoProject: allowsNoProject)
            return true
        }
    }

    private func promptForName(title: String, message: String, currentValue: String) -> String? {
        let tr = LocalizedStrings.current(defaults: defaults)
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: tr("保存", "Save"))
        alert.addButton(withTitle: tr("取消", "Cancel"))

        let textField = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
        textField.stringValue = currentValue
        alert.accessoryView = textField

        guard alert.runModal() == .alertFirstButtonReturn else {
            return nil
        }
        let value = textField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    private func copyConversationMenuText(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return
        }

        AppClipboard().copyText(trimmed)
    }

    private func conversationWorkspacePath(_ conversation: StoredConversation) -> String? {
        guard let path = project(for: conversation)?.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !path.isEmpty else {
            return nil
        }
        return path
    }

    private func project(for conversation: StoredConversation) -> ConversationProject? {
        if conversation.id == currentConversation.id {
            return currentProject
        }

        guard let projectID = conversation.projectID else {
            return nil
        }
        return projects.first(where: { $0.id == projectID })
    }

    private func markdownTitle(for conversation: StoredConversation, proposedTitle: String?) -> String {
        let title = (proposedTitle ?? conversation.title)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if title.isEmpty || title == "New Chat" {
            return localized("新聊天", "New chat")
        }
        return title
    }

    private func markdownRoleTitle(for role: ChatRole) -> String {
        switch role {
        case .user:
            return localized("用户", "User")
        case .assistant:
            return localized("助手", "Assistant")
        }
    }

    private func markdownDate(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}
