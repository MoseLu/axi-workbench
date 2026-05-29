import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func automationStoreParsesAssistantAutomationToml() throws {
    let text = """
    version = 1
    id = "skill-progression-map"
    kind = "cron"
    name = "Skill progression map"
    prompt = "Suggest next skills."
    status = "ACTIVE"
    rrule = "RRULE:FREQ=WEEKLY;BYHOUR=20;BYMINUTE=0;BYDAY=SU,MO,TU,WE,TH,FR,SA"
    model = "gpt-5.5"
    reasoning_effort = "high"
    execution_environment = "local"
    cwds = ["/Volumes/code/workspace/products/ielts-vocab"]
    created_at = 1777892912907
    updated_at = 1777892944837
    """

    let automation = AutomationStore(rootURL: temporaryAutomationRoot()).parseAutomation(
        text: text,
        fallbackID: "fallback"
    )

    #expect(automation.id == "skill-progression-map")
    #expect(automation.name == "Skill progression map")
    #expect(automation.status == .active)
    #expect(automation.executionEnvironment == .local)
    #expect(automation.reasoningEffort == "high")
    #expect(automation.cwds == ["/Volumes/code/workspace/products/ielts-vocab"])
    #expect(automation.scheduleText(language: .simplifiedChinese) == "每天 20:00")
}

@Test
func automationStoreCreatesTomlAndLoadsItBack() throws {
    let root = temporaryAutomationRoot()
    defer {
        try? FileManager.default.removeItem(at: root)
    }

    let store = AutomationStore(rootURL: root)
    let draft = AutomationDraft(
        title: "Daily Review",
        prompt: "Summarize yesterday's commits.",
        projectPath: "/tmp/example-project",
        branch: "main",
        executionEnvironment: .worktree,
        schedule: AutomationSchedule(recurrence: .daily, hour: 9, minute: 30),
        model: "gpt-5.5",
        reasoningEffort: "medium"
    )

    let created = try store.createAutomation(draft)
    let loaded = try store.loadAutomations()
    let automationFile = root
        .appending(path: created.id, directoryHint: .isDirectory)
        .appending(path: "automation.toml")
    let text = try String(contentsOf: automationFile, encoding: .utf8)

    #expect(created.id == "daily-review")
    #expect(loaded.count == 1)
    #expect(loaded.first?.name == "Daily Review")
    #expect(loaded.first?.branch == "main")
    #expect(loaded.first?.rrule == "RRULE:FREQ=DAILY;BYHOUR=9;BYMINUTE=30")
    #expect(text.contains("execution_environment = \"worktree\""))
    #expect(text.contains("branch = \"main\""))
}

private func temporaryAutomationRoot() -> URL {
    FileManager.default.temporaryDirectory
        .appending(path: "OllamaMenuAssistantAutomationTests-\(UUID().uuidString)", directoryHint: .isDirectory)
}
