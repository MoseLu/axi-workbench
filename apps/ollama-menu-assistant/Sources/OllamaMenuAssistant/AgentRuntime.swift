import Foundation

struct AgentRuntime: Sendable {
    var client: OllamaClient
    var workspaceRegistry: ToolRegistry
    var skillLibrary: SkillLibrary?
    var knowledgeStore: ProjectKnowledgeStore
    var mcpToolBroker: MCPToolBroker
    var modelGateway: ModelGateway = ModelGateway()
    var maxSkillContexts = 3
    var maxKnowledgeHits = 5

    func run(_ request: AgentRequest) async throws -> AgentRuntimeResult {
        let startedAt = Date()
        let attachments = request.messages.flatMap(\.attachments)
        let classification = TaskClassifier.classify(
            messages: request.messages,
            project: request.project,
            permissionMode: request.permissionMode
        )
        let includeVector = request.models.contains { model in
            model.capabilities.contains("embedding")
                || model.name.localizedCaseInsensitiveContains("embed")
        }
        let knowledgeHits = await retrieveKnowledge(
            request: request,
            classification: classification,
            includeVector: includeVector
        )
        let routeDecision = modelGateway.route(
            classification: classification,
            mode: request.routingMode,
            models: request.models,
            preferredExpertModelName: request.selectedModelName,
            attachments: attachments
        )
        let mcpSnapshot = await mcpToolBroker.snapshot(for: request.plugins)
        let capabilityRegistry = CapabilityRegistry(
            workspaceRegistry: workspaceRegistry,
            skillLibrary: skillLibrary,
            knowledgeStore: knowledgeStore,
            mcpToolBroker: mcpToolBroker,
            mcpTools: mcpSnapshot.tools,
            plugins: request.plugins
        )
        let slashInvocation = slashInvocation(for: request.messages)
        let skillContexts = capabilityRegistry.selectedSkillContexts(
            query: classification.query,
            slashInvocation: slashInvocation,
            maxCount: maxSkillContexts
        )
        let selection = CapabilitySelector.select(
            classification: classification,
            query: classification.query,
            project: request.project,
            workspaceTools: workspaceRegistry.registeredTools,
            skillContexts: skillContexts,
            mcpTools: mcpSnapshot.tools
        )
        let selectedCapabilities = capabilityRegistry.descriptors().filter {
            selection.capabilityNames.contains($0.name)
        }
        let descriptorByName = capabilityRegistry.descriptorByToolName()
        let invocationBuffer = RuntimeInvocationBuffer()

        let systemPrompt = makeRuntimeSystemPrompt(
            baseSystemPrompt: request.baseSystemPrompt,
            classification: classification,
            knowledgeHits: knowledgeHits,
            skillContexts: skillContexts,
            routeDecision: routeDecision,
            includeVector: includeVector
        )
        let registry = capabilityRegistry.runtimeToolRegistry(selectedToolNames: selection.toolNames)
        let primaryLoop = AgentLoop(
            client: client,
            registry: registry,
            skillLibrary: nil
        )
        var trace = RuntimeTrace(
            conversationID: request.conversationID,
            startedAt: startedAt,
            task: classification,
            modelDecision: routeDecision,
            selectedCapabilities: selectedCapabilities,
            knowledgeHits: knowledgeHits,
            rawPayloadSummary: payloadSummary(request: request, includeVector: includeVector)
        )

        do {
            let content = try await primaryLoop.run(
                model: routeDecision.selectedModelName,
                contextLength: request.models.first(where: { $0.name == routeDecision.selectedModelName })?.contextLength,
                modelSupportsNativeTools: request.models.first(where: { $0.name == routeDecision.selectedModelName })?.supportsTools == true,
                messages: request.messages,
                baseSystemPrompt: systemPrompt,
                project: request.project,
                permissionMode: request.permissionMode,
                onFinalDelta: request.onFinalDelta,
                onToolEvent: { event in
                    await invocationBuffer.append(invocation(from: event, descriptors: descriptorByName))
                    await request.onToolEvent(event)
                }
            )

            if ResponseRefusalDetector.shouldUseFallback(for: content),
               let fallbackModelName = routeDecision.fallbackModelName,
               fallbackModelName != routeDecision.selectedModelName {
                let fallbackDecision = ModelRouteDecision(
                    selectedModelName: fallbackModelName,
                    selectedDisplayName: ModelCatalogService.displayName(for: fallbackModelName),
                    mode: request.routingMode,
                    scores: routeDecision.scores,
                    fallbackModelName: nil,
                    reason: "primary response triggered fallback"
                )
                await request.onFallback(fallbackDecision)
                trace.fallbackModelName = fallbackModelName
                let fallbackLoop = AgentLoop(
                    client: client,
                    registry: registry,
                    skillLibrary: nil
                )
                let fallbackContent = try await fallbackLoop.run(
                    model: fallbackModelName,
                    contextLength: request.models.first(where: { $0.name == fallbackModelName })?.contextLength,
                    modelSupportsNativeTools: request.models.first(where: { $0.name == fallbackModelName })?.supportsTools == true,
                    messages: request.messages,
                    baseSystemPrompt: systemPrompt,
                    project: request.project,
                    permissionMode: request.permissionMode,
                    onFinalDelta: request.onFinalDelta,
                    onToolEvent: { event in
                        await invocationBuffer.append(invocation(from: event, descriptors: descriptorByName))
                        await request.onToolEvent(event)
                    }
                )
                trace.invocations = await invocationBuffer.values()
                trace.finishedAt = .now
                return AgentRuntimeResult(content: fallbackContent, trace: trace)
            }

            trace.invocations = await invocationBuffer.values()
            trace.finishedAt = .now
            return AgentRuntimeResult(content: content, trace: trace)
        } catch {
            trace.invocations = await invocationBuffer.values()
            trace.errorMessage = error.localizedDescription
            trace.finishedAt = .now
            throw AgentRuntimeError(underlying: error, trace: trace)
        }
    }

    private func retrieveKnowledge(
        request: AgentRequest,
        classification: TaskClassification,
        includeVector: Bool
    ) async -> [KnowledgeHit] {
        guard let project = request.project,
              !classification.query.isEmpty else {
            return []
        }

        do {
            return try await knowledgeStore.search(
                project: project,
                query: classification.query,
                maxResults: maxKnowledgeHits,
                includeVector: includeVector
            )
        } catch {
            return []
        }
    }

    private func slashInvocation(for messages: [ChatMessage]) -> SlashCommandInvocation? {
        guard let skillLibrary,
              let lastUserMessage = messages.last(where: { $0.role == .user }) else {
            return nil
        }
        return SlashCommandParser.parse(lastUserMessage.content, skills: skillLibrary.discoverSkills())
    }

    private func makeRuntimeSystemPrompt(
        baseSystemPrompt: String?,
        classification: TaskClassification,
        knowledgeHits: [KnowledgeHit],
        skillContexts: [RuntimeSkillContext],
        routeDecision: ModelRouteDecision,
        includeVector: Bool
    ) -> String {
        var sections: [String] = []
        if let baseSystemPrompt = baseSystemPrompt?.trimmingCharacters(in: .whitespacesAndNewlines),
           !baseSystemPrompt.isEmpty {
            sections.append(baseSystemPrompt)
        }

        sections.append("""
        Agent runtime selected task: \(classification.primaryKind.rawValue)
        Runtime labels: \(classification.labels.map(\.rawValue).joined(separator: ", "))
        Selected model: \(routeDecision.selectedModelName)
        Knowledge retrieval: \(includeVector ? "hybrid full-text + vector" : "full-text fallback")
        Use the provided knowledge excerpts and scoped capabilities before guessing about the workspace. Cite file paths naturally when they are useful.
        """)

        if !knowledgeHits.isEmpty {
            let knowledgeText = knowledgeHits.map { hit in
                """
                [\(hit.source)] \(hit.path) score=\(String(format: "%.3f", hit.score))
                \(hit.snippet)
                """
            }.joined(separator: "\n\n")
            sections.append("Project knowledge hits:\n\(knowledgeText)")
        }

        if !skillContexts.isEmpty {
            let skillText = skillContexts.map { context in
                """
                Skill: \(context.summary.name) (\(context.source))
                \(context.content)
                """
            }.joined(separator: "\n\n")
            sections.append("""
            Runtime selected these skills for this request. Follow them when relevant; do not assume unrelated skills are available unless you call list_skills/read_skill.

            \(skillText)
            """)
        }

        return sections.joined(separator: "\n\n")
    }

    private func invocation(
        from event: ToolExecutionEvent,
        descriptors: [String: CapabilityDescriptor]
    ) -> CapabilityInvocation {
        let descriptor = descriptors[event.toolName]
        return CapabilityInvocation(
            capabilityName: event.toolName,
            kind: descriptor?.kind,
            status: event.status,
            summary: event.summary,
            timestamp: event.timestamp,
            metadata: event.metadata
        )
    }

    private func payloadSummary(request: AgentRequest, includeVector: Bool) -> String {
        let userMessages = request.messages.filter { $0.role == .user }.count
        let assistantMessages = request.messages.filter { $0.role == .assistant }.count
        let attachments = request.messages.flatMap(\.attachments)
        return """
        messages: user=\(userMessages), assistant=\(assistantMessages)
        attachments: \(attachments.count), vision=\(attachments.requiresVisionModel)
        project: \(request.project?.path ?? "none")
        permission: \(request.permissionMode.rawValue)
        retrieval: \(includeVector ? "hybrid" : "fts")
        """
    }
}

struct AgentRuntimeError: LocalizedError {
    var underlying: Error
    var trace: RuntimeTrace

    var errorDescription: String? {
        underlying.localizedDescription
    }
}

private actor RuntimeInvocationBuffer {
    private var invocations: [CapabilityInvocation] = []

    func append(_ invocation: CapabilityInvocation) {
        invocations.append(invocation)
    }

    func values() -> [CapabilityInvocation] {
        invocations
    }
}
