import AppKit
import SwiftUI

struct MainContentDropOverlay: View {
    var body: some View {
        ZStack {
            Rectangle()
                .fill(AppTheme.dragDropScrim)
                .overlay(
                    LinearGradient(
                        colors: [
                            AppTheme.dropOverlayAccentStart,
                            AppTheme.dropOverlayAccentEnd,
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            HStack(spacing: 10) {
                Image(systemName: "square.and.arrow.down.on.square")
                    .font(.system(size: DesignTokens.IconSize.callout, weight: .semibold))
                Text(tr("松开即可添加", "Release to add"))
                    .font(.system(size: DesignTokens.FontSize.callout, weight: .semibold))
            }
            .foregroundStyle(AppTheme.textPrimary)
            .frame(width: 220, alignment: .center)
            .padding(.horizontal, DesignTokens.Spacing.sidebar)
            .padding(.vertical, DesignTokens.Spacing.panel)
            .background(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.overlay)
                    .fill(AppTheme.dragDropCalloutBackground)
                    .overlay(
                        LinearGradient(
                            colors: [
                                AppTheme.dropCalloutAccentStart,
                                AppTheme.dropCalloutAccentEnd,
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.overlay))
                    )
            )
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings.current()
    }
}

struct SidebarPrimaryNavigationButton: View {
    let title: String
    let systemName: String
    let accessibilityIdentifier: String
    var isSelected = false
    var suppressHoverStyle = false
    var badgeText: String?
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: AssistantPanelLayout.sidebarIconTextSpacing) {
                Image(systemName: systemName)
                    .font(.system(size: DesignTokens.IconSize.medium, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(
                        width: AssistantPanelLayout.sidebarIconColumnWidth,
                        height: DesignTokens.ControlSize.standardButton
                    )

                Text(title)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Spacer()

                if let badgeText {
                    ZStack {
                        Text(badgeText)
                            .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
                            .foregroundStyle(AppTheme.textSecondary)
                            .padding(.horizontal, 7)
                            .frame(minWidth: 20, minHeight: 20)
                            .background(AppTheme.surfaceHover)
                            .clipShape(Capsule())
                    }
                    .frame(
                        width: DesignTokens.ControlSize.standardButton,
                        height: DesignTokens.ControlSize.standardButton
                    )
                    .frame(width: AssistantPanelLayout.sidebarTrailingActionWidth, alignment: .trailing)
                }
            }
            .padding(.horizontal, AssistantPanelLayout.sidebarRowHorizontalPadding)
            .padding(.vertical, DesignTokens.Spacing.small)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(alignment: .leading) {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium)
                    .fill(isSelected || (isHovered && !suppressHoverStyle) ? AppTheme.surfaceHover : AppTheme.transparent)
                    .frame(width: AssistantPanelLayout.sidebarFloatingPanelWidth)
                    .offset(x: AssistantPanelLayout.sidebarMenuSurfaceOffset)
            }
            .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium))
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovered = hovering
        }
        .onChange(of: suppressHoverStyle) { _, shouldSuppress in
            if shouldSuppress {
                isHovered = false
            }
        }
        .accessibilityIdentifier(accessibilityIdentifier)
        .accessibilityLabel(title)
    }
}

struct SidebarProjectMenuButton: View {
    let project: ConversationProject
    let onRename: () -> Void
    let onOpenInDefaultEditor: () -> Void
    let onDelete: () -> Void
    @State private var isPresented = false
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        AppIconButton(
            systemName: "ellipsis",
            accessibilityLabel: tr("项目菜单", "Project menu"),
            help: tr("项目菜单", "Project menu"),
            hoverStyle: .titleBar,
            tint: AppTheme.textTertiary
        ) {
            isPresented.toggle()
        }
        .popover(isPresented: $isPresented, arrowEdge: .trailing) {
            VStack(alignment: .leading, spacing: 4) {
                popoverButton(
                    title: tr("重命名项目", "Rename project"),
                    systemName: "pencil",
                    action: {
                        isPresented = false
                        onRename()
                    }
                )

                if project.path != nil {
                    popoverButton(
                        title: tr("在默认编辑器中打开", "Open in default editor"),
                        systemName: "folder",
                        action: {
                            isPresented = false
                            onOpenInDefaultEditor()
                        }
                    )
                }

                Divider()
                    .padding(.vertical, DesignTokens.Spacing.compact)

                popoverButton(
                    title: tr("删除项目", "Delete project"),
                    systemName: "trash",
                    role: .destructive,
                    action: {
                        isPresented = false
                        onDelete()
                    }
                )
            }
            .padding(DesignTokens.Spacing.control)
            .frame(width: 180, alignment: .leading)
            .background(AppTheme.surface)
        }
    }

    private func popoverButton(
        title: String,
        systemName: String,
        role: ButtonRole? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(role: role, action: action) {
            HStack(spacing: 9) {
                Image(systemName: systemName)
                    .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                    .foregroundStyle(role == .destructive ? AppTheme.destructive : AppTheme.textSecondary)
                    .frame(width: DesignTokens.IconFrame.sidebar)

                Text(title)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(role == .destructive ? AppTheme.destructivePrimary : AppTheme.textPrimary)
                    .lineLimit(1)

                Spacer()
            }
            .padding(.horizontal, DesignTokens.Spacing.control)
            .padding(.vertical, DesignTokens.Spacing.control)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(AppTheme.transparent)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }
}

struct ConversationTitleMenuButton: View {
    let conversation: StoredConversation
    let project: ConversationProject?
    @Binding var isPresented: Bool
    let onTogglePin: () -> Void
    let onRename: () -> Void
    let onArchive: () -> Void
    let onCopyWorkspacePath: () -> Void
    let onCopyConversationID: () -> Void
    let onCopyDeepLink: () -> Void
    let onCopyMarkdown: () -> Void
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        AppIconButton(
            systemName: "ellipsis",
            accessibilityLabel: tr("会话菜单", "Chat menu"),
            help: tr("会话菜单", "Chat menu"),
            hoverStyle: .titleBar,
            tint: AppTheme.textSecondary
        ) {
            isPresented.toggle()
        }
        .popover(isPresented: $isPresented, arrowEdge: .top) {
            menuPanel
        }
    }

    private var menuPanel: some View {
        VStack(alignment: .leading, spacing: 2) {
            menuButton(
                title: conversation.isPinned ? tr("取消置顶", "Unpin chat") : tr("置顶对话", "Pin chat"),
                systemName: conversation.isPinned ? "pin.slash" : "pin",
                action: onTogglePin
            )

            menuButton(title: tr("重命名对话", "Rename chat"), systemName: "pencil", action: onRename)
            menuButton(title: tr("归档对话", "Archive chat"), systemName: "archivebox", action: onArchive)

            menuDivider

            if project?.path == nil {
                disabledMenuRow(title: tr("复制工作目录", "Copy working directory"), systemName: "folder")
            } else {
                menuButton(title: tr("复制工作目录", "Copy working directory"), systemName: "folder", action: onCopyWorkspacePath)
            }
            menuButton(title: tr("复制会话 ID", "Copy chat ID"), systemName: "doc.on.doc", action: onCopyConversationID)
            menuButton(title: tr("复制深度链接", "Copy deep link"), systemName: "link", action: onCopyDeepLink)
            menuButton(title: tr("复制为 Markdown", "Copy as Markdown"), systemName: "doc.richtext", action: onCopyMarkdown)

            menuDivider

            disabledMenuRow(title: tr("打开侧边聊天", "Open side chat"), systemName: "plus.circle")
            disabledMenuRow(title: tr("派生到本地", "Branch locally"), systemName: "arrow.triangle.branch")
            disabledMenuRow(title: tr("派生到新工作树", "Branch to new worktree"), systemName: "arrow.triangle.branch")
            disabledMenuRow(title: tr("添加自动化…", "Add automation..."), systemName: "clock.badge.plus")

            menuDivider

            disabledMenuRow(title: tr("在迷你窗口中打开", "Open in mini window"), systemName: "macwindow")
        }
        .padding(DesignTokens.Spacing.control)
        .frame(width: 224, alignment: .leading)
        .background(AppTheme.surface)
    }

    private func menuButton(
        title: String,
        systemName: String,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            isPresented = false
            action()
        } label: {
            menuRowContent(title: title, systemName: systemName, isDisabled: false)
        }
        .buttonStyle(.plain)
    }

    private func disabledMenuRow(title: String, systemName: String) -> some View {
        menuRowContent(title: title, systemName: systemName, isDisabled: true)
            .accessibilityAddTraits(.isStaticText)
    }

    private func menuRowContent(title: String, systemName: String, isDisabled: Bool) -> some View {
        HStack(spacing: 9) {
            Image(systemName: systemName)
                .font(.system(size: DesignTokens.IconSize.regular, weight: .medium))
                .foregroundStyle(isDisabled ? AppTheme.textTertiary : AppTheme.textSecondary)
                .frame(width: DesignTokens.IconFrame.sidebar)

            Text(title)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(isDisabled ? AppTheme.textTertiary : AppTheme.textPrimary)
                .lineLimit(1)

            Spacer(minLength: DesignTokens.Spacing.control)
        }
        .padding(.horizontal, DesignTokens.Spacing.related)
        .padding(.vertical, DesignTokens.Spacing.related)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ControlSize.menuRow, alignment: .leading)
        .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
    }

    private var menuDivider: some View {
        Divider()
            .overlay(AppTheme.menuDividerBorder)
            .padding(.vertical, DesignTokens.Spacing.compact)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }
}

struct SidebarFolderIcon: View {
    let isExpanded: Bool

    var body: some View {
        AssistantFolderShape(isExpanded: isExpanded)
            .stroke(style: StrokeStyle(lineWidth: 1.25, lineCap: .round, lineJoin: .round))
            .frame(width: DesignTokens.IconSize.medium, height: DesignTokens.IconSize.medium)
            .frame(
                width: AssistantPanelLayout.sidebarIconColumnWidth,
                height: DesignTokens.ControlSize.standardButton
            )
            .accessibilityHidden(true)
    }
}

private struct AssistantFolderShape: Shape {
    let isExpanded: Bool

    func path(in rect: CGRect) -> Path {
        let x = rect.minX
        let y = rect.minY
        let w = rect.width
        let h = rect.height

        return isExpanded ? expandedPath(x: x, y: y, w: w, h: h) : collapsedPath(x: x, y: y, w: w, h: h)
    }

    private func collapsedPath(x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat) -> Path {
        var path = Path()

        path.move(to: CGPoint(x: x + w * 0.09, y: y + h * 0.34))
        path.addLine(to: CGPoint(x: x + w * 0.09, y: y + h * 0.22))
        path.addLine(to: CGPoint(x: x + w * 0.16, y: y + h * 0.12))
        path.addLine(to: CGPoint(x: x + w * 0.45, y: y + h * 0.12))
        path.addLine(to: CGPoint(x: x + w * 0.57, y: y + h * 0.25))
        path.addLine(to: CGPoint(x: x + w * 0.88, y: y + h * 0.25))
        path.addLine(to: CGPoint(x: x + w * 0.93, y: y + h * 0.31))
        path.addLine(to: CGPoint(x: x + w * 0.93, y: y + h * 0.34))

        path.move(to: CGPoint(x: x + w * 0.09, y: y + h * 0.34))
        path.addLine(to: CGPoint(x: x + w * 0.93, y: y + h * 0.34))
        path.addLine(to: CGPoint(x: x + w * 0.93, y: y + h * 0.87))
        path.addLine(to: CGPoint(x: x + w * 0.09, y: y + h * 0.87))
        path.closeSubpath()
        return path
    }

    private func expandedPath(x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat) -> Path {
        var path = Path()

        path.move(to: CGPoint(x: x + w * 0.08, y: y + h * 0.63))
        path.addLine(to: CGPoint(x: x + w * 0.08, y: y + h * 0.18))
        path.addLine(to: CGPoint(x: x + w * 0.13, y: y + h * 0.12))
        path.addLine(to: CGPoint(x: x + w * 0.36, y: y + h * 0.12))
        path.addLine(to: CGPoint(x: x + w * 0.48, y: y + h * 0.25))
        path.addLine(to: CGPoint(x: x + w * 0.82, y: y + h * 0.25))
        path.addLine(to: CGPoint(x: x + w * 0.88, y: y + h * 0.31))
        path.addLine(to: CGPoint(x: x + w * 0.88, y: y + h * 0.39))
        path.addLine(to: CGPoint(x: x + w * 0.18, y: y + h * 0.39))
        path.addLine(to: CGPoint(x: x + w * 0.13, y: y + h * 0.44))

        path.move(to: CGPoint(x: x + w * 0.13, y: y + h * 0.44))
        path.addLine(to: CGPoint(x: x + w * 0.95, y: y + h * 0.44))
        path.addLine(to: CGPoint(x: x + w * 0.84, y: y + h * 0.88))
        path.addLine(to: CGPoint(x: x + w * 0.07, y: y + h * 0.88))
        path.closeSubpath()
        return path
    }
}

struct SidebarConversationRow: View {
    let conversation: StoredConversation
    let selected: Bool
    let isLoading: Bool
    var contentIndent: CGFloat = 0
    let onOpen: () -> Void
    let onTogglePin: () -> Void
    let onArchive: () -> Void
    @State private var isHovered = false
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @AppStorage(GitSettingsPreferences.showsPullRequestIconKey) private var gitShowsPullRequestIcon = GitSettingsPreferences.defaultShowsPullRequestIcon

    var body: some View {
        ZStack {
            Button(action: onOpen) {
                rowContent
            }
            .buttonStyle(.plain)

            rowActionOverlay
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: Self.rowHeight, alignment: .center)
        .background((selected || isHovered) ? AppTheme.surfaceHover : AppTheme.transparent)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium)
                .stroke(selected ? AppTheme.borderStrong : AppTheme.transparent, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium))
        .contentShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium))
        .onHover { hovering in
            isHovered = hovering
        }
    }

    private static let horizontalPadding = AssistantPanelLayout.sidebarRowHorizontalPadding
    private static let trailingStatusWidth = AssistantPanelLayout.sidebarTrailingActionWidth
    private static let rowHeight = DesignTokens.ControlSize.standardButton + (DesignTokens.Spacing.xSmall * 2)

    private var rowContent: some View {
        HStack(spacing: AssistantPanelLayout.sidebarIconTextSpacing) {
            leadingPinSlot

            titleContent
                .frame(maxWidth: .infinity, alignment: .leading)

            trailingStatus
                .opacity(isHovered ? 0 : 1)
                .frame(width: Self.trailingStatusWidth, height: DesignTokens.ControlSize.standardButton, alignment: .trailing)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: DesignTokens.ControlSize.standardButton, alignment: .center)
        .padding(.leading, contentIndent)
        .padding(.horizontal, Self.horizontalPadding)
        .padding(.vertical, DesignTokens.Spacing.xSmall)
    }

    private var rowActionOverlay: some View {
        HStack(spacing: AssistantPanelLayout.sidebarIconTextSpacing) {
            Button(action: onTogglePin) {
                SidebarPinIcon()
                    .foregroundStyle(conversation.isPinned ? AppTheme.textPrimary : AppTheme.textTertiary)
            }
            .buttonStyle(.plain)
            .frame(
                width: AssistantPanelLayout.sidebarIconColumnWidth,
                height: DesignTokens.ControlSize.standardButton
            )
            .help(conversation.isPinned ? tr("取消置顶", "Unpin chat") : tr("置顶对话", "Pin chat"))
            .opacity(isHovered ? 1 : 0)
            .allowsHitTesting(isHovered)
            .accessibilityHidden(!isHovered)

            Spacer(minLength: 0)

            Button(action: onArchive) {
                SidebarArchiveIcon()
                    .foregroundStyle(AppTheme.textTertiary)
                    .frame(width: DesignTokens.ControlSize.standardButton, height: DesignTokens.ControlSize.standardButton)
            }
            .buttonStyle(.plain)
            .help(tr("归档对话", "Archive chat"))
            .frame(width: Self.trailingStatusWidth, height: DesignTokens.ControlSize.standardButton, alignment: .trailing)
            .opacity(isHovered ? 1 : 0)
            .allowsHitTesting(isHovered)
            .accessibilityHidden(!isHovered)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: DesignTokens.ControlSize.standardButton, alignment: .center)
        .padding(.leading, contentIndent)
        .padding(.horizontal, Self.horizontalPadding)
        .padding(.vertical, DesignTokens.Spacing.xSmall)
        .animation(.easeOut(duration: 0.12), value: isHovered)
    }

    static func relativeAgeText(for date: Date, now: Date = .now, language: AppLanguage) -> String {
        let elapsedSeconds = max(0, Int(now.timeIntervalSince(date)))

        if elapsedSeconds < 60 {
            return language == .english ? "now" : "刚刚"
        }

        let elapsedMinutes = elapsedSeconds / 60
        if elapsedMinutes < 60 {
            return language == .english ? "\(elapsedMinutes) min" : "\(elapsedMinutes) 分"
        }

        let elapsedHours = elapsedMinutes / 60
        if elapsedHours < 24 {
            return language == .english ? "\(elapsedHours) h" : "\(elapsedHours) 小时"
        }

        let elapsedDays = elapsedHours / 24
        if elapsedDays < 30 {
            return language == .english ? "\(elapsedDays) d" : "\(elapsedDays) 天"
        }

        let elapsedMonths = elapsedDays / 30
        if elapsedMonths < 12 {
            return language == .english ? "\(elapsedMonths) mo" : "\(elapsedMonths) 月"
        }

        let elapsedYears = max(1, elapsedDays / 365)
        return language == .english ? "\(elapsedYears) y" : "\(elapsedYears) 年"
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var displayText: ChatDisplayText {
        let parsedTitle = ChatDisplayText.parse(conversation.title)
        if parsedTitle.invocations.isEmpty || !parsedTitle.body.isEmpty {
            return parsedTitle
        }

        guard let firstUserMessage = conversation.messages.first(where: { $0.role == .user }) else {
            return parsedTitle
        }

        let parsedMessage = ChatDisplayText.parse(firstUserMessage.content)
        return parsedMessage.body.isEmpty ? parsedTitle : parsedMessage
    }

    private var titleBody: String {
        let body = displayText.body.trimmingCharacters(in: .whitespacesAndNewlines)
        if !body.isEmpty {
            return body
        }
        return conversation.title == "New Chat" ? (appLanguage == .english ? "New chat" : "新聊天") : ""
    }

    private var leadingPinSlot: some View {
        SidebarPinIcon()
            .foregroundStyle(AppTheme.textTertiary)
            .frame(
                width: AssistantPanelLayout.sidebarIconColumnWidth,
                height: DesignTokens.ControlSize.standardButton
            )
            .opacity(conversation.isPinned ? 1 : 0)
    }

    private var titleContent: some View {
        HStack(spacing: 6) {
            if let invocation = displayText.invocations.first {
                ChatInvocationChip(invocation: invocation, compact: true)
            }

            Text(titleBody)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
        }
    }

    private var trailingTime: some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            Text(Self.relativeAgeText(for: conversation.updatedAt, now: context.date, language: appLanguage))
                .font(.system(size: DesignTokens.FontSize.metadata))
                .foregroundStyle(AppTheme.textTertiary)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
        }
    }

    @ViewBuilder
    private var trailingStatus: some View {
        if isLoading {
            ProgressView()
                .controlSize(.small)
                .scaleEffect(0.72)
                .accessibilityLabel(tr("生成中", "Generating"))
        } else if gitShowsPullRequestIcon && hasPullRequestDirective {
            Image(systemName: "globe")
                .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
                .accessibilityLabel(tr("包含 PR", "Contains pull request"))
        } else {
            trailingTime
        }
    }

    private var hasPullRequestDirective: Bool {
        conversation.messages.contains { message in
            message.content.contains("::git-create-pr{")
        }
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }
}

struct SidebarPinIcon: View {
    var body: some View {
        SidebarPinShape()
            .fill(style: FillStyle(eoFill: true))
            .frame(width: DesignTokens.IconSize.medium, height: DesignTokens.IconSize.medium)
            .frame(
                width: AssistantPanelLayout.sidebarIconColumnWidth,
                height: DesignTokens.ControlSize.standardButton
            )
            .accessibilityHidden(true)
    }
}

private struct SidebarPinShape: Shape {
    func path(in rect: CGRect) -> Path {
        let x = rect.minX
        let y = rect.minY
        let w = rect.width
        let h = rect.height
        func p(_ px: CGFloat, _ py: CGFloat) -> CGPoint {
            CGPoint(x: x + w * (px / 1024), y: y + h * (py / 1024))
        }

        var path = Path()

        path.move(to: p(916.8, 380.8))
        path.addLine(to: p(645.0, 109.4))
        path.addCurve(to: p(619.1, 98.7), control1: p(637.8, 102.2), control2: p(628.5, 98.7))
        path.addCurve(to: p(593.2, 109.4), control1: p(609.7, 98.7), control2: p(600.3, 102.2))
        path.addLine(to: p(415.5, 286.9))
        path.addCurve(to: p(374.9, 284.7), control1: p(402.0, 285.4), control2: p(388.5, 284.7))
        path.addCurve(to: p(147.1, 364.3), control1: p(294.2, 284.7), control2: p(213.4, 311.2))
        path.addCurve(to: p(144.1, 418.7), control1: p(130.1, 377.8), control2: p(128.7, 403.3))
        path.addLine(to: p(344.5, 618.8))
        path.addLine(to: p(106.9, 856.0))
        path.addCurve(to: p(101.8, 866.8), control1: p(104.0, 858.9), control2: p(102.2, 862.7))
        path.addLine(to: p(98.1, 907.8))
        path.addCurve(to: p(115.6, 927.0), control1: p(97.1, 918.2), control2: p(105.4, 927.0))
        path.addCurve(to: p(117.3, 926.9), control1: p(116.2, 927.0), control2: p(116.7, 927.0))
        path.addLine(to: p(158.3, 923.2))
        path.addCurve(to: p(169.1, 918.1), control1: p(162.4, 922.9), control2: p(166.2, 921.0))
        path.addLine(to: p(406.7, 680.8))
        path.addLine(to: p(607.1, 880.9))
        path.addCurve(to: p(633.0, 891.6), control1: p(614.3, 888.1), control2: p(623.6, 891.6))
        path.addCurve(to: p(661.6, 877.9), control1: p(643.7, 891.6), control2: p(654.3, 887.0))
        path.addCurve(to: p(739.0, 609.8), control1: p(723.7, 800.5), control2: p(749.5, 703.5))
        path.addLine(to: p(916.7, 432.4))
        path.addCurve(to: p(916.8, 380.8), control1: p(931.1, 418.2), control2: p(931.1, 395.1))
        path.closeSubpath()

        path.move(to: p(682.9, 553.9))
        path.addLine(to: p(655.9, 580.9))
        path.addLine(to: p(660.1, 618.8))
        path.addCurve(to: p(651.1, 728.6), control1: p(664.2, 655.9), control2: p(661.2, 692.8))
        path.addCurve(to: p(626.6, 788.3), control1: p(645.1, 749.5), control2: p(637.0, 769.5))
        path.addLine(to: p(237.0, 399.2))
        path.addCurve(to: p(281.5, 379.5), control1: p(251.2, 391.4), control2: p(266.0, 384.8))
        path.addCurve(to: p(374.9, 364.0), control1: p(311.5, 369.1), control2: p(342.9, 364.0))
        path.addCurve(to: p(406.8, 365.8), control1: p(385.5, 364.0), control2: p(396.2, 364.5))
        path.addLine(to: p(444.7, 370.0))
        path.addLine(to: p(619.2, 195.7))
        path.addLine(to: p(830.4, 406.6))
        path.addLine(to: p(682.9, 553.9))
        path.closeSubpath()

        return path
    }
}

struct SidebarArchiveIcon: View {
    var body: some View {
        SidebarArchiveShape()
            .stroke(style: StrokeStyle(lineWidth: 1.1, lineCap: .round, lineJoin: .round))
            .frame(width: DesignTokens.IconSize.medium, height: DesignTokens.IconSize.medium)
            .frame(
                width: AssistantPanelLayout.sidebarIconColumnWidth,
                height: DesignTokens.ControlSize.standardButton
            )
            .accessibilityHidden(true)
    }
}

struct SidebarFilterIcon: View {
    var body: some View {
        SidebarFilterShape()
            .stroke(style: StrokeStyle(lineWidth: 1.35, lineCap: .round, lineJoin: .round))
            .frame(width: DesignTokens.IconSize.medium, height: DesignTokens.IconSize.medium)
            .frame(
                width: AssistantPanelLayout.sidebarIconColumnWidth,
                height: DesignTokens.ControlSize.standardButton
            )
            .accessibilityHidden(true)
    }
}

private struct SidebarFilterShape: Shape {
    func path(in rect: CGRect) -> Path {
        let x = rect.minX
        let y = rect.minY
        let w = rect.width
        let h = rect.height
        var path = Path()

        path.move(to: CGPoint(x: x + w * 0.12, y: y + h * 0.20))
        path.addLine(to: CGPoint(x: x + w * 0.88, y: y + h * 0.20))
        path.move(to: CGPoint(x: x + w * 0.27, y: y + h * 0.50))
        path.addLine(to: CGPoint(x: x + w * 0.73, y: y + h * 0.50))
        path.move(to: CGPoint(x: x + w * 0.40, y: y + h * 0.80))
        path.addLine(to: CGPoint(x: x + w * 0.60, y: y + h * 0.80))
        return path
    }
}

private struct SidebarArchiveShape: Shape {
    func path(in rect: CGRect) -> Path {
        let x = rect.minX
        let y = rect.minY
        let w = rect.width
        let h = rect.height
        var path = Path()
        path.move(to: CGPoint(x: x + w * 0.28, y: y + h * 0.10))
        path.addLine(to: CGPoint(x: x + w * 0.70, y: y + h * 0.10))
        path.addQuadCurve(
            to: CGPoint(x: x + w * 0.82, y: y + h * 0.22),
            control: CGPoint(x: x + w * 0.82, y: y + h * 0.10)
        )
        path.addLine(to: CGPoint(x: x + w * 0.82, y: y + h * 0.72))
        path.addQuadCurve(
            to: CGPoint(x: x + w * 0.70, y: y + h * 0.84),
            control: CGPoint(x: x + w * 0.82, y: y + h * 0.84)
        )
        path.addLine(to: CGPoint(x: x + w * 0.34, y: y + h * 0.84))
        path.addQuadCurve(
            to: CGPoint(x: x + w * 0.18, y: y + h * 0.98),
            control: CGPoint(x: x + w * 0.18, y: y + h * 0.84)
        )
        path.addQuadCurve(
            to: CGPoint(x: x + w * 0.34, y: y + h * 0.92),
            control: CGPoint(x: x + w * 0.22, y: y + h * 0.92)
        )
        path.addLine(to: CGPoint(x: x + w * 0.84, y: y + h * 0.92))
        path.move(to: CGPoint(x: x + w * 0.18, y: y + h * 0.98))
        path.addLine(to: CGPoint(x: x + w * 0.18, y: y + h * 0.24))
        path.addQuadCurve(
            to: CGPoint(x: x + w * 0.28, y: y + h * 0.10),
            control: CGPoint(x: x + w * 0.18, y: y + h * 0.14)
        )
        path.move(to: CGPoint(x: x + w * 0.36, y: y + h * 0.34))
        path.addLine(to: CGPoint(x: x + w * 0.64, y: y + h * 0.34))
        path.move(to: CGPoint(x: x + w * 0.36, y: y + h * 0.56))
        path.addLine(to: CGPoint(x: x + w * 0.64, y: y + h * 0.56))
        return path
    }
}

struct ChatInvocationChip: View {
    let invocation: ChatDisplayInvocation
    var compact = false

    var body: some View {
        HStack(spacing: compact ? 3 : 4) {
            Image(systemName: systemImageName)
                .font(.system(size: compact ? 11 : 13, weight: .semibold))
                .symbolRenderingMode(.hierarchical)

            Text(displayName)
                .font(.system(size: compact ? 12 : 14, weight: .semibold))
                .lineLimit(1)
        }
        .foregroundStyle(tint)
        .fixedSize(horizontal: true, vertical: false)
        .accessibilityElement(children: .combine)
    }

    private var displayName: String {
        switch invocation.kind {
        case .plugin:
            return invocation.name
        case .skill:
            return Self.humanizedSkillName(invocation.name)
        }
    }

    private var systemImageName: String {
        switch invocation.kind {
        case .skill:
            return "cube.box"
        case .plugin:
            let normalized = invocation.name.lowercased()
            if normalized.contains("电脑") || normalized.contains("computer") {
                return "desktopcomputer"
            }
            if normalized.contains("浏览器") || normalized.contains("browser") {
                return "safari"
            }
            if normalized.contains("spreadsheet") || normalized.contains("sheet") {
                return "tablecells"
            }
            if normalized.contains("github") {
                return "chevron.left.forwardslash.chevron.right"
            }
            if normalized.contains("presentation") || normalized.contains("slide") {
                return "rectangle.on.rectangle.angled"
            }
            if normalized.contains("notion") {
                return "doc.text"
            }
            return "puzzlepiece.extension"
        }
    }

    private var tint: Color {
        switch invocation.kind {
        case .skill:
            return AppTheme.accent
        case .plugin:
            let normalized = invocation.name.lowercased()
            if normalized.contains("spreadsheet") || normalized.contains("sheet") {
                return Color(nsColor: .systemGreen)
            }
            if normalized.contains("presentation") || normalized.contains("slide") {
                return Color(nsColor: .systemOrange)
            }
            if normalized.contains("github") {
                return AppTheme.textSecondary
            }
            if normalized.contains("电脑")
                || normalized.contains("computer")
                || normalized.contains("浏览器")
                || normalized.contains("browser") {
                return AppTheme.accent
            }
            return AppTheme.textSecondary
        }
    }

    private static func humanizedSkillName(_ name: String) -> String {
        name
            .split(whereSeparator: { $0 == "-" || $0 == "_" || $0 == "." })
            .map { word in
                guard let first = word.first else {
                    return ""
                }
                return first.uppercased() + String(word.dropFirst())
            }
            .joined(separator: " ")
    }
}

struct WindowChromeMetrics: Equatable {
    var titleBarHeight: CGFloat = 32
}

struct WindowChromeMetricsReader: NSViewRepresentable {
    @Binding var metrics: WindowChromeMetrics

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        view.isHidden = true
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            updateMetrics(from: nsView)
        }
    }

    private func updateMetrics(from view: NSView) {
        guard let window = view.window else {
            return
        }

        let titleBarHeight = max(28, window.frame.height - window.contentLayoutRect.height)
        let updated = WindowChromeMetrics(titleBarHeight: titleBarHeight)

        guard updated != metrics else {
            return
        }

        metrics = updated
    }
}

struct InlineNotice: View {
    let text: String
    let tint: Color

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(tint.opacity(0.9))
                .frame(width: DesignTokens.Spacing.related, height: DesignTokens.Spacing.related)
            Text(text)
                .font(.system(size: DesignTokens.FontSize.caption))
                .foregroundStyle(AppTheme.textSecondary)
                .textSelection(.enabled)
            Spacer()
        }
        .padding(.horizontal, DesignTokens.Spacing.content)
        .padding(.vertical, DesignTokens.Spacing.control)
        .background(tint.opacity(0.10))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium)
                .stroke(tint.opacity(0.18), lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium))
        .accessibilityElement(children: .combine)
    }
}
