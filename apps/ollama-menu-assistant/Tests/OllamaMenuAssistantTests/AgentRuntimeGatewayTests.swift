import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func modelGatewayScoresToolsVisionAndFailureRates() {
    let gateway = ModelGateway()
    let classification = TaskClassification(
        primaryKind: .toolHeavy,
        labels: [.coding, .toolHeavy],
        query: "fix this Swift test by editing files",
        requiresVision: false,
        prefersTools: true,
        estimatedTokens: 2_000
    )
    let models = [
        gatewayModel("small-loaded:latest", size: 5_000_000_000, capabilities: ["completion"], isLoaded: true),
        gatewayModel("qwen-tools:latest", size: 7_000_000_000, capabilities: ["completion", "tools"]),
        gatewayModel("failing-tools:latest", size: 9_000_000_000, capabilities: ["completion", "tools"]),
    ]

    let decision = gateway.route(
        classification: classification,
        mode: .quick,
        models: models,
        preferredExpertModelName: "small-loaded:latest",
        attachments: [],
        stats: ["failing-tools:latest": ModelPerformanceStats(failureRate: 0.95, toolSuccessRate: 0.2)]
    )

    #expect(decision.selectedModelName == "qwen-tools:latest")
    #expect(decision.scores.first?.modelName == "qwen-tools:latest")

    let visionDecision = gateway.route(
        classification: TaskClassification(
            primaryKind: .vision,
            labels: [.vision],
            query: "describe image",
            requiresVision: true,
            prefersTools: false,
            estimatedTokens: 500
        ),
        mode: .expert,
        models: models + [
            gatewayModel("qwen3-vl:8b", size: 6_000_000_000, capabilities: ["completion", "vision", "tools"]),
        ],
        preferredExpertModelName: "small-loaded:latest",
        attachments: [MessageAttachment(name: "image.png", path: "/tmp/image.png", kind: .image, byteCount: 10)]
    )

    #expect(visionDecision.selectedModelName == "qwen3-vl:8b")
}

@Test
func capabilityRegistryCombinesWorkspaceKnowledgeSkillsAndEnabledMCP() async throws {
    let fixture = try MCPPluginFixture(http: true)
    defer { fixture.cleanup() }
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [MockMCPURLProtocol.self]
    let broker = MCPToolBroker(session: URLSession(configuration: config))
    let plugins = [
        fixture.plugin(id: "enabled@local", enabled: true),
        fixture.plugin(id: "disabled@local", enabled: false),
    ]
    let snapshot = await broker.snapshot(for: plugins)

    let registry = CapabilityRegistry(
        workspaceRegistry: WorkspaceToolService().makeRegistry(),
        skillLibrary: SkillLibrary(rootURL: fixture.skillRootURL),
        knowledgeStore: ProjectKnowledgeStore(rootURL: fixture.rootURL),
        mcpToolBroker: broker,
        mcpTools: snapshot.tools,
        plugins: plugins
    )

    let descriptors = registry.descriptors()
    let names = descriptors.map(\.name)

    #expect(names.contains("read_file"))
    #expect(names.contains("search_knowledge"))
    #expect(names.contains("diagnose-test"))
    #expect(names.contains("mcp__enabled_local__fixture_server__ping"))
    #expect(!names.contains("mcp__disabled_local__fixture_server__ping"))
}

@Test
func projectKnowledgeStoreSearchesFTSAndHybridVectorFallback() async throws {
    let root = try makeKnowledgeWorkspace()
    let storeRoot = FileManager.default.temporaryDirectory
        .appending(path: "OllamaMenuAssistantKnowledgeStore-\(UUID().uuidString)", directoryHint: .isDirectory)
    defer {
        try? FileManager.default.removeItem(at: root)
        try? FileManager.default.removeItem(at: storeRoot)
    }

    let project = ConversationProject(name: "Knowledge", path: root.path)
    let store = ProjectKnowledgeStore(rootURL: storeRoot)
    let ftsHits = try await store.search(project: project, query: "gateway routing", includeVector: false)
    let hybridHits = try await store.search(project: project, query: "gateway routing", includeVector: true)

    #expect(ftsHits.contains(where: { $0.path == "README.md" }))
    #expect(ftsHits.allSatisfy { $0.source == "fts" || $0.source == "fts-fallback" })
    #expect(hybridHits.contains(where: { $0.path == "README.md" }))
    let hybridSources = Set(hybridHits.map(\.source))
    #expect(!hybridSources.intersection(["hybrid", "vector", "fts"]).isEmpty)
}

@Test
func mcpToolBrokerCallsHTTPServerThroughNamespacedTool() async throws {
    let fixture = try MCPPluginFixture(http: true)
    defer { fixture.cleanup() }

    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [MockMCPURLProtocol.self]
    let broker = MCPToolBroker(session: URLSession(configuration: config))
    let snapshot = await broker.snapshot(for: [fixture.plugin(id: "http@local", enabled: true)])
    let tools = broker.registeredTools(for: snapshot.tools)
    let tool = try #require(tools.first)

    let result = await tool.execute(
        AgentToolCall(
            name: tool.definition.function.name,
            arguments: [
                "tool": .string("ping"),
                "arguments": .object(["value": .string("hello")]),
            ]
        ),
        ToolExecutionContext(project: nil, permissionMode: .default)
    )

    #expect(result.ok)
    #expect(result.content.contains("pong-http"))
    #expect(tool.definition.function.name == "mcp__http_local__fixture_server__ping")
    #expect(snapshot.serverStatuses.first?.toolCount == 1)
}

@Test
func mcpToolBrokerCallsStdioServerThroughNamespacedTool() async throws {
    let fixture = try MCPPluginFixture(stdio: true)
    defer { fixture.cleanup() }

    let broker = MCPToolBroker()
    let snapshot = await broker.snapshot(for: [fixture.plugin(id: "stdio@local", enabled: true)])
    let tools = broker.registeredTools(for: snapshot.tools)
    let tool = try #require(tools.first)

    let result = await tool.execute(
        AgentToolCall(
            name: tool.definition.function.name,
            arguments: [
                "tool": .string("ping"),
                "arguments": .object(["value": .string("hello")]),
            ]
        ),
        ToolExecutionContext(project: nil, permissionMode: .default)
    )

    #expect(result.ok)
    #expect(result.content.contains("pong-stdio"))
}

private func gatewayModel(
    _ name: String,
    size: Int64,
    capabilities: [String],
    isLoaded: Bool = false
) -> ModelSummary {
    ModelSummary(
        name: name,
        displayName: name,
        size: size,
        capabilities: capabilities,
        contextLength: 32_000,
        isLoaded: isLoaded,
        modifiedAt: .now
    )
}

private func makeKnowledgeWorkspace() throws -> URL {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "OllamaMenuAssistantKnowledge-\(UUID().uuidString)", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: root.appending(path: "Sources"), withIntermediateDirectories: true)
    try """
    # Runtime
    The local gateway routing layer chooses models, tools, skills, and knowledge.
    """.write(to: root.appending(path: "README.md"), atomically: true, encoding: .utf8)
    try "struct GatewayRuntime {}".write(to: root.appending(path: "Sources/GatewayRuntime.swift"), atomically: true, encoding: .utf8)
    return root
}

private final class MockMCPURLProtocol: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        let requestBody = request.value(forHTTPHeaderField: "X-MCP-Method") ?? Self.requestBodyText(request)
        let body: String
        if requestBody.contains("tools/list") {
            body = #"{"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"ping","description":"Ping fixture","inputSchema":{"type":"object","properties":{"value":{"type":"string"}}}}]}}"#
        } else {
            body = #"{"jsonrpc":"2.0","id":1,"result":{"content":"pong-http"}}"#
        }
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private static func requestBodyText(_ request: URLRequest) -> String {
        if let body = request.httpBody {
            return String(data: body, encoding: .utf8) ?? ""
        }
        guard let stream = request.httpBodyStream else {
            return ""
        }
        stream.open()
        defer {
            stream.close()
        }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 {
                break
            }
            data.append(buffer, count: count)
        }
        return String(data: data, encoding: .utf8) ?? ""
    }
}

private struct MCPPluginFixture {
    let rootURL: URL
    let pluginRootURL: URL
    let mcpConfigURL: URL
    let skillRootURL: URL

    init(http: Bool = false, stdio: Bool = false) throws {
        rootURL = FileManager.default.temporaryDirectory
            .appending(path: "OllamaMenuAssistantMCP-\(UUID().uuidString)", directoryHint: .isDirectory)
        pluginRootURL = rootURL.appending(path: "plugin", directoryHint: .isDirectory)
        mcpConfigURL = pluginRootURL.appending(path: ".mcp.json")
        skillRootURL = rootURL.appending(path: "skills", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: pluginRootURL, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: skillRootURL.appending(path: "diagnose-test"), withIntermediateDirectories: true)
        try """
        ---
        name: diagnose-test
        description: Diagnose fixture skill
        ---
        """.write(to: skillRootURL.appending(path: "diagnose-test/SKILL.md"), atomically: true, encoding: .utf8)

        if stdio {
            let scriptURL = pluginRootURL.appending(path: "mcp-fixture.sh")
            try """
            #!/bin/zsh
            if [[ "$OLLAMA_MENU_ASSISTANT_MCP_METHOD" == "tools/list" ]]; then
              body='{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"ping","description":"Ping fixture","inputSchema":{"type":"object","properties":{"value":{"type":"string"}}}}]}}'
            else
              body='{"jsonrpc":"2.0","id":2,"result":{"content":"pong-stdio"}}'
            fi
            printf 'Content-Length: %s\\r\\n\\r\\n%s' "${#body}" "$body"
            """.write(to: scriptURL, atomically: true, encoding: .utf8)
            try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: scriptURL.path)
            try """
            {
              "mcpServers": {
                "fixture-server": {
                  "command": "./mcp-fixture.sh",
                  "cwd": "."
                }
              }
            }
            """.write(to: mcpConfigURL, atomically: true, encoding: .utf8)
        } else {
            let url = http ? "https://mcp.fixture.test/call" : "https://example.invalid/mcp"
            try """
            {
              "mcpServers": {
                "fixture-server": {
                  "type": "http",
                  "url": "\(url)",
                  "note": "Fixture MCP server"
                }
              }
            }
            """.write(to: mcpConfigURL, atomically: true, encoding: .utf8)
        }
    }

    func cleanup() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    func plugin(id: String, enabled: Bool) -> PluginSummary {
        PluginSummary(
            pluginID: id,
            name: id,
            displayName: id,
            description: "Fixture plugin",
            developerName: "Tests",
            category: "Testing",
            version: "1.0.0",
            marketplace: "local",
            rootPath: pluginRootURL.path,
            iconPath: nil,
            brandColorHex: nil,
            mcpConfigPath: mcpConfigURL.path,
            skillCount: 0,
            hasApp: false,
            hasMCPServer: true,
            isInstalled: true,
            isEnabled: enabled,
            capabilityLabels: []
        )
    }
}
