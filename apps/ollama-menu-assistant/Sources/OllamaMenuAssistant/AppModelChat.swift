import AppKit
import Foundation

extension AppModel {
    func setRoutingMode(_ mode: RoutingMode) {
        routingMode = mode
        defaults.set(mode.rawValue, forKey: DefaultsKeys.routingMode)
    }

    func setToolPermissionMode(_ mode: ToolPermissionMode) {
        toolPermissionMode = mode
        defaults.set(mode.rawValue, forKey: DefaultsKeys.toolPermissionMode)
    }

    func pickAttachments() {
        let tr = LocalizedStrings.current(defaults: defaults)
        let panel = NSOpenPanel()
        panel.title = tr("选择文件或照片", "Choose files or photos")
        panel.message = tr("可添加文本文件、文档或照片。", "You can add text files, documents, or photos.")
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = true

        guard panel.runModal() == .OK else {
            return
        }

        _ = addPendingAttachments(from: panel.urls)
    }

    func removePendingAttachment(_ attachment: MessageAttachment) {
        pendingAttachments.removeAll(where: { $0.id == attachment.id })
    }

    @discardableResult
    func addPendingAttachments(from urls: [URL]) -> Bool {
        let selected = AttachmentPayloadBuilder.makeAttachments(from: urls)
        let existingPaths = Set(pendingAttachments.map(\.path))
        let freshAttachments = selected.filter { !existingPaths.contains($0.path) }
        guard freshAttachments.isEmpty == false else {
            return false
        }
        pendingAttachments.append(contentsOf: freshAttachments)
        return true
    }

    func toggleLaunchAtLogin(_ enabled: Bool) {
        do {
            try launchAtLoginCoordinator.setEnabled(enabled)
            isLaunchAtLoginEnabled = enabled
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func copyMessage(_ message: ChatMessage) {
        let content = message.content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else {
            return
        }

        AppClipboard().copyText(content)
    }

    func canEditUserMessage(_ message: ChatMessage) -> Bool {
        availability != .generating
            && message.role == .user
            && currentConversation.messages.contains(where: { $0.id == message.id })
    }

    @discardableResult
    func submitEditedUserMessage(_ message: ChatMessage, content: String) async -> Bool {
        guard canEditUserMessage(message),
              let index = currentConversation.messages.firstIndex(where: { $0.id == message.id }) else {
            return false
        }

        let prompt = content.trimmingCharacters(in: .whitespacesAndNewlines)
        let attachments = currentConversation.messages[index].attachments
        guard !prompt.isEmpty || !attachments.isEmpty else {
            return false
        }

        let resolvedPrompt = prompt.isEmpty && !attachments.isEmpty
            ? localized("请根据我附带的资料来处理这个请求。", "Please handle this request using the materials I attached.")
            : prompt

        var requestMessages = Array(currentConversation.messages.prefix(index + 1))
        requestMessages[index].content = resolvedPrompt
        let requestAttachments = requestMessages.flatMap(\.attachments)
        if requestAttachments.requiresVisionModel, resolvedModel(for: requestAttachments) == nil {
            errorMessage = localized("当前没有可用的视觉模型，请先在 Ollama 中安装 qwen3-vl、gemma3 或 qwen2.5vl。", "No vision-capable model is available. Install qwen3-vl, gemma3, or qwen2.5vl in Ollama first.")
            return false
        }

        stopVoiceInputIfNeeded()
        currentConversation.messages[index].content = resolvedPrompt
        currentConversation.messages[index].timestamp = .now
        if currentConversation.messages.count > index + 1 {
            currentConversation.messages.removeSubrange((index + 1)..<currentConversation.messages.count)
        }
        currentConversation.model = resolvedModel(for: requestAttachments)?.name ?? selectedModelNameOrFallback()
        currentConversation.updateMetadata()
        await persistCurrentConversationIfNeeded()
        await streamAssistantReply()
        return true
    }

    func canRetryMessage(_ message: ChatMessage) -> Bool {
        availability != .generating && currentConversation.messages.last?.id == message.id && message.role == .assistant
    }

    func retryMessage(_ message: ChatMessage) async {
        guard canRetryMessage(message) else {
            return
        }

        await retryLastResponse()
    }

    func submitDraft() async {
        let prompt = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        let attachments = pendingAttachments
        guard !prompt.isEmpty || !attachments.isEmpty else {
            return
        }

        let requestAttachments = currentConversation.messages.flatMap(\.attachments) + attachments
        if requestAttachments.requiresVisionModel, resolvedModel(for: requestAttachments) == nil {
            errorMessage = localized("当前没有可用的视觉模型，请先在 Ollama 中安装 qwen3-vl、gemma3 或 qwen2.5vl。", "No vision-capable model is available. Install qwen3-vl, gemma3, or qwen2.5vl in Ollama first.")
            return
        }

        stopVoiceInputIfNeeded()
        draft = ""
        pendingAttachments = []
        appendUserMessage(prompt, attachments: attachments)
        await streamAssistantReply()
    }

    func retryLastResponse() async {
        guard canRetry else {
            return
        }

        while currentConversation.messages.last?.role == .assistant {
            currentConversation.messages.removeLast()
        }
        currentConversation.updateMetadata()
        await persistCurrentConversationIfNeeded()
        await streamAssistantReply()
    }

    private func appendUserMessage(_ prompt: String, attachments: [MessageAttachment] = []) {
        let requestAttachments = currentConversation.messages.flatMap(\.attachments) + attachments
        let routedModelName = resolvedModel(for: requestAttachments)?.name ?? selectedModelNameOrFallback()
        let resolvedPrompt = prompt.isEmpty && !attachments.isEmpty
            ? localized("请根据我附带的资料来处理这个请求。", "Please handle this request using the materials I attached.")
            : prompt

        currentConversation.model = routedModelName
        currentConversation.messages.append(
            ChatMessage(role: .user, content: resolvedPrompt, attachments: attachments)
        )
        currentConversation.updateMetadata()
    }

    private func streamAssistantReply() async {
        errorMessage = nil
        let streamingConversationID = currentConversation.id
        availability = .generating
        generatingConversationID = streamingConversationID
        isAwaitingFirstToken = true
        didReceiveResponseChunk = false
        let changesBeforeReply = await workspaceChangeSnapshot()

        let assistantID = UUID()
        currentConversation.messages.append(ChatMessage(id: assistantID, role: .assistant, content: ""))
        currentConversation.updateMetadata()
        await persistCurrentConversationIfNeeded()

        let requestMessages = currentConversation.messages.filter { $0.id != assistantID }
        let requestAttachments = requestMessages.flatMap(\.attachments)
        let routedModelName = resolvedModel(for: requestAttachments)?.name ?? currentConversation.model

        do {
            try await streamChatAttempt(
                model: routedModelName,
                messages: requestMessages,
                assistantID: assistantID
            )

            let changeSummary = await assistantChangeSummary(startingFrom: changesBeforeReply)
            setAssistantChangeSummary(changeSummary, messageID: assistantID)

            if let index = currentConversation.messages.firstIndex(where: { $0.id == assistantID }),
               currentConversation.messages[index].content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
               changeSummary == nil {
                currentConversation.messages.remove(at: index)
            }

            await recordAssistantMemoryIfNeeded(
                conversation: currentConversation,
                project: currentProject,
                assistantMessageID: assistantID
            )

            availability = .idle
            clearGeneratingConversationID(streamingConversationID)
            isAwaitingFirstToken = false
            currentConversation.updateMetadata()
            await persistCurrentConversationIfNeeded()
            await mirrorAssistantReplyToIMIfAvailable(messageID: assistantID, conversationID: streamingConversationID)
            await refreshModels()
        } catch {
            if let runtimeError = error as? AgentRuntimeError {
                await recordRuntimeTrace(runtimeError.trace)
            }

            let changeSummary = await assistantChangeSummary(startingFrom: changesBeforeReply)
            setAssistantChangeSummary(changeSummary, messageID: assistantID)

            if let index = currentConversation.messages.firstIndex(where: { $0.id == assistantID }),
               currentConversation.messages[index].content.isEmpty,
               changeSummary == nil {
                currentConversation.messages.remove(at: index)
            }

            if case .offline = error as? OllamaError {
                availability = .offline
            } else {
                availability = .idle
            }
            clearGeneratingConversationID(streamingConversationID)
            isAwaitingFirstToken = false
            errorMessage = error.localizedDescription
            currentConversation.updateMetadata()
            await persistCurrentConversationIfNeeded()
        }
    }

    private func clearGeneratingConversationID(_ conversationID: UUID) {
        if generatingConversationID == conversationID {
            generatingConversationID = nil
        }
    }

    private func streamChatAttempt(
        model: String,
        messages: [ChatMessage],
        assistantID: UUID
    ) async throws {
        let runtime = AgentRuntime(
            client: client,
            workspaceRegistry: toolRegistry,
            skillLibrary: skillLibrary,
            knowledgeStore: knowledgeStore,
            mcpToolBroker: mcpToolBroker
        )
        let result = try await runtime.run(
            AgentRequest(
                conversationID: currentConversation.id,
                routingMode: routingMode,
                selectedModelName: model,
                models: models,
                messages: messages,
                baseSystemPrompt: await workspaceSystemPrompt(),
                project: currentProject,
                permissionMode: toolPermissionMode,
                plugins: availablePlugins,
                onFinalDelta: { [weak self] delta in
                    await self?.appendAssistantDelta(delta, messageID: assistantID)
                },
                onToolEvent: { [weak self] event in
                    await self?.appendToolEvent(event, messageID: assistantID)
                },
                onFallback: { [weak self] _ in
                    await self?.prepareAssistantFallback(messageID: assistantID)
                }
            )
        )
        currentConversation.model = result.trace.modelDecision.selectedModelName
        await recordRuntimeTrace(result.trace)
    }

    private func prepareAssistantFallback(messageID: UUID) {
        replaceAssistantContent("", messageID: messageID)
        didReceiveResponseChunk = false
        isAwaitingFirstToken = true
    }

    private func workspaceSystemPrompt() async -> String? {
        let language = AppLanguage.current(defaults: defaults)
        var sections: [String] = []

        if let currentProject,
           let workspacePrompt = WorkspaceContextBuilder.makePrompt(project: currentProject, language: language) {
            sections.append(workspacePrompt)
        }

        sections.append(contentsOf: [
            GitSettingsPreferences.runtimePrompt(defaults: defaults, language: language),
            AssistantSettingsPreferences.runtimePrompt(defaults: defaults, language: language),
        ].compactMap { $0 })

        if let memoryPrompt = await assistantMemoryPrompt(language: language) {
            sections.append(memoryPrompt)
        }

        return sections
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: "\n\n")
    }

    private func assistantContent(messageID: UUID) -> String {
        currentConversation.messages.first(where: { $0.id == messageID })?.content ?? ""
    }

    private func replaceAssistantContent(_ content: String, messageID: UUID) {
        guard let index = currentConversation.messages.firstIndex(where: { $0.id == messageID }) else {
            return
        }

        currentConversation.messages[index].content = ResponseContentSanitizer.sanitize(content)
        currentConversation.messages[index].timestamp = .now
        currentConversation.updatedAt = .now
    }

    private func setAssistantChangeSummary(_ summary: AssistantChangeSummary?, messageID: UUID) {
        guard let index = currentConversation.messages.firstIndex(where: { $0.id == messageID }) else {
            return
        }

        currentConversation.messages[index].changeSummary = summary
        if summary != nil {
            currentConversation.messages[index].timestamp = .now
            currentConversation.updatedAt = .now
        }
    }

    private func appendAssistantDelta(_ delta: String, messageID: UUID) {
        guard let index = currentConversation.messages.firstIndex(where: { $0.id == messageID }) else {
            return
        }

        currentConversation.messages[index].content.append(delta)
        currentConversation.messages[index].content = ResponseContentSanitizer.sanitize(
            currentConversation.messages[index].content
        )
        currentConversation.messages[index].timestamp = .now
        currentConversation.updatedAt = .now
        didReceiveResponseChunk = true
        isAwaitingFirstToken = false
    }

    private func appendToolEvent(_ event: ToolExecutionEvent, messageID: UUID) {
        guard let index = currentConversation.messages.firstIndex(where: { $0.id == messageID }) else {
            return
        }

        currentConversation.messages[index].toolEvents.append(event)
        currentConversation.messages[index].timestamp = .now
        currentConversation.updatedAt = .now
    }

    private func workspaceChangeSnapshot() async -> WorkspaceChangeSnapshot? {
        guard let path = currentProject?.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !path.isEmpty else {
            return nil
        }

        return try? await WorkspaceChangesLoader.load(projectPath: path)
    }

    private func assistantChangeSummary(startingFrom before: WorkspaceChangeSnapshot?) async -> AssistantChangeSummary? {
        guard before != nil else {
            return nil
        }

        let after = await workspaceChangeSnapshot()
        return AssistantChangeSummary.make(before: before, after: after)
    }
}
