import Foundation
import SQLite3

actor ProjectKnowledgeStore {
    private let rootURL: URL

    init(rootURL: URL? = nil) {
        if let rootURL {
            self.rootURL = rootURL
        } else {
            let baseURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            self.rootURL = baseURL.appending(path: "OllamaMenuAssistant", directoryHint: .isDirectory)
        }
    }

    func refreshProjectIndex(_ project: ConversationProject) throws {
        guard let projectPath = project.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !projectPath.isEmpty else {
            return
        }

        let projectURL = URL(fileURLWithPath: projectPath).standardizedFileURL.resolvingSymlinksInPath()
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: projectURL.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            return
        }

        let documents = collectDocuments(projectURL: projectURL, projectID: project.id)
        try withDatabase { database in
            try configure(database)
            try withTransaction(database) {
                try execute("DELETE FROM knowledge_documents WHERE project_id = ?", database, [project.id.uuidString])
                try execute("DELETE FROM knowledge_fts WHERE project_id = ?", database, [project.id.uuidString])
                for document in documents {
                    try execute(
                        """
                        INSERT INTO knowledge_documents (project_id, path, modified_at_ms, content)
                        VALUES (?, ?, ?, ?)
                        """,
                        database,
                        [
                            document.projectID.uuidString,
                            document.path,
                            String(document.modifiedAtMilliseconds),
                            document.content,
                        ]
                    )
                    try execute(
                        """
                        INSERT INTO knowledge_fts (project_id, path, content)
                        VALUES (?, ?, ?)
                        """,
                        database,
                        [document.projectID.uuidString, document.path, document.content]
                    )
                }
            }
        }
    }

    func search(
        project: ConversationProject,
        query: String,
        maxResults: Int = 5,
        includeVector: Bool = false
    ) throws -> [KnowledgeHit] {
        guard let _ = project.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return []
        }

        try refreshProjectIndex(project)
        let limit = max(1, min(maxResults, 12))
        let lexicalHits = try searchFTS(projectID: project.id, query: query, maxResults: limit)
        guard includeVector else {
            return lexicalHits
        }

        let vectorHits = try searchVector(projectID: project.id, query: query, maxResults: limit)
        return merge(lexicalHits: lexicalHits, vectorHits: vectorHits, maxResults: limit)
    }

    private func searchFTS(projectID: UUID, query: String, maxResults: Int) throws -> [KnowledgeHit] {
        let ftsQuery = makeFTSQuery(query)
        guard !ftsQuery.isEmpty else {
            return []
        }

        do {
            return try withDatabase { database in
                try configure(database)
                var statement: OpaquePointer?
                let sql = """
                SELECT path,
                       snippet(knowledge_fts, 2, '[', ']', '...', 18),
                       bm25(knowledge_fts)
                FROM knowledge_fts
                WHERE project_id = ? AND knowledge_fts MATCH ?
                ORDER BY bm25(knowledge_fts)
                LIMIT ?
                """
                guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
                      let statement else {
                    throw ProjectKnowledgeError(sqliteErrorMessage(database))
                }
                defer {
                    sqlite3_finalize(statement)
                }

                bind(projectID.uuidString, to: 1, in: statement)
                bind(ftsQuery, to: 2, in: statement)
                sqlite3_bind_int(statement, 3, Int32(maxResults))

                var hits: [KnowledgeHit] = []
                while sqlite3_step(statement) == SQLITE_ROW {
                    let path = columnText(statement, 0)
                    let snippet = columnText(statement, 1)
                    let rank = sqlite3_column_double(statement, 2)
                    hits.append(
                        KnowledgeHit(
                            projectID: projectID,
                            path: path,
                            snippet: snippet.isEmpty ? path : snippet,
                            score: max(0, -rank),
                            source: "fts"
                        )
                    )
                }
                return hits
            }
        } catch {
            return try searchLike(projectID: projectID, query: query, maxResults: maxResults)
        }
    }

    private func searchLike(projectID: UUID, query: String, maxResults: Int) throws -> [KnowledgeHit] {
        try withDatabase { database in
            try configure(database)
            var statement: OpaquePointer?
            let sql = """
            SELECT path, content
            FROM knowledge_documents
            WHERE project_id = ? AND (path LIKE ? OR content LIKE ?)
            LIMIT ?
            """
            guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
                  let statement else {
                throw ProjectKnowledgeError(sqliteErrorMessage(database))
            }
            defer {
                sqlite3_finalize(statement)
            }

            let likeQuery = "%\(query)%"
            bind(projectID.uuidString, to: 1, in: statement)
            bind(likeQuery, to: 2, in: statement)
            bind(likeQuery, to: 3, in: statement)
            sqlite3_bind_int(statement, 4, Int32(maxResults))

            var hits: [KnowledgeHit] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                let path = columnText(statement, 0)
                let content = columnText(statement, 1)
                hits.append(
                    KnowledgeHit(
                        projectID: projectID,
                        path: path,
                        snippet: excerpt(content, query: query),
                        score: 0.1,
                        source: "fts-fallback"
                    )
                )
            }
            return hits
        }
    }

    private func searchVector(projectID: UUID, query: String, maxResults: Int) throws -> [KnowledgeHit] {
        let queryVector = hashedVector(query)
        guard !queryVector.isEmpty else {
            return []
        }

        return try withDatabase { database in
            try configure(database)
            var statement: OpaquePointer?
            let sql = """
            SELECT path, content
            FROM knowledge_documents
            WHERE project_id = ?
            LIMIT 600
            """
            guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
                  let statement else {
                throw ProjectKnowledgeError(sqliteErrorMessage(database))
            }
            defer {
                sqlite3_finalize(statement)
            }

            bind(projectID.uuidString, to: 1, in: statement)
            var hits: [KnowledgeHit] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                let path = columnText(statement, 0)
                let content = columnText(statement, 1)
                let score = cosine(queryVector, hashedVector(path + "\n" + content))
                guard score > 0.08 else {
                    continue
                }
                hits.append(
                    KnowledgeHit(
                        projectID: projectID,
                        path: path,
                        snippet: excerpt(content, query: query),
                        score: score,
                        source: "vector"
                    )
                )
            }
            return hits.sorted { $0.score > $1.score }.prefix(maxResults).map { $0 }
        }
    }

    private func merge(
        lexicalHits: [KnowledgeHit],
        vectorHits: [KnowledgeHit],
        maxResults: Int
    ) -> [KnowledgeHit] {
        var hitsByPath: [String: KnowledgeHit] = [:]
        for hit in lexicalHits {
            hitsByPath[hit.path] = hit
        }
        for hit in vectorHits {
            if var existing = hitsByPath[hit.path] {
                existing.score += hit.score
                existing.source = "hybrid"
                if existing.snippet.count < hit.snippet.count {
                    existing.snippet = hit.snippet
                }
                hitsByPath[hit.path] = existing
            } else {
                hitsByPath[hit.path] = hit
            }
        }
        return hitsByPath.values.sorted {
            if $0.score == $1.score {
                return $0.path < $1.path
            }
            return $0.score > $1.score
        }
        .prefix(maxResults)
        .map { $0 }
    }

    private func collectDocuments(projectURL: URL, projectID: UUID) -> [KnowledgeDocument] {
        guard let enumerator = FileManager.default.enumerator(
            at: projectURL,
            includingPropertiesForKeys: [.isDirectoryKey, .contentModificationDateKey, .fileSizeKey],
            options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else {
            return []
        }

        var documents: [KnowledgeDocument] = []
        for case let url as URL in enumerator {
            guard documents.count < 900 else {
                break
            }

            let values = try? url.resourceValues(forKeys: [.isDirectoryKey, .contentModificationDateKey, .fileSizeKey])
            if values?.isDirectory == true {
                if shouldSkipDirectory(url.lastPathComponent) {
                    enumerator.skipDescendants()
                }
                continue
            }

            guard shouldIndexFile(url, byteCount: Int64(values?.fileSize ?? 0)),
                  let content = readTextPrefix(url, maxBytes: 80_000),
                  !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                continue
            }

            let normalized = url.standardizedFileURL.resolvingSymlinksInPath()
            guard ToolPermissionEngine.isPath(normalized, inside: projectURL) else {
                continue
            }
            let relativePath = normalized.path.replacingOccurrences(of: projectURL.path + "/", with: "")
            documents.append(
                KnowledgeDocument(
                    projectID: projectID,
                    path: relativePath,
                    modifiedAtMilliseconds: milliseconds(from: values?.contentModificationDate ?? .distantPast),
                    content: content
                )
            )
        }
        return documents
    }

    private func shouldSkipDirectory(_ name: String) -> Bool {
        WorkspaceToolService.ignoredDirectoryNames.contains(name)
    }

    private func shouldIndexFile(_ url: URL, byteCount: Int64) -> Bool {
        guard byteCount <= 512_000 else {
            return false
        }
        let name = url.lastPathComponent
        if name == "README" || name == "AGENTS.md" {
            return true
        }
        let allowedExtensions: Set<String> = [
            "c", "cc", "cpp", "css", "go", "h", "hpp", "html", "java", "js",
            "json", "jsx", "kt", "md", "mjs", "mm", "py", "rb", "rs", "sh",
            "swift", "toml", "ts", "tsx", "txt", "yaml", "yml",
        ]
        return allowedExtensions.contains(url.pathExtension.lowercased())
    }

    private func readTextPrefix(_ url: URL, maxBytes: Int) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: url) else {
            return nil
        }
        defer {
            try? handle.close()
        }
        let data = handle.readData(ofLength: maxBytes)
        return String(data: data, encoding: .utf8)
    }

    private func makeFTSQuery(_ query: String) -> String {
        let tokens = query
            .lowercased()
            .split { scalar in
                guard let first = scalar.unicodeScalars.first else {
                    return true
                }
                return CharacterSet.alphanumerics.inverted.contains(first)
            }
            .map(String.init)
            .filter { $0.count >= 2 }
            .prefix(8)
        return tokens.map { "\"\($0.replacingOccurrences(of: "\"", with: "\"\""))\"" }
            .joined(separator: " OR ")
    }

    private func excerpt(_ content: String, query: String) -> String {
        let clean = content.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let lowered = clean.lowercased()
        let queryToken = query.lowercased()
            .split { !$0.isLetter && !$0.isNumber }
            .map(String.init)
            .first(where: { $0.count >= 2 })
        guard let queryToken,
              let range = lowered.range(of: queryToken) else {
            return String(clean.prefix(300))
        }
        let start = clean.index(range.lowerBound, offsetBy: -120, limitedBy: clean.startIndex) ?? clean.startIndex
        let end = clean.index(range.upperBound, offsetBy: 180, limitedBy: clean.endIndex) ?? clean.endIndex
        return String(clean[start..<end])
    }

    private func hashedVector(_ text: String) -> [Int: Double] {
        var vector: [Int: Double] = [:]
        let tokens = text
            .lowercased()
            .split { !$0.isLetter && !$0.isNumber }
            .map(String.init)
            .filter { $0.count >= 2 }
        for token in tokens {
            let bucket = abs(token.hashValue % 256)
            vector[bucket, default: 0] += 1
        }
        return vector
    }

    private func cosine(_ lhs: [Int: Double], _ rhs: [Int: Double]) -> Double {
        guard !lhs.isEmpty, !rhs.isEmpty else {
            return 0
        }
        var dot = 0.0
        for (key, lhsValue) in lhs {
            dot += lhsValue * (rhs[key] ?? 0)
        }
        let lhsNorm = sqrt(lhs.values.reduce(0) { $0 + $1 * $1 })
        let rhsNorm = sqrt(rhs.values.reduce(0) { $0 + $1 * $1 })
        guard lhsNorm > 0, rhsNorm > 0 else {
            return 0
        }
        return dot / (lhsNorm * rhsNorm)
    }

    private func withDatabase<T>(_ body: (OpaquePointer) throws -> T) throws -> T {
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        var database: OpaquePointer?
        guard sqlite3_open_v2(databaseURL.path, &database, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK,
              let database else {
            throw ProjectKnowledgeError(database.map(sqliteErrorMessage) ?? "Unable to open knowledge database.")
        }
        defer {
            sqlite3_close(database)
        }
        return try body(database)
    }

    private func configure(_ database: OpaquePointer) throws {
        try execute("PRAGMA journal_mode = WAL", database)
        try execute("PRAGMA busy_timeout = 5000", database)
        try execute(
            """
            CREATE TABLE IF NOT EXISTS knowledge_documents (
                project_id TEXT NOT NULL,
                path TEXT NOT NULL,
                modified_at_ms INTEGER NOT NULL,
                content TEXT NOT NULL,
                PRIMARY KEY (project_id, path)
            )
            """,
            database
        )
        try execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts
            USING fts5(project_id UNINDEXED, path, content)
            """,
            database
        )
    }

    private func withTransaction(_ database: OpaquePointer, _ body: () throws -> Void) throws {
        try execute("BEGIN IMMEDIATE", database)
        do {
            try body()
            try execute("COMMIT", database)
        } catch {
            try? execute("ROLLBACK", database)
            throw error
        }
    }

    private func execute(_ sql: String, _ database: OpaquePointer, _ values: [String] = []) throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
              let statement else {
            throw ProjectKnowledgeError(sqliteErrorMessage(database))
        }
        defer {
            sqlite3_finalize(statement)
        }
        for (offset, value) in values.enumerated() {
            bind(value, to: Int32(offset + 1), in: statement)
        }
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_DONE {
                return
            }
            if code == SQLITE_ROW {
                continue
            }
            throw ProjectKnowledgeError(sqliteErrorMessage(database))
        }
    }

    private var databaseURL: URL {
        rootURL.appending(path: "project-knowledge.sqlite3")
    }
}

private struct KnowledgeDocument {
    var projectID: UUID
    var path: String
    var modifiedAtMilliseconds: Int64
    var content: String
}

struct ProjectKnowledgeError: LocalizedError, Hashable, Sendable {
    var message: String

    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? {
        message
    }
}

private func milliseconds(from date: Date) -> Int64 {
    Int64((date.timeIntervalSince1970 * 1_000).rounded())
}

private func bind(_ value: String, to index: Int32, in statement: OpaquePointer) {
    sqlite3_bind_text(statement, index, value, -1, knowledgeSQLiteTransient)
}

private func columnText(_ statement: OpaquePointer, _ index: Int32) -> String {
    guard let text = sqlite3_column_text(statement, index) else {
        return ""
    }
    return String(cString: text)
}

private func sqliteErrorMessage(_ database: OpaquePointer) -> String {
    String(cString: sqlite3_errmsg(database))
}

private let knowledgeSQLiteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
