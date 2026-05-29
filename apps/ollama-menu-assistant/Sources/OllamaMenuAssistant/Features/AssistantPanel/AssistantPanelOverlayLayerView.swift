import SwiftUI

struct AssistantPanelOverlayLayerView: View {
    let size: CGSize
    @Binding var isSettingsPanelPresented: Bool
    @Binding var isProjectRunSettingsPresented: Bool
    @Binding var isAutomationCreatePanelPresented: Bool
    @Binding var conversationSearchQuery: String
    let isConversationSearchPresented: Bool
    let isLaunchAtLoginEnabled: Bool
    let currentProject: ConversationProject?
    let projects: [ConversationProject]
    let selectedModelName: String
    let conversationSearchResults: [StoredConversation]
    let isConversationSearchFiltering: Bool
    let language: AppLanguage
    let currentConversationID: UUID
    let title: (StoredConversation) -> String
    let projectName: (StoredConversation) -> String?
    let isGenerating: (StoredConversation) -> Bool
    let onToggleLaunchAtLogin: (Bool) -> Void
    let onRefreshModels: () -> Void
    let onSaveAndRunProjectCommand: (String) -> Void
    let onCreateAutomation: (AutomationDraft) -> Void
    let onCloseConversationSearch: () -> Void
    let onOpenConversationFromSearch: (StoredConversation) -> Void

    var body: some View {
        Group {
            if isSettingsPanelPresented {
                SettingsPanelView(
                    isPresented: $isSettingsPanelPresented,
                    isLaunchAtLoginEnabled: isLaunchAtLoginEnabled,
                    onToggleLaunchAtLogin: onToggleLaunchAtLogin,
                    onRefreshModels: onRefreshModels
                )
                .frame(width: size.width, height: size.height, alignment: .topLeading)
                .clipped()
                .transition(.opacity)
                .zIndex(5)
            }

            if isProjectRunSettingsPresented {
                AppTheme.dismissalOverlay
                    .contentShape(Rectangle())
                    .onTapGesture {
                        isProjectRunSettingsPresented = false
                    }
                    .frame(width: size.width, height: size.height)
                    .zIndex(6)

                ProjectRunSettingsPanelView(
                    project: currentProject,
                    initialCommand: currentProject?.startupCommand ?? "",
                    onClose: {
                        isProjectRunSettingsPresented = false
                    },
                    onSaveAndRun: onSaveAndRunProjectCommand
                )
                .position(x: size.width / 2, y: size.height / 2)
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
                .zIndex(7)
            }

            if isAutomationCreatePanelPresented {
                AppTheme.dismissalOverlay
                    .contentShape(Rectangle())
                    .onTapGesture {
                        isAutomationCreatePanelPresented = false
                    }
                    .frame(width: size.width, height: size.height)
                    .zIndex(8)

                AutomationCreatePanelView(
                    projects: projects,
                    initialProjectID: currentProject?.id,
                    selectedModelName: selectedModelName,
                    onCancel: {
                        isAutomationCreatePanelPresented = false
                    },
                    onCreate: onCreateAutomation
                )
                .position(x: size.width / 2, y: size.height / 2)
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
                .zIndex(9)
            }

            if isConversationSearchPresented {
                AppTheme.dismissalOverlay
                    .contentShape(Rectangle())
                    .onTapGesture {
                        onCloseConversationSearch()
                    }
                    .frame(width: size.width, height: size.height)
                    .zIndex(10)

                ConversationSearchPanelView(
                    query: $conversationSearchQuery,
                    conversations: conversationSearchResults,
                    isFiltering: isConversationSearchFiltering,
                    language: language,
                    currentConversationID: currentConversationID,
                    title: title,
                    projectName: projectName,
                    isGenerating: isGenerating,
                    onOpen: onOpenConversationFromSearch,
                    onClose: onCloseConversationSearch
                )
                .position(x: size.width / 2, y: size.height / 2)
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
                .zIndex(11)
            }
        }
    }
}
