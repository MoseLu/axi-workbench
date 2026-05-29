import Foundation

struct RuntimeSkillContext: Hashable, Sendable {
    var summary: SkillSummary
    var content: String
    var source: String
}

struct CapabilityRegistry: Sendable {
    var workspaceRegistry: ToolRegistry
    var skillLibrary: SkillLibrary?
    var knowledgeStore: ProjectKnowledgeStore
    var mcpToolBroker: MCPToolBroker
    var mcpTools: [MCPToolDescriptor]
    var plugins: [PluginSummary]

    func descriptors() -> [CapabilityDescriptor] {
        var descriptors = workspaceRegistry.registeredTools.map { tool in
            CapabilityDescriptor(
                id: "workspace:\(tool.definition.function.name)",
                kind: .workspaceTool,
                name: tool.definition.function.name,
                description: tool.definition.function.description,
                risk: risk(for: tool.operation),
                source: "workspace",
                schema: tool.definition.function.parameters
            )
        }

        descriptors.append(
            CapabilityDescriptor(
                id: "knowledge:search_knowledge",
                kind: .knowledgeSource,
                name: "search_knowledge",
                description: "Search the selected project's local knowledge index.",
                risk: .read,
                source: "project knowledge",
                schema: Self.searchKnowledgeSchema
            )
        )

        if let skillLibrary {
            descriptors.append(contentsOf: skillLibrary.discoverSkills().map { skill in
                CapabilityDescriptor(
                    id: "skill:\(skill.relativePath)",
                    kind: .skill,
                    name: skill.name,
                    description: skill.description,
                    risk: .read,
                    source: "bundled skill"
                )
            })
        }

        descriptors.append(contentsOf: pluginSkillSummaries().map { skill in
            CapabilityDescriptor(
                id: "plugin-skill:\(skill.relativePath)",
                kind: .skill,
                name: skill.name,
                description: skill.description,
                risk: .read,
                source: "plugin skill"
            )
        })

        descriptors.append(contentsOf: mcpTools.map { tool in
            CapabilityDescriptor(
                id: "mcp:\(tool.namespacedToolName)",
                kind: .pluginMCPTool,
                name: tool.namespacedToolName,
                description: tool.description.isEmpty ? "MCP tool \(tool.displayName)" : tool.description,
                risk: tool.transport == "http" ? .network : .external,
                source: tool.pluginID,
                schema: tool.inputSchema
            )
        })

        return descriptors.sorted { lhs, rhs in
            if lhs.kind.rawValue == rhs.kind.rawValue {
                return lhs.name < rhs.name
            }
            return lhs.kind.rawValue < rhs.kind.rawValue
        }
    }

    func runtimeToolRegistry(selectedToolNames: Set<String>? = nil) -> ToolRegistry {
        let tools = workspaceRegistry.registeredTools
            + [searchKnowledgeTool()]
            + mcpToolBroker.registeredTools(for: mcpTools)
        let selectedTools = selectedToolNames.map { names in
            tools.filter { names.contains($0.definition.function.name) }
        } ?? tools
        return ToolRegistry(
            tools: selectedTools
        )
    }

    func selectedSkillContexts(
        query: String,
        slashInvocation: SlashCommandInvocation?,
        maxCount: Int = 3
    ) -> [RuntimeSkillContext] {
        if let slashInvocation,
           let context = readBundledSkill(slashInvocation.skill) {
            return [context]
        }

        let candidates = bundledSkillContexts() + pluginSkillContexts()
        let queryTokens = tokenSet(query)
        guard !queryTokens.isEmpty else {
            return []
        }

        return candidates
            .map { context -> (RuntimeSkillContext, Int) in
                let text = "\(context.summary.name) \(context.summary.description) \(context.summary.relativePath)"
                let score = tokenSet(text).intersection(queryTokens).count
                    + (query.localizedCaseInsensitiveContains(context.summary.name) ? 4 : 0)
                return (context, score)
            }
            .filter { $0.1 > 0 }
            .sorted {
                if $0.1 == $1.1 {
                    return $0.0.summary.name < $1.0.summary.name
                }
                return $0.1 > $1.1
            }
            .prefix(maxCount)
            .map(\.0)
    }

    func descriptorByToolName() -> [String: CapabilityDescriptor] {
        var values: [String: CapabilityDescriptor] = [:]
        for descriptor in descriptors() where values[descriptor.name] == nil {
            values[descriptor.name] = descriptor
        }
        return values
    }

    private func searchKnowledgeTool() -> RegisteredTool {
        RegisteredTool(
            definition: ToolDefinition(
                name: "search_knowledge",
                description: "Search the selected project's indexed local knowledge. Use this before guessing about project files or architecture.",
                parameters: Self.searchKnowledgeSchema
            ),
            operation: .read,
            execute: { call, context in
                guard let project = context.project else {
                    return ToolResult(
                        ok: false,
                        toolName: "search_knowledge",
                        content: "No workspace is selected for this conversation.",
                        errorCode: "no_workspace"
                    )
                }
                guard let query = call.arguments["query"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
                      !query.isEmpty else {
                    return ToolResult(
                        ok: false,
                        toolName: "search_knowledge",
                        content: "Missing required argument: query",
                        errorCode: "invalid_arguments"
                    )
                }

                do {
                    let hits = try await knowledgeStore.search(
                        project: project,
                        query: query,
                        maxResults: call.arguments["maxResults"]?.intValue ?? 5,
                        includeVector: call.arguments["includeVector"]?.boolValue ?? false
                    )
                    let encoder = JSONEncoder()
                    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
                    let data = try encoder.encode(hits)
                    return ToolResult(
                        ok: true,
                        toolName: "search_knowledge",
                        content: String(data: data, encoding: .utf8) ?? "[]",
                        metadata: ["count": .number(Double(hits.count))]
                    )
                } catch {
                    return ToolResult(
                        ok: false,
                        toolName: "search_knowledge",
                        content: error.localizedDescription,
                        errorCode: "knowledge_search_failed"
                    )
                }
            }
        )
    }

    private func risk(for operation: WorkspaceToolOperation) -> CapabilityRisk {
        switch operation {
        case .read:
            return .read
        case .write:
            return .write
        case .delete:
            return .delete
        case .shell:
            return .shell
        }
    }

    private func bundledSkillContexts() -> [RuntimeSkillContext] {
        guard let skillLibrary else {
            return []
        }
        return skillLibrary.discoverSkills().compactMap(readBundledSkill)
    }

    private func readBundledSkill(_ skill: SkillSummary) -> RuntimeSkillContext? {
        guard let skillLibrary else {
            return nil
        }
        guard case .success(let content) = skillLibrary.readSkillFile(skill: skill.name, maxBytes: 12_000) else {
            return nil
        }
        return RuntimeSkillContext(summary: skill, content: content, source: "bundled skill")
    }

    private func pluginSkillSummaries() -> [SkillSummary] {
        pluginSkillLibraries().flatMap { library, _ in
            library.discoverSkills()
        }
    }

    private func pluginSkillContexts() -> [RuntimeSkillContext] {
        pluginSkillLibraries().flatMap { library, plugin in
            library.discoverSkills().compactMap { skill in
                guard case .success(let content) = library.readSkillFile(skill: skill.name, maxBytes: 12_000) else {
                    return nil
                }
                let namespaced = SkillSummary(
                    name: "\(plugin.name):\(skill.name)",
                    description: skill.description,
                    relativePath: "\(plugin.pluginID)/\(skill.relativePath)"
                )
                return RuntimeSkillContext(summary: namespaced, content: content, source: plugin.pluginID)
            }
        }
    }

    private func pluginSkillLibraries() -> [(SkillLibrary, PluginSummary)] {
        plugins
            .filter { $0.isEnabled }
            .compactMap { plugin in
                let root = URL(fileURLWithPath: plugin.rootPath, isDirectory: true)
                    .appending(path: "skills", directoryHint: .isDirectory)
                guard FileManager.default.fileExists(atPath: root.path) else {
                    return nil
                }
                return (SkillLibrary(rootURL: root), plugin)
            }
    }

    private func tokenSet(_ text: String) -> Set<String> {
        Set(
            text
                .lowercased()
                .split { !$0.isLetter && !$0.isNumber }
                .map(String.init)
                .filter { $0.count >= 2 }
        )
    }

    private static let searchKnowledgeSchema: JSONValue = .object([
        "type": .string("object"),
        "properties": .object([
            "query": .object([
                "type": .string("string"),
                "description": .string("Search query."),
            ]),
            "maxResults": .object([
                "type": .string("number"),
                "description": .string("Maximum number of results."),
            ]),
            "includeVector": .object([
                "type": .string("boolean"),
                "description": .string("Include vector-style semantic matches when available."),
            ]),
        ]),
        "required": .array([.string("query")]),
    ])

}

struct CapabilitySelection: Sendable {
    var toolNames: Set<String>
    var capabilityNames: Set<String>
}

enum CapabilitySelector {
    static func select(
        classification: TaskClassification,
        query: String,
        project: ConversationProject?,
        workspaceTools: [RegisteredTool],
        skillContexts: [RuntimeSkillContext],
        mcpTools: [MCPToolDescriptor],
        maxMCPTools: Int = 4
    ) -> CapabilitySelection {
        var toolNames = Set<String>()
        let labels = Set(classification.labels)
        let hasProject = project?.path?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false

        if hasProject {
            let readToolNames: Set<String> = [
                "list_dir", "read_file", "stat_path", "glob_files", "find_files",
                "search", "search_rg", "grep_text", "tree",
            ]
            let writeToolNames: Set<String> = [
                "shell_command", "write_file", "apply_patch", "move_path", "delete_path",
            ]
            let wantsWorkspaceTools = classification.prefersTools
                || labels.contains(.coding)
                || labels.contains(.codebaseSearch)
                || labels.contains(.toolHeavy)
            if wantsWorkspaceTools {
                toolNames.formUnion(readToolNames)
            }
            if labels.contains(.coding) || labels.contains(.toolHeavy) {
                toolNames.formUnion(writeToolNames)
            }
            toolNames.insert("search_knowledge")
        }

        if !skillContexts.isEmpty {
            toolNames.insert("read_skill")
        }
        if query.localizedCaseInsensitiveContains("skill") || query.localizedCaseInsensitiveContains("技能") {
            toolNames.insert("list_skills")
            toolNames.insert("read_skill")
        }

        let workspaceToolNames = Set(workspaceTools.map(\.definition.function.name))
        toolNames = toolNames.filter { $0 == "search_knowledge" || workspaceToolNames.contains($0) }

        let selectedMCPTools = topMCPTools(query: query, classification: classification, tools: mcpTools, maxCount: maxMCPTools)
        toolNames.formUnion(selectedMCPTools.map(\.namespacedToolName))

        var capabilityNames = toolNames
        capabilityNames.formUnion(skillContexts.map(\.summary.name))
        return CapabilitySelection(toolNames: toolNames, capabilityNames: capabilityNames)
    }

    private static func topMCPTools(
        query: String,
        classification: TaskClassification,
        tools: [MCPToolDescriptor],
        maxCount: Int
    ) -> [MCPToolDescriptor] {
        let queryTokens = tokenSet(query)
        guard !queryTokens.isEmpty else {
            return []
        }

        return tools
            .map { tool -> (MCPToolDescriptor, Int) in
                let haystack = [
                    tool.pluginID,
                    tool.pluginDisplayName,
                    tool.serverName,
                    tool.remoteToolName,
                    tool.description,
                    tool.capabilityLabels.joined(separator: " "),
                    classification.labels.map(\.rawValue).joined(separator: " "),
                ].joined(separator: " ")
                let score = tokenSet(haystack).intersection(queryTokens).count
                    + (query.localizedCaseInsensitiveContains(tool.remoteToolName) ? 4 : 0)
                    + (query.localizedCaseInsensitiveContains(tool.pluginDisplayName) ? 3 : 0)
                return (tool, score)
            }
            .filter { $0.1 > 0 }
            .sorted {
                if $0.1 == $1.1 {
                    return $0.0.namespacedToolName < $1.0.namespacedToolName
                }
                return $0.1 > $1.1
            }
            .prefix(maxCount)
            .map(\.0)
    }

    private static func tokenSet(_ text: String) -> Set<String> {
        Set(
            text
                .lowercased()
                .split { !$0.isLetter && !$0.isNumber }
                .map(String.init)
                .filter { $0.count >= 2 }
        )
    }
}
