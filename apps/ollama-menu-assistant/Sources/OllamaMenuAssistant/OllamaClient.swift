import Foundation

struct OllamaClient: Sendable {
    let baseURL: URL
    let session: URLSession

    init(baseURL: URL = URL(string: "http://127.0.0.1:11434")!, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func fetchModels() async throws -> [OllamaTaggedModel] {
        let request = URLRequest(url: baseURL.appending(path: "/api/tags"))
        let response: TagsResponse = try await send(request, expecting: TagsResponse.self)
        return response.models
    }

    func fetchModelDetails(model: String) async throws -> OllamaModelDetails {
        var request = URLRequest(url: baseURL.appending(path: "/api/show"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(ShowRequest(model: model, verbose: false))
        return try await send(request, expecting: OllamaModelDetails.self)
    }

    func fetchRunningModels() async throws -> [OllamaRunningModel] {
        let request = URLRequest(url: baseURL.appending(path: "/api/ps"))
        let response: RunningModelsResponse = try await send(request, expecting: RunningModelsResponse.self)
        return response.models
    }

    func streamChat(
        model: String,
        messages: [ChatMessage],
        systemPrompt: String? = nil,
        contextLength: Int? = nil,
        onDelta: @escaping @Sendable (String) async -> Void
    ) async throws {
        var request = URLRequest(url: baseURL.appending(path: "/api/chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            try ChatRequest(
                model: model,
                messages: messages,
                systemPrompt: systemPrompt,
                contextLength: contextLength,
                stream: true
            )
        )

        do {
            let (bytes, response) = try await session.bytes(for: request)
            guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
                throw OllamaError.invalidResponse
            }

            for try await rawLine in bytes.lines {
                let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
                if line.isEmpty {
                    continue
                }

                let chunk = try Self.parseChatChunk(line)
                if let error = chunk.error, !error.isEmpty {
                    throw OllamaError.server(error)
                }

                if let content = chunk.message?.content, !content.isEmpty {
                    await onDelta(content)
                }
            }
        } catch let error as OllamaError {
            throw error
        } catch {
            throw OllamaError.offline
        }
    }

    func completeChat(
        model: String,
        messages: [AgentChatMessage],
        systemPrompt: String? = nil,
        tools: [ToolDefinition]? = nil,
        contextLength: Int? = nil
    ) async throws -> OllamaChatChunk {
        var request = URLRequest(url: baseURL.appending(path: "/api/chat"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            try ChatRequest(
                model: model,
                agentMessages: messages,
                systemPrompt: systemPrompt,
                tools: tools,
                contextLength: contextLength,
                stream: false
            )
        )

        let response: OllamaChatChunk = try await send(request, expecting: OllamaChatChunk.self)
        if let error = response.error, !error.isEmpty {
            throw OllamaError.server(error)
        }
        return response
    }

    static func parseChatChunk(_ line: String) throws -> OllamaChatChunk {
        let data = Data(line.utf8)
        return try makeDecoder().decode(OllamaChatChunk.self, from: data)
    }

    private func send<T: Decodable>(_ request: URLRequest, expecting type: T.Type) async throws -> T {
        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
                if let message = String(data: data, encoding: .utf8), !message.isEmpty {
                    throw OllamaError.server(message)
                }
                throw OllamaError.invalidResponse
            }
            return try Self.makeDecoder().decode(T.self, from: data)
        } catch let error as OllamaError {
            throw error
        } catch {
            throw OllamaError.offline
        }
    }

    static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = makeFractionalFormatter().date(from: string) ?? makeStandardFormatter().date(from: string) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO8601 date: \(string)")
        }
        return decoder
    }
}

private struct TagsResponse: Decodable {
    let models: [OllamaTaggedModel]
}

private struct RunningModelsResponse: Decodable {
    let models: [OllamaRunningModel]
}

private struct ShowRequest: Encodable {
    let model: String
    let verbose: Bool
}

struct ChatRequest: Encodable {
    let model: String
    let messages: [OllamaPayloadMessage]
    let tools: [ToolDefinition]?
    let options: OllamaChatOptions?
    let stream: Bool
    let think = false
    let keepAlive = "30m"

    enum CodingKeys: String, CodingKey {
        case model
        case messages
        case tools
        case options
        case stream
        case think
        case keepAlive = "keep_alive"
    }

    init(
        model: String,
        messages: [ChatMessage],
        systemPrompt: String? = nil,
        tools: [ToolDefinition]? = nil,
        contextLength: Int? = nil,
        stream: Bool
    ) throws {
        self.model = model
        self.tools = tools
        self.options = OllamaChatOptions(contextLength: contextLength)
        self.stream = stream

        var payloadMessages = [OllamaPayloadMessage]()
        if let systemPrompt = systemPrompt?.trimmingCharacters(in: .whitespacesAndNewlines),
           !systemPrompt.isEmpty {
            payloadMessages.append(OllamaPayloadMessage(role: "system", content: systemPrompt))
        }
        payloadMessages.append(contentsOf: try messages.map(OllamaPayloadMessage.init(message:)))
        self.messages = payloadMessages
    }

    init(
        model: String,
        agentMessages: [AgentChatMessage],
        systemPrompt: String? = nil,
        tools: [ToolDefinition]? = nil,
        contextLength: Int? = nil,
        stream: Bool
    ) throws {
        self.model = model
        self.tools = tools
        self.options = OllamaChatOptions(contextLength: contextLength)
        self.stream = stream

        var payloadMessages = [OllamaPayloadMessage]()
        if let systemPrompt = systemPrompt?.trimmingCharacters(in: .whitespacesAndNewlines),
           !systemPrompt.isEmpty {
            payloadMessages.append(OllamaPayloadMessage(role: "system", content: systemPrompt))
        }
        payloadMessages.append(contentsOf: try agentMessages.map(OllamaPayloadMessage.init(message:)))
        self.messages = payloadMessages
    }
}

struct OllamaChatOptions: Encodable, Equatable, Sendable {
    let numCtx: Int

    enum CodingKeys: String, CodingKey {
        case numCtx = "num_ctx"
    }

    init?(contextLength: Int?) {
        guard let contextLength, contextLength > 0 else {
            return nil
        }
        self.numCtx = contextLength
    }
}

struct OllamaPayloadMessage: Encodable, Sendable {
    let role: String
    let content: String
    let images: [String]?

    init(role: String, content: String, images: [String]? = nil) {
        self.role = role
        self.content = content
        self.images = images
    }

    init(message: ChatMessage) throws {
        self.role = message.role.rawValue
        self.content = try AttachmentPayloadBuilder.makePromptText(
            prompt: message.content,
            attachments: message.attachments
        )
        self.images = AttachmentPayloadBuilder.makeImagePayloads(from: message.attachments)
    }

    init(message: AgentChatMessage) throws {
        self.role = message.role
        self.content = try AttachmentPayloadBuilder.makePromptText(
            prompt: message.content,
            attachments: message.attachments
        )
        self.images = AttachmentPayloadBuilder.makeImagePayloads(from: message.attachments)
    }
}

private func makeFractionalFormatter() -> ISO8601DateFormatter {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
}

private func makeStandardFormatter() -> ISO8601DateFormatter {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter
}
