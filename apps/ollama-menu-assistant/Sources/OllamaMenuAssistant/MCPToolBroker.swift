import Foundation

struct MCPToolBroker: Sendable {
    var session: URLSession = .shared

    func snapshot(for plugins: [PluginSummary]) async -> MCPBrokerSnapshot {
        var descriptors: [MCPToolDescriptor] = []
        var statuses: [MCPServerStatus] = []

        for plugin in plugins.sorted(by: { $0.pluginID < $1.pluginID }) {
            guard plugin.isEnabled else {
                continue
            }
            let servers = loadServers(for: plugin)
            for server in servers {
                do {
                    let tools = try await listTools(server)
                    descriptors.append(contentsOf: tools)
                    statuses.append(
                        MCPServerStatus(
                            pluginID: server.pluginID,
                            serverName: server.serverName,
                            displayName: server.displayName,
                            state: .available,
                            message: nil,
                            toolCount: tools.count
                        )
                    )
                } catch {
                    statuses.append(
                        MCPServerStatus(
                            pluginID: server.pluginID,
                            serverName: server.serverName,
                            displayName: server.displayName,
                            state: .failed,
                            message: error.localizedDescription,
                            toolCount: 0
                        )
                    )
                }
            }
        }

        return MCPBrokerSnapshot(
            tools: descriptors.sorted { $0.namespacedToolName < $1.namespacedToolName },
            serverStatuses: statuses.sorted { $0.id < $1.id }
        )
    }

    func registeredTools(for descriptors: [MCPToolDescriptor]) -> [RegisteredTool] {
        descriptors.map { descriptor in
            RegisteredTool(
                definition: ToolDefinition(
                    name: descriptor.namespacedToolName,
                    description: descriptor.description.isEmpty
                        ? "Call \(descriptor.remoteToolName) from \(descriptor.displayName)."
                        : descriptor.description,
                    parameters: descriptor.inputSchema
                ),
                operation: descriptor.transport == "http" ? .shell : .shell,
                execute: { call, _ in
                    await execute(call, descriptor: descriptor)
                }
            )
        }
    }

    func loadServers(for plugin: PluginSummary) -> [MCPServerDescriptor] {
        guard let configPath = plugin.mcpConfigPath,
              let data = try? Data(contentsOf: URL(fileURLWithPath: configPath)),
              let config = try? JSONDecoder().decode(MCPConfigFile.self, from: data) else {
            return []
        }

        return config.mcpServers.map { serverName, server in
            MCPServerDescriptor(
                pluginID: plugin.pluginID,
                pluginDisplayName: plugin.displayName,
                serverName: serverName,
                rootPath: plugin.rootPath,
                capabilityLabels: plugin.capabilityLabels,
                config: server
            )
        }
    }

    private func listTools(_ server: MCPServerDescriptor) async throws -> [MCPToolDescriptor] {
        let result = try await call(server: server, method: "tools/list", params: nil)
        let tools = result.objectValue?["tools"]?.arrayValue ?? []
        return tools.compactMap { value in
            guard let object = value.objectValue,
                  let name = object["name"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !name.isEmpty else {
                return nil
            }
            return MCPToolDescriptor(
                pluginID: server.pluginID,
                pluginDisplayName: server.pluginDisplayName,
                serverName: server.serverName,
                remoteToolName: name,
                description: object["description"]?.stringValue ?? "",
                inputSchema: object["inputSchema"] ?? object["schema"] ?? Self.emptyObjectSchema,
                rootPath: server.rootPath,
                capabilityLabels: server.capabilityLabels,
                config: server.config
            )
        }
    }

    private func execute(_ call: AgentToolCall, descriptor: MCPToolDescriptor) async -> ToolResult {
        do {
            let content = try await self.call(
                server: descriptor.serverDescriptor,
                method: "tools/call",
                params: .object([
                    "name": .string(descriptor.remoteToolName),
                    "arguments": .object(call.arguments),
                ])
            )
            return ToolResult(
                ok: true,
                toolName: descriptor.namespacedToolName,
                content: stringify(content),
                metadata: descriptor.metadata.merging([
                    "mcpMethod": .string("tools/call"),
                    "mcpTool": .string(descriptor.remoteToolName),
                ]) { _, rhs in rhs }
            )
        } catch {
            return ToolResult(
                ok: false,
                toolName: descriptor.namespacedToolName,
                content: error.localizedDescription,
                errorCode: "mcp_call_failed",
                metadata: descriptor.metadata.merging([
                    "mcpMethod": .string("tools/call"),
                    "mcpTool": .string(descriptor.remoteToolName),
                ]) { _, rhs in rhs }
            )
        }
    }

    private func call(server: MCPServerDescriptor, method: String, params: JSONValue?) async throws -> JSONValue {
        if let url = server.config.url {
            return try await callHTTPMCP(url: url, method: method, params: params)
        }
        if let command = server.config.command {
            return try await callStdioMCP(server: server, command: command, method: method, params: params)
        }
        throw MCPBrokerError("MCP server has no url or command.")
    }

    private func callHTTPMCP(url: URL, method: String, params: JSONValue?) async throws -> JSONValue {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json, text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue(method, forHTTPHeaderField: "X-MCP-Method")
        request.httpBody = try JSONEncoder().encode(
            MCPJSONRPCRequest(
                id: 1,
                method: method,
                params: params
            )
        )

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            let text = String(data: data, encoding: .utf8) ?? "HTTP MCP request failed."
            throw MCPBrokerError(text)
        }
        return try decodeMCPResponse(data)
    }

    private func callStdioMCP(
        server: MCPServerDescriptor,
        command: String,
        method: String,
        params: JSONValue?
    ) async throws -> JSONValue {
        try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let exchange = MCPStdioExchange(server: server)
                    let result = try exchange.call(command: command, method: method, params: params)
                    continuation.resume(returning: result)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func decodeMCPResponse(_ data: Data) throws -> JSONValue {
        if let envelope = try? JSONDecoder().decode(MCPJSONRPCResponse.self, from: data) {
            if let error = envelope.error {
                throw MCPBrokerError(error.message)
            }
            return envelope.result ?? .object([:])
        }
        if let text = String(data: data, encoding: .utf8) {
            return .string(text)
        }
        return .null
    }

    private func stringify(_ value: JSONValue) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(value),
              let text = String(data: data, encoding: .utf8) else {
            return String(describing: value)
        }
        return text
    }

    private static let emptyObjectSchema: JSONValue = .object([
        "type": .string("object"),
        "properties": .object([:]),
    ])
}

struct MCPBrokerSnapshot: Codable, Hashable, Sendable {
    var tools: [MCPToolDescriptor]
    var serverStatuses: [MCPServerStatus]
}

struct MCPServerStatus: Identifiable, Codable, Hashable, Sendable {
    enum State: String, Codable, Hashable, Sendable {
        case available
        case failed
    }

    var id: String { "\(pluginID):\(serverName)" }
    var pluginID: String
    var serverName: String
    var displayName: String
    var state: State
    var message: String?
    var toolCount: Int
}

struct MCPServerDescriptor: Codable, Hashable, Sendable {
    var pluginID: String
    var pluginDisplayName: String
    var serverName: String
    var rootPath: String
    var capabilityLabels: [String]
    var config: MCPServerConfig

    var displayName: String {
        "\(pluginDisplayName) / \(serverName)"
    }
}

struct MCPToolDescriptor: Codable, Hashable, Sendable {
    var pluginID: String
    var pluginDisplayName: String
    var serverName: String
    var remoteToolName: String
    var description: String
    var inputSchema: JSONValue
    var rootPath: String
    var capabilityLabels: [String]
    var config: MCPServerConfig

    var displayName: String {
        "\(pluginDisplayName) / \(serverName) / \(remoteToolName)"
    }

    var namespacedToolName: String {
        "mcp__\(sanitize(pluginID))__\(sanitize(serverName))__\(sanitize(remoteToolName))"
    }

    var transport: String {
        config.url == nil ? "stdio" : "http"
    }

    var serverDescriptor: MCPServerDescriptor {
        MCPServerDescriptor(
            pluginID: pluginID,
            pluginDisplayName: pluginDisplayName,
            serverName: serverName,
            rootPath: rootPath,
            capabilityLabels: capabilityLabels,
            config: config
        )
    }

    var metadata: [String: JSONValue] {
        [
            "kind": .string("pluginMCPTool"),
            "pluginID": .string(pluginID),
            "serverName": .string(serverName),
            "remoteToolName": .string(remoteToolName),
            "transport": .string(transport),
        ]
    }

    private func sanitize(_ value: String) -> String {
        let scalars = value.unicodeScalars.map { scalar -> Character in
            if CharacterSet.alphanumerics.contains(scalar) {
                return Character(scalar)
            }
            return "_"
        }
        return String(scalars).replacingOccurrences(of: "__+", with: "_", options: .regularExpression)
    }
}

struct MCPServerConfig: Codable, Hashable, Sendable {
    var type: String?
    var url: URL?
    var command: String?
    var args: [String]?
    var cwd: String?
    var note: String?
}

private struct MCPConfigFile: Codable {
    var mcpServers: [String: MCPServerConfig]
}

private struct MCPJSONRPCRequest: Encodable {
    var jsonrpc = "2.0"
    var id: Int
    var method: String
    var params: JSONValue?
}

private struct MCPJSONRPCResponse: Decodable {
    var id: Int?
    var result: JSONValue?
    var error: MCPJSONRPCError?
}

private struct MCPJSONRPCError: Decodable {
    var message: String
}

private struct MCPBrokerError: LocalizedError {
    var message: String

    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? {
        message
    }
}

private final class MCPStdioExchange: @unchecked Sendable {
    private let server: MCPServerDescriptor
    private let encoder = JSONEncoder()

    init(server: MCPServerDescriptor) {
        self.server = server
    }

    func call(command: String, method: String, params: JSONValue?) throws -> JSONValue {
        let process = Process()
        let stdin = Pipe()
        let stdout = Pipe()
        let stderr = Pipe()

        process.executableURL = resolve(command)
        process.arguments = server.config.args ?? []
        process.standardInput = stdin
        process.standardOutput = stdout
        process.standardError = stderr
        var environment = ProcessInfo.processInfo.environment
        environment["OLLAMA_MENU_ASSISTANT_MCP_METHOD"] = method
        process.environment = environment
        if let cwd = server.config.cwd {
            process.currentDirectoryURL = resolveDirectory(cwd)
        } else {
            process.currentDirectoryURL = URL(fileURLWithPath: server.rootPath, isDirectory: true)
        }

        let state = MCPStdioState()
        let semaphore = DispatchSemaphore(value: 0)

        stdout.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            guard !data.isEmpty else {
                return
            }
            state.append(data)
            while let frame = state.nextFrame() {
                if let response = try? JSONDecoder().decode(MCPJSONRPCResponse.self, from: frame),
                   response.id == 2 {
                    state.setResponse(response)
                    semaphore.signal()
                }
            }
        }

        try process.run()
        try write(MCPJSONRPCRequest(id: 1, method: "initialize", params: .object([:])), to: stdin)
        try write(MCPJSONRPCRequest(id: 2, method: method, params: params), to: stdin)

        let timeout = semaphore.wait(timeout: .now() + 12)
        stdout.fileHandleForReading.readabilityHandler = nil
        if process.isRunning {
            process.terminate()
        }
        if timeout == .timedOut {
            let stderrText = String(data: stderr.fileHandleForReading.availableData, encoding: .utf8) ?? ""
            throw MCPBrokerError(stderrText.isEmpty ? "Timed out waiting for stdio MCP response." : stderrText)
        }
        if let error = state.response?.error {
            throw MCPBrokerError(error.message)
        }
        return state.response?.result ?? .object([:])
    }

    private func write(_ request: MCPJSONRPCRequest, to pipe: Pipe) throws {
        let body = try encoder.encode(request)
        var frame = Data("Content-Length: \(body.count)\r\n\r\n".utf8)
        frame.append(body)
        try pipe.fileHandleForWriting.write(contentsOf: frame)
    }

    private func resolve(_ command: String) -> URL {
        if command.hasPrefix("/") {
            return URL(fileURLWithPath: command)
        }
        return URL(fileURLWithPath: server.rootPath).appending(path: command)
    }

    private func resolveDirectory(_ path: String) -> URL {
        if path == "." {
            return URL(fileURLWithPath: server.rootPath, isDirectory: true)
        }
        if path.hasPrefix("/") {
            return URL(fileURLWithPath: path, isDirectory: true)
        }
        return URL(fileURLWithPath: server.rootPath, isDirectory: true).appending(path: path, directoryHint: .isDirectory)
    }

    fileprivate static func nextFrame(from buffer: inout Data) -> Data? {
        let separator = Data("\r\n\r\n".utf8)
        guard let headerRange = buffer.range(of: separator),
              let header = String(data: buffer[..<headerRange.lowerBound], encoding: .utf8) else {
            return nextLineFrame(from: &buffer)
        }
        let length = header
            .split(separator: "\r\n")
            .compactMap { line -> Int? in
                let parts = line.split(separator: ":", maxSplits: 1)
                guard parts.count == 2,
                      parts[0].trimmingCharacters(in: .whitespaces).lowercased() == "content-length" else {
                    return nil
                }
                return Int(parts[1].trimmingCharacters(in: .whitespaces))
            }
            .first
        guard let length else {
            buffer.removeSubrange(..<headerRange.upperBound)
            return nil
        }

        let bodyStart = headerRange.upperBound
        let bodyEnd = bodyStart + length
        guard buffer.count >= bodyEnd else {
            return nil
        }
        let body = buffer[bodyStart..<bodyEnd]
        buffer.removeSubrange(..<bodyEnd)
        return Data(body)
    }

    fileprivate static func nextLineFrame(from buffer: inout Data) -> Data? {
        guard let newline = buffer.firstIndex(of: UInt8(ascii: "\n")) else {
            return nil
        }
        let line = buffer[..<newline]
        buffer.removeSubrange(...newline)
        guard !line.isEmpty else {
            return nil
        }
        return Data(line)
    }
}

private final class MCPStdioState: @unchecked Sendable {
    private let lock = NSLock()
    private var buffer = Data()
    private var responseValue: MCPJSONRPCResponse?

    var response: MCPJSONRPCResponse? {
        lock.lock()
        defer {
            lock.unlock()
        }
        return responseValue
    }

    func append(_ data: Data) {
        lock.lock()
        buffer.append(data)
        lock.unlock()
    }

    func nextFrame() -> Data? {
        lock.lock()
        defer {
            lock.unlock()
        }
        return MCPStdioExchange.nextFrame(from: &buffer)
    }

    func setResponse(_ response: MCPJSONRPCResponse) {
        lock.lock()
        responseValue = response
        lock.unlock()
    }
}
