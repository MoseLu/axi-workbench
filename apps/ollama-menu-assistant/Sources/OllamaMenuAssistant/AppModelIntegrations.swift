import AppKit
import Combine
import Foundation

extension AppModel {
    func setIMBridgeEnabled(_ enabled: Bool) {
        isIMBridgeEnabled = enabled
        defaults.set(enabled, forKey: DefaultsKeys.imBridgeEnabled)
        if enabled {
            startIMBridge()
        } else {
            stopIMBridge()
        }
    }

    func refreshIMBridge() {
        guard isIMBridgeEnabled else {
            return
        }
        stopIMBridge()
        startIMBridge()
    }

    func setPetSelection(_ selection: PetSelection) {
        setPetSelections(selection == .none ? [] : [selection])
    }

    func setPetSelection(_ selection: PetSelection, enabled: Bool) {
        var selections = petSelections.filter { $0 != selection }
        if enabled {
            guard selections.count < PetRoster.maxPets else {
                petStatusMessage = localized("最多同时显示 3 个桌面宠物", "You can show up to 3 desktop pets at once")
                return
            }
            selections.append(selection)
        }

        setPetSelections(selections)
    }

    func clearPetSelections() {
        setPetSelections([])
    }

    func setPetSelections(_ selections: [PetSelection]) {
        refreshPetCatalog()
        let roster = PetRoster(selections: selections)
        petSelections = roster.selections
        petSelection = roster.primarySelection
        defaults.set(roster.storageValue, forKey: DefaultsKeys.pets)
        defaults.set(petSelection.storageValue, forKey: DefaultsKeys.pet)
        Task {
            await applyPetSelections(roster.selections)
        }
    }

    func refreshPetRunnerState() {
        isPetRunning = petRunnerController.isRunning
    }

    func stopPetRunnerForAppTermination() {
        petRunnerController.terminate()
        isPetRunning = false
    }

    func toggleVoiceInput() async {
        if isVoiceInputActive {
            stopVoiceInputIfNeeded()
            return
        }

        voiceDraftPrefix = draft.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            try await speechInputCoordinator.start(
                onText: { [weak self] transcript in
                    self?.updateDraftFromSpeech(transcript)
                },
                onFinish: { [weak self] message in
                    self?.finishVoiceInput(message: message)
                }
            )
            isVoiceInputActive = true
            errorMessage = nil
        } catch {
            isVoiceInputActive = false
            errorMessage = error.localizedDescription
        }
    }

    func observePetRunnerLifecycle() {
        let notifications = NSWorkspace.shared.notificationCenter
        notifications.publisher(for: NSWorkspace.didLaunchApplicationNotification)
            .merge(with: notifications.publisher(for: NSWorkspace.didTerminateApplicationNotification))
            .sink { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.refreshPetRunnerState()
                }
            }
            .store(in: &cancellables)
    }

    func applyPetSelection(_ selection: PetSelection) async {
        await applyPetSelections(selection == .none ? [] : [selection])
    }

    func applyPetSelections(_ selections: [PetSelection]) async {
        let roster = PetRoster(selections: selections)
        do {
            if roster.selections.isEmpty {
                petRunnerController.terminate()
            } else {
                let requests = roster.selections.enumerated().map { index, selection in
                    PetLaunchRequest(
                        id: selection.id,
                        petDirectoryURL: petDirectoryURL(for: selection),
                        slotIndex: index,
                        slotCount: PetFormationSlots.slotCount
                    )
                }
                try await petRunnerController.launchPets(requests)
            }
            petStatusMessage = nil
        } catch {
            petStatusMessage = error.localizedDescription
        }

        refreshPetRunnerState()
    }

    func startIMBridge() {
        stopIMBridge()
        let generation = UUID()
        imBridgeGeneration = generation

        do {
            imBridgeStatus = WeChatIMBridgeStatus(
                state: .connecting,
                detail: localized("正在读取微信 IM 凭证", "Reading WeChat IM credentials"),
                credentialSource: nil,
                activeChatID: nil,
                processedMessageCount: 0,
                lastMessageAt: nil
            )
            let credentials = try imCredentialStore.load(pathOverride: defaults.string(forKey: DefaultsKeys.imBridgeCredentialPath))
            let client = WeChatILinkClient(credentials: credentials)
            let bridge = WeChatIMBridge(
                client: client,
                botID: credentials.ilinkBotID,
                credentialSource: credentials.sourcePath,
                onMessage: { [weak self] message in
                    guard let self else {
                        return nil
                    }
                    return try await self.handleIncomingIMMessage(message)
                },
                onStatus: { [weak self] status in
                    Task { @MainActor [weak self] in
                        guard let self, self.imBridgeGeneration == generation else {
                            return
                        }
                        self.imBridgeStatus = status
                    }
                }
            )
            imBridge = bridge
            imBridgeStatus = WeChatIMBridgeStatus(
                state: .connecting,
                detail: localized("正在连接微信 IM", "Connecting WeChat IM"),
                credentialSource: credentials.sourcePath,
                activeChatID: nil,
                processedMessageCount: 0,
                lastMessageAt: nil
            )
            Task {
                await bridge.start()
            }
        } catch let error as WeChatIMCredentialError {
            let state: WeChatIMBridgeStatus.State = {
                if case .missingFile = error {
                    return .waitingForCredentials
                }
                return .failed
            }()
            imBridgeStatus = WeChatIMBridgeStatus(
                state: state,
                detail: error.localizedDescription,
                credentialSource: nil,
                activeChatID: nil,
                processedMessageCount: 0,
                lastMessageAt: nil
            )
        } catch {
            imBridgeStatus = WeChatIMBridgeStatus(
                state: .failed,
                detail: error.localizedDescription,
                credentialSource: nil,
                activeChatID: nil,
                processedMessageCount: 0,
                lastMessageAt: nil
            )
        }
    }

    private func stopIMBridge() {
        imBridgeGeneration = UUID()
        if let bridge = imBridge {
            Task {
                await bridge.stop()
            }
        }
        imBridge = nil
        imBridgeStatus = .disabled
    }

    func handleIncomingIMMessage(_ message: WeChatIncomingMessage) async throws -> String? {
        if let selectionReply = try await imSelectionResponseIfNeeded(message) {
            return selectionReply
        }

        var conversation = try await conversationForIncomingIMMessage(message)
        conversation.messages.append(ChatMessage(role: .user, content: message.text, timestamp: message.timestamp))
        conversation.updatedAt = .now
        upsertIMConversation(conversation)
        await persistConversation(conversation)

        let toolEvents = IMToolEventBuffer()
        let model = conversation.model.isEmpty ? selectedModelNameOrFallback() : conversation.model
        let runtime = AgentRuntime(
            client: client,
            workspaceRegistry: toolRegistry,
            skillLibrary: skillLibrary,
            knowledgeStore: knowledgeStore,
            mcpToolBroker: mcpToolBroker
        )

        do {
            let result = try await runtime.run(
                AgentRequest(
                    conversationID: conversation.id,
                    routingMode: routingMode,
                    selectedModelName: model,
                    models: models,
                    messages: conversation.messages,
                    baseSystemPrompt: await imSystemPrompt(),
                    project: nil,
                    permissionMode: .default,
                    plugins: availablePlugins,
                    onFinalDelta: { _ in },
                    onToolEvent: { event in
                        await toolEvents.append(event)
                    },
                    onFallback: { _ in }
                )
            )
            let sanitizedReply = ResponseContentSanitizer
                .sanitize(result.content)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !sanitizedReply.isEmpty else {
                return nil
            }
            await recordRuntimeTrace(result.trace)
            let assistantMessage = ChatMessage(
                role: .assistant,
                content: sanitizedReply,
                toolEvents: await toolEvents.values()
            )
            conversation.messages.append(assistantMessage)
            conversation.updateMetadata()
            await recordAssistantMemoryIfNeeded(
                conversation: conversation,
                project: nil,
                assistantMessageID: assistantMessage.id
            )
            upsertIMConversation(conversation)
            await persistConversation(conversation)
            return sanitizedReply
        } catch {
            if let runtimeError = error as? AgentRuntimeError {
                await recordRuntimeTrace(runtimeError.trace)
            }

            let errorReply = localized(
                "IM 回复失败：\(error.localizedDescription)",
                "IM reply failed: \(error.localizedDescription)"
            )
            conversation.messages.append(ChatMessage(role: .assistant, content: errorReply))
            conversation.updateMetadata()
            upsertIMConversation(conversation)
            await persistConversation(conversation)
            return errorReply
        }
    }

    func imSelectionResponseIfNeeded(_ message: WeChatIncomingMessage) async throws -> String? {
        let key = imConversationBindingKey(chatID: message.chatID)
        let trimmed = message.text.trimmingCharacters(in: .whitespacesAndNewlines)

        if let request = await imBindingStore.takeoverRequest(for: key) {
            if imCancelsConversationSelection(trimmed) {
                try await imBindingStore.clearTakeoverRequest(for: key)
                return localized("已取消会话接管选择。", "Cancelled session takeover selection.")
            }

            if let conversation = try await imTakeoverConversationSelection(from: trimmed, request: request) {
                try await imBindingStore.setConversationID(conversation.id, for: key)
                return imConversationHandoffText(for: conversation)
                    ?? localized("已接入所选会话。", "Connected to the selected session.")
            }

            return try await imConversationTakeoverPrompt(for: key, invalidSelection: !trimmed.isEmpty)
        }

        if imRequestsConversationSelection(trimmed) {
            return try await imConversationTakeoverPrompt(for: key)
        }

        guard await imBindingStore.conversationID(for: key) == nil else {
            return nil
        }

        let candidates = imConversationTakeoverCandidates()
        guard !candidates.isEmpty else {
            return nil
        }
        return try await imConversationTakeoverPrompt(for: key, candidates: candidates)
    }

    private func conversationForIncomingIMMessage(_ message: WeChatIncomingMessage) async throws -> StoredConversation {
        let key = imConversationBindingKey(chatID: message.chatID)
        if let conversationID = await imBindingStore.conversationID(for: key) {
            if currentConversation.id == conversationID,
               !currentConversation.messages.isEmpty {
                return currentConversation
            }

            if let cached = conversationDetailCache[conversationID] {
                return cached
            }

            if let loaded = try await conversationStore.loadConversation(id: conversationID) {
                cacheConversationDetailIfEligible(loaded)
                return loaded
            }

            if let summary = conversations.first(where: { $0.id == conversationID }) {
                return summary
            }
        }

        var conversation = StoredConversation(
            title: "WeChat · \(shortIMIdentifier(message.chatID))",
            model: selectedModelNameOrFallback(),
            isTitleManuallyEdited: true
        )
        conversation.updatedAt = message.timestamp
        try await imBindingStore.setConversationID(conversation.id, for: key)
        return conversation
    }

    private func upsertIMConversation(_ conversation: StoredConversation) {
        upsertConversationSummary(conversation)
        cacheConversationDetailIfEligible(conversation)
        if currentConversation.id == conversation.id {
            currentConversation = conversation
        }
    }

    private func imConversationBindingKey(chatID: String) -> String {
        "wechat:\(chatID)"
    }

    private func shortIMIdentifier(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > 12 else {
            return trimmed
        }
        return String(trimmed.prefix(6)) + "..." + String(trimmed.suffix(4))
    }

    func mirrorAssistantReplyToIMIfAvailable(messageID: UUID, conversationID: UUID) async {
        guard isIMBridgeEnabled,
              currentConversation.id == conversationID,
              let bridge = imBridge,
              let message = currentConversation.messages.first(where: { $0.id == messageID }),
              message.role == .assistant,
              let text = imForwardText(for: message) else {
            return
        }
        let chatIDs = await imBindingStore.chatIDs(forConversationID: conversationID)
        guard !chatIDs.isEmpty else {
            return
        }

        do {
            for chatID in chatIDs {
                _ = try await bridge.sendText(toChatID: chatID, text)
            }
        } catch {
            errorMessage = localized(
                "微信 IM 转发失败：\(error.localizedDescription)",
                "WeChat IM forward failed: \(error.localizedDescription)"
            )
        }
    }

    private func imConversationHandoffText(for conversation: StoredConversation) -> String? {
        let title = conversation.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallbackTitle = localized("新对话", "New Chat")
        let displayTitle = title.isEmpty ? fallbackTitle : title
        let header = localized(
            "已接入当前会话：\(displayTitle)",
            "Connected current conversation: \(displayTitle)"
        )
        let turns = conversation.messages.suffix(6).compactMap { message -> String? in
            let content = imTrimForChat(message.content, limit: 700)
            guard !content.isEmpty else {
                return nil
            }
            return "\(imRoleLabel(message.role)): \(content)"
        }
        guard !turns.isEmpty else {
            return header
        }
        return imTrimForChat("\(header)\n\n\(localized("最近对话", "Recent turns")):\n\(turns.joined(separator: "\n\n"))", limit: 3_600)
    }

    private func imConversationTakeoverPrompt(
        for key: String,
        candidates providedCandidates: [StoredConversation]? = nil,
        invalidSelection: Bool = false
    ) async throws -> String {
        let candidates = providedCandidates ?? imConversationTakeoverCandidates()
        guard !candidates.isEmpty else {
            return localized(
                "当前没有可接管的会话。请先在桌面端开始一个会话。",
                "There are no sessions available to take over yet. Start one on desktop first."
            )
        }

        try await imBindingStore.setTakeoverRequest(
            IMConversationTakeoverRequest(conversationIDs: candidates.map(\.id)),
            for: key
        )

        let header = invalidSelection
            ? localized(
                "没认出你要接管哪一个会话，请回复编号。",
                "I couldn't tell which session you want. Reply with a number."
            )
            : localized(
                "找到这些正在进行的会话，回复编号即可接管。",
                "I found these active sessions. Reply with a number to take one over."
            )
        let lines = candidates.enumerated().map { index, conversation in
            "\(index + 1). \(imConversationTakeoverLabel(for: conversation))"
        }
        let footer = localized(
            "发送“会话列表”可重新查看，发送“取消”可退出选择。",
            "Send \"session list\" to view them again, or \"cancel\" to stop choosing."
        )
        return ([header] + lines + [footer]).joined(separator: "\n")
    }

    private func imConversationTakeoverCandidates(limit: Int = 8) -> [StoredConversation] {
        var candidatesByID: [UUID: StoredConversation] = [:]

        if !currentConversation.messages.isEmpty, !currentConversation.isArchived {
            candidatesByID[currentConversation.id] = currentConversation
        }

        for summary in conversations where !summary.isArchived {
            if let cached = conversationDetailCache[summary.id] {
                candidatesByID[summary.id] = cached.mergingMetadata(from: summary)
            } else if summary.id == currentConversation.id, !currentConversation.messages.isEmpty {
                candidatesByID[summary.id] = currentConversation.mergingMetadata(from: summary)
            } else {
                candidatesByID[summary.id] = summary
            }
        }

        return Array(
            candidatesByID.values
                .sorted { lhs, rhs in
                    let lhsGenerating = isConversationGenerating(lhs.id)
                    let rhsGenerating = isConversationGenerating(rhs.id)
                    if lhsGenerating != rhsGenerating {
                        return lhsGenerating && !rhsGenerating
                    }

                    let lhsCurrent = lhs.id == currentConversation.id || lhs.id == activeConversationID
                    let rhsCurrent = rhs.id == currentConversation.id || rhs.id == activeConversationID
                    if lhsCurrent != rhsCurrent {
                        return lhsCurrent && !rhsCurrent
                    }

                    if lhs.updatedAt != rhs.updatedAt {
                        return lhs.updatedAt > rhs.updatedAt
                    }

                    return lhs.createdAt > rhs.createdAt
                }
                .prefix(limit)
        )
    }

    private func imTakeoverConversationSelection(
        from rawSelection: String,
        request: IMConversationTakeoverRequest
    ) async throws -> StoredConversation? {
        let selection = rawSelection.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !selection.isEmpty else {
            return nil
        }

        if let index = imConversationSelectionIndex(from: selection),
           request.conversationIDs.indices.contains(index),
           let conversation = try await imConversationForTakeover(id: request.conversationIDs[index]) {
            return conversation
        }

        if let conversationID = imConversationSelectionUUID(from: selection, candidates: request.conversationIDs) {
            return try await imConversationForTakeover(id: conversationID)
        }

        return nil
    }

    private func imConversationForTakeover(id: UUID) async throws -> StoredConversation? {
        if currentConversation.id == id, !currentConversation.messages.isEmpty {
            return currentConversation
        }

        if let summary = conversations.first(where: { $0.id == id }) {
            if let cached = conversationDetailCache[id] {
                return cached.mergingMetadata(from: summary)
            }

            if let loaded = try await conversationStore.loadConversation(id: id) {
                let conversation = loaded.mergingMetadata(from: summary)
                cacheConversationDetailIfEligible(conversation)
                upsertConversationSummary(conversation)
                return conversation
            }

            return summary
        }

        guard let loaded = try await conversationStore.loadConversation(id: id) else {
            return nil
        }
        cacheConversationDetailIfEligible(loaded)
        upsertConversationSummary(loaded)
        return loaded
    }

    private func imConversationTakeoverLabel(for conversation: StoredConversation) -> String {
        var parts = [
            imConversationTitle(conversation),
            imConversationTimestampLabel(conversation.updatedAt),
        ]

        if let projectName = conversation.projectID.flatMap({ projectID in
            projects.first(where: { $0.id == projectID })?.name
        }), !projectName.isEmpty {
            parts.append(projectName)
        }

        var badges: [String] = []
        if isConversationGenerating(conversation.id) {
            badges.append(localized("进行中", "Running"))
        }
        if conversation.id == currentConversation.id || conversation.id == activeConversationID {
            badges.append(localized("当前", "Current"))
        }
        if !badges.isEmpty {
            parts.append("[\(badges.joined(separator: " · "))]")
        }

        return parts.joined(separator: " · ")
    }

    private func imConversationTitle(_ conversation: StoredConversation) -> String {
        let trimmed = conversation.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            return trimmed
        }
        return localized("新对话", "New Chat")
    }

    private func imConversationTimestampLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = Calendar.current.isDateInToday(date) ? "HH:mm" : "MM-dd HH:mm"
        return formatter.string(from: date)
    }

    private func imRequestsConversationSelection(_ text: String) -> Bool {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else {
            return false
        }
        let keywords = [
            "会话",
            "会话列表",
            "最近的会话",
            "最近会话",
            "接管会话",
            "切换会话",
            "session",
            "sessions",
            "session list",
            "take over",
            "takeover",
            "switch session",
        ]
        return keywords.contains { normalized.contains($0) }
    }

    private func imCancelsConversationSelection(_ text: String) -> Bool {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return normalized == "取消" || normalized == "cancel"
    }

    private func imConversationSelectionIndex(from text: String) -> Int? {
        guard let range = text.range(of: #"[1-9][0-9]*"#, options: .regularExpression),
              let value = Int(text[range]),
              value > 0 else {
            return nil
        }
        return value - 1
    }

    private func imConversationSelectionUUID(from text: String, candidates: [UUID]) -> UUID? {
        let matches = text.matches(of: /[0-9a-fA-F-]{4,36}/).map { String($0.output) }
        guard !matches.isEmpty else {
            return nil
        }

        for match in matches {
            let normalized = match.lowercased()
            if let candidate = candidates.first(where: { $0.uuidString.lowercased().hasPrefix(normalized) }) {
                return candidate
            }
        }
        return nil
    }

    private func imForwardText(for message: ChatMessage) -> String? {
        var parts: [String] = []
        let content = imTrimForChat(message.content, limit: 3_200)
        if !content.isEmpty {
            parts.append(content)
        }
        if let changeSummary = message.changeSummary {
            parts.append(imChangeSummaryText(changeSummary))
        }
        let text = parts.joined(separator: "\n\n").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : text
    }

    private func imChangeSummaryText(_ summary: AssistantChangeSummary) -> String {
        let files = summary.files.prefix(6).map { file in
            "\(file.path) (+\(file.additions) -\(file.deletions))"
        }
        let suffix = summary.files.count > files.count ? "\n..." : ""
        return "\(localized("文件变更", "File changes")):\n\(files.joined(separator: "\n"))\(suffix)"
    }

    private func imRoleLabel(_ role: ChatRole) -> String {
        switch role {
        case .user:
            return localized("你", "You")
        case .assistant:
            return "Codex"
        }
    }

    private func imTrimForChat(_ value: String, limit: Int) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > limit else {
            return trimmed
        }
        return String(trimmed.prefix(max(0, limit - 3))) + "..."
    }

    private func imSystemPrompt() async -> String {
        let language = AppLanguage.current(defaults: defaults)
        let replyLanguage = language == .english ? "English" : "Simplified Chinese"
        return [
            """
        This conversation arrived through WeChat IM. Reply directly to the sender in \(replyLanguage).

        Keep the response concise enough for chat. Do not mention bridge internals, iLink, MiniMax, or local credentials unless the sender explicitly asks about the IM integration.
        """,
            AssistantSettingsPreferences.runtimePrompt(defaults: defaults, language: language),
            await assistantMemoryPrompt(language: language),
        ]
        .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: "\n\n")
    }

    private func updateDraftFromSpeech(_ transcript: String) {
        let trimmedPrefix = voiceDraftPrefix.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            draft = trimmedPrefix
            return
        }

        if trimmedPrefix.isEmpty {
            draft = transcript
        } else {
            draft = "\(trimmedPrefix)\n\(transcript)"
        }
    }

    private func finishVoiceInput(message: String?) {
        isVoiceInputActive = false
        voiceDraftPrefix = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        if let message, !message.isEmpty {
            errorMessage = localized("语音录入已结束：\(message)", "Voice input ended: \(message)")
        }
    }
}

private actor IMToolEventBuffer {
    private var storage: [ToolExecutionEvent] = []

    func append(_ event: ToolExecutionEvent) {
        storage.append(event)
    }

    func values() -> [ToolExecutionEvent] {
        storage
    }
}
