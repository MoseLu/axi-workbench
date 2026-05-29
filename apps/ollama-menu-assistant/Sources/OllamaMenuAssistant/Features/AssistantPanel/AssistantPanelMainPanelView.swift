import SwiftUI

struct AssistantPanelMainPanelView<
    TitleBarContent: View,
    AutomationsContent: View,
    PluginsContent: View,
    PluginManagementContent: View,
    ConversationContent: View,
    RightSidebarContent: View
>: View {
    let sidebarState: AssistantPanelLayout.ResponsiveSidebarState
    let selectedDestination: AssistantPanelDestination
    let isChangesSidebarExpanded: Bool
    @Binding var isTerminalPanelCollapsed: Bool
    @Binding var storedChangesSidebarWidthRatio: Double
    let terminalCommandRequest: ProjectTerminalCommandRequest?
    let currentProject: ConversationProject?
    let terminalPanelAnimation: Animation
    private let titleBar: TitleBarContent
    private let automationsContent: AutomationsContent
    private let pluginsContent: PluginsContent
    private let pluginManagementContent: PluginManagementContent
    private let conversationContent: ConversationContent
    private let rightSidebarContent: RightSidebarContent

    init(
        sidebarState: AssistantPanelLayout.ResponsiveSidebarState,
        selectedDestination: AssistantPanelDestination,
        isChangesSidebarExpanded: Bool,
        isTerminalPanelCollapsed: Binding<Bool>,
        storedChangesSidebarWidthRatio: Binding<Double>,
        terminalCommandRequest: ProjectTerminalCommandRequest?,
        currentProject: ConversationProject?,
        terminalPanelAnimation: Animation,
        @ViewBuilder titleBar: () -> TitleBarContent,
        @ViewBuilder automationsContent: () -> AutomationsContent,
        @ViewBuilder pluginsContent: () -> PluginsContent,
        @ViewBuilder pluginManagementContent: () -> PluginManagementContent,
        @ViewBuilder conversationContent: () -> ConversationContent,
        @ViewBuilder rightSidebarContent: () -> RightSidebarContent
    ) {
        self.sidebarState = sidebarState
        self.selectedDestination = selectedDestination
        self.isChangesSidebarExpanded = isChangesSidebarExpanded
        _isTerminalPanelCollapsed = isTerminalPanelCollapsed
        _storedChangesSidebarWidthRatio = storedChangesSidebarWidthRatio
        self.terminalCommandRequest = terminalCommandRequest
        self.currentProject = currentProject
        self.terminalPanelAnimation = terminalPanelAnimation
        self.titleBar = titleBar()
        self.automationsContent = automationsContent()
        self.pluginsContent = pluginsContent()
        self.pluginManagementContent = pluginManagementContent()
        self.conversationContent = conversationContent()
        self.rightSidebarContent = rightSidebarContent()
    }

    var body: some View {
        VStack(spacing: 0) {
            titleBar
            Rectangle()
                .fill(AppTheme.border)
                .frame(height: 1)
            mainContentWithTerminalPanel
        }
        .background(AppTheme.canvas)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(AppTheme.border)
                .frame(width: AssistantPanelLayout.sidebarDividerWidth)
                .opacity(sidebarState.isSidebarCollapsed ? 0 : 1)
        }
    }

    private var mainContentWithTerminalPanel: some View {
        GeometryReader { geometry in
            if selectedDestination != .conversation {
                mainContentArea
                    .frame(width: geometry.size.width, height: geometry.size.height)
            } else {
                let terminalHeight = isTerminalPanelCollapsed ? 0 : min(
                    AssistantPanelLayout.terminalPanelHeight,
                    max(180, geometry.size.height * 0.42)
                )
                let terminalDividerHeight: CGFloat = isTerminalPanelCollapsed ? 0 : 1
                let contentHeight = max(0, geometry.size.height - terminalHeight - terminalDividerHeight)

                VStack(spacing: 0) {
                    mainContentArea
                        .frame(height: contentHeight)

                    if !isTerminalPanelCollapsed {
                        Rectangle()
                            .fill(AppTheme.border)
                            .frame(height: terminalDividerHeight)

                        ProjectTerminalPanelView(
                            project: currentProject,
                            commandRequest: terminalCommandRequest,
                            onClose: {
                                withAnimation(terminalPanelAnimation) {
                                    isTerminalPanelCollapsed = true
                                }
                            }
                        )
                        .frame(height: terminalHeight)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
                .frame(width: geometry.size.width, height: geometry.size.height, alignment: .top)
            }
        }
    }

    @ViewBuilder
    private var mainContentArea: some View {
        GeometryReader { geometry in
            if selectedDestination == .automations {
                automationsContent
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
            } else if selectedDestination == .plugins {
                pluginsContent
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
            } else if selectedDestination == .pluginManagement {
                pluginManagementContent
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
            } else if sidebarState.isRightSidebarCollapsed {
                conversationContent
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
            } else if isChangesSidebarExpanded {
                rightSidebarContent
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
            } else {
                NativeChangesSidebarSplitView(
                    availableWidth: geometry.size.width,
                    rightWidthRatio: $storedChangesSidebarWidthRatio,
                    leftMinimumWidth: AssistantPanelLayout.conversationMinimumResizeWidth,
                    rightMinimumWidth: AssistantPanelLayout.changesSidebarMinimumWidth,
                    rightDefaultWidth: AssistantPanelLayout.changesSidebarWidth,
                    rightMaximumWidthRatio: AssistantPanelLayout.changesSidebarMaximumWidthRatio
                ) {
                    conversationContent
                } right: {
                    rightSidebarContent
                }
                .frame(width: geometry.size.width, height: geometry.size.height)
                .clipped()
            }
        }
    }
}
