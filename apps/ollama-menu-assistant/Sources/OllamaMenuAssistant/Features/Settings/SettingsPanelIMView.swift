import Foundation
import SwiftUI

extension SettingsPanelView {
    var mcpServersSettings: some View {
        VStack(alignment: .leading, spacing: 22) {
            settingsGroup(title: tr("服务器", "Servers")) {
                settingsCard {
                    mcpWeChatServerRow

                    ForEach(mcpPluginServerRows) { row in
                        divider
                        MCPSettingsServerRow(row: row)
                    }
                }
            }
        }
        .onAppear {
            Task {
                await appModel.refreshMCPBrokerStatus()
            }
        }
    }

    private var mcpWeChatServerRow: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: imStatusSystemName)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(imServerTint)
                .frame(width: 38, height: 38)
                .background(AppTheme.surfaceRaised)
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 5) {
                Text(tr("微信 IM", "WeChat IM"))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)

                Text(imServerDescription)
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)
                    .truncationMode(.tail)

                Text(imServerMetadata)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)
                    .truncationMode(.tail)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)

            Spacer(minLength: 12)

            if appModel.isIMBridgeEnabled {
                Button(tr("重连", "Reconnect")) {
                    appModel.refreshIMBridge()
                }
                .font(.system(size: 12, weight: .medium))
                .buttonStyle(.plain)
                .foregroundStyle(AppTheme.textPrimary)
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(AppTheme.surfaceRaised)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .fixedSize(horizontal: true, vertical: false)
            }

            Text(imStatusTitle)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(imServerTint)
                .lineLimit(1)
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(AppTheme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .fixedSize(horizontal: true, vertical: false)

            settingsSwitch(
                isOn: Binding(
                    get: { appModel.isIMBridgeEnabled },
                    set: { appModel.setIMBridgeEnabled($0) }
                )
            )
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }

    private var mcpPluginServerRows: [MCPSettingsServerRowModel] {
        let statuses = Dictionary(uniqueKeysWithValues: appModel.mcpServerStatuses.map { ($0.id, $0) })

        return appModel.availablePlugins
            .filter(\.hasMCPServer)
            .sorted { lhs, rhs in
                lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
            }
            .flatMap { plugin in
                appModel.mcpToolBroker.loadServers(for: plugin)
                    .sorted { lhs, rhs in
                        lhs.serverName.localizedCaseInsensitiveCompare(rhs.serverName) == .orderedAscending
                    }
                    .map { server in
                        let status = statuses["\(plugin.pluginID):\(server.serverName)"]
                        let state = mcpSettingsState(for: plugin, status: status)
                        return MCPSettingsServerRowModel(
                            id: "\(plugin.pluginID):\(server.serverName)",
                            title: server.serverName,
                            subtitle: plugin.displayName,
                            detail: mcpSettingsDetail(for: plugin, status: status),
                            systemName: state.systemName,
                            statusTitle: state.title,
                            tint: state.tint
                        )
                    }
            }
    }

    private func mcpSettingsState(
        for plugin: PluginSummary,
        status: MCPServerStatus?
    ) -> (title: String, systemName: String, tint: Color) {
        guard plugin.isEnabled else {
            return (tr("关闭", "Off"), "pause.circle", AppTheme.textTertiary)
        }

        switch status?.state {
        case .available:
            return (tr("可用", "Available"), "checkmark.circle", AppTheme.accent)
        case .failed:
            return (tr("失败", "Failed"), "exclamationmark.triangle", AppTheme.destructive)
        case nil:
            return (tr("检测中", "Checking"), "arrow.triangle.2.circlepath", AppTheme.textTertiary)
        }
    }

    private func mcpSettingsDetail(for plugin: PluginSummary, status: MCPServerStatus?) -> String {
        guard plugin.isEnabled else {
            return tr("插件已关闭", "Plugin is off")
        }

        if let message = status?.message, !message.isEmpty {
            return message
        }

        if let status {
            return tr("\(status.toolCount) 个工具", "\(status.toolCount) tools")
        }

        return tr("等待服务器状态", "Waiting for server status")
    }

    private var imServerTint: Color {
        switch appModel.imBridgeStatus.state {
        case .disabled:
            AppTheme.textTertiary
        case .waitingForCredentials, .connecting:
            AppTheme.textSecondary
        case .connected:
            AppTheme.accent
        case .failed:
            AppTheme.destructive
        }
    }

    private var imServerDescription: String {
        if appModel.imBridgeStatus.detail.isEmpty {
            return tr(
                "读取 MiniMax/Mavis 微信凭证，并把微信消息交给当前模型回复。",
                "Reads MiniMax/Mavis WeChat credentials and routes WeChat messages to the current model."
            )
        }
        return appModel.imBridgeStatus.detail
    }

    private var imServerMetadata: String {
        [
            "\(tr("凭证", "Credentials")): \(imCredentialSourceValue)",
            "\(tr("会话", "Chat")): \(imChatValue)",
            "\(tr("消息", "Messages")): \(appModel.imBridgeStatus.processedMessageCount)",
            "\(tr("最近", "Last")): \(imLastMessageValue)",
        ].joined(separator: " · ")
    }

    private var imChatValue: String {
        appModel.imBridgeStatus.activeChatID.map(shortSettingsValue) ?? tr("未收到消息", "No message yet")
    }

    private var imLastMessageValue: String {
        appModel.imBridgeStatus.lastMessageAt.map(formatIMDate) ?? tr("无", "None")
    }

    var imStatusTitle: String {
        switch appModel.imBridgeStatus.state {
        case .disabled:
            tr("关闭", "Off")
        case .waitingForCredentials:
            tr("等待凭证", "Waiting")
        case .connecting:
            tr("连接中", "Connecting")
        case .connected:
            tr("已连接", "Connected")
        case .failed:
            tr("失败", "Failed")
        }
    }

    var imStatusSystemName: String {
        switch appModel.imBridgeStatus.state {
        case .disabled:
            "pause.circle"
        case .waitingForCredentials:
            "key"
        case .connecting:
            "arrow.triangle.2.circlepath"
        case .connected:
            "checkmark.circle"
        case .failed:
            "exclamationmark.triangle"
        }
    }

    var imCredentialSourceValue: String {
        guard let path = appModel.imBridgeStatus.credentialSource else {
            return tr("未加载", "Not loaded")
        }
        return shortSettingsValue(path.replacingOccurrences(of: NSHomeDirectory(), with: "~"))
    }

    var petOptions: [String] {
        appModel.petOptionTitles(language: appLanguage)
    }

    var petSelectionBinding: Binding<String> {
        Binding(
            get: {
                appModel.petSelectionTitle(language: appLanguage)
            },
            set: { title in
                appModel.setPetSelection(appModel.petSelection(matching: title, language: appLanguage))
            }
        )
    }

    var petDescription: String {
        if let message = appModel.petStatusMessage {
            return message
        }

        if appModel.petSelections.isEmpty {
            return appModel.isPetRunning
                ? tr("正在关闭桌面宠物", "Turning off the desktop pet")
                : tr("桌面宠物已关闭", "The desktop pet is off")
        }

        if let missingSelection = appModel.petSelections.first(where: { selection in
            !appModel.availablePets.contains { $0.id == selection.id }
        }) {
            let path = appModel.petDirectoryURL(for: missingSelection)
                .path
                .replacingOccurrences(of: NSHomeDirectory(), with: "~")
            return tr("未找到宠物资源：\(path)", "Pet assets not found: \(path)")
        }

        let summary = appModel.petSelectionSummary(language: appLanguage)
        return appModel.isPetRunning
            ? tr("\(summary) 正在运行，桌面点击会编队跑向光标", "\(summary) is running. Desktop clicks call the group to the cursor.")
            : tr("选择后会启动桌面宠物，最多 3 个", "Selecting pets starts them on the desktop, up to 3")
    }

    func shortSettingsValue(_ value: String) -> String {
        guard value.count > 42 else {
            return value
        }
        return "..." + String(value.suffix(39))
    }

    func formatIMDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: appLanguage == .english ? "en_US" : "zh_Hans_CN")
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

private struct MCPSettingsServerRow: View {
    let row: MCPSettingsServerRowModel

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: row.systemName)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(row.tint)
                .frame(width: 38, height: 38)
                .background(AppTheme.surfaceRaised)
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 5) {
                Text(row.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)

                Text(row.subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)
                    .truncationMode(.tail)

                Text(row.detail)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)
                    .truncationMode(.tail)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)

            Spacer(minLength: 12)

            Text(row.statusTitle)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(row.tint)
                .lineLimit(1)
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(AppTheme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.border, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }
}

private struct MCPSettingsServerRowModel: Identifiable {
    var id: String
    var title: String
    var subtitle: String
    var detail: String
    var systemName: String
    var statusTitle: String
    var tint: Color
}
