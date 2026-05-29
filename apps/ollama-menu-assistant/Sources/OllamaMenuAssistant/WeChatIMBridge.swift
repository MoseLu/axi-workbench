import Foundation

struct WeChatILinkClient: Sendable {
    var credentials: WeChatIMCredentials
    var session: URLSession
    var apiTimeout: TimeInterval
    var longPollTimeout: TimeInterval

    init(
        credentials: WeChatIMCredentials,
        session: URLSession = .shared,
        apiTimeout: TimeInterval = 15,
        longPollTimeout: TimeInterval = 35
    ) {
        self.credentials = credentials
        self.session = session
        self.apiTimeout = apiTimeout
        self.longPollTimeout = longPollTimeout
    }

    func fetchUpdates(buffer: String?, timeout: TimeInterval? = nil) async throws -> WeChatUpdatesResponse {
        let body = GetUpdatesRequest(
            getUpdatesBuffer: buffer ?? "",
            baseInfo: WeChatBaseInfo(channelVersion: WeChatILinkConstants.sdkVersion)
        )
        let request = try makeRequest(
            endpoint: "ilink/bot/getupdates",
            body: body,
            timeout: timeout ?? longPollTimeout
        )

        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode) else {
                let bodyText = String(data: data, encoding: .utf8) ?? ""
                throw WeChatIMBridgeError.apiFailed("getUpdates failed: \(bodyText)")
            }
            return try JSONDecoder().decode(WeChatUpdatesResponse.self, from: data)
        } catch let error as WeChatIMBridgeError {
            throw error
        } catch {
            if (error as NSError).domain == NSURLErrorDomain,
               (error as NSError).code == NSURLErrorTimedOut {
                return WeChatUpdatesResponse(ret: 0, messages: [], getUpdatesBuffer: buffer)
            }
            throw error
        }
    }

    func sendText(to chatID: String, contextToken: String, text: String) async throws {
        for chunk in Self.chunk(text: text, limit: WeChatILinkConstants.textLimit) {
            let body = Self.makeSendTextPayload(to: chatID, contextToken: contextToken, text: chunk)
            let request = try makeRequest(
                endpoint: "ilink/bot/sendmessage",
                body: body,
                timeout: apiTimeout
            )
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode) else {
                let bodyText = String(data: data, encoding: .utf8) ?? ""
                throw WeChatIMBridgeError.apiFailed("sendMessage failed: \(bodyText)")
            }
        }
    }

    func makeRequest<T: Encodable>(endpoint: String, body: T, timeout: TimeInterval) throws -> URLRequest {
        let bodyData = try JSONEncoder().encode(body)
        var request = URLRequest(url: endpointURL(endpoint))
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.httpBody = bodyData
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("ilink_bot_token", forHTTPHeaderField: "AuthorizationType")
        request.setValue("Bearer \(credentials.botToken)", forHTTPHeaderField: "Authorization")
        request.setValue(String(bodyData.count), forHTTPHeaderField: "Content-Length")
        request.setValue(Self.randomWechatUIN(), forHTTPHeaderField: "X-WECHAT-UIN")
        return request
    }

    func endpointURL(_ endpoint: String) -> URL {
        let base = credentials.baseURL.absoluteString.hasSuffix("/")
            ? credentials.baseURL
            : URL(string: credentials.baseURL.absoluteString + "/")!
        return URL(string: endpoint, relativeTo: base)!.absoluteURL
    }

    static func makeSendTextPayload(to chatID: String, contextToken: String, text: String) -> SendTextRequest {
        SendTextRequest(
            message: SendMessagePayload(
                fromUserID: "",
                toUserID: chatID,
                clientID: "sdk-wx-\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(8).lowercased())",
                messageType: WeChatILinkConstants.messageTypeBot,
                messageState: WeChatILinkConstants.messageStateFinish,
                itemList: [
                    SendMessageItem(
                        type: WeChatILinkConstants.messageItemText,
                        textItem: SendTextItem(text: text)
                    ),
                ],
                contextToken: contextToken
            ),
            baseInfo: WeChatBaseInfo(channelVersion: WeChatILinkConstants.sdkVersion)
        )
    }

    static func chunk(text: String, limit: Int) -> [String] {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return []
        }
        guard trimmed.count > limit else {
            return [trimmed]
        }

        var chunks: [String] = []
        var start = trimmed.startIndex
        while start < trimmed.endIndex {
            let end = trimmed.index(start, offsetBy: limit, limitedBy: trimmed.endIndex) ?? trimmed.endIndex
            chunks.append(String(trimmed[start..<end]))
            start = end
        }
        return chunks
    }

    private static func randomWechatUIN() -> String {
        let value = UInt32.random(in: UInt32.min...UInt32.max)
        return Data(String(value).utf8).base64EncodedString()
    }
}

enum WeChatIMBridgeError: LocalizedError, Equatable {
    case apiFailed(String)

    var errorDescription: String? {
        switch self {
        case .apiFailed(let message):
            return message
        }
    }
}

actor WeChatIMBridge {
    typealias MessageHandler = @Sendable (WeChatIncomingMessage) async throws -> String?
    typealias StatusHandler = @Sendable (WeChatIMBridgeStatus) -> Void

    private let client: WeChatILinkClient
    private let botID: String?
    private let credentialSource: String
    private let onMessage: MessageHandler
    private let onStatus: StatusHandler
    private var isRunning = false
    private var processedMessageIDs = Set<String>()
    private var getUpdatesBuffer = ""
    private var processedMessageCount = 0
    private var activeChatID: String?
    private var activeContextToken: String?
    private var chatContextTokens: [String: String] = [:]
    private var lastMessageAt: Date?

    init(
        client: WeChatILinkClient,
        botID: String?,
        credentialSource: String,
        onMessage: @escaping MessageHandler,
        onStatus: @escaping StatusHandler
    ) {
        self.client = client
        self.botID = botID
        self.credentialSource = credentialSource
        self.onMessage = onMessage
        self.onStatus = onStatus
    }

    func start() async {
        guard !isRunning else {
            return
        }
        isRunning = true
        publish(.connecting, detail: "Connecting")
        publish(.connected, detail: "Polling")

        while isRunning {
            do {
                let response = try await client.fetchUpdates(buffer: getUpdatesBuffer.nilIfEmpty)
                guard isRunning else {
                    break
                }

                if let buffer = response.getUpdatesBuffer?.nilIfEmpty {
                    getUpdatesBuffer = buffer
                }

                guard response.isSuccessful else {
                    publish(
                        .failed,
                        detail: "getUpdates failed: ret=\(response.ret ?? 0) errcode=\(response.errorCode ?? 0) \(response.errorMessage ?? "")"
                    )
                    try? await Task.sleep(for: .seconds(2))
                    continue
                }

                publish(.connected, detail: "Polling")
                for rawMessage in response.messages {
                    await handle(rawMessage)
                }
            } catch {
                guard isRunning else {
                    break
                }
                publish(.failed, detail: error.localizedDescription)
                try? await Task.sleep(for: .seconds(2))
            }
        }

        publish(.disabled, detail: "Stopped")
    }

    func stop() {
        isRunning = false
    }

    func activeChatIDForForwarding() -> String? {
        activeChatID
    }

    func rememberChatTarget(chatID: String, contextToken: String, timestamp: Date = .now) {
        activeChatID = chatID
        activeContextToken = contextToken
        chatContextTokens[chatID] = contextToken
        lastMessageAt = timestamp
    }

    func sendTextToActiveChat(_ text: String) async throws -> Bool {
        guard let chatID = activeChatID?.nilIfEmpty else {
            return false
        }

        return try await sendText(toChatID: chatID, text)
    }

    func sendText(toChatID chatID: String, _ text: String) async throws -> Bool {
        let storedContextToken = chatContextTokens[chatID]?.nilIfEmpty
        let fallbackContextToken = chatID == activeChatID ? activeContextToken?.nilIfEmpty : nil
        guard let contextToken = storedContextToken ?? fallbackContextToken else {
            return false
        }

        try await client.sendText(to: chatID, contextToken: contextToken, text: text)
        publish(.connected, detail: "Forwarded to WeChat")
        return true
    }

    private func handle(_ rawMessage: WeChatRawMessage) async {
        guard let message = rawMessage.incomingMessage(botID: botID) else {
            return
        }
        guard processedMessageIDs.insert(message.messageID).inserted else {
            return
        }

        rememberChatTarget(chatID: message.chatID, contextToken: message.contextToken, timestamp: message.timestamp)
        processedMessageCount += 1
        publish(.connected, detail: "Handling message")

        do {
            guard let reply = (try await onMessage(message))?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !reply.isEmpty else {
                publish(.connected, detail: "Polling")
                return
            }
            try await client.sendText(to: message.chatID, contextToken: message.contextToken, text: reply)
            publish(.connected, detail: "Reply sent")
        } catch {
            publish(.failed, detail: error.localizedDescription)
        }
    }

    private func publish(_ state: WeChatIMBridgeStatus.State, detail: String) {
        onStatus(
            WeChatIMBridgeStatus(
                state: state,
                detail: detail,
                credentialSource: credentialSource,
                activeChatID: activeChatID,
                processedMessageCount: processedMessageCount,
                lastMessageAt: lastMessageAt
            )
        )
    }
}
