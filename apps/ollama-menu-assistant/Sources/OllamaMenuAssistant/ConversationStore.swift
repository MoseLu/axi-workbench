import Foundation
import SQLite3

actor ConversationStore {
    private let fileManager: FileManager
    private let rootURL: URL

    init(
        fileManager: FileManager = .default,
        rootURL: URL? = nil,
        limit: Int = 20
    ) {
        self.fileManager = fileManager
        _ = limit

        if let rootURL {
            self.rootURL = rootURL
        } else {
            let baseURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            self.rootURL = baseURL.appending(path: "OllamaMenuAssistant", directoryHint: .isDirectory)
        }
    }

    func loadLibrary() throws -> ConversationLibrary {
        let database = try openPreparedDatabase()
        defer {
            sqlite3_close(database)
        }

        try importLegacyJSONIfNeeded(database)
        return try loadLibrary(from: database)
    }

    func loadLibraryMetadata() throws -> ConversationLibrary {
        let database = try openPreparedDatabase()
        defer {
            sqlite3_close(database)
        }

        try importLegacyJSONIfNeeded(database)
        return try loadLibraryMetadata(from: database)
    }

    func loadConversation(id: UUID) throws -> StoredConversation? {
        let database = try openPreparedDatabase()
        defer {
            sqlite3_close(database)
        }

        try importLegacyJSONIfNeeded(database)
        return try loadConversation(id: id, from: database)
    }

    func saveLibrary(_ library: ConversationLibrary) throws {
        let database = try openPreparedDatabase()
        defer {
            sqlite3_close(database)
        }

        try saveLibrary(normalizedLibrary(library), to: database)
    }

    func saveLibraryMetadata(_ library: ConversationLibrary) throws {
        let database = try openPreparedDatabase()
        defer {
            sqlite3_close(database)
        }

        try saveLibraryMetadata(normalizedLibrary(library), to: database)
    }

    func saveConversation(
        _ conversation: StoredConversation,
        projects: [ConversationProject],
        activeConversationID: UUID?
    ) throws {
        let database = try openPreparedDatabase()
        defer {
            sqlite3_close(database)
        }

        try saveConversation(
            conversation,
            projects: projects,
            activeConversationID: activeConversationID,
            to: database
        )
    }

    func saveActiveConversationID(_ id: UUID?) throws {
        let database = try openPreparedDatabase()
        defer {
            sqlite3_close(database)
        }

        try saveActiveConversationID(id, to: database)
    }

    func load() throws -> [StoredConversation] {
        try loadLibrary().conversations
    }

    func save(_ conversations: [StoredConversation]) throws {
        try saveLibrary(ConversationLibrary(conversations: conversations))
    }

    private func openPreparedDatabase() throws -> SQLiteDatabase {
        try fileManager.createDirectory(at: rootURL, withIntermediateDirectories: true)

        var database: SQLiteDatabase?
        let flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(databaseURL().path, &database, flags, nil) == SQLITE_OK,
              let database else {
            let message = database.map { sqliteErrorMessage($0) } ?? "Unable to open conversation database."
            if let database {
                sqlite3_close(database)
            }
            throw ConversationStoreError(message)
        }

        do {
            try configure(database)
            try migrate(database)
            return database
        } catch {
            sqlite3_close(database)
            throw error
        }
    }

    private func configure(_ database: SQLiteDatabase) throws {
        try execute("PRAGMA foreign_keys = ON", database)
        try execute("PRAGMA journal_mode = WAL", database)
        try execute("PRAGMA busy_timeout = 5000", database)
    }

    private func migrate(_ database: SQLiteDatabase) throws {
        try execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at_ms INTEGER NOT NULL
            )
            """,
            database
        )

        var appliedVersions = try appliedMigrationVersions(database)

        if appliedVersions.contains(1) == false {
            try withTransaction(database) {
                try execute(
                    """
                    CREATE TABLE IF NOT EXISTS app_state (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL,
                        updated_at_ms INTEGER NOT NULL
                    )
                    """,
                    database
                )
                try execute(
                    """
                    CREATE TABLE IF NOT EXISTS projects (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        path TEXT,
                        created_at_ms INTEGER NOT NULL,
                        updated_at_ms INTEGER NOT NULL
                    )
                    """,
                    database
                )
                try execute(
                    """
                    CREATE TABLE IF NOT EXISTS conversations (
                        id TEXT PRIMARY KEY,
                        project_id TEXT,
                        title TEXT NOT NULL,
                        model TEXT NOT NULL,
                        created_at_ms INTEGER NOT NULL,
                        updated_at_ms INTEGER NOT NULL,
                        is_pinned INTEGER NOT NULL,
                        is_archived INTEGER NOT NULL,
                        is_title_manually_edited INTEGER NOT NULL,
                        message_count INTEGER NOT NULL,
                        last_message_at_ms INTEGER
                    )
                    """,
                    database
                )
                try execute(
                    """
                    CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        conversation_id TEXT NOT NULL,
                        position INTEGER NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        timestamp_ms INTEGER NOT NULL,
                        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                        UNIQUE(conversation_id, position)
                    )
                    """,
                    database
                )
                try execute(
                    """
                    CREATE TABLE IF NOT EXISTS message_attachments (
                        id TEXT PRIMARY KEY,
                        message_id TEXT NOT NULL,
                        position INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        path TEXT NOT NULL,
                        kind TEXT NOT NULL,
                        byte_count INTEGER NOT NULL,
                        FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
                        UNIQUE(message_id, position)
                    )
                    """,
                    database
                )
                try execute(
                    """
                    CREATE TABLE IF NOT EXISTS tool_events (
                        id TEXT PRIMARY KEY,
                        message_id TEXT NOT NULL,
                        position INTEGER NOT NULL,
                        tool_name TEXT NOT NULL,
                        status TEXT NOT NULL,
                        summary TEXT NOT NULL,
                        timestamp_ms INTEGER NOT NULL,
                        FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
                        UNIQUE(message_id, position)
                    )
                    """,
                    database
                )
                try execute(
                    "CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at_ms DESC, id DESC)",
                    database
                )
                try execute(
                    "CREATE INDEX IF NOT EXISTS idx_conversations_project_updated ON conversations(project_id, is_archived, is_pinned DESC, updated_at_ms DESC, id DESC)",
                    database
                )
                try execute(
                    "CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at_ms DESC, id DESC)",
                    database
                )
                try execute(
                    "CREATE INDEX IF NOT EXISTS idx_messages_conversation_position ON messages(conversation_id, position)",
                    database
                )
                try execute(
                    "CREATE INDEX IF NOT EXISTS idx_message_attachments_message_position ON message_attachments(message_id, position)",
                    database
                )
                try execute(
                    "CREATE INDEX IF NOT EXISTS idx_tool_events_message_position ON tool_events(message_id, position)",
                    database
                )

                let statement = try prepare(
                    "INSERT INTO schema_migrations (version, name, applied_at_ms) VALUES (?, ?, ?)",
                    database
                )
                defer {
                    sqlite3_finalize(statement)
                }

                bind(1, to: 1, in: statement)
                bind("initial_conversation_store", to: 2, in: statement)
                bind(milliseconds(from: .now), to: 3, in: statement)
                try stepDone(statement, database)
            }
            appliedVersions.insert(1)
        }

        if appliedVersions.contains(2) == false {
            try withTransaction(database) {
                try execute("ALTER TABLE projects ADD COLUMN startup_command TEXT", database)
                let statement = try prepare(
                    "INSERT INTO schema_migrations (version, name, applied_at_ms) VALUES (?, ?, ?)",
                    database
                )
                defer {
                    sqlite3_finalize(statement)
                }

                bind(2, to: 1, in: statement)
                bind("project_startup_command", to: 2, in: statement)
                bind(milliseconds(from: .now), to: 3, in: statement)
                try stepDone(statement, database)
            }
        }

        if appliedVersions.contains(3) == false {
            try withTransaction(database) {
                try execute("ALTER TABLE messages ADD COLUMN change_summary_json TEXT", database)
                let statement = try prepare(
                    "INSERT INTO schema_migrations (version, name, applied_at_ms) VALUES (?, ?, ?)",
                    database
                )
                defer {
                    sqlite3_finalize(statement)
                }

                bind(3, to: 1, in: statement)
                bind("message_change_summary", to: 2, in: statement)
                bind(milliseconds(from: .now), to: 3, in: statement)
                try stepDone(statement, database)
            }
        }

        if appliedVersions.contains(4) == false {
            try withTransaction(database) {
                try execute("ALTER TABLE tool_events ADD COLUMN metadata_json TEXT", database)
                let statement = try prepare(
                    "INSERT INTO schema_migrations (version, name, applied_at_ms) VALUES (?, ?, ?)",
                    database
                )
                defer {
                    sqlite3_finalize(statement)
                }

                bind(4, to: 1, in: statement)
                bind("tool_event_metadata", to: 2, in: statement)
                bind(milliseconds(from: .now), to: 3, in: statement)
                try stepDone(statement, database)
            }
        }

        if appliedVersions.contains(5) == false {
            try withTransaction(database) {
                try execute("ALTER TABLE projects ADD COLUMN local_environment_json TEXT", database)
                let statement = try prepare(
                    "INSERT INTO schema_migrations (version, name, applied_at_ms) VALUES (?, ?, ?)",
                    database
                )
                defer {
                    sqlite3_finalize(statement)
                }

                bind(5, to: 1, in: statement)
                bind("project_local_environment", to: 2, in: statement)
                bind(milliseconds(from: .now), to: 3, in: statement)
                try stepDone(statement, database)
            }
        }
    }

    private func appliedMigrationVersions(_ database: SQLiteDatabase) throws -> Set<Int> {
        let statement = try prepare("SELECT version FROM schema_migrations", database)
        defer {
            sqlite3_finalize(statement)
        }

        var versions = Set<Int>()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                versions.insert(Int(sqlite3_column_int(statement, 0)))
            } else if code == SQLITE_DONE {
                return versions
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func importLegacyJSONIfNeeded(_ database: SQLiteDatabase) throws {
        guard try isDatabaseEmpty(database), let legacyLibrary = try loadLegacyLibrary() else {
            return
        }

        let sorted = sortedLibrary(legacyLibrary)
        let activeConversationID = sorted.activeConversationID ?? mostRecentlyUpdatedVisibleConversation(in: sorted.conversations)?.id
        try saveLibrary(
            ConversationLibrary(
                projects: sorted.projects,
                conversations: sorted.conversations,
                activeConversationID: activeConversationID
            ),
            to: database
        )
    }

    private func isDatabaseEmpty(_ database: SQLiteDatabase) throws -> Bool {
        try countRows(in: "projects", database) == 0
            && countRows(in: "conversations", database) == 0
    }

    private func countRows(in table: String, _ database: SQLiteDatabase) throws -> Int {
        let statement = try prepare("SELECT COUNT(*) FROM \(table)", database)
        defer {
            sqlite3_finalize(statement)
        }

        guard sqlite3_step(statement) == SQLITE_ROW else {
            throw sqliteError(database)
        }

        return Int(sqlite3_column_int64(statement, 0))
    }

    private func loadLegacyLibrary() throws -> ConversationLibrary? {
        let url = legacyLibraryURL()
        if fileManager.fileExists(atPath: url.path()) {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(ConversationLibrary.self, from: data)
        }

        let legacyURL = legacyRecentConversationsURL()
        guard fileManager.fileExists(atPath: legacyURL.path()) else {
            return nil
        }

        let data = try Data(contentsOf: legacyURL)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let legacyConversations = try decoder.decode([StoredConversation].self, from: data)
        return ConversationLibrary(conversations: legacyConversations)
    }

    private func loadLibrary(from database: SQLiteDatabase) throws -> ConversationLibrary {
        let projects = try loadProjects(from: database)
        let attachmentsByMessageID = try loadAttachments(from: database)
        let toolEventsByMessageID = try loadToolEvents(from: database)
        let messagesByConversationID = try loadMessages(
            attachmentsByMessageID: attachmentsByMessageID,
            toolEventsByMessageID: toolEventsByMessageID,
            from: database
        )
        let conversations = try loadConversations(
            messagesByConversationID: messagesByConversationID,
            from: database
        )
        let activeConversationID = try loadActiveConversationID(from: database)
        return sortedLibrary(
            ConversationLibrary(
                projects: projects,
                conversations: conversations,
                activeConversationID: activeConversationID
            )
        )
    }

    private func loadLibraryMetadata(from database: SQLiteDatabase) throws -> ConversationLibrary {
        let projects = try loadProjects(from: database)
        let conversations = try loadConversations(
            messagesByConversationID: [:],
            from: database
        )
        let activeConversationID = try loadActiveConversationID(from: database)
        return sortedLibrary(
            ConversationLibrary(
                projects: projects,
                conversations: conversations,
                activeConversationID: activeConversationID
            )
        )
    }

    private func loadConversation(id conversationID: UUID, from database: SQLiteDatabase) throws -> StoredConversation? {
        let attachmentsByMessageID = try loadAttachments(
            forConversationID: conversationID,
            from: database
        )
        let toolEventsByMessageID = try loadToolEvents(
            forConversationID: conversationID,
            from: database
        )
        let messagesByConversationID = try loadMessages(
            forConversationID: conversationID,
            attachmentsByMessageID: attachmentsByMessageID,
            toolEventsByMessageID: toolEventsByMessageID,
            from: database
        )
        return try loadConversation(
            id: conversationID,
            messages: messagesByConversationID[conversationID] ?? [],
            from: database
        )
    }

    private func loadProjects(from database: SQLiteDatabase) throws -> [ConversationProject] {
        let statement = try prepare(
            """
            SELECT id, name, path, startup_command, local_environment_json, created_at_ms, updated_at_ms
            FROM projects
            ORDER BY updated_at_ms DESC, id DESC
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        var projects = [ConversationProject]()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                guard let id = UUID(uuidString: columnText(statement, 0) ?? "") else {
                    continue
                }
                projects.append(
                    ConversationProject(
                        id: id,
                        name: columnText(statement, 1) ?? "",
                        path: columnText(statement, 2),
                        startupCommand: columnText(statement, 3),
                        localEnvironment: decodeLocalEnvironment(columnText(statement, 4)),
                        createdAt: date(fromMilliseconds: sqlite3_column_int64(statement, 5)),
                        updatedAt: date(fromMilliseconds: sqlite3_column_int64(statement, 6))
                    )
                )
            } else if code == SQLITE_DONE {
                return projects
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func loadAttachments(from database: SQLiteDatabase) throws -> [UUID: [MessageAttachment]] {
        let statement = try prepare(
            """
            SELECT message_id, id, name, path, kind, byte_count
            FROM message_attachments
            ORDER BY message_id, position
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        var attachmentsByMessageID = [UUID: [MessageAttachment]]()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                guard let messageID = UUID(uuidString: columnText(statement, 0) ?? ""),
                      let id = UUID(uuidString: columnText(statement, 1) ?? ""),
                      let kind = AttachmentKind(rawValue: columnText(statement, 4) ?? "") else {
                    continue
                }

                let attachment = MessageAttachment(
                    id: id,
                    name: columnText(statement, 2) ?? "",
                    path: columnText(statement, 3) ?? "",
                    kind: kind,
                    byteCount: sqlite3_column_int64(statement, 5)
                )
                attachmentsByMessageID[messageID, default: []].append(attachment)
            } else if code == SQLITE_DONE {
                return attachmentsByMessageID
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func loadAttachments(
        forConversationID conversationID: UUID,
        from database: SQLiteDatabase
    ) throws -> [UUID: [MessageAttachment]] {
        let statement = try prepare(
            """
            SELECT message_attachments.message_id, message_attachments.id, message_attachments.name,
                   message_attachments.path, message_attachments.kind, message_attachments.byte_count
            FROM message_attachments
            INNER JOIN messages ON messages.id = message_attachments.message_id
            WHERE messages.conversation_id = ?
            ORDER BY message_attachments.message_id, message_attachments.position
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        bind(conversationID.uuidString, to: 1, in: statement)

        var attachmentsByMessageID = [UUID: [MessageAttachment]]()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                guard let messageID = UUID(uuidString: columnText(statement, 0) ?? ""),
                      let id = UUID(uuidString: columnText(statement, 1) ?? ""),
                      let kind = AttachmentKind(rawValue: columnText(statement, 4) ?? "") else {
                    continue
                }

                let attachment = MessageAttachment(
                    id: id,
                    name: columnText(statement, 2) ?? "",
                    path: columnText(statement, 3) ?? "",
                    kind: kind,
                    byteCount: sqlite3_column_int64(statement, 5)
                )
                attachmentsByMessageID[messageID, default: []].append(attachment)
            } else if code == SQLITE_DONE {
                return attachmentsByMessageID
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func loadToolEvents(from database: SQLiteDatabase) throws -> [UUID: [ToolExecutionEvent]] {
        let statement = try prepare(
            """
            SELECT message_id, id, tool_name, status, summary, timestamp_ms, metadata_json
            FROM tool_events
            ORDER BY message_id, position
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        var eventsByMessageID = [UUID: [ToolExecutionEvent]]()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                guard let messageID = UUID(uuidString: columnText(statement, 0) ?? ""),
                      let id = UUID(uuidString: columnText(statement, 1) ?? ""),
                      let status = ToolExecutionStatus(rawValue: columnText(statement, 3) ?? "") else {
                    continue
                }

                let event = ToolExecutionEvent(
                    id: id,
                    toolName: columnText(statement, 2) ?? "",
                    status: status,
                    summary: columnText(statement, 4) ?? "",
                    timestamp: date(fromMilliseconds: sqlite3_column_int64(statement, 5)),
                    metadata: decodeToolEventMetadata(columnText(statement, 6))
                )
                eventsByMessageID[messageID, default: []].append(event)
            } else if code == SQLITE_DONE {
                return eventsByMessageID
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func loadToolEvents(
        forConversationID conversationID: UUID,
        from database: SQLiteDatabase
    ) throws -> [UUID: [ToolExecutionEvent]] {
        let statement = try prepare(
            """
            SELECT tool_events.message_id, tool_events.id, tool_events.tool_name, tool_events.status,
                   tool_events.summary, tool_events.timestamp_ms, tool_events.metadata_json
            FROM tool_events
            INNER JOIN messages ON messages.id = tool_events.message_id
            WHERE messages.conversation_id = ?
            ORDER BY tool_events.message_id, tool_events.position
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        bind(conversationID.uuidString, to: 1, in: statement)

        var eventsByMessageID = [UUID: [ToolExecutionEvent]]()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                guard let messageID = UUID(uuidString: columnText(statement, 0) ?? ""),
                      let id = UUID(uuidString: columnText(statement, 1) ?? ""),
                      let status = ToolExecutionStatus(rawValue: columnText(statement, 3) ?? "") else {
                    continue
                }

                let event = ToolExecutionEvent(
                    id: id,
                    toolName: columnText(statement, 2) ?? "",
                    status: status,
                    summary: columnText(statement, 4) ?? "",
                    timestamp: date(fromMilliseconds: sqlite3_column_int64(statement, 5)),
                    metadata: decodeToolEventMetadata(columnText(statement, 6))
                )
                eventsByMessageID[messageID, default: []].append(event)
            } else if code == SQLITE_DONE {
                return eventsByMessageID
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func loadMessages(
        attachmentsByMessageID: [UUID: [MessageAttachment]],
        toolEventsByMessageID: [UUID: [ToolExecutionEvent]],
        from database: SQLiteDatabase
    ) throws -> [UUID: [ChatMessage]] {
        let statement = try prepare(
            """
            SELECT conversation_id, id, role, content, timestamp_ms, change_summary_json
            FROM messages
            ORDER BY conversation_id, position
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        var messagesByConversationID = [UUID: [ChatMessage]]()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                guard let conversationID = UUID(uuidString: columnText(statement, 0) ?? ""),
                      let id = UUID(uuidString: columnText(statement, 1) ?? ""),
                      let role = ChatRole(rawValue: columnText(statement, 2) ?? "") else {
                    continue
                }

                let message = ChatMessage(
                    id: id,
                    role: role,
                    content: columnText(statement, 3) ?? "",
                    attachments: attachmentsByMessageID[id] ?? [],
                    timestamp: date(fromMilliseconds: sqlite3_column_int64(statement, 4)),
                    toolEvents: toolEventsByMessageID[id] ?? [],
                    changeSummary: decodeChangeSummary(columnText(statement, 5))
                )
                messagesByConversationID[conversationID, default: []].append(message)
            } else if code == SQLITE_DONE {
                return messagesByConversationID
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func loadMessages(
        forConversationID conversationID: UUID,
        attachmentsByMessageID: [UUID: [MessageAttachment]],
        toolEventsByMessageID: [UUID: [ToolExecutionEvent]],
        from database: SQLiteDatabase
    ) throws -> [UUID: [ChatMessage]] {
        let statement = try prepare(
            """
            SELECT conversation_id, id, role, content, timestamp_ms, change_summary_json
            FROM messages
            WHERE conversation_id = ?
            ORDER BY position
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        bind(conversationID.uuidString, to: 1, in: statement)

        var messagesByConversationID = [UUID: [ChatMessage]]()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                guard let conversationID = UUID(uuidString: columnText(statement, 0) ?? ""),
                      let id = UUID(uuidString: columnText(statement, 1) ?? ""),
                      let role = ChatRole(rawValue: columnText(statement, 2) ?? "") else {
                    continue
                }

                let message = ChatMessage(
                    id: id,
                    role: role,
                    content: columnText(statement, 3) ?? "",
                    attachments: attachmentsByMessageID[id] ?? [],
                    timestamp: date(fromMilliseconds: sqlite3_column_int64(statement, 4)),
                    toolEvents: toolEventsByMessageID[id] ?? [],
                    changeSummary: decodeChangeSummary(columnText(statement, 5))
                )
                messagesByConversationID[conversationID, default: []].append(message)
            } else if code == SQLITE_DONE {
                return messagesByConversationID
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func loadConversations(
        messagesByConversationID: [UUID: [ChatMessage]],
        from database: SQLiteDatabase
    ) throws -> [StoredConversation] {
        let statement = try prepare(
            """
            SELECT id, project_id, title, model, created_at_ms, updated_at_ms,
                   is_pinned, is_archived, is_title_manually_edited
            FROM conversations
            ORDER BY is_pinned DESC, updated_at_ms DESC, id DESC
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        var conversations = [StoredConversation]()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                guard let id = UUID(uuidString: columnText(statement, 0) ?? "") else {
                    continue
                }

                let projectID = columnText(statement, 1).flatMap(UUID.init(uuidString:))
                conversations.append(
                    StoredConversation(
                        id: id,
                        projectID: projectID,
                        title: columnText(statement, 2) ?? "New Chat",
                        model: columnText(statement, 3) ?? "main:latest",
                        createdAt: date(fromMilliseconds: sqlite3_column_int64(statement, 4)),
                        updatedAt: date(fromMilliseconds: sqlite3_column_int64(statement, 5)),
                        isPinned: sqlite3_column_int(statement, 6) != 0,
                        isArchived: sqlite3_column_int(statement, 7) != 0,
                        isTitleManuallyEdited: sqlite3_column_int(statement, 8) != 0,
                        messages: messagesByConversationID[id] ?? []
                    )
                )
            } else if code == SQLITE_DONE {
                return conversations
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func loadConversation(
        id conversationID: UUID,
        messages: [ChatMessage],
        from database: SQLiteDatabase
    ) throws -> StoredConversation? {
        let statement = try prepare(
            """
            SELECT id, project_id, title, model, created_at_ms, updated_at_ms,
                   is_pinned, is_archived, is_title_manually_edited
            FROM conversations
            WHERE id = ?
            LIMIT 1
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        bind(conversationID.uuidString, to: 1, in: statement)

        let code = sqlite3_step(statement)
        if code == SQLITE_ROW {
            guard let id = UUID(uuidString: columnText(statement, 0) ?? "") else {
                return nil
            }

            let projectID = columnText(statement, 1).flatMap(UUID.init(uuidString:))
            return StoredConversation(
                id: id,
                projectID: projectID,
                title: columnText(statement, 2) ?? "New Chat",
                model: columnText(statement, 3) ?? "main:latest",
                createdAt: date(fromMilliseconds: sqlite3_column_int64(statement, 4)),
                updatedAt: date(fromMilliseconds: sqlite3_column_int64(statement, 5)),
                isPinned: sqlite3_column_int(statement, 6) != 0,
                isArchived: sqlite3_column_int(statement, 7) != 0,
                isTitleManuallyEdited: sqlite3_column_int(statement, 8) != 0,
                messages: messages
            )
        } else if code == SQLITE_DONE {
            return nil
        } else {
            throw sqliteError(database)
        }
    }

    private func loadActiveConversationID(from database: SQLiteDatabase) throws -> UUID? {
        let statement = try prepare(
            "SELECT value FROM app_state WHERE key = ? LIMIT 1",
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        bind(StoreStateKey.activeConversationID.rawValue, to: 1, in: statement)
        let code = sqlite3_step(statement)
        if code == SQLITE_ROW {
            return columnText(statement, 0).flatMap(UUID.init(uuidString:))
        } else if code == SQLITE_DONE {
            return nil
        } else {
            throw sqliteError(database)
        }
    }

    private func saveLibrary(_ library: ConversationLibrary, to database: SQLiteDatabase) throws {
        let normalized = normalizedLibrary(library)
        let existingConversationVersions = try loadConversationVersions(from: database)

        try withTransaction(database) {
            try upsertProjects(normalized.projects, to: database)
            try deleteMissingRows(from: "projects", keeping: Set(normalized.projects.map { $0.id.uuidString }), in: database)

            try upsertConversations(normalized.conversations, to: database)
            try deleteMissingRows(from: "conversations", keeping: Set(normalized.conversations.map { $0.id.uuidString }), in: database)

            for conversation in normalized.conversations {
                let existing = existingConversationVersions[conversation.id.uuidString]
                if existing?.updatedAtMilliseconds != milliseconds(from: conversation.updatedAt)
                    || existing?.messageCount != conversation.messages.count {
                    try replaceMessages(for: conversation, in: database)
                }
            }

            try saveActiveConversationID(normalized.activeConversationID, to: database)
        }
    }

    private func saveLibraryMetadata(_ library: ConversationLibrary, to database: SQLiteDatabase) throws {
        let normalized = normalizedLibrary(library)
        let existingConversationVersions = try loadConversationVersions(from: database)

        try withTransaction(database) {
            try upsertProjects(normalized.projects, to: database)
            try deleteMissingRows(from: "projects", keeping: Set(normalized.projects.map { $0.id.uuidString }), in: database)

            try upsertConversationMetadata(
                normalized.conversations,
                existingVersions: existingConversationVersions,
                to: database
            )
            try deleteMissingRows(from: "conversations", keeping: Set(normalized.conversations.map { $0.id.uuidString }), in: database)

            try saveActiveConversationID(normalized.activeConversationID, to: database)
        }
    }

    private func saveConversation(
        _ conversation: StoredConversation,
        projects: [ConversationProject],
        activeConversationID: UUID?,
        to database: SQLiteDatabase
    ) throws {
        try withTransaction(database) {
            try upsertProjects(projects.sorted(by: { $0.updatedAt > $1.updatedAt }), to: database)
            try upsertConversations([conversation], to: database)
            try replaceMessages(for: conversation, in: database)
            try saveActiveConversationID(activeConversationID, to: database)
        }
    }

    private func loadConversationVersions(from database: SQLiteDatabase) throws -> [String: ConversationVersion] {
        let statement = try prepare(
            "SELECT id, updated_at_ms, message_count, last_message_at_ms FROM conversations",
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        var versions = [String: ConversationVersion]()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                let id = columnText(statement, 0) ?? ""
                versions[id] = ConversationVersion(
                    updatedAtMilliseconds: sqlite3_column_int64(statement, 1),
                    messageCount: Int(sqlite3_column_int64(statement, 2)),
                    lastMessageAtMilliseconds: sqlite3_column_type(statement, 3) == SQLITE_NULL
                        ? nil
                        : sqlite3_column_int64(statement, 3)
                )
            } else if code == SQLITE_DONE {
                return versions
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func upsertProjects(_ projects: [ConversationProject], to database: SQLiteDatabase) throws {
        let statement = try prepare(
            """
            INSERT INTO projects (id, name, path, startup_command, local_environment_json, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                path = excluded.path,
                startup_command = excluded.startup_command,
                local_environment_json = excluded.local_environment_json,
                created_at_ms = excluded.created_at_ms,
                updated_at_ms = excluded.updated_at_ms
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        for project in projects {
            sqlite3_reset(statement)
            sqlite3_clear_bindings(statement)
            bind(project.id.uuidString, to: 1, in: statement)
            bind(project.name, to: 2, in: statement)
            bindOptional(project.path, to: 3, in: statement)
            bindOptional(project.startupCommand, to: 4, in: statement)
            bindOptional(encodeLocalEnvironment(project.localEnvironment), to: 5, in: statement)
            bind(milliseconds(from: project.createdAt), to: 6, in: statement)
            bind(milliseconds(from: project.updatedAt), to: 7, in: statement)
            try stepDone(statement, database)
        }
    }

    private func upsertConversations(_ conversations: [StoredConversation], to database: SQLiteDatabase) throws {
        let statement = try prepare(
            """
            INSERT INTO conversations (
                id, project_id, title, model, created_at_ms, updated_at_ms,
                is_pinned, is_archived, is_title_manually_edited, message_count, last_message_at_ms
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                project_id = excluded.project_id,
                title = excluded.title,
                model = excluded.model,
                created_at_ms = excluded.created_at_ms,
                updated_at_ms = excluded.updated_at_ms,
                is_pinned = excluded.is_pinned,
                is_archived = excluded.is_archived,
                is_title_manually_edited = excluded.is_title_manually_edited,
                message_count = excluded.message_count,
                last_message_at_ms = excluded.last_message_at_ms
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        for conversation in conversations {
            sqlite3_reset(statement)
            sqlite3_clear_bindings(statement)
            bind(conversation.id.uuidString, to: 1, in: statement)
            bindOptional(conversation.projectID?.uuidString, to: 2, in: statement)
            bind(conversation.title, to: 3, in: statement)
            bind(conversation.model, to: 4, in: statement)
            bind(milliseconds(from: conversation.createdAt), to: 5, in: statement)
            bind(milliseconds(from: conversation.updatedAt), to: 6, in: statement)
            bind(conversation.isPinned, to: 7, in: statement)
            bind(conversation.isArchived, to: 8, in: statement)
            bind(conversation.isTitleManuallyEdited, to: 9, in: statement)
            bind(conversation.messages.count, to: 10, in: statement)
            bindOptional(conversation.messages.last.map { milliseconds(from: $0.timestamp) }, to: 11, in: statement)
            try stepDone(statement, database)
        }
    }

    private func upsertConversationMetadata(
        _ conversations: [StoredConversation],
        existingVersions: [String: ConversationVersion],
        to database: SQLiteDatabase
    ) throws {
        let statement = try prepare(
            """
            INSERT INTO conversations (
                id, project_id, title, model, created_at_ms, updated_at_ms,
                is_pinned, is_archived, is_title_manually_edited, message_count, last_message_at_ms
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                project_id = excluded.project_id,
                title = excluded.title,
                model = excluded.model,
                created_at_ms = excluded.created_at_ms,
                updated_at_ms = excluded.updated_at_ms,
                is_pinned = excluded.is_pinned,
                is_archived = excluded.is_archived,
                is_title_manually_edited = excluded.is_title_manually_edited,
                message_count = excluded.message_count,
                last_message_at_ms = excluded.last_message_at_ms
            """,
            database
        )
        defer {
            sqlite3_finalize(statement)
        }

        for conversation in conversations {
            let existing = existingVersions[conversation.id.uuidString]
            let messageCount = conversation.messages.isEmpty
                ? existing?.messageCount ?? 0
                : conversation.messages.count
            let lastMessageAtMilliseconds = conversation.messages.last.map { milliseconds(from: $0.timestamp) }
                ?? existing?.lastMessageAtMilliseconds

            sqlite3_reset(statement)
            sqlite3_clear_bindings(statement)
            bind(conversation.id.uuidString, to: 1, in: statement)
            bindOptional(conversation.projectID?.uuidString, to: 2, in: statement)
            bind(conversation.title, to: 3, in: statement)
            bind(conversation.model, to: 4, in: statement)
            bind(milliseconds(from: conversation.createdAt), to: 5, in: statement)
            bind(milliseconds(from: conversation.updatedAt), to: 6, in: statement)
            bind(conversation.isPinned, to: 7, in: statement)
            bind(conversation.isArchived, to: 8, in: statement)
            bind(conversation.isTitleManuallyEdited, to: 9, in: statement)
            bind(messageCount, to: 10, in: statement)
            bindOptional(lastMessageAtMilliseconds, to: 11, in: statement)
            try stepDone(statement, database)
        }
    }

    private func replaceMessages(for conversation: StoredConversation, in database: SQLiteDatabase) throws {
        try deleteMessages(for: conversation.id, in: database)

        let messageStatement = try prepare(
            """
            INSERT INTO messages (id, conversation_id, position, role, content, timestamp_ms, change_summary_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            database
        )
        let attachmentStatement = try prepare(
            """
            INSERT INTO message_attachments (id, message_id, position, name, path, kind, byte_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            database
        )
        let toolEventStatement = try prepare(
            """
            INSERT INTO tool_events (id, message_id, position, tool_name, status, summary, timestamp_ms, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            database
        )
        defer {
            sqlite3_finalize(messageStatement)
            sqlite3_finalize(attachmentStatement)
            sqlite3_finalize(toolEventStatement)
        }

        for (messageIndex, message) in conversation.messages.enumerated() {
            sqlite3_reset(messageStatement)
            sqlite3_clear_bindings(messageStatement)
            bind(message.id.uuidString, to: 1, in: messageStatement)
            bind(conversation.id.uuidString, to: 2, in: messageStatement)
            bind(messageIndex, to: 3, in: messageStatement)
            bind(message.role.rawValue, to: 4, in: messageStatement)
            bind(message.content, to: 5, in: messageStatement)
            bind(milliseconds(from: message.timestamp), to: 6, in: messageStatement)
            bindOptional(encodeChangeSummary(message.changeSummary), to: 7, in: messageStatement)
            try stepDone(messageStatement, database)

            for (attachmentIndex, attachment) in message.attachments.enumerated() {
                sqlite3_reset(attachmentStatement)
                sqlite3_clear_bindings(attachmentStatement)
                bind(attachment.id.uuidString, to: 1, in: attachmentStatement)
                bind(message.id.uuidString, to: 2, in: attachmentStatement)
                bind(attachmentIndex, to: 3, in: attachmentStatement)
                bind(attachment.name, to: 4, in: attachmentStatement)
                bind(attachment.path, to: 5, in: attachmentStatement)
                bind(attachment.kind.rawValue, to: 6, in: attachmentStatement)
                bind(attachment.byteCount, to: 7, in: attachmentStatement)
                try stepDone(attachmentStatement, database)
            }

            for (toolEventIndex, toolEvent) in message.toolEvents.enumerated() {
                sqlite3_reset(toolEventStatement)
                sqlite3_clear_bindings(toolEventStatement)
                bind(toolEvent.id.uuidString, to: 1, in: toolEventStatement)
                bind(message.id.uuidString, to: 2, in: toolEventStatement)
                bind(toolEventIndex, to: 3, in: toolEventStatement)
                bind(toolEvent.toolName, to: 4, in: toolEventStatement)
                bind(toolEvent.status.rawValue, to: 5, in: toolEventStatement)
                bind(toolEvent.summary, to: 6, in: toolEventStatement)
                bind(milliseconds(from: toolEvent.timestamp), to: 7, in: toolEventStatement)
                bindOptional(encodeToolEventMetadata(toolEvent.metadata), to: 8, in: toolEventStatement)
                try stepDone(toolEventStatement, database)
            }
        }
    }

    private func deleteMessages(for conversationID: UUID, in database: SQLiteDatabase) throws {
        let statement = try prepare("DELETE FROM messages WHERE conversation_id = ?", database)
        defer {
            sqlite3_finalize(statement)
        }

        bind(conversationID.uuidString, to: 1, in: statement)
        try stepDone(statement, database)
    }

    private func deleteMissingRows(from table: String, keeping ids: Set<String>, in database: SQLiteDatabase) throws {
        let existingIDs = try loadIDs(from: table, in: database)
        let statement = try prepare("DELETE FROM \(table) WHERE id = ?", database)
        defer {
            sqlite3_finalize(statement)
        }

        for id in existingIDs where !ids.contains(id) {
            sqlite3_reset(statement)
            sqlite3_clear_bindings(statement)
            bind(id, to: 1, in: statement)
            try stepDone(statement, database)
        }
    }

    private func loadIDs(from table: String, in database: SQLiteDatabase) throws -> [String] {
        let statement = try prepare("SELECT id FROM \(table)", database)
        defer {
            sqlite3_finalize(statement)
        }

        var ids = [String]()
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_ROW {
                ids.append(columnText(statement, 0) ?? "")
            } else if code == SQLITE_DONE {
                return ids
            } else {
                throw sqliteError(database)
            }
        }
    }

    private func saveActiveConversationID(_ id: UUID?, to database: SQLiteDatabase) throws {
        if let id {
            let statement = try prepare(
                """
                INSERT INTO app_state (key, value, updated_at_ms)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at_ms = excluded.updated_at_ms
                """,
                database
            )
            defer {
                sqlite3_finalize(statement)
            }

            bind(StoreStateKey.activeConversationID.rawValue, to: 1, in: statement)
            bind(id.uuidString, to: 2, in: statement)
            bind(milliseconds(from: .now), to: 3, in: statement)
            try stepDone(statement, database)
        } else {
            let statement = try prepare("DELETE FROM app_state WHERE key = ?", database)
            defer {
                sqlite3_finalize(statement)
            }

            bind(StoreStateKey.activeConversationID.rawValue, to: 1, in: statement)
            try stepDone(statement, database)
        }
    }

    private func sortedLibrary(_ library: ConversationLibrary) -> ConversationLibrary {
        let projects = library.projects.sorted(by: { $0.updatedAt > $1.updatedAt })
        let conversations = sortConversations(library.conversations)
        let conversationIDs = Set(conversations.map(\.id))
        let activeConversationID = library.activeConversationID.flatMap { conversationIDs.contains($0) ? $0 : nil }
        return ConversationLibrary(
            projects: projects,
            conversations: conversations,
            activeConversationID: activeConversationID
        )
    }

    private func normalizedLibrary(_ library: ConversationLibrary) -> ConversationLibrary {
        let projects = library.projects.map { project in
            var updated = project
            let projectConversations = library.conversations.filter { $0.projectID == project.id }
            updated.updatedAt = projectConversations.map(\.updatedAt).max() ?? project.updatedAt
            return updated
        }
        .sorted(by: { $0.updatedAt > $1.updatedAt })

        let conversations = sortConversations(library.conversations)
        let conversationIDs = Set(conversations.map(\.id))
        let activeConversationID = library.activeConversationID.flatMap { conversationIDs.contains($0) ? $0 : nil }
        return ConversationLibrary(
            projects: projects,
            conversations: conversations,
            activeConversationID: activeConversationID
        )
    }

    private func sortConversations(_ conversations: [StoredConversation]) -> [StoredConversation] {
        conversations.sorted { lhs, rhs in
            if lhs.isPinned != rhs.isPinned {
                return lhs.isPinned && !rhs.isPinned
            }
            return lhs.updatedAt > rhs.updatedAt
        }
    }

    private func mostRecentlyUpdatedVisibleConversation(in conversations: [StoredConversation]) -> StoredConversation? {
        conversations
            .filter { !$0.isArchived }
            .max(by: { $0.updatedAt < $1.updatedAt })
    }

    private func encodeChangeSummary(_ summary: AssistantChangeSummary?) -> String? {
        guard let summary,
              let data = try? JSONEncoder().encode(summary) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private func encodeToolEventMetadata(_ metadata: [String: JSONValue]) -> String? {
        guard !metadata.isEmpty,
              let data = try? JSONEncoder().encode(metadata) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private func encodeLocalEnvironment(_ environment: ProjectLocalEnvironment?) -> String? {
        guard let environment,
              let data = try? JSONEncoder().encode(environment) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private func decodeChangeSummary(_ text: String?) -> AssistantChangeSummary? {
        guard let text,
              let data = text.data(using: .utf8) else {
            return nil
        }
        return try? JSONDecoder().decode(AssistantChangeSummary.self, from: data)
    }

    private func decodeToolEventMetadata(_ text: String?) -> [String: JSONValue] {
        guard let text,
              let data = text.data(using: .utf8),
              let metadata = try? JSONDecoder().decode([String: JSONValue].self, from: data) else {
            return [:]
        }
        return metadata
    }

    private func decodeLocalEnvironment(_ text: String?) -> ProjectLocalEnvironment? {
        guard let text,
              let data = text.data(using: .utf8) else {
            return nil
        }
        return try? JSONDecoder().decode(ProjectLocalEnvironment.self, from: data)
    }

    private func databaseURL() -> URL {
        rootURL.appending(path: "conversations.sqlite3")
    }

    private func legacyLibraryURL() -> URL {
        rootURL.appending(path: "conversation-library.json")
    }

    private func legacyRecentConversationsURL() -> URL {
        rootURL.appending(path: "recent-conversations.json")
    }

    private func withTransaction<T>(_ database: SQLiteDatabase, _ work: () throws -> T) throws -> T {
        try execute("BEGIN IMMEDIATE TRANSACTION", database)
        do {
            let result = try work()
            try execute("COMMIT", database)
            return result
        } catch {
            try? execute("ROLLBACK", database)
            throw error
        }
    }

    private func execute(_ sql: String, _ database: SQLiteDatabase) throws {
        guard sqlite3_exec(database, sql, nil, nil, nil) == SQLITE_OK else {
            throw sqliteError(database)
        }
    }

    private func prepare(_ sql: String, _ database: SQLiteDatabase) throws -> SQLiteStatement {
        var statement: SQLiteStatement?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
              let statement else {
            throw sqliteError(database)
        }
        return statement
    }

    private func stepDone(_ statement: SQLiteStatement, _ database: SQLiteDatabase) throws {
        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw sqliteError(database)
        }
    }

    private func bind(_ value: String, to index: Int32, in statement: SQLiteStatement) {
        sqlite3_bind_text(statement, index, value, -1, sqliteTransient)
    }

    private func bindOptional(_ value: String?, to index: Int32, in statement: SQLiteStatement) {
        if let value {
            bind(value, to: index, in: statement)
        } else {
            sqlite3_bind_null(statement, index)
        }
    }

    private func bind(_ value: Int, to index: Int32, in statement: SQLiteStatement) {
        sqlite3_bind_int64(statement, index, Int64(value))
    }

    private func bind(_ value: Int64, to index: Int32, in statement: SQLiteStatement) {
        sqlite3_bind_int64(statement, index, value)
    }

    private func bindOptional(_ value: Int64?, to index: Int32, in statement: SQLiteStatement) {
        if let value {
            bind(value, to: index, in: statement)
        } else {
            sqlite3_bind_null(statement, index)
        }
    }

    private func bind(_ value: Bool, to index: Int32, in statement: SQLiteStatement) {
        sqlite3_bind_int(statement, index, value ? 1 : 0)
    }

    private func columnText(_ statement: SQLiteStatement, _ index: Int32) -> String? {
        guard let pointer = sqlite3_column_text(statement, index) else {
            return nil
        }
        return String(cString: pointer)
    }

    private func milliseconds(from date: Date) -> Int64 {
        Int64((date.timeIntervalSince1970 * 1000).rounded())
    }

    private func date(fromMilliseconds milliseconds: Int64) -> Date {
        Date(timeIntervalSince1970: TimeInterval(milliseconds) / 1000)
    }

    private func sqliteError(_ database: SQLiteDatabase) -> ConversationStoreError {
        ConversationStoreError(sqliteErrorMessage(database))
    }

    private func sqliteErrorMessage(_ database: SQLiteDatabase) -> String {
        String(cString: sqlite3_errmsg(database))
    }
}

private typealias SQLiteDatabase = OpaquePointer
private typealias SQLiteStatement = OpaquePointer

private let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

private struct ConversationStoreError: LocalizedError {
    let message: String

    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? {
        message
    }
}

private struct ConversationVersion {
    var updatedAtMilliseconds: Int64
    var messageCount: Int
    var lastMessageAtMilliseconds: Int64?
}

private enum StoreStateKey: String {
    case activeConversationID
}
