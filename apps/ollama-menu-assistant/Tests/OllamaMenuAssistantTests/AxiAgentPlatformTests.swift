import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func agentPlatformPreferenceDefaultsMatchMigratedAxiConfig() {
    let preferences = AxiAgentPlatformPreferences()

    #expect(preferences.provider == .minimax)
    #expect(preferences.minimaxAPIURL == "https://api.minimaxi.com/v1")
    #expect(preferences.minimaxDefaultModel == "abab6-chat")
    #expect(preferences.openAIDefaultModel == "gpt-4")
    #expect(preferences.qwenAPIURL == "https://dashscope.aliyuncs.com/compatible-mode/v1")
    #expect(preferences.qwenDefaultModel == "qwen-plus")
    #expect(preferences.defaultTemperature == 0.7)
    #expect(preferences.defaultMaxTokens == 2048)
    #expect(preferences.maxAgents == 10)
    #expect(preferences.repositoryPath == "./projects")
    #expect(preferences.maxWorktrees == 10)
    #expect(preferences.maxParallelAgents == 8)
    #expect(preferences.defaultBaseBranch == "main")
    #expect(preferences.worktreesCleanupHours == 24)
    #expect(preferences.mcpCommand == "node")
    #expect(preferences.mcpTimeoutSeconds == 5.0)
    #expect(preferences.mcpProtocolVersion == "2024-11-05")
}

@Test
func agentPlatformPreferenceKeysUseStableNamespace() {
    #expect(AppPreferenceKeys.AgentPlatform.provider == "settings.agentPlatform.provider")
    #expect(AppPreferenceKeys.AgentPlatform.minimaxAPIKey == "settings.agentPlatform.minimax.apiKey")
    #expect(AppPreferenceKeys.AgentPlatform.repositoryPath == "settings.agentPlatform.worktree.repositoryPath")
    #expect(AppPreferenceKeys.AgentPlatform.mcpCommand == "settings.agentPlatform.mcp.command")
}

@Test
func agentPlatformSettingsSectionIsRoutable() {
    #expect(SettingsSection.allCases.contains(.agentPlatform))
    #expect(SettingsSection.agentPlatform.title(language: .simplifiedChinese) == "智能体平台")
    #expect(SettingsSection.agentPlatform.title(language: .english) == "Agent Platform")
}

@Test
func agentPlatformHealthReportsReadyWorkspaceAndMissingProviderWarning() async throws {
    let root = try makeAgentPlatformWorkspace(hasGitMetadata: true)
    defer { try? FileManager.default.removeItem(at: root) }

    let service = AxiAgentPlatformHealthService(
        commandPathEnvironment: "/bin:/usr/bin",
        ollamaProbe: { .success }
    )
    let preferences = AxiAgentPlatformPreferences(
        minimaxAPIKey: "",
        repositoryPath: root.path,
        mcpCommand: "sh"
    )

    let report = await service.makeReport(preferences: preferences, language: .english)

    #expect(report.overallSeverity == .warning)
    #expect(report.checks.first { $0.id == "ollama" }?.severity == .ready)
    #expect(report.checks.first { $0.id == "workspace" }?.severity == .ready)
    #expect(report.checks.first { $0.id == "mcp" }?.severity == .ready)
    #expect(report.checks.first { $0.id == "provider" }?.severity == .warning)
}

@Test
func agentPlatformHealthRejectsInvalidWorkspaceAndMissingMCPCommand() async {
    let service = AxiAgentPlatformHealthService(
        commandPathEnvironment: "",
        ollamaProbe: { .success }
    )
    let preferences = AxiAgentPlatformPreferences(
        minimaxAPIKey: "key",
        repositoryPath: "/path/that/does/not/exist/\(UUID().uuidString)",
        mcpCommand: "definitely-not-installed-\(UUID().uuidString)"
    )

    let report = await service.makeReport(preferences: preferences, language: .english)

    #expect(report.overallSeverity == .error)
    #expect(report.checks.first { $0.id == "workspace" }?.severity == .error)
    #expect(report.checks.first { $0.id == "mcp" }?.severity == .error)
}

@Test
func agentPlatformHealthWarnsWhenWorkspaceHasNoGitMetadata() async throws {
    let root = try makeAgentPlatformWorkspace(hasGitMetadata: false)
    defer { try? FileManager.default.removeItem(at: root) }

    let service = AxiAgentPlatformHealthService(
        commandPathEnvironment: "/bin:/usr/bin",
        ollamaProbe: { .success }
    )
    let preferences = AxiAgentPlatformPreferences(
        minimaxAPIKey: "key",
        repositoryPath: root.path,
        mcpCommand: "sh"
    )

    let report = await service.makeReport(preferences: preferences, language: .english)

    #expect(report.overallSeverity == .warning)
    #expect(report.checks.first { $0.id == "workspace" }?.severity == .warning)
    #expect(report.checks.first { $0.id == "provider" }?.severity == .ready)
}

private func makeAgentPlatformWorkspace(hasGitMetadata: Bool) throws -> URL {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "OllamaMenuAssistantAgentPlatform-\(UUID().uuidString)", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    if hasGitMetadata {
        try FileManager.default.createDirectory(at: root.appending(path: ".git"), withIntermediateDirectories: true)
    }
    return root
}
