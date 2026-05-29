import AppKit
import SwiftUI

extension AssistantPanelView {
    func sidebar(isCollapsed: Bool) -> some View {
        AssistantPanelSidebarView(
            snapshot: sidebarSnapshot,
            actions: sidebarActions,
            topInset: sidebarTopInset,
            isCollapsed: isCollapsed,
            isSettingsMenuPresented: $isSidebarSettingsMenuPresented,
            isNoProjectFilterPresented: $isNoProjectFilterPresented
        )
    }

    var sidebarSnapshot: AssistantSidebarSnapshot {
        AssistantSidebarSnapshot(
            language: appLanguage,
            isTranslucent: translucentSidebar,
            selectedDestination: selectedDestination,
            currentConversationID: appModel.currentConversation.id,
            currentConversationTitle: appModel.currentConversation.title,
            currentConversationIsEmpty: appModel.currentConversation.messages.isEmpty,
            isCurrentConversationLoading: appModel.isCurrentConversationLoading,
            currentProjectID: appModel.currentProject?.id,
            pinnedConversations: appModel.pinnedConversations(),
            projectGroups: appModel.projects.map { project in
                AssistantSidebarProjectGroup(
                    project: project,
                    conversations: appModel.visibleConversations(for: project.id)
                )
            },
            noProjectConversations: appModel.visibleConversations(for: nil),
            automationCount: automations.count,
            isSearchPresented: isConversationSearchPresented,
            generatingConversationID: appModel.generatingConversationID,
            title: { displayTitle(for: $0) }
        )
    }

    var sidebarActions: AssistantSidebarActions {
        AssistantSidebarActions(
            openSettings: {
                isSettingsPanelPresented = true
            },
            quit: {
                NSApplication.shared.terminate(nil)
            },
            newChat: {
                selectedDestination = .conversation
                appModel.startNewConversation()
            },
            toggleSearch: {
                if isConversationSearchPresented {
                    closeConversationSearch()
                } else {
                    presentConversationSearch()
                }
            },
            openPlugins: {
                selectedDestination = .plugins
                isProjectRunSettingsPresented = false
                isAutomationCreatePanelPresented = false
                appModel.refreshPlugins()
            },
            openAutomations: {
                selectedDestination = .automations
                isProjectRunSettingsPresented = false
            },
            chooseWorkspaceFolder: {
                appModel.pickWorkspaceFolder()
            },
            newChatInProject: { projectID in
                selectedDestination = .conversation
                appModel.startNewConversation(in: projectID)
            },
            newNoProjectChat: {
                selectedDestination = .conversation
                appModel.startNewConversation(in: nil)
            },
            openConversation: { conversation in
                selectedDestination = .conversation
                appModel.openConversation(conversation)
            },
            renameProject: { appModel.renameProjectWithPrompt($0) },
            openProjectInDefaultEditor: { appModel.openProjectInDefaultEditor($0) },
            deleteProject: { appModel.deleteProject($0) },
            togglePinConversation: { appModel.togglePinConversation($0) },
            renameConversation: { appModel.renameConversationWithPrompt($0) },
            archiveConversation: { appModel.archiveConversation($0) },
            openConversationWorkspaceInFinder: { appModel.openConversationWorkspaceInFinder($0) },
            copyConversationWorkspacePath: { appModel.copyConversationWorkspacePath($0) },
            copyConversationID: { appModel.copyConversationID($0) },
            copyConversationDeepLink: { appModel.copyConversationDeepLink($0) },
            copyConversationMarkdown: { conversation, title in
                appModel.copyConversationAsMarkdown(conversation, title: title)
            }
        )
    }

    var conversationSearchQueryText: String {
        conversationSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var searchableConversations: [StoredConversation] {
        AssistantPanelConversationSearch.searchableConversations(appModel.conversations)
    }

    var conversationSearchResults: [StoredConversation] {
        AssistantPanelConversationSearch.results(
            query: conversationSearchQueryText,
            conversations: searchableConversations,
            title: { displayTitle(for: $0) }
        )
    }

    func presentConversationSearch() {
        conversationSearchQuery = ""
        isSidebarSettingsMenuPresented = false
        isNoProjectFilterPresented = false
        isProjectRunSettingsPresented = false
        isAutomationCreatePanelPresented = false
        isConversationSearchPresented = true
    }

    func closeConversationSearch() {
        isConversationSearchPresented = false
        conversationSearchQuery = ""
    }

    func openConversationFromSearch(_ conversation: StoredConversation) {
        closeConversationSearch()
        selectedDestination = .conversation
        appModel.openConversation(conversation)
    }

    func projectName(for conversation: StoredConversation) -> String? {
        project(for: conversation)?.name
    }

    func project(for conversation: StoredConversation) -> ConversationProject? {
        guard let projectID = conversation.projectID else {
            return nil
        }
        return appModel.projects.first(where: { $0.id == projectID })
    }
}
