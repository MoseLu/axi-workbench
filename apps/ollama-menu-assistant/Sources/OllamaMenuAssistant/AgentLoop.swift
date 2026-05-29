import Foundation

struct AgentLoop: Sendable {
    var client: OllamaClient
    var registry: ToolRegistry
    var skillLibrary: SkillLibrary? = SkillLibrary.default()
    var maxRounds: Int = 8
    var maxToolCallsPerRound: Int = 12

    func run(
        model: String,
        contextLength: Int?,
        modelSupportsNativeTools: Bool,
        messages: [ChatMessage],
        baseSystemPrompt: String?,
        project: ConversationProject?,
        permissionMode: ToolPermissionMode,
        onFinalDelta: @escaping @Sendable (String) async -> Void,
        onToolEvent: @escaping @Sendable (ToolExecutionEvent) async -> Void
    ) async throws -> String {
        let context = ToolExecutionContext(project: project, permissionMode: permissionMode)
        let availableSkills = skillLibrary?.discoverSkills() ?? []
        let slashInvocation = messages.last(where: { $0.role == .user }).flatMap {
            SlashCommandParser.parse($0.content, skills: availableSkills)
        }
        let systemPrompt = makeSystemPrompt(
            baseSystemPrompt: baseSystemPrompt,
            permissionMode: permissionMode,
            useNativeTools: modelSupportsNativeTools,
            slashInvocation: slashInvocation
        )
        var transcript = messages.map(AgentChatMessage.init(message:))
        if let slashInvocation,
           let lastUserIndex = transcript.lastIndex(where: { $0.role == "user" }) {
            let tr = LocalizedStrings.current()
            transcript[lastUserIndex].content = slashInvocation.request.isEmpty
                ? tr("使用 \(slashInvocation.skill.name) 技能处理当前请求。", "Use the \(slashInvocation.skill.name) skill to handle the current request.")
                : slashInvocation.request
        }

        for round in 0..<maxRounds {
            let response = try await client.completeChat(
                model: model,
                messages: transcript,
                systemPrompt: systemPrompt,
                tools: modelSupportsNativeTools ? registry.definitions : nil,
                contextLength: contextLength
            )
            let content = response.message?.content ?? ""
            let nativeCalls = response.message?.toolCalls?.map(\.agentCall) ?? []
            let fallbackCalls = nativeCalls.isEmpty ? ToolCallParser.parseFallbackToolCalls(in: content) : []
            let toolCalls = Array((nativeCalls + fallbackCalls).prefix(maxToolCallsPerRound))

            guard !toolCalls.isEmpty else {
                await onFinalDelta(content)
                return content
            }

            let results = await execute(toolCalls, context: context, onToolEvent: onToolEvent)
            transcript.append(AgentChatMessage(role: "assistant", content: content.isEmpty ? "Requested tool calls." : content))
            transcript.append(AgentChatMessage(role: "user", content: toolResultsPrompt(round: round + 1, results: results)))
        }

        throw OllamaError.server(LocalizedStrings.current()("工具调用超过最大轮数（\(maxRounds)）。", "Tool calls exceeded the maximum round count (\(maxRounds))."))
    }

    private func execute(
        _ calls: [AgentToolCall],
        context: ToolExecutionContext,
        onToolEvent: @escaping @Sendable (ToolExecutionEvent) async -> Void
    ) async -> [ToolResult] {
        var results: [ToolResult] = []
        for call in calls {
            let result = await registry.execute(call, context: context)
            results.append(result)
            await onToolEvent(makeEvent(from: result))
        }
        return results
    }

    private func makeEvent(from result: ToolResult) -> ToolExecutionEvent {
        let status: ToolExecutionStatus
        if result.ok {
            status = .allowed
        } else if ["permission_denied", "outside_workspace", "destructive_command", "sandbox_denied"].contains(result.errorCode ?? "") {
            status = .denied
        } else {
            status = .failed
        }

        let summaryPrefix = result.errorCode.map { "\($0): " } ?? ""
        return ToolExecutionEvent(
            toolName: result.toolName,
            status: status,
            summary: truncate(summaryPrefix + result.content.replacingOccurrences(of: "\n", with: " "), limit: 240),
            metadata: result.metadata
        )
    }

    private func toolResultsPrompt(round: Int, results: [ToolResult]) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let trimmedResults = results.map { result in
            ToolResult(
                ok: result.ok,
                toolName: result.toolName,
                content: truncate(result.content, limit: 18_000),
                errorCode: result.errorCode,
                metadata: result.metadata
            )
        }

        let payload: String
        if let data = try? encoder.encode(trimmedResults),
           let text = String(data: data, encoding: .utf8) {
            payload = text
        } else {
            payload = "[]"
        }

        return """
        Tool results for round \(round):
        \(payload)

        Use these results to continue. If more information is needed, request more tools using the same tool protocol. Otherwise, answer the user normally. Do not show raw tool-call JSON.
        """
    }

    private func makeSystemPrompt(
        baseSystemPrompt: String?,
        permissionMode: ToolPermissionMode,
        useNativeTools: Bool,
        slashInvocation: SlashCommandInvocation?
    ) -> String {
        var sections: [String] = []
        if let baseSystemPrompt = baseSystemPrompt?.trimmingCharacters(in: .whitespacesAndNewlines),
           !baseSystemPrompt.isEmpty {
            sections.append(baseSystemPrompt)
        }

        let language = AppLanguage.current()
        sections.append("""
        You are running inside a local macOS app with workspace tools. For questions about the selected project, inspect files with tools instead of guessing from the project name.

        Current tool permission mode: \(permissionMode.title(language: language)) - \(permissionMode.subtitle(language: language))
        Tool execution policy:
        - Default mode allows workspace read tools and read-only shell commands only.
        - Auto-review mode can allow safe workspace writes after static review and sandboxed command review.
        - Full-access mode allows ordinary local shell and file operations with timeout and output truncation.
        - Permission failures are returned as structured tool errors; adapt and use safer tools when possible.

        When you need tools and native tool calls are unavailable, reply only with JSON in this shape:
        {"tool_calls":[{"name":"list_dir","arguments":{"path":"."}}]}
        You may request multiple calls at once. Do not include prose around tool-call JSON. After tool results arrive, answer normally.
        """)

        if let skillLibrary {
            sections.append("""
            Assistant skills are installed in this app. Use them when the user's request matches a skill's description. If a skill may apply, call list_skills or read_skill to load the exact instructions before acting.

            Installed skills:
            \(skillLibrary.manifestText())
            """)
        }

        if let slashInvocation,
           let skillText = readInvokedSkill(slashInvocation.skill.name) {
            sections.append("""
            The user explicitly invoked the /\(slashInvocation.skill.name) skill. Follow this skill for the current response.

            Skill entrypoint:
            \(skillText)
            """)
        }

        if !useNativeTools {
            sections.append("Available tools:\n\(registry.manifestText())")
        }
        return sections.joined(separator: "\n\n")
    }

    private func readInvokedSkill(_ name: String) -> String? {
        guard let skillLibrary else {
            return nil
        }

        switch skillLibrary.readSkillFile(skill: name, maxBytes: 18_000) {
        case .success(let text):
            return truncate(text, limit: 18_000)
        case .failure:
            return nil
        }
    }

    private func truncate(_ text: String, limit: Int) -> String {
        guard text.count > limit else {
            return text
        }
        return "\(text.prefix(limit))\n[truncated]"
    }
}
