import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func automationScheduleCalculatorFindsNextDailyRun() throws {
    let calendar = automationTestCalendar()
    let beforeRun = try date("2026-05-06 08:45", calendar: calendar)
    let afterRun = try date("2026-05-06 09:15", calendar: calendar)
    let rrule = "RRULE:FREQ=DAILY;BYHOUR=9;BYMINUTE=0"

    let nextFromBefore = AutomationScheduleCalculator.nextRun(
        after: beforeRun,
        rrule: rrule,
        calendar: calendar
    )
    let nextFromAfter = AutomationScheduleCalculator.nextRun(
        after: afterRun,
        rrule: rrule,
        calendar: calendar
    )
    let expectedFromBefore = try date("2026-05-06 09:00", calendar: calendar)
    let expectedFromAfter = try date("2026-05-07 09:00", calendar: calendar)

    #expect(nextFromBefore == expectedFromBefore)
    #expect(nextFromAfter == expectedFromAfter)
}

@Test
func automationScheduleCalculatorFindsNextWeeklyRunAcrossSelectedDays() throws {
    let calendar = automationTestCalendar()
    let fridayMorning = try date("2026-05-08 08:30", calendar: calendar)
    let fridayEvening = try date("2026-05-08 20:30", calendar: calendar)
    let rrule = "RRULE:FREQ=WEEKLY;BYHOUR=20;BYMINUTE=0;BYDAY=MO,FR"

    let nextFromMorning = AutomationScheduleCalculator.nextRun(
        after: fridayMorning,
        rrule: rrule,
        calendar: calendar
    )
    let nextFromEvening = AutomationScheduleCalculator.nextRun(
        after: fridayEvening,
        rrule: rrule,
        calendar: calendar
    )
    let expectedFromMorning = try date("2026-05-08 20:00", calendar: calendar)
    let expectedFromEvening = try date("2026-05-11 20:00", calendar: calendar)

    #expect(nextFromMorning == expectedFromMorning)
    #expect(nextFromEvening == expectedFromEvening)
}

@Test
func automationRunPlanUsesLastRunStateToAvoidRepeatingDueTask() throws {
    let calendar = automationTestCalendar()
    let createdAt = try date("2026-05-06 08:00", calendar: calendar)
    let now = try date("2026-05-06 09:05", calendar: calendar)
    let automation = automationTask(
        id: "daily-review",
        createdAt: createdAt,
        rrule: "RRULE:FREQ=DAILY;BYHOUR=9;BYMINUTE=0"
    )

    let duePlan = AutomationScheduleCalculator.makeRunPlan(
        automations: [automation],
        state: AutomationRunState(),
        now: now,
        calendar: calendar
    )
    let completedPlan = AutomationScheduleCalculator.makeRunPlan(
        automations: [automation],
        state: AutomationRunState(lastRunAtMillisecondsByID: [
            automation.id: milliseconds(from: try date("2026-05-06 09:03", calendar: calendar)),
        ]),
        now: now,
        calendar: calendar
    )
    let expectedNextRun = try date("2026-05-07 09:00", calendar: calendar)

    #expect(duePlan.dueTasks.map(\.id) == ["daily-review"])
    #expect(completedPlan.dueTasks.isEmpty)
    #expect(completedPlan.nextRunAt == expectedNextRun)
}

private func automationTask(id: String, createdAt: Date, rrule: String) -> AutomationTask {
    AutomationTask(
        id: id,
        name: id,
        prompt: "Run it.",
        status: .active,
        rrule: rrule,
        model: "main:latest",
        reasoningEffort: "medium",
        executionEnvironment: .worktree,
        cwds: ["/tmp/project"],
        branch: nil,
        createdAtMilliseconds: milliseconds(from: createdAt),
        updatedAtMilliseconds: milliseconds(from: createdAt)
    )
}

private func automationTestCalendar() -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    calendar.locale = Locale(identifier: "en_US_POSIX")
    return calendar
}

private func date(_ value: String, calendar: Calendar) throws -> Date {
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.timeZone = calendar.timeZone
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd HH:mm"
    guard let date = formatter.date(from: value) else {
        throw AutomationSchedulerTestError.invalidDate(value)
    }
    return date
}

private func milliseconds(from date: Date) -> Int64 {
    Int64(date.timeIntervalSince1970 * 1000)
}

private enum AutomationSchedulerTestError: Error {
    case invalidDate(String)
}
