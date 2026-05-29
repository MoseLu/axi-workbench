import Foundation

struct WeChatIMBridgeStatus: Equatable, Sendable {
    enum State: String, Sendable {
        case disabled
        case waitingForCredentials
        case connecting
        case connected
        case failed
    }

    var state: State
    var detail: String
    var credentialSource: String?
    var activeChatID: String?
    var processedMessageCount: Int
    var lastMessageAt: Date?

    static let disabled = WeChatIMBridgeStatus(
        state: .disabled,
        detail: "Disabled",
        credentialSource: nil,
        activeChatID: nil,
        processedMessageCount: 0,
        lastMessageAt: nil
    )
}

struct WeChatIMCredentials: Equatable, Sendable {
    var botToken: String
    var ilinkBotID: String?
    var baseURL: URL
    var sourcePath: String
}

enum WeChatIMCredentialError: LocalizedError, Equatable {
    case missingFile(String)
    case invalidCredentials(String)

    var errorDescription: String? {
        switch self {
        case .missingFile(let path):
            return "WeChat credentials were not found at \(path)."
        case .invalidCredentials(let detail):
            return "WeChat credentials are invalid: \(detail)"
        }
    }
}

struct WeChatIMCredentialStore {
    private let fileManager: FileManager
    private let defaultCredentialURL: URL

    init(
        fileManager: FileManager = .default,
        defaultCredentialURL: URL = URL(
            fileURLWithPath: ("~/.mavis/credentials/main/wechat.json" as NSString).expandingTildeInPath
        )
        .standardizedFileURL
        .resolvingSymlinksInPath()
    ) {
        self.fileManager = fileManager
        self.defaultCredentialURL = defaultCredentialURL
    }

    func load(pathOverride: String? = nil) throws -> WeChatIMCredentials {
        let url = credentialURL(pathOverride: pathOverride)
        guard fileManager.fileExists(atPath: url.path) else {
            throw WeChatIMCredentialError.missingFile(url.path)
        }

        let data = try Data(contentsOf: url)
        let payload = try JSONDecoder().decode(MavisCredentialPayload.self, from: data)
        let token = payload.credentials.botToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty else {
            throw WeChatIMCredentialError.invalidCredentials("botToken is empty")
        }

        let baseURLString = (payload.credentials.baseURL ?? "https://ilinkai.weixin.qq.com")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let baseURL = URL(string: baseURLString), baseURL.scheme != nil else {
            throw WeChatIMCredentialError.invalidCredentials("baseUrl is invalid")
        }

        return WeChatIMCredentials(
            botToken: token,
            ilinkBotID: payload.credentials.ilinkBotID?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            baseURL: baseURL,
            sourcePath: url.path
        )
    }

    private func credentialURL(pathOverride: String?) -> URL {
        guard let pathOverride = pathOverride?.trimmingCharacters(in: .whitespacesAndNewlines),
              !pathOverride.isEmpty else {
            return defaultCredentialURL
        }
        return URL(fileURLWithPath: pathOverride)
            .standardizedFileURL
            .resolvingSymlinksInPath()
    }
}

private struct MavisCredentialPayload: Decodable {
    let platform: String?
    let credentials: MavisCredentialFields
}

private struct MavisCredentialFields: Decodable {
    let botToken: String
    let ilinkBotID: String?
    let baseURL: String?

    enum CodingKeys: String, CodingKey {
        case botToken
        case ilinkBotID = "ilinkBotId"
        case baseURL = "baseUrl"
    }
}

struct WeChatIncomingMessage: Equatable, Sendable {
    var chatID: String
    var senderID: String
    var messageID: String
    var text: String
    var contextToken: String
    var timestamp: Date
}

struct WeChatUpdatesResponse: Decodable, Equatable, Sendable {
    var ret: Int?
    var errorCode: Int?
    var errorMessage: String?
    var messages: [WeChatRawMessage]
    var getUpdatesBuffer: String?
    var longPollingTimeoutMilliseconds: Int?

    enum CodingKeys: String, CodingKey {
        case ret
        case errorCode = "errcode"
        case errorMessage = "errmsg"
        case messages = "msgs"
        case getUpdatesBuffer = "get_updates_buf"
        case longPollingTimeoutMilliseconds = "longpolling_timeout_ms"
    }

    init(
        ret: Int? = nil,
        errorCode: Int? = nil,
        errorMessage: String? = nil,
        messages: [WeChatRawMessage] = [],
        getUpdatesBuffer: String? = nil,
        longPollingTimeoutMilliseconds: Int? = nil
    ) {
        self.ret = ret
        self.errorCode = errorCode
        self.errorMessage = errorMessage
        self.messages = messages
        self.getUpdatesBuffer = getUpdatesBuffer
        self.longPollingTimeoutMilliseconds = longPollingTimeoutMilliseconds
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        ret = try container.decodeIfPresent(Int.self, forKey: .ret)
        errorCode = try container.decodeIfPresent(Int.self, forKey: .errorCode)
        errorMessage = try container.decodeIfPresent(String.self, forKey: .errorMessage)
        messages = try container.decodeIfPresent([WeChatRawMessage].self, forKey: .messages) ?? []
        getUpdatesBuffer = try container.decodeIfPresent(String.self, forKey: .getUpdatesBuffer)
        longPollingTimeoutMilliseconds = try container.decodeIfPresent(Int.self, forKey: .longPollingTimeoutMilliseconds)
    }

    var isSuccessful: Bool {
        (ret ?? 0) == 0 && (errorCode ?? 0) == 0
    }
}

struct WeChatRawMessage: Decodable, Equatable, Sendable {
    var fromUserID: String?
    var groupID: String?
    var messageID: String?
    var clientID: String?
    var contextToken: String?
    var createTimeMilliseconds: Int64?
    var messageType: Int?
    var itemList: [WeChatRawMessageItem]

    enum CodingKeys: String, CodingKey {
        case fromUserID = "from_user_id"
        case groupID = "group_id"
        case messageID = "message_id"
        case clientID = "client_id"
        case contextToken = "context_token"
        case createTimeMilliseconds = "create_time_ms"
        case messageType = "message_type"
        case itemList = "item_list"
    }

    init(
        fromUserID: String?,
        groupID: String?,
        messageID: String?,
        clientID: String?,
        contextToken: String?,
        createTimeMilliseconds: Int64?,
        messageType: Int?,
        itemList: [WeChatRawMessageItem]
    ) {
        self.fromUserID = fromUserID
        self.groupID = groupID
        self.messageID = messageID
        self.clientID = clientID
        self.contextToken = contextToken
        self.createTimeMilliseconds = createTimeMilliseconds
        self.messageType = messageType
        self.itemList = itemList
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        fromUserID = try container.decodeLossyStringIfPresent(forKey: .fromUserID)
        groupID = try container.decodeLossyStringIfPresent(forKey: .groupID)
        messageID = try container.decodeLossyStringIfPresent(forKey: .messageID)
        clientID = try container.decodeLossyStringIfPresent(forKey: .clientID)
        contextToken = try container.decodeLossyStringIfPresent(forKey: .contextToken)
        createTimeMilliseconds = try container.decodeLossyInt64IfPresent(forKey: .createTimeMilliseconds)
        messageType = try container.decodeIfPresent(Int.self, forKey: .messageType)
        itemList = try container.decodeIfPresent([WeChatRawMessageItem].self, forKey: .itemList) ?? []
    }
}

struct WeChatRawMessageItem: Decodable, Equatable, Sendable {
    var type: Int
    var textItem: WeChatTextItem?
    var voiceItem: WeChatVoiceItem?

    enum CodingKeys: String, CodingKey {
        case type
        case textItem = "text_item"
        case voiceItem = "voice_item"
    }
}

struct WeChatTextItem: Decodable, Equatable, Sendable {
    var text: String?
}

struct WeChatVoiceItem: Decodable, Equatable, Sendable {
    var text: String?
}

extension WeChatRawMessage {
    func incomingMessage(botID: String?, now: Date = .now, staleInterval: TimeInterval = 30 * 60) -> WeChatIncomingMessage? {
        guard fromUserID != botID else {
            return nil
        }
        guard let senderID = fromUserID?.nilIfEmpty else {
            return nil
        }
        guard let contextToken = contextToken?.nilIfEmpty else {
            return nil
        }

        let text = itemList.compactMap { item -> String? in
            switch item.type {
            case WeChatILinkConstants.messageItemText:
                return item.textItem?.text?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            case WeChatILinkConstants.messageItemVoice:
                return item.voiceItem?.text?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            default:
                return nil
            }
        }
        .joined(separator: "\n")
        .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !text.isEmpty else {
            return nil
        }

        let timestamp = createTimeMilliseconds.map { Date(timeIntervalSince1970: TimeInterval($0) / 1000) } ?? now
        guard now.timeIntervalSince(timestamp) <= staleInterval else {
            return nil
        }

        let chatID = groupID?.nilIfEmpty ?? senderID
        let resolvedMessageID = messageID?.nilIfEmpty ?? clientID?.nilIfEmpty ?? "\(Int(timestamp.timeIntervalSince1970 * 1000))"
        return WeChatIncomingMessage(
            chatID: chatID,
            senderID: senderID,
            messageID: resolvedMessageID,
            text: text,
            contextToken: contextToken,
            timestamp: timestamp
        )
    }
}
