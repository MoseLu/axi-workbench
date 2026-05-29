import Foundation

extension AppModel {
    func runAutomationTask(_ automation: AutomationTask) async -> AutomationRunOutcome {
        guard availability != .generating else {
            return .retryLater
        }

        guard let project = resolveAutomationProject(automation) else {
            errorMessage = localized(
                "自动化任务“\(automation.name)”没有可用项目，已跳过本次运行。",
                "Automation \"\(automation.name)\" has no available project and was skipped."
            )
            return .skipped
        }

        startNewConversation(in: project.id)
        currentConversation.title = automation.name
        currentConversation.isTitleManuallyEdited = true
        draft = automationPrompt(for: automation, project: project)
        await submitDraft()
        return .completed
    }

    private func resolveAutomationProject(_ automation: AutomationTask) -> ConversationProject? {
        guard let path = automation.cwds.first?.trimmingCharacters(in: .whitespacesAndNewlines),
              !path.isEmpty else {
            return nil
        }

        if let project = projects.first(where: { $0.path == path }) {
            return project
        }

        let url = URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }

        let project = ensureProject(for: url)
        Task {
            await persistLibrary()
        }
        return project
    }

    private func automationPrompt(for automation: AutomationTask, project: ConversationProject) -> String {
        let projectPath = project.path ?? automation.cwds.first ?? ""
        var lines = [
            localized("这是一个自动化任务。", "This is an automation task."),
            localized("任务：\(automation.name)", "Task: \(automation.name)"),
        ]

        if !projectPath.isEmpty {
            lines.append(localized("项目：\(projectPath)", "Project: \(projectPath)"))
        }
        if let branch = automation.branch?.trimmingCharacters(in: .whitespacesAndNewlines),
           !branch.isEmpty {
            lines.append(localized("目标分支：\(branch)", "Target branch: \(branch)"))
            lines.append(localized(
                "除非任务明确要求，否则不要在后台切换 Git 分支；需要分支信息时先检查当前仓库状态。",
                "Do not switch Git branches in the background unless the task explicitly requires it; inspect repository state first when branch context matters."
            ))
        }
        lines.append("")
        lines.append(automation.prompt)
        return lines.joined(separator: "\n")
    }
}
