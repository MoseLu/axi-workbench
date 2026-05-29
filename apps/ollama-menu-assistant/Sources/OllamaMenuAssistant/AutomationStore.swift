import Foundation

enum AutomationTaskStatus: String, Equatable, Sendable {
    case active = "ACTIVE"
    case paused = "PAUSED"

    init(rawValue: String?) {
        switch rawValue?.uppercased() {
        case Self.paused.rawValue:
            self = .paused
        default:
            self = .active
        }
    }

    func title(language: AppLanguage) -> String {
        switch self {
        case .active:
            language == .english ? "Active" : "运行中"
        case .paused:
            language == .english ? "Paused" : "已暂停"
        }
    }
}

enum AutomationExecutionEnvironment: String, CaseIterable, Identifiable, Equatable, Sendable {
    case worktree
    case local

    var id: String { rawValue }

    init(rawValue: String?) {
        switch rawValue?.lowercased() {
        case Self.local.rawValue:
            self = .local
        default:
            self = .worktree
        }
    }

    func title(language: AppLanguage) -> String {
        switch self {
        case .worktree:
            language == .english ? "Worktree" : "工作树"
        case .local:
            language == .english ? "Local" : "本地"
        }
    }
}

enum AutomationRecurrence: String, CaseIterable, Identifiable, Equatable, Sendable {
    case hourly
    case daily
    case workdays
    case weekly
    case custom

    var id: String { rawValue }

    func title(language: AppLanguage) -> String {
        switch self {
        case .hourly:
            language == .english ? "Hourly" : "每小时"
        case .daily:
            language == .english ? "Daily" : "每天"
        case .workdays:
            language == .english ? "Workdays" : "工作日"
        case .weekly:
            language == .english ? "Weekly" : "每周"
        case .custom:
            language == .english ? "Custom" : "自定义"
        }
    }
}

enum AutomationWeekday: String, CaseIterable, Identifiable, Equatable, Hashable, Sendable {
    case sunday = "SU"
    case monday = "MO"
    case tuesday = "TU"
    case wednesday = "WE"
    case thursday = "TH"
    case friday = "FR"
    case saturday = "SA"

    var id: String { rawValue }

    func shortTitle(language: AppLanguage) -> String {
        switch (self, language) {
        case (.sunday, .english): "Sun"
        case (.monday, .english): "Mon"
        case (.tuesday, .english): "Tue"
        case (.wednesday, .english): "Wed"
        case (.thursday, .english): "Thu"
        case (.friday, .english): "Fri"
        case (.saturday, .english): "Sat"
        case (.sunday, _): "周日"
        case (.monday, _): "周一"
        case (.tuesday, _): "周二"
        case (.wednesday, _): "周三"
        case (.thursday, _): "周四"
        case (.friday, _): "周五"
        case (.saturday, _): "周六"
        }
    }
}

struct AutomationSchedule: Equatable, Sendable {
    var recurrence: AutomationRecurrence
    var hour: Int
    var minute: Int
    var weekdays: Set<AutomationWeekday>
    var customRRule: String

    init(
        recurrence: AutomationRecurrence = .daily,
        hour: Int = 9,
        minute: Int = 0,
        weekdays: Set<AutomationWeekday> = Set(AutomationWeekday.allCases),
        customRRule: String = ""
    ) {
        self.recurrence = recurrence
        self.hour = hour
        self.minute = minute
        self.weekdays = weekdays
        self.customRRule = customRRule
    }

    var isValid: Bool {
        switch recurrence {
        case .weekly:
            !weekdays.isEmpty
        case .custom:
            !normalizedCustomRRule.isEmpty
        case .hourly, .daily, .workdays:
            true
        }
    }

    var rrule: String {
        switch recurrence {
        case .hourly:
            "RRULE:FREQ=HOURLY"
        case .daily:
            "RRULE:FREQ=DAILY;BYHOUR=\(clampedHour);BYMINUTE=\(clampedMinute)"
        case .workdays:
            "RRULE:FREQ=WEEKLY;BYHOUR=\(clampedHour);BYMINUTE=\(clampedMinute);BYDAY=MO,TU,WE,TH,FR"
        case .weekly:
            "RRULE:FREQ=WEEKLY;BYHOUR=\(clampedHour);BYMINUTE=\(clampedMinute);BYDAY=\(orderedWeekdays.map(\.rawValue).joined(separator: ","))"
        case .custom:
            normalizedCustomRRule.hasPrefix("RRULE:") ? normalizedCustomRRule : "RRULE:\(normalizedCustomRRule)"
        }
    }

    func label(language: AppLanguage) -> String {
        AutomationSchedule.displayText(for: rrule, language: language)
    }

    static func displayText(for rrule: String, language: AppLanguage) -> String {
        let parsed = parseRRule(rrule)
        let freq = parsed["FREQ"]?.uppercased()
        let hour = Int(parsed["BYHOUR"] ?? "")
        let minute = Int(parsed["BYMINUTE"] ?? "")
        let time = timeText(hour: hour, minute: minute)
        let byDay = (parsed["BYDAY"] ?? "")
            .split(separator: ",")
            .map { String($0).uppercased() }
            .compactMap(AutomationWeekday.init(rawValue:))

        switch freq {
        case "HOURLY":
            return language == .english ? "Hourly" : "每小时"
        case "DAILY":
            return joined(prefix: language == .english ? "Daily" : "每天", time: time)
        case "WEEKLY":
            if Set(byDay) == Set(AutomationWeekday.allCases) {
                return joined(prefix: language == .english ? "Daily" : "每天", time: time)
            }
            if Set(byDay) == Set([.monday, .tuesday, .wednesday, .thursday, .friday]) {
                return joined(prefix: language == .english ? "Workdays" : "工作日", time: time)
            }
            if byDay.isEmpty {
                return joined(prefix: language == .english ? "Weekly" : "每周", time: time)
            }
            let days = AutomationWeekday.allCases
                .filter { byDay.contains($0) }
                .map { $0.shortTitle(language: language) }
                .joined(separator: language == .english ? ", " : "、")
            return joined(prefix: language == .english ? "Weekly \(days)" : "每周\(days)", time: time)
        default:
            return rrule.isEmpty ? (language == .english ? "Unscheduled" : "未设置") : rrule
        }
    }

    private var clampedHour: Int {
        min(max(hour, 0), 23)
    }

    private var clampedMinute: Int {
        min(max(minute, 0), 59)
    }

    private var orderedWeekdays: [AutomationWeekday] {
        AutomationWeekday.allCases.filter { weekdays.contains($0) }
    }

    private var normalizedCustomRRule: String {
        customRRule.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func joined(prefix: String, time: String?) -> String {
        guard let time else {
            return prefix
        }
        return "\(prefix) \(time)"
    }

    private static func timeText(hour: Int?, minute: Int?) -> String? {
        guard let hour, let minute else {
            return nil
        }
        return String(format: "%02d:%02d", hour, minute)
    }

    private static func parseRRule(_ rrule: String) -> [String: String] {
        let normalized = rrule
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "RRULE:", with: "")
        var result: [String: String] = [:]
        for component in normalized.split(separator: ";") {
            let pair = component.split(separator: "=", maxSplits: 1).map(String.init)
            guard pair.count == 2 else {
                continue
            }
            result[pair[0].uppercased()] = pair[1]
        }
        return result
    }
}

struct AutomationTask: Identifiable, Equatable, Sendable {
    var id: String
    var name: String
    var prompt: String
    var status: AutomationTaskStatus
    var rrule: String
    var model: String
    var reasoningEffort: String
    var executionEnvironment: AutomationExecutionEnvironment
    var cwds: [String]
    var branch: String?
    var createdAtMilliseconds: Int64
    var updatedAtMilliseconds: Int64

    func scheduleText(language: AppLanguage) -> String {
        AutomationSchedule.displayText(for: rrule, language: language)
    }

    func projectText(projects: [ConversationProject]) -> String {
        if let cwd = cwds.first,
           let project = projects.first(where: { $0.path == cwd }) {
            return project.name
        }
        guard let cwd = cwds.first else {
            return ""
        }
        return URL(fileURLWithPath: cwd).lastPathComponent
    }
}

struct AutomationDraft: Equatable, Sendable {
    var title: String
    var prompt: String
    var projectPath: String
    var branch: String?
    var executionEnvironment: AutomationExecutionEnvironment
    var schedule: AutomationSchedule
    var model: String
    var reasoningEffort: String

    var canCreate: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !projectPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && schedule.isValid
    }
}

enum AutomationStoreError: LocalizedError {
    case invalidDraft
    case writeFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidDraft:
            "Automation title, prompt, project, and schedule are required."
        case .writeFailed(let message):
            message
        }
    }
}

struct AutomationStore: Sendable {
    let rootURL: URL

    init(rootURL: URL = AutomationStore.defaultRootURL) {
        self.rootURL = rootURL
    }

    static var defaultRootURL: URL {
        AppDataPaths.default().automationsURL
    }

    func loadAutomations() throws -> [AutomationTask] {
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: rootURL.path) else {
            return []
        }

        let directories = try fileManager.contentsOfDirectory(
            at: rootURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )

        return directories
            .filter { url in
                (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
            }
            .compactMap { directory -> AutomationTask? in
                let fileURL = directory.appending(path: "automation.toml")
                guard let text = try? String(contentsOf: fileURL, encoding: .utf8) else {
                    return nil
                }
                return parseAutomation(text: text, fallbackID: directory.lastPathComponent)
            }
            .sorted { lhs, rhs in
                if lhs.createdAtMilliseconds == rhs.createdAtMilliseconds {
                    return lhs.id < rhs.id
                }
                return lhs.createdAtMilliseconds < rhs.createdAtMilliseconds
            }
    }

    func createAutomation(_ draft: AutomationDraft) throws -> AutomationTask {
        guard draft.canCreate else {
            throw AutomationStoreError.invalidDraft
        }

        let fileManager = FileManager.default
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        let name = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let id = uniqueAutomationID(base: slug(from: name), fileManager: fileManager)

        let task = AutomationTask(
            id: id,
            name: name,
            prompt: draft.prompt.trimmingCharacters(in: .whitespacesAndNewlines),
            status: .active,
            rrule: draft.schedule.rrule,
            model: draft.model.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "main:latest" : draft.model,
            reasoningEffort: draft.reasoningEffort,
            executionEnvironment: draft.executionEnvironment,
            cwds: [draft.projectPath],
            branch: draft.branch?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            createdAtMilliseconds: now,
            updatedAtMilliseconds: now
        )

        let directoryURL = rootURL.appending(path: id, directoryHint: .isDirectory)
        let fileURL = directoryURL.appending(path: "automation.toml")

        do {
            try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
            try tomlString(for: task).write(to: fileURL, atomically: true, encoding: .utf8)
        } catch {
            throw AutomationStoreError.writeFailed(error.localizedDescription)
        }

        return task
    }

    func parseAutomation(text: String, fallbackID: String) -> AutomationTask {
        let values = parseTomlKeyValues(text)
        let id = values["id"]?.stringValue?.nilIfEmpty ?? fallbackID
        let name = values["name"]?.stringValue?.nilIfEmpty ?? id
        let prompt = values["prompt"]?.stringValue ?? ""
        let rrule = values["rrule"]?.stringValue ?? ""
        let cwds = values["cwds"]?.arrayValue ?? []

        return AutomationTask(
            id: id,
            name: name,
            prompt: prompt,
            status: AutomationTaskStatus(rawValue: values["status"]?.stringValue),
            rrule: rrule,
            model: values["model"]?.stringValue ?? "",
            reasoningEffort: values["reasoning_effort"]?.stringValue ?? "",
            executionEnvironment: AutomationExecutionEnvironment(rawValue: values["execution_environment"]?.stringValue),
            cwds: cwds,
            branch: values["branch"]?.stringValue?.nilIfEmpty,
            createdAtMilliseconds: values["created_at"]?.integerValue ?? 0,
            updatedAtMilliseconds: values["updated_at"]?.integerValue ?? 0
        )
    }

    private func uniqueAutomationID(base: String, fileManager: FileManager) -> String {
        let normalizedBase = base.isEmpty ? "automation" : base
        var candidate = normalizedBase
        var suffix = 2

        while fileManager.fileExists(atPath: rootURL.appending(path: candidate, directoryHint: .isDirectory).path) {
            candidate = "\(normalizedBase)-\(suffix)"
            suffix += 1
        }

        return candidate
    }

    private func slug(from value: String) -> String {
        let lowercase = value.lowercased()
        var result = ""
        var previousWasSeparator = false

        for scalar in lowercase.unicodeScalars {
            if CharacterSet.alphanumerics.contains(scalar), scalar.isASCII {
                result.unicodeScalars.append(scalar)
                previousWasSeparator = false
            } else if !previousWasSeparator {
                result.append("-")
                previousWasSeparator = true
            }
        }

        return result.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    private func tomlString(for task: AutomationTask) -> String {
        var lines = [
            "version = 1",
            "id = \"\(escapeToml(task.id))\"",
            "kind = \"cron\"",
            "name = \"\(escapeToml(task.name))\"",
            "prompt = \"\(escapeToml(task.prompt))\"",
            "status = \"\(task.status.rawValue)\"",
            "rrule = \"\(escapeToml(task.rrule))\"",
            "model = \"\(escapeToml(task.model))\"",
            "reasoning_effort = \"\(escapeToml(task.reasoningEffort))\"",
            "execution_environment = \"\(escapeToml(task.executionEnvironment.rawValue))\"",
            "cwds = \(tomlArray(task.cwds))",
        ]
        if let branch = task.branch {
            lines.append("branch = \"\(escapeToml(branch))\"")
        }
        lines.append("created_at = \(task.createdAtMilliseconds)")
        lines.append("updated_at = \(task.updatedAtMilliseconds)")
        return lines.joined(separator: "\n") + "\n"
    }

    private func parseTomlKeyValues(_ text: String) -> [String: TomlValue] {
        var result: [String: TomlValue] = [:]

        for rawLine in text.split(whereSeparator: \.isNewline) {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty, !line.hasPrefix("#") else {
                continue
            }
            let parts = line.split(separator: "=", maxSplits: 1).map(String.init)
            guard parts.count == 2 else {
                continue
            }
            let key = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
            let rawValue = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
            result[key] = parseTomlValue(rawValue)
        }

        return result
    }

    private func parseTomlValue(_ rawValue: String) -> TomlValue {
        if rawValue.hasPrefix("[") {
            return .array(parseTomlStringArray(rawValue))
        }
        if rawValue.hasPrefix("\"") {
            return .string(unescapeTomlString(rawValue))
        }
        if let integer = Int64(rawValue) {
            return .integer(integer)
        }
        return .string(rawValue)
    }

    private func parseTomlStringArray(_ rawValue: String) -> [String] {
        var values: [String] = []
        var current = ""
        var isInsideString = false
        var isEscaped = false

        for character in rawValue {
            if isEscaped {
                current.append(character)
                isEscaped = false
                continue
            }
            if character == "\\" {
                isEscaped = true
                continue
            }
            if character == "\"" {
                if isInsideString {
                    values.append(current)
                    current = ""
                }
                isInsideString.toggle()
                continue
            }
            if isInsideString {
                current.append(character)
            }
        }

        return values
    }

    private func unescapeTomlString(_ rawValue: String) -> String {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let withoutQuotes: Substring
        if trimmed.hasPrefix("\""), trimmed.hasSuffix("\""), trimmed.count >= 2 {
            withoutQuotes = trimmed.dropFirst().dropLast()
        } else {
            withoutQuotes = Substring(trimmed)
        }

        var result = ""
        var isEscaped = false
        for character in withoutQuotes {
            if isEscaped {
                switch character {
                case "n":
                    result.append("\n")
                case "t":
                    result.append("\t")
                default:
                    result.append(character)
                }
                isEscaped = false
                continue
            }
            if character == "\\" {
                isEscaped = true
            } else {
                result.append(character)
            }
        }
        return result
    }

    private func escapeToml(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\t", with: "\\t")
    }

    private func tomlArray(_ values: [String]) -> String {
        "[" + values.map { "\"\(escapeToml($0))\"" }.joined(separator: ", ") + "]"
    }
}

private enum TomlValue: Equatable {
    case string(String)
    case array([String])
    case integer(Int64)

    var stringValue: String? {
        switch self {
        case .string(let value):
            value
        case .array, .integer:
            nil
        }
    }

    var arrayValue: [String]? {
        switch self {
        case .array(let values):
            values
        case .string, .integer:
            nil
        }
    }

    var integerValue: Int64? {
        switch self {
        case .integer(let value):
            value
        case .string, .array:
            nil
        }
    }
}
