import Foundation

struct WeChatBaseInfo: Encodable, Equatable, Sendable {
    var channelVersion: String

    enum CodingKeys: String, CodingKey {
        case channelVersion = "channel_version"
    }
}

struct GetUpdatesRequest: Encodable, Equatable, Sendable {
    var getUpdatesBuffer: String
    var baseInfo: WeChatBaseInfo

    enum CodingKeys: String, CodingKey {
        case getUpdatesBuffer = "get_updates_buf"
        case baseInfo = "base_info"
    }
}

struct SendTextRequest: Encodable, Equatable, Sendable {
    var message: SendMessagePayload
    var baseInfo: WeChatBaseInfo

    enum CodingKeys: String, CodingKey {
        case message = "msg"
        case baseInfo = "base_info"
    }
}

struct SendMessagePayload: Encodable, Equatable, Sendable {
    var fromUserID: String
    var toUserID: String
    var clientID: String
    var messageType: Int
    var messageState: Int
    var itemList: [SendMessageItem]
    var contextToken: String

    enum CodingKeys: String, CodingKey {
        case fromUserID = "from_user_id"
        case toUserID = "to_user_id"
        case clientID = "client_id"
        case messageType = "message_type"
        case messageState = "message_state"
        case itemList = "item_list"
        case contextToken = "context_token"
    }
}

struct SendMessageItem: Encodable, Equatable, Sendable {
    var type: Int
    var textItem: SendTextItem

    enum CodingKeys: String, CodingKey {
        case type
        case textItem = "text_item"
    }
}

struct SendTextItem: Encodable, Equatable, Sendable {
    var text: String
}

enum WeChatILinkConstants {
    static let sdkVersion = "0.9.0"
    static let textLimit = 4096
    static let messageTypeBot = 2
    static let messageStateFinish = 2
    static let messageItemText = 1
    static let messageItemVoice = 3
}

extension KeyedDecodingContainer {
    func decodeLossyStringIfPresent(forKey key: Key) throws -> String? {
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(Int.self, forKey: key) {
            return String(value)
        }
        if let value = try? decodeIfPresent(Int64.self, forKey: key) {
            return String(value)
        }
        return nil
    }

    func decodeLossyInt64IfPresent(forKey key: Key) throws -> Int64? {
        if let value = try? decodeIfPresent(Int64.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            return Int64(value)
        }
        return nil
    }
}

extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
