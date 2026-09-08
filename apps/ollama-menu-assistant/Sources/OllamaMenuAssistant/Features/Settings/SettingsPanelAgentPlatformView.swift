import SwiftUI

extension SettingsPanelView {
    var agentPlatformSettings: some View {
        VStack(alignment: .leading, spacing: 24) {
            settingsGroup(title: tr("状态", "Status")) {
                settingsCard {
                    agentPlatformHealthSummary
                        .padding(.horizontal, 14)
                        .padding(.vertical, 13)
                }
            }

            settingsGroup(title: tr("Provider / API", "Provider / API")) {
                settingsCard {
                    agentPlatformProviderRow
                    divider
                    agentPlatformSecureTextRow(
                        title: tr("MiniMax API Key", "MiniMax API Key"),
                        description: tr("用于 Axi 智能体平台调用 MiniMax。", "Used by the Axi agent platform to call MiniMax."),
                        text: $agentPlatformMiniMaxAPIKey,
                        placeholder: "sk-..."
                    )
                    divider
                    agentPlatformTextRow(
                        title: tr("MiniMax API URL", "MiniMax API URL"),
                        description: "",
                        text: $agentPlatformMiniMaxAPIURL,
                        placeholder: AxiAgentPlatformPreferences.defaultMiniMaxAPIURL
                    )
                    divider
                    agentPlatformTextRow(
                        title: tr("MiniMax 默认模型", "MiniMax default model"),
                        description: "",
                        text: $agentPlatformMiniMaxDefaultModel,
                        placeholder: AxiAgentPlatformPreferences.defaultMiniMaxModel
                    )
                    divider
                    agentPlatformSecureTextRow(
                        title: tr("OpenAI API Key", "OpenAI API Key"),
                        description: tr("备用远程模型 Provider。", "Fallback remote model provider."),
                        text: $agentPlatformOpenAIAPIKey,
                        placeholder: "sk-..."
                    )
                    divider
                    agentPlatformTextRow(
                        title: tr("OpenAI 默认模型", "OpenAI default model"),
                        description: "",
                        text: $agentPlatformOpenAIDefaultModel,
                        placeholder: AxiAgentPlatformPreferences.defaultOpenAIModel
                    )
                    divider
                    agentPlatformSecureTextRow(
                        title: tr("Qwen API Key", "Qwen API Key"),
                        description: tr("通义千问兼容 OpenAI 接口。", "Qwen OpenAI-compatible endpoint."),
                        text: $agentPlatformQwenAPIKey,
                        placeholder: "sk-..."
                    )
                    divider
                    agentPlatformTextRow(
                        title: tr("Qwen API URL", "Qwen API URL"),
                        description: "",
                        text: $agentPlatformQwenAPIURL,
                        placeholder: AxiAgentPlatformPreferences.defaultQwenAPIURL
                    )
                    divider
                    agentPlatformTextRow(
                        title: tr("Qwen 默认模型", "Qwen default model"),
                        description: "",
                        text: $agentPlatformQwenDefaultModel,
                        placeholder: AxiAgentPlatformPreferences.defaultQwenModel
                    )
                }
            }

            settingsGroup(title: tr("运行参数", "Runtime")) {
                settingsCard {
                    settingsSliderRow(
                        title: tr("默认温度", "Default temperature"),
                        value: $agentPlatformDefaultTemperature,
                        range: 0...2
                    )
                    divider
                    agentPlatformIntegerRow(
                        title: tr("默认最大 token", "Default max tokens"),
                        description: tr("单次远程模型调用的最大输出 token。", "Maximum output tokens for a remote model call."),
                        value: $agentPlatformDefaultMaxTokens,
                        range: 1...8192
                    )
                    divider
                    agentPlatformIntegerRow(
                        title: tr("最大智能体数", "Max agents"),
                        description: tr("智能体平台可同时管理的 agent 上限。", "Maximum agents managed by the agent platform."),
                        value: $agentPlatformMaxAgents,
                        range: 1...50
                    )
                }
            }

            settingsGroup(title: tr("工作树", "Worktrees")) {
                settingsCard {
                    agentPlatformTextRow(
                        title: tr("仓库路径", "Repository path"),
                        description: tr("Axi SubAgent 和工作树操作的默认仓库。", "Default repository for Axi SubAgent and worktree operations."),
                        text: $agentPlatformRepositoryPath,
                        placeholder: AxiAgentPlatformPreferences.defaultRepositoryPath
                    )
                    divider
                    agentPlatformIntegerRow(
                        title: tr("最大 worktree", "Max worktrees"),
                        description: "",
                        value: $agentPlatformMaxWorktrees,
                        range: 1...100
                    )
                    divider
                    agentPlatformIntegerRow(
                        title: tr("最大并行 agent", "Max parallel agents"),
                        description: "",
                        value: $agentPlatformMaxParallelAgents,
                        range: 1...50
                    )
                    divider
                    agentPlatformTextRow(
                        title: tr("默认基础分支", "Default base branch"),
                        description: "",
                        text: $agentPlatformDefaultBaseBranch,
                        placeholder: AxiAgentPlatformPreferences.defaultBaseBranch
                    )
                    divider
                    agentPlatformIntegerRow(
                        title: tr("清理小时数", "Cleanup hours"),
                        description: tr("自动清理旧 worktree 的时间窗口。", "Age window for automatic old worktree cleanup."),
                        value: $agentPlatformWorktreesCleanupHours,
                        range: 1...720
                    )
                }
            }

            settingsGroup(title: tr("Axi MCP", "Axi MCP")) {
                settingsCard {
                    agentPlatformTextRow(
                        title: tr("Command", "Command"),
                        description: tr("用于启动 Axi MCP 服务的可执行文件。", "Executable used to start the Axi MCP service."),
                        text: $agentPlatformMCPCommand,
                        placeholder: AxiAgentPlatformPreferences.defaultMCPCommand
                    )
                    divider
                    agentPlatformTextRow(
                        title: tr("Arguments", "Arguments"),
                        description: tr("启动参数，按 shell 字符串保存。", "Launch arguments stored as a shell string."),
                        text: $agentPlatformMCPArguments,
                        placeholder: ""
                    )
                    divider
                    agentPlatformTextRow(
                        title: tr("工作目录", "Working directory"),
                        description: tr("留空时使用默认 Axi MCP 根目录。", "Leave empty to use the default Axi MCP root."),
                        text: $agentPlatformMCPCWD,
                        placeholder: ""
                    )
                    divider
                    agentPlatformDoubleRow(
                        title: tr("超时秒数", "Timeout seconds"),
                        description: "",
                        value: $agentPlatformMCPTimeoutSeconds,
                        range: 1...120
                    )
                    divider
                    agentPlatformTextRow(
                        title: tr("协议版本", "Protocol version"),
                        description: "",
                        text: $agentPlatformMCPProtocolVersion,
                        placeholder: AxiAgentPlatformPreferences.defaultMCPProtocolVersion
                    )
                }
            }
        }
    }

    var agentPlatformHealthSummary: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 16) {
                settingsRowText(
                    title: tr("原生迁移健康检查", "Native migration health check"),
                    description: tr("检查 Ollama、工作区、MCP 命令和 Provider 配置。", "Checks Ollama, workspace, MCP command, and provider configuration.")
                )
                Spacer(minLength: 18)
                Button {
                    runAgentPlatformHealthCheck()
                } label: {
                    HStack(spacing: 8) {
                        if isCheckingAgentPlatformHealth {
                            ProgressView()
                                .controlSize(.small)
                                .scaleEffect(0.72)
                        }
                        Text(isCheckingAgentPlatformHealth ? tr("检查中", "Checking") : tr("运行检查", "Run check"))
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(AppTheme.textPrimary)
                    .padding(.horizontal, 12)
                    .frame(height: 30)
                    .background(AppTheme.surfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .disabled(isCheckingAgentPlatformHealth)
                .accessibilityIdentifier("settings.agentPlatform.health.run")
            }

            if let agentPlatformHealthReport {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(agentPlatformSeverityColor(agentPlatformHealthReport.overallSeverity))
                            .frame(width: 8, height: 8)
                        Text(agentPlatformSeverityTitle(agentPlatformHealthReport.overallSeverity))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(agentPlatformHealthReport.checkedAt, style: .time)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(AppTheme.textTertiary)
                    }

                    ForEach(agentPlatformHealthReport.checks) { check in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Image(systemName: agentPlatformSeverityIcon(check.severity))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(agentPlatformSeverityColor(check.severity))
                                .frame(width: 14)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(check.title)
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(AppTheme.textPrimary)
                                Text(check.message)
                                    .font(.system(size: 12))
                                    .foregroundStyle(AppTheme.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
                .padding(12)
                .background(AppTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                Text(tr("尚未运行检查。", "No check has been run yet."))
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
    }

    var agentPlatformProviderRow: some View {
        settingsMenuRow(
            title: tr("当前 Provider", "Active provider"),
            description: tr("从旧 Axi 顶部 Backend 控件迁移而来。", "Migrated from the old Axi Backend control."),
            selection: agentPlatformProviderSelection,
            options: AxiAgentPlatformProvider.allCases.map { $0.title(language: appLanguage) }
        )
    }

    var agentPlatformProviderSelection: Binding<String> {
        Binding(
            get: {
                agentPlatformCurrentProvider.title(language: appLanguage)
            },
            set: { newValue in
                if let provider = AxiAgentPlatformProvider.allCases.first(where: { $0.title(language: appLanguage) == newValue }) {
                    agentPlatformProvider = provider.rawValue
                }
            }
        )
    }

    var agentPlatformCurrentProvider: AxiAgentPlatformProvider {
        AxiAgentPlatformProvider(rawValue: agentPlatformProvider) ?? .minimax
    }

    var currentAgentPlatformPreferences: AxiAgentPlatformPreferences {
        AxiAgentPlatformPreferences(
            provider: agentPlatformCurrentProvider,
            minimaxAPIKey: agentPlatformMiniMaxAPIKey,
            minimaxAPIURL: agentPlatformMiniMaxAPIURL,
            minimaxDefaultModel: agentPlatformMiniMaxDefaultModel,
            openAIAPIKey: agentPlatformOpenAIAPIKey,
            openAIDefaultModel: agentPlatformOpenAIDefaultModel,
            qwenAPIKey: agentPlatformQwenAPIKey,
            qwenAPIURL: agentPlatformQwenAPIURL,
            qwenDefaultModel: agentPlatformQwenDefaultModel,
            defaultTemperature: agentPlatformDefaultTemperature,
            defaultMaxTokens: agentPlatformDefaultMaxTokens,
            maxAgents: agentPlatformMaxAgents,
            repositoryPath: agentPlatformRepositoryPath,
            maxWorktrees: agentPlatformMaxWorktrees,
            maxParallelAgents: agentPlatformMaxParallelAgents,
            defaultBaseBranch: agentPlatformDefaultBaseBranch,
            worktreesCleanupHours: agentPlatformWorktreesCleanupHours,
            mcpCommand: agentPlatformMCPCommand,
            mcpArguments: agentPlatformMCPArguments,
            mcpCWD: agentPlatformMCPCWD,
            mcpTimeoutSeconds: agentPlatformMCPTimeoutSeconds,
            mcpProtocolVersion: agentPlatformMCPProtocolVersion
        )
    }

    func runAgentPlatformHealthCheck() {
        guard !isCheckingAgentPlatformHealth else {
            return
        }
        isCheckingAgentPlatformHealth = true
        let preferences = currentAgentPlatformPreferences
        let language = appLanguage
        let service = AxiAgentPlatformHealthService(ollamaClient: appModel.client)
        Task { @MainActor in
            agentPlatformHealthReport = await service.makeReport(
                preferences: preferences,
                language: language
            )
            isCheckingAgentPlatformHealth = false
        }
    }

    func agentPlatformTextRow(
        title: String,
        description: String,
        text: Binding<String>,
        placeholder: String
    ) -> some View {
        agentPlatformInputRow(title: title, description: description) {
            TextField(placeholder, text: text)
                .textFieldStyle(.plain)
        }
    }

    func agentPlatformSecureTextRow(
        title: String,
        description: String,
        text: Binding<String>,
        placeholder: String
    ) -> some View {
        agentPlatformInputRow(title: title, description: description) {
            SecureField(placeholder, text: text)
                .textFieldStyle(.plain)
        }
    }

    func agentPlatformIntegerRow(
        title: String,
        description: String,
        value: Binding<Int>,
        range: ClosedRange<Int>
    ) -> some View {
        HStack(alignment: .center, spacing: 16) {
            settingsRowText(title: title, description: description)
            Spacer(minLength: 18)
            Stepper(value: value, in: range, step: 1) {
                Text("\(value.wrappedValue)")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .frame(width: 48, alignment: .trailing)
            }
            .fixedSize()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    func agentPlatformDoubleRow(
        title: String,
        description: String,
        value: Binding<Double>,
        range: ClosedRange<Double>
    ) -> some View {
        HStack(alignment: .center, spacing: 16) {
            settingsRowText(title: title, description: description)
            Spacer(minLength: 18)
            Stepper(value: value, in: range, step: 1) {
                Text(String(format: "%.0f", value.wrappedValue))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .frame(width: 48, alignment: .trailing)
            }
            .fixedSize()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    func agentPlatformInputRow<Field: View>(
        title: String,
        description: String,
        @ViewBuilder field: () -> Field
    ) -> some View {
        HStack(alignment: .center, spacing: 16) {
            settingsRowText(title: title, description: description)
            Spacer(minLength: 18)
            field()
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .padding(.horizontal, 10)
                .frame(width: 260, height: 30)
                .background(AppTheme.surfaceRaised)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    func agentPlatformSeverityTitle(_ severity: AxiAgentPlatformHealthSeverity) -> String {
        switch severity {
        case .ready:
            return tr("可用", "Ready")
        case .warning:
            return tr("可继续，有警告", "Usable with warnings")
        case .error:
            return tr("需要修复", "Needs attention")
        }
    }

    func agentPlatformSeverityIcon(_ severity: AxiAgentPlatformHealthSeverity) -> String {
        switch severity {
        case .ready:
            return "checkmark.circle.fill"
        case .warning:
            return "exclamationmark.triangle.fill"
        case .error:
            return "xmark.octagon.fill"
        }
    }

    func agentPlatformSeverityColor(_ severity: AxiAgentPlatformHealthSeverity) -> Color {
        switch severity {
        case .ready:
            return .green
        case .warning:
            return .orange
        case .error:
            return .red
        }
    }
}
