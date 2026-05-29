import Foundation

enum SidebarConversationOrganization {
    case byProject
    case recentProjects
    case chronological

    func title(language: AppLanguage) -> String {
        switch self {
        case .byProject:
            language == .english ? "By project" : "按项目"
        case .recentProjects:
            language == .english ? "Recent projects" : "近期项目"
        case .chronological:
            language == .english ? "Chronological" : "按时间顺序"
        }
    }

    var systemName: String {
        switch self {
        case .byProject: "folder"
        case .recentProjects: "folder.badge.clock"
        case .chronological: "clock"
        }
    }
}

enum SidebarConversationSortOption {
    case createdAt
    case updatedAt

    func title(language: AppLanguage) -> String {
        switch self {
        case .createdAt:
            language == .english ? "Created" : "创建时间"
        case .updatedAt:
            language == .english ? "Recently updated" : "最近更新"
        }
    }

    var systemName: String {
        switch self {
        case .createdAt: "plus.circle"
        case .updatedAt: "clock.arrow.circlepath"
        }
    }
}

enum SidebarConversationDisplayScope {
    case all
    case related

    func title(language: AppLanguage) -> String {
        switch self {
        case .all:
            language == .english ? "All chats" : "所有对话"
        case .related:
            language == .english ? "Related" : "相关"
        }
    }

    var systemName: String {
        switch self {
        case .all: "bubble.left.and.bubble.right"
        case .related: "star"
        }
    }
}

enum AssistantPanelDestination: Equatable {
    case conversation
    case plugins
    case pluginManagement
    case automations
}

struct AssistantSidebarProjectGroup: Identifiable {
    let project: ConversationProject
    let conversations: [StoredConversation]

    var id: UUID {
        project.id
    }
}

struct AssistantSidebarSnapshot {
    let language: AppLanguage
    let isTranslucent: Bool
    let selectedDestination: AssistantPanelDestination
    let currentConversationID: UUID
    let currentConversationTitle: String
    let currentConversationIsEmpty: Bool
    let isCurrentConversationLoading: Bool
    let currentProjectID: UUID?
    let pinnedConversations: [StoredConversation]
    let projectGroups: [AssistantSidebarProjectGroup]
    let noProjectConversations: [StoredConversation]
    let automationCount: Int
    let isSearchPresented: Bool
    let generatingConversationID: UUID?
    let title: (StoredConversation) -> String

    var projects: [ConversationProject] {
        projectGroups.map(\.project)
    }

    func project(for conversation: StoredConversation) -> ConversationProject? {
        guard let projectID = conversation.projectID else {
            return nil
        }
        return projects.first(where: { $0.id == projectID })
    }

    func isGenerating(_ conversation: StoredConversation) -> Bool {
        generatingConversationID == conversation.id
    }
}

struct AssistantSidebarActions {
    let openSettings: () -> Void
    let quit: () -> Void
    let newChat: () -> Void
    let toggleSearch: () -> Void
    let openPlugins: () -> Void
    let openAutomations: () -> Void
    let chooseWorkspaceFolder: () -> Void
    let newChatInProject: (UUID) -> Void
    let newNoProjectChat: () -> Void
    let openConversation: (StoredConversation) -> Void
    let renameProject: (ConversationProject) -> Void
    let openProjectInDefaultEditor: (ConversationProject) -> Void
    let deleteProject: (ConversationProject) -> Void
    let togglePinConversation: (StoredConversation) -> Void
    let renameConversation: (StoredConversation) -> Void
    let archiveConversation: (StoredConversation) -> Void
    let openConversationWorkspaceInFinder: (StoredConversation) -> Void
    let copyConversationWorkspacePath: (StoredConversation) -> Void
    let copyConversationID: (StoredConversation) -> Void
    let copyConversationDeepLink: (StoredConversation) -> Void
    let copyConversationMarkdown: (StoredConversation, String) -> Void
}
