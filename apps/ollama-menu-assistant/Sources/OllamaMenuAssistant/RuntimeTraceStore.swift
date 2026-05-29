import Foundation

actor RuntimeTraceStore {
    private let rootURL: URL
    private let limit: Int

    init(rootURL: URL? = nil, limit: Int = 200) {
        if let rootURL {
            self.rootURL = rootURL
        } else {
            let baseURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            self.rootURL = baseURL.appending(path: "OllamaMenuAssistant", directoryHint: .isDirectory)
        }
        self.limit = limit
    }

    func load() throws -> [RuntimeTrace] {
        guard FileManager.default.fileExists(atPath: tracesURL.path) else {
            return []
        }
        let data = try Data(contentsOf: tracesURL)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([RuntimeTrace].self, from: data)
    }

    func append(_ trace: RuntimeTrace) throws -> [RuntimeTrace] {
        var traces = (try? load()) ?? []
        traces.insert(trace, at: 0)
        if traces.count > limit {
            traces = Array(traces.prefix(limit))
        }
        try save(traces)
        return traces
    }

    func clear() throws {
        try save([])
    }

    private func save(_ traces: [RuntimeTrace]) throws {
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(traces)
        try data.write(to: tracesURL, options: .atomic)
    }

    private var tracesURL: URL {
        rootURL.appending(path: "runtime-traces.json")
    }
}
