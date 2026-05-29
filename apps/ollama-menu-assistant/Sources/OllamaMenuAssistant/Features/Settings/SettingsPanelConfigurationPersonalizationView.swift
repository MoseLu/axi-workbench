import AppKit
import SwiftUI

extension SettingsPanelView {
    var configurationSettings: some View {
        VStack(alignment: .leading, spacing: 30) {
            linkedSectionDescription(
                text: tr("配置审批策略和沙盒设置", "Configure approval policies and sandbox settings"),
                linkText: tr("了解更多", "Learn more")
            )

            settingsGroup(title: tr("自定义 config.toml 设置", "Custom config.toml settings")) {
                HStack(alignment: .center, spacing: 12) {
                    configScopeMenu

                    Spacer(minLength: 18)

                    Button {
                        openSelectedConfigToml()
                    } label: {
                        HStack(spacing: 6) {
                            Text(tr("打开 config.toml", "Open config.toml"))
                            Image(systemName: "arrow.up.forward")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                    }
                    .buttonStyle(.plain)
                }

                settingsCard {
                    settingsMenuRow(
                        title: tr("批准策略", "Approval policy"),
                        description: tr("选择 Assistant 何时请求批准", "Choose when Assistant asks for approval"),
                        selection: enumSelection(
                            storage: $configurationApprovalPolicy,
                            values: AssistantSettingsPreferences.ApprovalPolicy.allCases,
                            title: { $0.title(language: appLanguage) }
                        ),
                        options: AssistantSettingsPreferences.ApprovalPolicy.allCases.map { $0.title(language: appLanguage) }
                    )
                    divider
                    settingsMenuRow(
                        title: tr("沙盒设置", "Sandbox settings"),
                        description: tr("选择 Assistant 的命令执行权限", "Choose Assistant command execution permissions"),
                        selection: enumSelection(
                            storage: $configurationSandboxMode,
                            values: AssistantSettingsPreferences.SandboxMode.allCases,
                            title: { $0.title(language: appLanguage) }
                        ),
                        options: AssistantSettingsPreferences.SandboxMode.allCases.map { $0.title(language: appLanguage) }
                    )
                }

                if let configurationStatusMessage {
                    Text(configurationStatusMessage)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                }
            }

            settingsGroup(title: tr("工作空间依赖项", "Workspace dependencies")) {
                settingsCard {
                    settingsValueRow(title: tr("当前版本", "Current version"), value: appVersionText)
                    divider
                    settingsToggleRow(
                        title: tr("Assistant 依赖项", "Assistant dependencies"),
                        description: tr("允许 Assistant 安装并提供附带的 Node.js 和 Python 工具", "Allow Assistant to install and provide bundled Node.js and Python tools"),
                        isOn: $bundledDependenciesEnabled
                    )
                    divider
                    settingsActionValueRow(
                        title: tr("诊断 Assistant 工作空间中的问题", "Diagnose Assistant workspace issues"),
                        description: tr("检查当前捆绑包并记录诊断日志", "Check the current bundle and record diagnostic notes"),
                        value: "",
                        buttonTitle: tr("诊断", "Diagnose"),
                        action: diagnoseAssistantWorkspace
                    )
                    divider
                    settingsActionValueRow(
                        title: tr("重置并安装工作空间", "Reset and install workspace"),
                        description: tr("删除本地捆绑包，重新下载后再重新加载工具", "Remove the local bundle, then download and reload tools"),
                        value: "",
                        buttonTitle: tr("重新安装", "Reinstall"),
                        action: resetAssistantWorkspaceInstall
                    )
                }
            }
        }
    }

    var personalizationSettings: some View {
        VStack(alignment: .leading, spacing: 30) {
            settingsCard {
                personalityRow
            }

            VStack(alignment: .leading, spacing: 14) {
                linkedSectionDescription(
                    title: tr("自定义指令", "Custom instructions"),
                    text: tr("为你的项目向 Assistant 提供额外指令和上下文。", "Provide extra instructions and context to Assistant for your projects."),
                    linkText: tr("了解更多", "Learn more")
                )

                TextEditor(text: $customInstructionsDraft)
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.textPrimary)
                    .scrollContentBackground(.hidden)
                    .background(AppTheme.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(AppTheme.border, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .frame(minHeight: 250)
                    .overlay(alignment: .topLeading) {
                        if customInstructionsDraft.isEmpty {
                            Text(tr("添加自定义指令...", "Add custom instructions..."))
                                .font(.system(size: 13))
                                .foregroundStyle(AppTheme.textTertiary)
                                .padding(.top, 12)
                                .padding(.leading, 14)
                                .allowsHitTesting(false)
                        }
                    }

                HStack {
                    if let personalizationStatusMessage {
                        Text(personalizationStatusMessage)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(AppTheme.textTertiary)
                    }

                    Spacer(minLength: 12)

                    Button(tr("保存", "Save")) {
                        saveCustomInstructions()
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .buttonStyle(.plain)
                    .foregroundStyle(canSaveCustomInstructions ? AppTheme.textPrimary : AppTheme.textTertiary)
                    .padding(.horizontal, 14)
                    .frame(height: 30)
                    .background(canSaveCustomInstructions ? AppTheme.surfaceRaised : AppTheme.surfaceRaised.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .disabled(!canSaveCustomInstructions)
                }
            }

            settingsGroup(title: tr("记忆（实验性）", "Memory (experimental)")) {
                linkedSectionDescription(
                    text: tr("设置 Assistant 如何收集、保留和整合记忆。", "Configure how Assistant collects, keeps, and consolidates memories."),
                    linkText: tr("了解更多", "Learn more")
                )

                settingsCard {
                    settingsToggleRow(
                        title: tr("启用记忆", "Enable memory"),
                        description: tr("从聊天中生成新记忆，并将其带入新聊天", "Generate memories from chats and bring them into new chats"),
                        isOn: $memoryEnabled
                    )
                    divider
                    settingsToggleRow(
                        title: tr("跳过工具辅助对话", "Skip tool-assisted chats"),
                        description: tr("请勿从使用了 MCP 工具或网页搜索的对话中生成记忆", "Do not create memories from chats that used MCP tools or web search"),
                        isOn: $skipToolAssistedMemory
                    )
                    divider
                    settingsDestructiveActionRow(
                        title: tr("重置记忆", "Reset memory"),
                        description: tr("删除所有 Assistant 记忆", "Delete all Assistant memories"),
                        buttonTitle: tr("重置", "Reset"),
                        action: resetAssistantMemory
                    )
                }
            }
        }
        .onAppear {
            customInstructionsDraft = customInstructions
        }
    }

    private var personalityRow: some View {
        HStack(alignment: .center, spacing: 14) {
            settingsRowText(
                title: tr("个性", "Personality"),
                description: tr("选择 Assistant 回复的默认语气", "Choose the default tone for Assistant replies")
            )
            Spacer(minLength: 18)
            personalityMenu
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }

    private var configScopeMenu: some View {
        Menu {
            ForEach(AssistantSettingsPreferences.ConfigScope.allCases, id: \.rawValue) { scope in
                Button {
                    configurationScope = scope.rawValue
                } label: {
                    HStack {
                        Text(scope.title(language: appLanguage))
                        if scope.rawValue == configurationScope {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            settingsPillMenuLabel(
                title: AssistantSettingsPreferences.ConfigScope(storedValue: configurationScope).title(language: appLanguage),
                width: 250
            )
        }
        .buttonStyle(.plain)
    }

    private var personalityMenu: some View {
        Menu {
            ForEach(AssistantSettingsPreferences.PersonalityTone.allCases, id: \.rawValue) { tone in
                Button {
                    personalityTone = tone.rawValue
                } label: {
                    VStack(alignment: .leading) {
                        Text(tone.title(language: appLanguage))
                        Text(tone.subtitle(language: appLanguage))
                    }
                }
            }
        } label: {
            settingsPillMenuLabel(
                title: AssistantSettingsPreferences.PersonalityTone(storedValue: personalityTone).title(language: appLanguage),
                width: 230
            )
        }
        .buttonStyle(.plain)
    }

    private func settingsPillMenuLabel(title: String, width: CGFloat) -> some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)

            Spacer(minLength: 8)

            Image(systemName: "chevron.down")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
        }
        .padding(.horizontal, 12)
        .frame(width: width, height: 30)
        .background(AppTheme.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .contentShape(RoundedRectangle(cornerRadius: 8))
    }

    private func linkedSectionDescription(title: String? = nil, text: String, linkText: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            if let title {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
            }

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(text)
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)

                Text(linkText)
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.accent)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
    }

    private func settingsDestructiveActionRow(
        title: String,
        description: String,
        buttonTitle: String,
        action: @escaping () -> Void
    ) -> some View {
        HStack(alignment: .center, spacing: 14) {
            settingsRowText(title: title, description: description)

            Spacer(minLength: 18)

            Button(action: action) {
                Text(buttonTitle)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AppTheme.destructivePrimary)
                    .lineLimit(1)
                    .padding(.horizontal, 12)
                    .frame(height: 28)
                    .background(AppTheme.redSoft)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }

    private func enumSelection<Value: RawRepresentable>(
        storage: Binding<String>,
        values: [Value],
        title: @escaping (Value) -> String
    ) -> Binding<String> where Value.RawValue == String {
        Binding(
            get: {
                values.first(where: { $0.rawValue == storage.wrappedValue }).map(title) ?? title(values[0])
            },
            set: { newValue in
                if let value = values.first(where: { title($0) == newValue }) {
                    storage.wrappedValue = value.rawValue
                }
            }
        )
    }

    private var appVersionText: String {
        let shortVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String

        switch (shortVersion, build) {
        case let (short?, build?) where short != build:
            return "\(short) (\(build))"
        case let (short?, _):
            return short
        default:
            return "1.0"
        }
    }

    private var canSaveCustomInstructions: Bool {
        customInstructionsDraft != customInstructions
    }

    private func saveCustomInstructions() {
        customInstructions = customInstructionsDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        customInstructionsDraft = customInstructions
        personalizationStatusMessage = tr("自定义指令已保存", "Custom instructions saved")
    }

    private func resetAssistantMemory() {
        Task {
            do {
                try await appModel.resetAssistantMemory()
                await MainActor.run {
                    memoryEnabled = false
                    skipToolAssistedMemory = false
                    personalizationStatusMessage = tr("记忆已重置", "Memory reset")
                }
            } catch {
                await MainActor.run {
                    personalizationStatusMessage = error.localizedDescription
                }
            }
        }
    }

    private func diagnoseAssistantWorkspace() {
        let hasConfig = FileManager.default.fileExists(atPath: appModel.appDataPaths.configTomlURL.path)
        let dependencyState = bundledDependenciesEnabled ? tr("依赖项已启用", "dependencies enabled") : tr("依赖项已关闭", "dependencies disabled")
        configurationStatusMessage = hasConfig
            ? tr("诊断完成：config.toml 存在，\(dependencyState)。", "Diagnostics complete: config.toml exists, \(dependencyState).")
            : tr("诊断完成：尚未创建 config.toml，\(dependencyState)。", "Diagnostics complete: config.toml has not been created, \(dependencyState).")
    }

    private func resetAssistantWorkspaceInstall() {
        do {
            try appModel.appDataPaths.createBaseDirectories()
            configurationStatusMessage = tr("工作空间已重置，工具将在下次使用时重新加载。", "Workspace reset; tools will reload next time they are used.")
        } catch {
            configurationStatusMessage = error.localizedDescription
        }
    }

    private func openSelectedConfigToml() {
        do {
            let url = try selectedConfigTomlURL()
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            if !FileManager.default.fileExists(atPath: url.path) {
                let text = AssistantSettingsPreferences.defaultConfigToml(
                    approvalPolicy: AssistantSettingsPreferences.ApprovalPolicy(storedValue: configurationApprovalPolicy),
                    sandboxMode: AssistantSettingsPreferences.SandboxMode(storedValue: configurationSandboxMode),
                    bundledDependenciesEnabled: bundledDependenciesEnabled
                )
                try text.write(to: url, atomically: true, encoding: .utf8)
            }
            NSWorkspace.shared.open(url)
            configurationStatusMessage = tr("已打开 \(url.lastPathComponent)", "Opened \(url.lastPathComponent)")
        } catch {
            configurationStatusMessage = error.localizedDescription
        }
    }

    private func selectedConfigTomlURL() throws -> URL {
        switch AssistantSettingsPreferences.ConfigScope(storedValue: configurationScope) {
        case .user:
            return appModel.appDataPaths.configTomlURL
        case .workspace:
            guard let path = appModel.currentProject?.path,
                  !path.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                return appModel.appDataPaths.configTomlURL
            }
            return URL(fileURLWithPath: path, isDirectory: true)
                .appending(path: ".assistant", directoryHint: .isDirectory)
                .appending(path: "config.toml")
        }
    }
}
