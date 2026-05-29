import Foundation

enum AutomationRunOutcome: Equatable, Sendable {
    case completed
    case skipped
    case retryLater
}

struct AutomationRunState: Codable, Equatable, Sendable {
    var lastRunAtMillisecondsByID: [String: Int64]

    init(lastRunAtMillisecondsByID: [String: Int64] = [:]) {
        self.lastRunAtMillisecondsByID = lastRunAtMillisecondsByID
    }
}

struct AutomationRunStateStore {
    let fileURL: URL

    init(fileURL: URL = AutomationRunStateStore.defaultFileURL) {
        self.fileURL = fileURL
    }

    static var defaultFileURL: URL {
        let baseURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return baseURL
            .appending(path: "OllamaMenuAssistant", directoryHint: .isDirectory)
            .appending(path: "automation-runs.json")
    }

    func load() throws -> AutomationRunState {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return AutomationRunState()
        }
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode(AutomationRunState.self, from: data)
    }

    func save(_ state: AutomationRunState) throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let data = try JSONEncoder().encode(state)
        try data.write(to: fileURL, options: .atomic)
    }
}

struct AutomationRunPlan: Equatable, Sendable {
    var dueTasks: [AutomationTask]
    var nextRunAt: Date?
}

enum AutomationScheduleCalculator {
    static func makeRunPlan(
        automations: [AutomationTask],
        state: AutomationRunState,
        now: Date,
        calendar: Calendar = .current
    ) -> AutomationRunPlan {
        var dueTasks: [AutomationTask] = []
        var nextRunAt: Date?

        for automation in automations where automation.status == .active {
            guard let scheduledAt = nextScheduledRun(for: automation, state: state, calendar: calendar) else {
                continue
            }

            if scheduledAt <= now {
                dueTasks.append(automation)
            } else if nextRunAt == nil || scheduledAt < nextRunAt! {
                nextRunAt = scheduledAt
            }
        }

        return AutomationRunPlan(dueTasks: dueTasks, nextRunAt: nextRunAt)
    }

    static func nextScheduledRun(
        for automation: AutomationTask,
        state: AutomationRunState,
        calendar: Calendar = .current
    ) -> Date? {
        let baselineMilliseconds = state.lastRunAtMillisecondsByID[automation.id]
            ?? max(automation.createdAtMilliseconds, 0)
        let baseline = baselineMilliseconds > 0
            ? Date(timeIntervalSince1970: TimeInterval(baselineMilliseconds) / 1000)
            : Date(timeIntervalSince1970: 0)
        return nextRun(after: baseline, rrule: automation.rrule, calendar: calendar)
    }

    static func nextRun(after date: Date, rrule: String, calendar: Calendar = .current) -> Date? {
        let values = parseRRule(rrule)
        guard let frequency = values["FREQ"]?.uppercased() else {
            return nil
        }

        switch frequency {
        case "HOURLY":
            return nextHourlyRun(after: date, values: values, calendar: calendar)
        case "DAILY":
            return nextDailyRun(after: date, values: values, calendar: calendar)
        case "WEEKLY":
            return nextWeeklyRun(after: date, values: values, calendar: calendar)
        default:
            return nil
        }
    }

    static func parseRRule(_ rrule: String) -> [String: String] {
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

    private static func nextHourlyRun(after date: Date, values: [String: String], calendar: Calendar) -> Date? {
        let minute = clampedMinute(values["BYMINUTE"].flatMap(Int.init) ?? 0)
        let second = 0
        guard let candidate = calendar.nextDate(
            after: date,
            matching: DateComponents(minute: minute, second: second),
            matchingPolicy: .nextTime,
            repeatedTimePolicy: .first,
            direction: .forward
        ) else {
            return nil
        }
        return candidate
    }

    private static func nextDailyRun(after date: Date, values: [String: String], calendar: Calendar) -> Date? {
        let hour = clampedHour(values["BYHOUR"].flatMap(Int.init) ?? 9)
        let minute = clampedMinute(values["BYMINUTE"].flatMap(Int.init) ?? 0)
        return calendar.nextDate(
            after: date,
            matching: DateComponents(hour: hour, minute: minute, second: 0),
            matchingPolicy: .nextTime,
            repeatedTimePolicy: .first,
            direction: .forward
        )
    }

    private static func nextWeeklyRun(after date: Date, values: [String: String], calendar: Calendar) -> Date? {
        let hour = clampedHour(values["BYHOUR"].flatMap(Int.init) ?? 9)
        let minute = clampedMinute(values["BYMINUTE"].flatMap(Int.init) ?? 0)
        let weekdays = weekdayNumbers(from: values["BYDAY"])
        guard !weekdays.isEmpty else {
            return nil
        }

        return weekdays
            .compactMap { weekday in
                calendar.nextDate(
                    after: date,
                    matching: DateComponents(hour: hour, minute: minute, second: 0, weekday: weekday),
                    matchingPolicy: .nextTime,
                    repeatedTimePolicy: .first,
                    direction: .forward
                )
            }
            .min()
    }

    private static func weekdayNumbers(from rawValue: String?) -> [Int] {
        let values = (rawValue ?? "")
            .split(separator: ",")
            .map { String($0).uppercased() }
        return values.compactMap { value in
            switch value {
            case "SU": 1
            case "MO": 2
            case "TU": 3
            case "WE": 4
            case "TH": 5
            case "FR": 6
            case "SA": 7
            default: nil
            }
        }
    }

    private static func clampedHour(_ value: Int) -> Int {
        min(max(value, 0), 23)
    }

    private static func clampedMinute(_ value: Int) -> Int {
        min(max(value, 0), 59)
    }
}

@MainActor
final class AutomationScheduler {
    private let appModel: AppModel
    private let automationStore: AutomationStore
    private let runStateStore: AutomationRunStateStore
    private var scheduleTask: Task<Void, Never>?
    private var notificationObserver: NSObjectProtocol?

    init(
        appModel: AppModel,
        automationStore: AutomationStore = AutomationStore(),
        runStateStore: AutomationRunStateStore = AutomationRunStateStore()
    ) {
        self.appModel = appModel
        self.automationStore = automationStore
        self.runStateStore = runStateStore
    }

    func start() {
        guard scheduleTask == nil else {
            return
        }
        notificationObserver = NotificationCenter.default.addObserver(
            forName: .automationTasksDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.refresh()
            }
        }
        scheduleEvaluation(after: 0)
    }

    func stop() {
        scheduleTask?.cancel()
        scheduleTask = nil
        if let notificationObserver {
            NotificationCenter.default.removeObserver(notificationObserver)
            self.notificationObserver = nil
        }
    }

    func refresh() {
        scheduleEvaluation(after: 0)
    }

    private func scheduleEvaluation(after delay: TimeInterval) {
        scheduleTask?.cancel()
        scheduleTask = Task { [weak self] in
            guard let self else {
                return
            }
            if delay > 0 {
                let nanoseconds = UInt64(delay * 1_000_000_000)
                try? await Task.sleep(nanoseconds: nanoseconds)
                guard !Task.isCancelled else {
                    return
                }
            }
            await self.evaluateAndReschedule()
        }
    }

    private func evaluateAndReschedule() async {
        do {
            var state = try runStateStore.load()
            let automations = try automationStore.loadAutomations()
            let now = Date()
            let plan = AutomationScheduleCalculator.makeRunPlan(
                automations: automations,
                state: state,
                now: now
            )

            if plan.dueTasks.isEmpty {
                scheduleNextEvaluation(nextRunAt: plan.nextRunAt)
                return
            }

            for automation in plan.dueTasks {
                guard !Task.isCancelled else {
                    return
                }
                let outcome = await appModel.runAutomationTask(automation)
                switch outcome {
                case .completed, .skipped:
                    state.lastRunAtMillisecondsByID[automation.id] = Int64(Date().timeIntervalSince1970 * 1000)
                    try runStateStore.save(state)
                case .retryLater:
                    scheduleEvaluation(after: 60)
                    return
                }
            }

            scheduleEvaluation(after: 1)
        } catch {
            appModel.errorMessage = LocalizedStrings.current(defaults: appModel.defaults)(
                "自动化调度器错误：\(error.localizedDescription)",
                "Automation scheduler error: \(error.localizedDescription)"
            )
            scheduleEvaluation(after: 300)
        }
    }

    private func scheduleNextEvaluation(nextRunAt: Date?) {
        guard let nextRunAt else {
            scheduleEvaluation(after: 300)
            return
        }

        let delay = max(1, min(nextRunAt.timeIntervalSinceNow, 86_400))
        scheduleEvaluation(after: delay)
    }
}

extension Notification.Name {
    static let automationTasksDidChange = Notification.Name("automationTasksDidChange")
}
