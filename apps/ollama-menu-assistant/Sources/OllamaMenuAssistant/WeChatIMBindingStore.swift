import Foundation

actor IMConversationBindingStore {
    private let fileManager: FileManager
    private let rootURL: URL
    private var bindings: [String: UUID] = [:]
    private var takeoverRequests: [String: IMConversationTakeoverRequest] = [:]

    init(fileManager: FileManager = .default, rootURL: URL? = nil) {
        self.fileManager = fileManager
        if let rootURL {
            self.rootURL = rootURL
        } else {
            let baseURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            self.rootURL = baseURL.appending(path: "OllamaMenuAssistant", directoryHint: .isDirectory)
        }
    }

    func load() throws {
        let url = storageURL()
        guard fileManager.fileExists(atPath: url.path) else {
            bindings = [:]
            takeoverRequests = [:]
            return
        }
        let data = try Data(contentsOf: url)
        if let payload = try? JSONDecoder().decode(IMConversationBindingPayload.self, from: data) {
            bindings = payload.bindings
            takeoverRequests = payload.takeoverRequests
        } else {
            bindings = try JSONDecoder().decode([String: UUID].self, from: data)
            takeoverRequests = [:]
        }
    }

    func conversationID(for key: String) -> UUID? {
        bindings[key]
    }

    func chatIDs(forConversationID id: UUID) -> [String] {
        bindings
            .filter { $0.value == id }
            .map { chatID(from: $0.key) }
            .sorted()
    }

    func takeoverRequest(for key: String) -> IMConversationTakeoverRequest? {
        takeoverRequests[key]
    }

    func setConversationID(_ id: UUID, for key: String) throws {
        bindings[key] = id
        takeoverRequests[key] = nil
        try save()
    }

    func setTakeoverRequest(_ request: IMConversationTakeoverRequest, for key: String) throws {
        takeoverRequests[key] = request
        try save()
    }

    func clearTakeoverRequest(for key: String) throws {
        takeoverRequests[key] = nil
        try save()
    }

    private func save() throws {
        try fileManager.createDirectory(at: rootURL, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(
            IMConversationBindingPayload(
                bindings: bindings,
                takeoverRequests: takeoverRequests
            )
        )
        try data.write(to: storageURL(), options: .atomic)
    }

    private func storageURL() -> URL {
        rootURL.appending(path: "im-conversation-bindings.json")
    }

    private func chatID(from key: String) -> String {
        let prefix = "wechat:"
        guard key.hasPrefix(prefix) else {
            return key
        }
        return String(key.dropFirst(prefix.count))
    }
}

struct IMConversationTakeoverRequest: Codable, Hashable, Sendable {
    var conversationIDs: [UUID]
    var requestedAt: Date

    init(conversationIDs: [UUID], requestedAt: Date = .now) {
        self.conversationIDs = conversationIDs
        self.requestedAt = requestedAt
    }
}

private struct IMConversationBindingPayload: Codable {
    var bindings: [String: UUID]
    var takeoverRequests: [String: IMConversationTakeoverRequest]
}
