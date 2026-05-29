import SwiftUI

struct SettingsPanelRouteView: View {
    let selectedSection: SettingsSection
    private let general: () -> AnyView
    private let appearance: () -> AnyView
    private let configuration: () -> AnyView
    private let personalization: () -> AnyView
    private let mcpServers: () -> AnyView
    private let git: () -> AnyView
    private let environment: () -> AnyView
    private let browserUsage: () -> AnyView
    private let computerControl: () -> AnyView
    private let archivedConversations: () -> AnyView
    private let usage: () -> AnyView

    init<General: View, Appearance: View, Configuration: View, Personalization: View, MCPServers: View, Git: View, Environment: View, BrowserUsage: View, ComputerControl: View, ArchivedConversations: View, Usage: View>(
        selectedSection: SettingsSection,
        @ViewBuilder general: @escaping () -> General,
        @ViewBuilder appearance: @escaping () -> Appearance,
        @ViewBuilder configuration: @escaping () -> Configuration,
        @ViewBuilder personalization: @escaping () -> Personalization,
        @ViewBuilder mcpServers: @escaping () -> MCPServers,
        @ViewBuilder git: @escaping () -> Git,
        @ViewBuilder environment: @escaping () -> Environment,
        @ViewBuilder browserUsage: @escaping () -> BrowserUsage,
        @ViewBuilder computerControl: @escaping () -> ComputerControl,
        @ViewBuilder archivedConversations: @escaping () -> ArchivedConversations,
        @ViewBuilder usage: @escaping () -> Usage
    ) {
        self.selectedSection = selectedSection
        self.general = { AnyView(general()) }
        self.appearance = { AnyView(appearance()) }
        self.configuration = { AnyView(configuration()) }
        self.personalization = { AnyView(personalization()) }
        self.mcpServers = { AnyView(mcpServers()) }
        self.git = { AnyView(git()) }
        self.environment = { AnyView(environment()) }
        self.browserUsage = { AnyView(browserUsage()) }
        self.computerControl = { AnyView(computerControl()) }
        self.archivedConversations = { AnyView(archivedConversations()) }
        self.usage = { AnyView(usage()) }
    }

    var body: some View {
        switch selectedSection {
        case .general:
            general()
        case .appearance:
            appearance()
        case .configuration:
            configuration()
        case .personalization:
            personalization()
        case .mcpServers:
            mcpServers()
        case .git:
            git()
        case .environment:
            environment()
        case .browserUsage:
            browserUsage()
        case .computerControl:
            computerControl()
        case .archivedConversations:
            archivedConversations()
        case .usage:
            usage()
        case .workspace:
            EmptyView()
        }
    }
}
