import SwiftUI

struct AssistantSidebarConversationContextMenu: View {
    let conversation: StoredConversation
    let snapshot: AssistantSidebarSnapshot
    let actions: AssistantSidebarActions

    var body: some View {
        Button {
            actions.togglePinConversation(conversation)
        } label: {
            Label(
                conversation.isPinned ? tr("取消置顶", "Unpin chat") : tr("置顶对话", "Pin chat"),
                systemImage: conversation.isPinned ? "pin.slash" : "pin"
            )
        }

        Button {
            actions.renameConversation(conversation)
        } label: {
            Label(tr("重命名对话", "Rename chat"), systemImage: "pencil")
        }

        Button {
            actions.archiveConversation(conversation)
        } label: {
            Label(tr("归档对话", "Archive chat"), systemImage: "archivebox")
        }

        Button {} label: {
            Label(tr("标记为未读", "Mark as unread"), systemImage: "envelope.badge")
        }
        .disabled(true)

        Divider()

        if snapshot.project(for: conversation)?.path == nil {
            Button {} label: {
                Label(tr("在“访达”中打开", "Open in Finder"), systemImage: "folder")
            }
            .disabled(true)

            Button {} label: {
                Label(tr("复制工作目录", "Copy working directory"), systemImage: "doc.on.doc")
            }
            .disabled(true)
        } else {
            Button {
                actions.openConversationWorkspaceInFinder(conversation)
            } label: {
                Label(tr("在“访达”中打开", "Open in Finder"), systemImage: "folder")
            }

            Button {
                actions.copyConversationWorkspacePath(conversation)
            } label: {
                Label(tr("复制工作目录", "Copy working directory"), systemImage: "doc.on.doc")
            }
        }

        Button {
            actions.copyConversationID(conversation)
        } label: {
            Label(tr("复制会话 ID", "Copy chat ID"), systemImage: "number")
        }

        Button {
            actions.copyConversationDeepLink(conversation)
        } label: {
            Label(tr("复制深度链接", "Copy deep link"), systemImage: "link")
        }

        Button {
            actions.copyConversationMarkdown(conversation, snapshot.title(conversation))
        } label: {
            Label(tr("复制为 Markdown", "Copy as Markdown"), systemImage: "doc.richtext")
        }

        Divider()

        Button {} label: {
            Label(tr("派生到本地", "Branch locally"), systemImage: "arrow.triangle.branch")
        }
        .disabled(true)

        Button {} label: {
            Label(tr("派生到新工作树", "Branch to new worktree"), systemImage: "arrow.triangle.branch")
        }
        .disabled(true)

        Button {} label: {
            Label(tr("在迷你窗口中打开", "Open in mini window"), systemImage: "macwindow")
        }
        .disabled(true)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: snapshot.language)
    }
}
