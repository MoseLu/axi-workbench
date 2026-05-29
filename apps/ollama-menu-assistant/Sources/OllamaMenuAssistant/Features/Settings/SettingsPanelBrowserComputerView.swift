import AppKit
import SwiftUI

private enum SettingsBuiltinPlugin {
    case browserUse
    case computerUse

    var displayName: String {
        switch self {
        case .browserUse:
            "Browser Use"
        case .computerUse:
            "Computer Use"
        }
    }

    func description(language: AppLanguage) -> String {
        switch self {
        case .browserUse:
            language == .english ? "Control the in-app browser with Assistant" : "Control the in-app browser with Assistant"
        case .computerUse:
            language == .english ? "Control Mac apps from Assistant" : "Control Mac apps from Assistant"
        }
    }

    var idCandidates: [String] {
        switch self {
        case .browserUse:
            ["browser-use@openai-bundled", "browser-use", "browser"]
        case .computerUse:
            ["computer-use@openai-bundled", "computer-use", "computer"]
        }
    }

    var iconName: String {
        switch self {
        case .browserUse:
            "location.north.fill"
        case .computerUse:
            "cursorarrow.click.2"
        }
    }

    var gradientColors: [Color] {
        switch self {
        case .browserUse:
            [
                Color(red: 0.05, green: 0.42, blue: 0.95),
                Color(red: 0.12, green: 0.66, blue: 1.00),
            ]
        case .computerUse:
            [
                Color(red: 0.25, green: 0.74, blue: 1.00),
                Color(red: 0.93, green: 0.52, blue: 1.00),
                Color(red: 1.00, green: 0.76, blue: 0.73),
            ]
        }
    }
}

extension SettingsPanelView {
    var browserUsageSettings: some View {
        VStack(alignment: .leading, spacing: 30) {
            settingsGroup(title: tr("插件", "Plugin")) {
                settingsCard {
                    settingsBuiltinPluginRow(.browserUse)
                }
            }

            settingsGroup(title: tr("浏览器", "Browser")) {
                settingsCard {
                    browserDataRow
                }

                if let browserDataStatusMessage {
                    Text(browserDataStatusMessage)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                }
            }

            settingsGroup(title: tr("权限", "Permissions")) {
                settingsCard {
                    settingsMenuRow(
                        title: tr("审批", "Approval"),
                        description: tr("选择 Assistant 在打开网站前是否请求批准", "Choose whether Assistant asks for approval before opening websites"),
                        selection: permissionPolicySelection($browserNavigationApproval),
                        options: permissionPolicyOptions
                    )
                    divider
                    settingsMenuRow(
                        title: tr("历史记录", "History"),
                        description: tr("选择 Assistant 在访问你的历史记录前是否需要批准", "Choose whether Assistant needs approval before accessing your history"),
                        selection: permissionPolicySelection($browserHistoryApproval),
                        options: permissionPolicyOptions
                    )
                }
            }

            settingsListSection(
                title: tr("已屏蔽的域名", "Blocked domains"),
                description: tr("Assistant 绝不会打开这些网站", "Assistant will never open these websites"),
                addTitle: tr("添加", "Add"),
                addAction: addBlockedDomain
            ) {
                domainListCard(
                    domains: browserBlockedDomains,
                    emptyTitle: tr("没有已屏蔽的域名", "No blocked domains"),
                    onRemove: removeBlockedDomain
                )
            }

            settingsListSection(
                title: tr("允许的域名", "Allowed domains"),
                description: tr("无需询问即可打开的域名", "Domains that can be opened without asking"),
                addTitle: tr("添加", "Add"),
                addAction: addAllowedDomain
            ) {
                domainListCard(
                    domains: browserAllowedDomains,
                    emptyTitle: tr("没有允许的域名", "No allowed domains"),
                    onRemove: removeAllowedDomain
                )
            }
        }
    }

    var computerControlSettings: some View {
        VStack(alignment: .leading, spacing: 52) {
            settingsGroup(title: tr("插件", "Plugin")) {
                settingsCard {
                    settingsBuiltinPluginRow(.computerUse)
                }
            }

            settingsListSection(
                title: tr("始终允许的应用", "Always allowed apps"),
                description: nil,
                addTitle: nil,
                addAction: nil
            ) {
                appListCard(
                    apps: computerAlwaysAllowedApps,
                    emptyTitle: tr("暂无", "None"),
                    onRemove: removeAlwaysAllowedApp
                )
            }
        }
    }

    private var browserDataRow: some View {
        HStack(alignment: .center, spacing: 14) {
            settingsRowText(
                title: tr("浏览数据", "Browsing data"),
                description: tr("清除应用内浏览器中的网站数据和缓存", "Clear website data and cache in the in-app browser")
            )

            Spacer(minLength: 18)

            Menu {
                Button(tr("清除所有浏览数据", "Clear all browsing data")) {
                    clearBrowserData()
                }
            } label: {
                HStack(spacing: 8) {
                    Text(tr("清除所有浏览数据", "Clear all browsing data"))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)

                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(AppTheme.textTertiary)
                }
                .padding(.horizontal, 12)
                .frame(height: 30)
                .background(AppTheme.surfaceRaised)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .contentShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
    }

    private func settingsBuiltinPluginRow(_ pluginKind: SettingsBuiltinPlugin) -> some View {
        let plugin = builtinPlugin(pluginKind)
        let isEnabled = plugin?.isEnabled ?? true

        return Button {
            if let plugin {
                appModel.setPluginEnabled(plugin, enabled: !plugin.isEnabled)
            }
        } label: {
            HStack(alignment: .center, spacing: 14) {
                SettingsBuiltinPluginIcon(pluginKind: pluginKind)

                VStack(alignment: .leading, spacing: 5) {
                    Text(plugin?.displayName ?? pluginKind.displayName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                        .allowsTightening(true)

                    Text(plugin?.description ?? pluginKind.description(language: appLanguage))
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                        .allowsTightening(true)
                        .truncationMode(.tail)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)

                Spacer(minLength: 12)

                Image(systemName: isEnabled ? "checkmark" : "plus")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(isEnabled ? AppTheme.textTertiary : AppTheme.textPrimary)
                    .frame(width: 30, height: 30)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("settings.plugin.\(pluginKind.displayName)")
    }

    private func settingsListSection<Content: View>(
        title: String,
        description: String?,
        addTitle: String?,
        addAction: (() -> Void)?,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)

                    if let description {
                        Text(description)
                            .font(.system(size: 13))
                            .foregroundStyle(AppTheme.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                            .allowsTightening(true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if let addTitle, let addAction {
                    Button(action: addAction) {
                        HStack(spacing: 8) {
                            Image(systemName: "plus")
                                .font(.system(size: 13, weight: .medium))
                            Text(addTitle)
                                .font(.system(size: 13, weight: .medium))
                        }
                        .foregroundStyle(AppTheme.textPrimary)
                        .padding(.horizontal, 12)
                        .frame(height: 30)
                        .background(AppTheme.surfaceRaised)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .fixedSize(horizontal: true, vertical: false)
                }
            }

            content()
        }
    }

    private func domainListCard(
        domains: [String],
        emptyTitle: String,
        onRemove: @escaping (String) -> Void
    ) -> some View {
        settingsListCard(items: domains, emptyTitle: emptyTitle) { domain in
            settingsRemovableListRow(title: domain, systemName: "globe", onRemove: { onRemove(domain) })
        }
    }

    private func appListCard(
        apps: [String],
        emptyTitle: String,
        onRemove: @escaping (String) -> Void
    ) -> some View {
        settingsListCard(items: apps, emptyTitle: emptyTitle) { app in
            settingsRemovableListRow(title: app, systemName: "app.dashed", onRemove: { onRemove(app) })
        }
    }

    private func settingsListCard<Row: View>(
        items: [String],
        emptyTitle: String,
        @ViewBuilder row: @escaping (String) -> Row
    ) -> some View {
        settingsCard {
            if items.isEmpty {
                Text(emptyTitle)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .center)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 2)
            } else {
                ForEach(Array(items.enumerated()), id: \.element) { index, item in
                    row(item)
                    if index < items.count - 1 {
                        divider
                    }
                }
            }
        }
    }

    private func settingsRemovableListRow(
        title: String,
        systemName: String,
        onRemove: @escaping () -> Void
    ) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: systemName)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .frame(width: 18)

            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)

            Spacer(minLength: 12)

            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(AppTheme.textTertiary)
                    .frame(width: 26, height: 26)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(tr("移除", "Remove"))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var permissionPolicyOptions: [String] {
        BrowserComputerSettingsPreferences.PermissionPolicy.allCases.map { $0.title(language: appLanguage) }
    }

    private func permissionPolicySelection(_ storage: Binding<String>) -> Binding<String> {
        Binding(
            get: {
                BrowserComputerSettingsPreferences.PermissionPolicy(storedValue: storage.wrappedValue)
                    .title(language: appLanguage)
            },
            set: { newValue in
                if let policy = BrowserComputerSettingsPreferences.PermissionPolicy.allCases.first(where: { policy in
                    policy.title(language: appLanguage) == newValue
                }) {
                    storage.wrappedValue = policy.rawValue
                }
            }
        )
    }

    private var browserBlockedDomains: [String] {
        BrowserComputerSettingsPreferences.decodeStringList(browserBlockedDomainsRaw)
    }

    private var browserAllowedDomains: [String] {
        BrowserComputerSettingsPreferences.decodeStringList(browserAllowedDomainsRaw)
    }

    private var computerAlwaysAllowedApps: [String] {
        BrowserComputerSettingsPreferences.decodeStringList(computerAlwaysAllowedAppsRaw)
    }

    private func addBlockedDomain() {
        guard let domain = promptForSettingsValue(
            title: tr("添加已屏蔽的域名", "Add blocked domain"),
            message: tr("输入 Assistant 不应打开的域名。", "Enter a domain Assistant should not open."),
            placeholder: "example.com"
        ).flatMap(BrowserComputerSettingsPreferences.normalizedDomain) else {
            return
        }

        browserBlockedDomainsRaw = BrowserComputerSettingsPreferences.encodeStringList(browserBlockedDomains + [domain])
        browserAllowedDomainsRaw = BrowserComputerSettingsPreferences.encodeStringList(browserAllowedDomains.filter { $0 != domain })
    }

    private func addAllowedDomain() {
        guard let domain = promptForSettingsValue(
            title: tr("添加允许的域名", "Add allowed domain"),
            message: tr("输入 Assistant 可以无需询问打开的域名。", "Enter a domain Assistant can open without asking."),
            placeholder: "example.com"
        ).flatMap(BrowserComputerSettingsPreferences.normalizedDomain) else {
            return
        }

        browserAllowedDomainsRaw = BrowserComputerSettingsPreferences.encodeStringList(browserAllowedDomains + [domain])
        browserBlockedDomainsRaw = BrowserComputerSettingsPreferences.encodeStringList(browserBlockedDomains.filter { $0 != domain })
    }

    private func removeBlockedDomain(_ domain: String) {
        browserBlockedDomainsRaw = BrowserComputerSettingsPreferences.encodeStringList(browserBlockedDomains.filter { $0 != domain })
    }

    private func removeAllowedDomain(_ domain: String) {
        browserAllowedDomainsRaw = BrowserComputerSettingsPreferences.encodeStringList(browserAllowedDomains.filter { $0 != domain })
    }

    private func removeAlwaysAllowedApp(_ app: String) {
        computerAlwaysAllowedAppsRaw = BrowserComputerSettingsPreferences.encodeStringList(computerAlwaysAllowedApps.filter { $0 != app })
    }

    private func clearBrowserData() {
        BrowserComputerSettingsPreferences.clearBrowsingData()
        browserDataStatusMessage = tr("浏览数据已清除", "Browsing data cleared")
    }

    private func builtinPlugin(_ pluginKind: SettingsBuiltinPlugin) -> PluginSummary? {
        appModel.availablePlugins.first { plugin in
            pluginKind.idCandidates.contains(plugin.pluginID)
                || plugin.displayName.localizedCaseInsensitiveCompare(pluginKind.displayName) == .orderedSame
                || plugin.name.localizedCaseInsensitiveCompare(pluginKind.displayName) == .orderedSame
        }
    }

    private func promptForSettingsValue(
        title: String,
        message: String,
        placeholder: String
    ) -> String? {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: tr("添加", "Add"))
        alert.addButton(withTitle: tr("取消", "Cancel"))

        let textField = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24))
        textField.placeholderString = placeholder
        alert.accessoryView = textField

        guard alert.runModal() == .alertFirstButtonReturn else {
            return nil
        }

        let value = textField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}

private struct SettingsBuiltinPluginIcon: View {
    let pluginKind: SettingsBuiltinPlugin

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: pluginKind.gradientColors,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(AppTheme.borderStrong, lineWidth: 1)
                )

            Image(systemName: pluginKind.iconName)
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.white.opacity(0.92))
                .rotationEffect(.degrees(pluginKind == .browserUse ? -28 : 0))
        }
        .frame(width: 44, height: 44)
    }
}
