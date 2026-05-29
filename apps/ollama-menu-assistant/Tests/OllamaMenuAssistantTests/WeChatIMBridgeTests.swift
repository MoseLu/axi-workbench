import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func weChatCredentialStoreLoadsMavisCredentialFile() throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let credentialURL = root.appending(path: "wechat.json")
    try """
    {
      "platform": "wechat",
      "credentials": {
        "botToken": "token-123",
        "ilinkBotId": "bot-456",
        "baseUrl": "https://example.test/base/"
      },
      "updatedAt": "2026-05-04T20:57:45.020Z"
    }
    """.data(using: .utf8)!.write(to: credentialURL)

    let store = WeChatIMCredentialStore(defaultCredentialURL: credentialURL)
    let credentials = try store.load()

    #expect(credentials.botToken == "token-123")
    #expect(credentials.ilinkBotID == "bot-456")
    #expect(credentials.baseURL.absoluteString == "https://example.test/base/")
    #expect(credentials.sourcePath == credentialURL.path)
}

@Test
func weChatRawUpdateParsesTextAndVoiceMessages() throws {
    let timestamp = Int64(Date().timeIntervalSince1970 * 1000)
    let data = """
    {
      "ret": 0,
      "get_updates_buf": "next-buffer",
      "msgs": [
        {
          "from_user_id": "sender-1",
          "group_id": "group-1",
          "message_id": 12345,
          "context_token": "ctx-1",
          "create_time_ms": "\(timestamp)",
          "item_list": [
            { "type": 1, "text_item": { "text": "hello" } },
            { "type": 3, "voice_item": { "text": "voice text" } }
          ]
        }
      ]
    }
    """.data(using: .utf8)!

    let response = try JSONDecoder().decode(WeChatUpdatesResponse.self, from: data)
    let message = try #require(response.messages.first?.incomingMessage(botID: "bot-456"))

    #expect(response.isSuccessful)
    #expect(response.getUpdatesBuffer == "next-buffer")
    #expect(message.chatID == "group-1")
    #expect(message.senderID == "sender-1")
    #expect(message.messageID == "12345")
    #expect(message.contextToken == "ctx-1")
    #expect(message.text == "hello\nvoice text")
}

@Test
func weChatRawUpdateFiltersSelfAndStaleMessages() throws {
    let oldTimestamp = Int64(Date(timeIntervalSinceNow: -3600).timeIntervalSince1970 * 1000)
    let data = """
    {
      "ret": 0,
      "msgs": [
        {
          "from_user_id": "bot-456",
          "message_id": "self",
          "context_token": "ctx",
          "create_time_ms": "\(Int64(Date().timeIntervalSince1970 * 1000))",
          "item_list": [{ "type": 1, "text_item": { "text": "ignore self" } }]
        },
        {
          "from_user_id": "sender-1",
          "message_id": "old",
          "context_token": "ctx",
          "create_time_ms": "\(oldTimestamp)",
          "item_list": [{ "type": 1, "text_item": { "text": "ignore old" } }]
        }
      ]
    }
    """.data(using: .utf8)!

    let response = try JSONDecoder().decode(WeChatUpdatesResponse.self, from: data)
    let parsed = response.messages.compactMap { $0.incomingMessage(botID: "bot-456") }

    #expect(parsed.isEmpty)
}

@Test
func weChatSendTextPayloadMatchesILinkShape() throws {
    let payload = WeChatILinkClient.makeSendTextPayload(
        to: "chat-1",
        contextToken: "ctx-1",
        text: "reply"
    )
    let data = try JSONEncoder().encode(payload)
    let object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let msg = try #require(object["msg"] as? [String: Any])
    let baseInfo = try #require(object["base_info"] as? [String: Any])
    let items = try #require(msg["item_list"] as? [[String: Any]])
    let textItem = try #require(items.first?["text_item"] as? [String: Any])

    #expect(msg["from_user_id"] as? String == "")
    #expect(msg["to_user_id"] as? String == "chat-1")
    #expect(msg["message_type"] as? Int == 2)
    #expect(msg["message_state"] as? Int == 2)
    #expect(msg["context_token"] as? String == "ctx-1")
    #expect(items.first?["type"] as? Int == 1)
    #expect(textItem["text"] as? String == "reply")
    #expect(baseInfo["channel_version"] as? String == "0.9.0")
}

@Test
func weChatTextChunkingRespectsILinkLimit() {
    let text = String(repeating: "a", count: WeChatILinkConstants.textLimit + 8)
    let chunks = WeChatILinkClient.chunk(text: text, limit: WeChatILinkConstants.textLimit)

    #expect(chunks.count == 2)
    #expect(chunks[0].count == WeChatILinkConstants.textLimit)
    #expect(chunks[1].count == 8)
}

@Test
func imConversationBindingStorePersistsTakeoverRequests() async throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let store = IMConversationBindingStore(rootURL: root)
    let first = UUID()
    let second = UUID()

    try await store.setTakeoverRequest(
        IMConversationTakeoverRequest(conversationIDs: [first, second]),
        for: "wechat:chat-1"
    )

    let reloaded = IMConversationBindingStore(rootURL: root)
    try await reloaded.load()
    let request = try #require(await reloaded.takeoverRequest(for: "wechat:chat-1"))

    #expect(request.conversationIDs == [first, second])
}

@Test
func imConversationBindingStoreReturnsChatIDsForConversation() async throws {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let store = IMConversationBindingStore(rootURL: root)
    let conversationID = UUID()

    try await store.setConversationID(conversationID, for: "wechat:chat-2")
    try await store.setConversationID(conversationID, for: "wechat:chat-1")

    #expect(await store.chatIDs(forConversationID: conversationID) == ["chat-1", "chat-2"])
}

@MainActor
@Test
func appModelListsActiveConversationsForUnboundIMTakeover() async throws {
    let model = makeIMTestAppModel()
    let first = StoredConversation(
        title: "First session",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 1_000),
        messages: [ChatMessage(role: .user, content: "alpha")]
    )
    let second = StoredConversation(
        title: "Second session",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 2_000),
        messages: [ChatMessage(role: .user, content: "beta")]
    )

    model.currentConversation = first
    model.activeConversationID = first.id
    model.conversations = [first.metadataOnly, second.metadataOnly]
    model.cacheConversationDetailIfEligible(first)
    model.cacheConversationDetailIfEligible(second)

    let reply = try await model.imSelectionResponseIfNeeded(
        WeChatIncomingMessage(
            chatID: "chat-1",
            senderID: "sender-1",
            messageID: "msg-1",
            text: "继续",
            contextToken: "ctx-1",
            timestamp: .now
        )
    )

    #expect(reply?.contains("First session") == true)
    #expect(reply?.contains("Second session") == true)
    #expect(reply?.contains("1.") == true)
    #expect(reply?.contains("2.") == true)

    let request = try #require(await model.imBindingStore.takeoverRequest(for: "wechat:chat-1"))
    #expect(request.conversationIDs == [first.id, second.id])
}

@MainActor
@Test
func appModelBindsSelectedConversationAfterTakeoverChoice() async throws {
    let model = makeIMTestAppModel()
    let first = StoredConversation(
        title: "First session",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 1_000),
        messages: [ChatMessage(role: .user, content: "alpha")]
    )
    let second = StoredConversation(
        title: "Second session",
        model: "main:latest",
        updatedAt: Date(timeIntervalSince1970: 2_000),
        messages: [ChatMessage(role: .user, content: "beta")]
    )

    model.currentConversation = first
    model.activeConversationID = first.id
    model.conversations = [first.metadataOnly, second.metadataOnly]
    model.cacheConversationDetailIfEligible(first)
    model.cacheConversationDetailIfEligible(second)

    _ = try await model.imSelectionResponseIfNeeded(
        WeChatIncomingMessage(
            chatID: "chat-1",
            senderID: "sender-1",
            messageID: "msg-1",
            text: "会话列表",
            contextToken: "ctx-1",
            timestamp: .now
        )
    )

    let reply = try await model.imSelectionResponseIfNeeded(
        WeChatIncomingMessage(
            chatID: "chat-1",
            senderID: "sender-1",
            messageID: "msg-2",
            text: "2",
            contextToken: "ctx-1",
            timestamp: .now
        )
    )

    let boundConversationID = await model.imBindingStore.conversationID(for: "wechat:chat-1")
    let pendingRequest = await model.imBindingStore.takeoverRequest(for: "wechat:chat-1")

    #expect(boundConversationID == second.id)
    #expect(pendingRequest == nil)
    #expect(reply?.contains("Second session") == true)
    #expect(reply?.contains("beta") == true)
}

@Test
func weChatBridgeDoesNotForwardWithoutActiveChat() async throws {
    let client = WeChatILinkClient(
        credentials: WeChatIMCredentials(
            botToken: "token",
            ilinkBotID: "bot-1",
            baseURL: URL(string: "https://wechat.test")!,
            sourcePath: "test"
        )
    )
    let bridge = WeChatIMBridge(
        client: client,
        botID: "bot-1",
        credentialSource: "test",
        onMessage: { _ in nil },
        onStatus: { _ in }
    )

    let didSend = try await bridge.sendTextToActiveChat("desktop reply")

    #expect(!didSend)
}

@Test
func weChatBridgeForwardsDesktopReplyToLastActiveChat() async throws {
    let mockHost = "wechat-\(UUID().uuidString).test"
    MockWeChatIMURLProtocol.server.reset(host: mockHost)
    let timestamp = Int64(Date().timeIntervalSince1970 * 1000)
    MockWeChatIMURLProtocol.server.setUpdatesResponse(host: mockHost, """
    {
      "ret": 0,
      "get_updates_buf": "next-buffer",
      "msgs": [
        {
          "from_user_id": "sender-1",
          "group_id": "group-1",
          "message_id": "msg-1",
          "context_token": "ctx-1",
          "create_time_ms": "\(timestamp)",
          "item_list": [{ "type": 1, "text_item": { "text": "sync this session" } }]
        }
      ]
    }
    """
    )

    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockWeChatIMURLProtocol.self]
    let client = WeChatILinkClient(
        credentials: WeChatIMCredentials(
            botToken: "token",
            ilinkBotID: "bot-1",
            baseURL: URL(string: "https://\(mockHost)")!,
            sourcePath: "test"
        ),
        session: URLSession(configuration: configuration)
    )
    let bridgeBox = WeChatBridgeBox()
    let bridge = WeChatIMBridge(
        client: client,
        botID: "bot-1",
        credentialSource: "test",
        onMessage: { message in
            #expect(message.chatID == "group-1")
            #expect(message.contextToken == "ctx-1")
            await bridgeBox.stop()
            return nil
        },
        onStatus: { _ in }
    )
    await bridgeBox.set(bridge)

    await bridge.start()
    let didSend = try await bridge.sendTextToActiveChat("desktop reply")

    let sendBodies = MockWeChatIMURLProtocol.server.sendBodies(host: mockHost)
    let firstBody = try #require(sendBodies.first)
    let object = try #require(JSONSerialization.jsonObject(with: Data(firstBody.utf8)) as? [String: Any])
    let msg = try #require(object["msg"] as? [String: Any])
    let items = try #require(msg["item_list"] as? [[String: Any]])
    let textItem = try #require(items.first?["text_item"] as? [String: Any])

    #expect(didSend)
    #expect(msg["to_user_id"] as? String == "group-1")
    #expect(msg["context_token"] as? String == "ctx-1")
    #expect(textItem["text"] as? String == "desktop reply")
}

@Test
func weChatBridgeForwardsDesktopReplyToRequestedKnownChat() async throws {
    let mockHost = "wechat-\(UUID().uuidString).test"
    MockWeChatIMURLProtocol.server.reset(host: mockHost)
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockWeChatIMURLProtocol.self]
    let client = WeChatILinkClient(
        credentials: WeChatIMCredentials(
            botToken: "token",
            ilinkBotID: "bot-1",
            baseURL: URL(string: "https://\(mockHost)")!,
            sourcePath: "test"
        ),
        session: URLSession(configuration: configuration)
    )
    let bridge = WeChatIMBridge(
        client: client,
        botID: "bot-1",
        credentialSource: "test",
        onMessage: { _ in nil },
        onStatus: { _ in }
    )

    await bridge.rememberChatTarget(chatID: "group-1", contextToken: "ctx-1")
    await bridge.rememberChatTarget(chatID: "group-2", contextToken: "ctx-2")
    let didSend = try await bridge.sendText(toChatID: "group-1", "desktop reply")

    let sendBodies = MockWeChatIMURLProtocol.server.sendBodies(host: mockHost)
    let firstBody = try #require(sendBodies.first)
    let object = try #require(JSONSerialization.jsonObject(with: Data(firstBody.utf8)) as? [String: Any])
    let msg = try #require(object["msg"] as? [String: Any])
    let items = try #require(msg["item_list"] as? [[String: Any]])
    let textItem = try #require(items.first?["text_item"] as? [String: Any])

    #expect(didSend)
    #expect(msg["to_user_id"] as? String == "group-1")
    #expect(msg["context_token"] as? String == "ctx-1")
    #expect(textItem["text"] as? String == "desktop reply")
}

private actor WeChatBridgeBox {
    private var bridge: WeChatIMBridge?

    func set(_ bridge: WeChatIMBridge) {
        self.bridge = bridge
    }

    func stop() async {
        await bridge?.stop()
    }
}

@MainActor
private func makeIMTestAppModel() -> AppModel {
    let defaults = UserDefaults(suiteName: "OllamaMenuAssistantTests-\(UUID().uuidString)")!
    let root = FileManager.default.temporaryDirectory
        .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    let client = OllamaClient(baseURL: URL(string: "http://127.0.0.1:9")!)
    return AppModel(
        client: client,
        catalogService: ModelCatalogService(client: client),
        conversationStore: ConversationStore(rootURL: root, limit: 20),
        launchAtLoginCoordinator: LaunchAtLoginCoordinator(defaults: defaults),
        petRootURL: root.appending(path: "pets", directoryHint: .isDirectory),
        defaults: defaults
    )
}

private final class MockWeChatIMURLProtocol: URLProtocol, @unchecked Sendable {
    static let server = MockWeChatIMServer()

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        let body = Self.server.responseBody(for: request)
        let data = Data(body.utf8)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private final class MockWeChatIMServer: @unchecked Sendable {
    private let lock = NSLock()
    private var states: [String: State] = [:]

    func sendBodies(host: String) -> [String] {
        lock.lock()
        defer {
            lock.unlock()
        }
        return state(for: host).sendBodies
    }

    func reset(host: String) {
        lock.lock()
        states[host] = State()
        lock.unlock()
    }

    func setUpdatesResponse(host: String, _ response: String) {
        lock.lock()
        var current = state(for: host)
        current.updatesResponse = response
        states[host] = current
        lock.unlock()
    }

    func responseBody(for request: URLRequest) -> String {
        lock.lock()
        defer {
            lock.unlock()
        }

        let host = request.url?.host ?? ""
        var current = state(for: host)
        if request.url?.path.contains("sendmessage") == true {
            current.sendBodies.append(Self.requestBodyText(request))
            states[host] = current
            return #"{"ret":0}"#
        }

        return current.updatesResponse
    }

    private func state(for host: String) -> State {
        states[host] ?? State()
    }

    private struct State {
        var updatesResponse = #"{"ret":0,"msgs":[]}"#
        var sendBodies: [String] = []
    }

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
