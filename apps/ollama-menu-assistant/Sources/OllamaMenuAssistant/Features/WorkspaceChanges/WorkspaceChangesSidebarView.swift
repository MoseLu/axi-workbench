import SwiftUI

private enum WorkspaceChangesLoadState: Equatable {
    case idle
    case loading
    case loaded(WorkspaceChangeSnapshot)
    case failed(String)
}

private enum WorkspaceDiffPresentationMode: Equatable {
    case unified
    case split

    mutating func toggle() {
        self = self == .unified ? .split : .unified
    }
}

struct WorkspaceChangesSidebarView: View {
    private static let fileActionSpacing: CGFloat = 2
    private static let fileActionButtonCount: CGFloat = 3
    private static let fileActionSlotWidth = (DesignTokens.IconFrame.sidebarAction * fileActionButtonCount)
        + (fileActionSpacing * (fileActionButtonCount - 1))

    let project: ConversationProject?
    @Binding var isCollapsed: Bool

    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @AppStorage(DefaultEditorTarget.storageKey) private var defaultEditorRaw = DefaultEditorTarget.finder.rawValue
    @AppStorage(GitSettingsPreferences.branchPrefixKey) private var gitBranchPrefix = GitSettingsPreferences.defaultBranchPrefix
    @AppStorage(GitSettingsPreferences.pullRequestMergeMethodKey) private var gitPullRequestMergeMethod = GitSettingsPreferences.defaultPullRequestMergeMethod
    @AppStorage(GitSettingsPreferences.alwaysForcePushKey) private var gitAlwaysForcePush = GitSettingsPreferences.defaultAlwaysForcePush
    @AppStorage(GitSettingsPreferences.createsDraftPullRequestKey) private var gitCreatesDraftPullRequest = GitSettingsPreferences.defaultCreatesDraftPullRequest
    @State private var loadState: WorkspaceChangesLoadState = .idle
    @State private var expandedFileIDs = Set<String>()
    @State private var reloadID = UUID()
    @State private var scrollMetrics = AppScrollMetrics()
    @State private var scrollController = AppScrollController()
    @State private var diffPresentationMode: WorkspaceDiffPresentationMode = .unified
    @State private var isOptionsMenuPresented = false
    @State private var isGitMenuPresented = false
    @State private var isFileFilterMode = false
    @State private var fileFilterQuery = ""
    @State private var isAutoWrapDisabled = true
    @State private var loadsCompleteFiles = false
    @State private var richTextPreviewEnabled = false
    @State private var textDiffEnabled = true
    @State private var hidesWhitespaceOnlyLines = false
    @State private var hoveredFileID: String?
    @State private var activeFileActionID: String?
    @State private var fileActionErrorMessage: String?
    private let workspaceActions = WorkspaceChangeActions()

    var body: some View {
        GeometryReader { geometry in
            let isCompact = geometry.size.width < 360

            VStack(spacing: 0) {
                header(isCompact: isCompact)
                Rectangle()
                    .fill(AppTheme.border)
                    .frame(height: DesignTokens.Stroke.hairline)
                content(isCompact: isCompact)
            }
            .frame(width: geometry.size.width, height: geometry.size.height, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(AppTheme.canvas)
        .task(id: loadTaskID) {
            await loadChanges()
        }
        .onChange(of: project?.path ?? "") { _, _ in
            expandedFileIDs.removeAll()
            hoveredFileID = nil
            activeFileActionID = nil
            fileActionErrorMessage = nil
        }
        .onReceive(NotificationCenter.default.publisher(for: .workspaceGitBranchDidChange)) { notification in
            guard let changedPath = notification.userInfo?["projectPath"] as? String,
                  changedPath == project?.path else {
                return
            }
            expandedFileIDs.removeAll()
            reloadID = UUID()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("changes.sidebar")
    }

    @ViewBuilder
    private func header(isCompact: Bool) -> some View {
        if isCompact {
            HStack(spacing: 6) {
                Text(headerTitle)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.86)
                    .layoutPriority(1)

                if let snapshot = loadedSnapshot {
                    Text("\(snapshot.fileCount)")
                        .font(.system(size: DesignTokens.FontSize.metadata, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .padding(.horizontal, 7)
                        .frame(height: 22)
                        .background(AppTheme.surfaceRaised)
                        .clipShape(Capsule())
                        .fixedSize(horizontal: true, vertical: false)

                    Text("+\(snapshot.totalAdditions)")
                        .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                        .foregroundStyle(AppTheme.diffAddedText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.86)
                        .fixedSize(horizontal: true, vertical: false)

                    Text("-\(snapshot.totalDeletions)")
                        .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                        .foregroundStyle(AppTheme.diffRemovedText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.86)
                        .fixedSize(horizontal: true, vertical: false)
                }

                Spacer(minLength: 4)

                optionsMenuButton
                gitOperationsButton
                fileFilterButton
            }
            .padding(.horizontal, DesignTokens.Spacing.content)
            .frame(height: 42)
        } else {
            HStack(spacing: 8) {
                Text(headerTitle)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textSecondary)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)

                if let snapshot = loadedSnapshot {
                    Text("\(snapshot.fileCount)")
                        .font(.system(size: DesignTokens.FontSize.metadata, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .padding(.horizontal, 7)
                        .frame(height: 22)
                        .background(AppTheme.surfaceRaised)
                        .clipShape(Capsule())
                        .fixedSize(horizontal: true, vertical: false)

                    Text("+\(snapshot.totalAdditions)")
                        .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                        .foregroundStyle(AppTheme.diffAddedText)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)

                    Text("-\(snapshot.totalDeletions)")
                        .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                        .foregroundStyle(AppTheme.diffRemovedText)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                }

                Spacer(minLength: 8)

                optionsMenuButton
                diffPresentationToggleButton
                gitOperationsButton
                fileFilterButton
            }
            .padding(.horizontal, DesignTokens.Spacing.content)
            .frame(height: 42)
        }
    }

    private var optionsMenuButton: some View {
        AppIconButton(
            systemName: "ellipsis",
            accessibilityLabel: tr("修改显示菜单", "Changes display menu"),
            help: tr("修改显示菜单", "Changes display menu"),
            hoverStyle: .titleBar,
            tint: AppTheme.textTertiary
        ) {
            isOptionsMenuPresented.toggle()
        }
        .popover(isPresented: $isOptionsMenuPresented, arrowEdge: .bottom) {
            optionsMenuPanel
        }
    }

    private var optionsMenuPanel: some View {
        VStack(alignment: .leading, spacing: 2) {
            menuActionRow(title: tr("刷新", "Refresh"), systemName: "arrow.clockwise") {
                reloadID = UUID()
                isOptionsMenuPresented = false
            }
            menuActionRow(title: diffPresentationToggleTitle, systemName: "rectangle.split.2x1") {
                diffPresentationMode.toggle()
                isOptionsMenuPresented = false
            }
            menuToggleRow(
                title: isAutoWrapDisabled ? tr("启用自动换行", "Enable word wrap") : tr("禁用自动换行", "Disable word wrap"),
                systemName: "increase.indent",
                isOn: !isAutoWrapDisabled
            ) {
                isAutoWrapDisabled.toggle()
            }
            menuActionRow(title: tr("折叠全部差异", "Collapse all diffs"), systemName: "arrow.down.right.and.arrow.up.left") {
                expandedFileIDs.removeAll()
                isOptionsMenuPresented = false
            }

            Divider().padding(.vertical, DesignTokens.Spacing.compact)

            menuToggleRow(title: tr("加载完整文件", "Load full files"), systemName: "doc", isOn: loadsCompleteFiles) {
                loadsCompleteFiles.toggle()
            }
            menuToggleRow(title: tr("富文本预览", "Rich text preview"), systemName: "photo", isOn: richTextPreviewEnabled) {
                richTextPreviewEnabled.toggle()
            }
            menuToggleRow(title: tr("文字差异", "Text diff"), systemName: "text.alignleft", isOn: textDiffEnabled) {
                textDiffEnabled.toggle()
            }
            menuToggleRow(title: tr("隐藏空白字符", "Hide whitespace"), systemName: "eye", isOn: hidesWhitespaceOnlyLines) {
                hidesWhitespaceOnlyLines.toggle()
            }
            menuActionRow(title: tr("复制 git apply 命令", "Copy git apply command"), systemName: "doc.on.doc") {
                copyGitApplyCommand()
                isOptionsMenuPresented = false
            }
        }
        .padding(DesignTokens.Spacing.control)
        .frame(width: 224, alignment: .leading)
        .background(AppTheme.surface)
    }

    private var diffPresentationToggleButton: some View {
        AppIconGlyphButton(
            accessibilityLabel: diffPresentationToggleTitle,
            help: diffPresentationToggleTitle,
            hoverStyle: .titleBar,
            keyboardShortcut: KeyboardShortcut("d", modifiers: [.command, .shift]),
            action: {
                diffPresentationMode.toggle()
            }
        ) {
            DiffPresentationGlyph(mode: diffPresentationMode)
        }
    }

    private var gitOperationsButton: some View {
        WorkspaceHeaderGlyphButton(
            glyph: .gitBranch,
            accessibilityLabel: tr("Git 操作", "Git operations"),
            help: tr("Git 操作", "Git operations"),
            tint: AppTheme.textTertiary
        ) {
            isGitMenuPresented.toggle()
        }
        .popover(isPresented: $isGitMenuPresented, arrowEdge: .bottom) {
            gitOperationsPanel
        }
    }

    private var gitOperationsPanel: some View {
        VStack(alignment: .leading, spacing: 2) {
            menuActionRow(title: tr("提交", "Commit"), systemName: "circle") {
                copyGitCommand("git status --short && git add -A && git commit")
                isGitMenuPresented = false
            }
            menuActionRow(title: tr("推送", "Push"), systemName: "icloud.and.arrow.up") {
                copyGitCommand(GitSettingsPreferences.pushCommand(forceWithLease: gitAlwaysForcePush))
                isGitMenuPresented = false
            }
            menuActionRow(title: tr("创建拉取请求", "Create pull request"), systemName: "globe") {
                copyGitCommand(GitSettingsPreferences.createPullRequestCommand(draft: gitCreatesDraftPullRequest))
                isGitMenuPresented = false
            }
            menuActionRow(title: tr("合并拉取请求", "Merge pull request"), systemName: "arrow.triangle.merge") {
                copyGitCommand(
                    GitSettingsPreferences.mergePullRequestCommand(
                        method: GitPullRequestMergeMethod(storedValue: gitPullRequestMergeMethod)
                    )
                )
                isGitMenuPresented = false
            }
            menuActionRow(title: tr("创建分支", "Create branch"), systemName: "arrow.triangle.branch") {
                copyGitCommand(GitSettingsPreferences.createBranchCommand(branchPrefix: gitBranchPrefix))
                isGitMenuPresented = false
            }
        }
        .padding(DesignTokens.Spacing.control)
        .frame(width: 184, alignment: .leading)
        .background(AppTheme.surface)
    }

    private var fileFilterButton: some View {
        WorkspaceHeaderGlyphButton(
            glyph: .folder,
            accessibilityLabel: tr("筛选文件", "Filter files"),
            help: tr("筛选文件", "Filter files"),
            tint: isFileFilterMode ? AppTheme.textPrimary : AppTheme.textTertiary
        ) {
            isFileFilterMode.toggle()
        }
    }

    @ViewBuilder
    private func content(isCompact: Bool) -> some View {
        switch loadState {
        case .idle, .loading:
            ProgressView()
                .controlSize(.small)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityLabel(tr("正在加载修改", "Loading changes"))
        case .failed(let message):
            emptyState(
                systemName: "exclamationmark.triangle",
                title: tr("无法读取修改", "Unable to read changes"),
                detail: localizedErrorMessage(message)
            )
        case .loaded(let snapshot):
            if isFileFilterMode {
                fileFilterView(snapshot, isCompact: isCompact)
            } else if snapshot.files.isEmpty {
                emptyState(
                    systemName: "checkmark.circle",
                    title: tr("没有修改", "No changes"),
                    detail: tr("当前项目没有未提交的文件修改。", "This project has no uncommitted file changes.")
                )
            } else {
                changesList(snapshot, isCompact: isCompact)
            }
        }
    }

    private func changesList(_ snapshot: WorkspaceChangeSnapshot, isCompact: Bool) -> some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: 0) {
                if snapshot.didTruncate {
                    truncationNotice
                        .padding(.horizontal, DesignTokens.Spacing.content)
                        .padding(.top, DesignTokens.Spacing.control)
                        .padding(.bottom, DesignTokens.Spacing.compact)
                }

                if let fileActionErrorMessage {
                    InlineNotice(text: fileActionErrorMessage, tint: AppTheme.destructive)
                        .padding(.horizontal, DesignTokens.Spacing.content)
                        .padding(.bottom, DesignTokens.Spacing.compact)
                }

                ForEach(snapshot.files) { file in
                    changedFileSection(file, isCompact: isCompact)
                }
            }
            .padding(.vertical, DesignTokens.Spacing.control)
            .background(
                AppScrollMetricsReader(
                    metrics: $scrollMetrics,
                    controller: scrollController
                )
            )
        }
        .overlay(alignment: .topTrailing) {
            AppVerticalScrollIndicator(
                metrics: scrollMetrics,
                controller: scrollController,
                width: 6,
                trailingInset: 3,
                verticalInset: 6,
                minimumThumbHeight: 34
            )
        }
    }

    private func fileFilterView(_ snapshot: WorkspaceChangeSnapshot, isCompact: Bool) -> some View {
        return VStack(alignment: .leading, spacing: 0) {
            TextField(tr("筛选文件...", "Filter files..."), text: $fileFilterQuery)
                .textFieldStyle(.plain)
                .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(AppTheme.surfaceRaised.opacity(0.42))
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                        .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
                )
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
                .padding(.horizontal, DesignTokens.Spacing.content)
                .padding(.top, DesignTokens.Spacing.control)
                .padding(.bottom, DesignTokens.Spacing.related)

            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(filteredFiles(in: snapshot)) { file in
                        Button {
                            expandedFileIDs = [file.id]
                            isFileFilterMode = false
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: fileIconName(for: file))
                                    .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                                    .foregroundStyle(file.status == .untracked ? AppTheme.accent : AppTheme.warning)
                                    .frame(width: DesignTokens.IconFrame.sidebar)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(isCompact ? fileDisplayName(for: file.path) : file.path)
                                        .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                                        .foregroundStyle(AppTheme.textPrimary)
                                        .lineLimit(1)
                                        .truncationMode(isCompact ? .tail : .middle)

                                    if isCompact, let parentPath = fileParentPath(for: file.path) {
                                        Text(parentPath)
                                            .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
                                            .foregroundStyle(AppTheme.textTertiary)
                                            .lineLimit(1)
                                            .truncationMode(.middle)
                                    }
                                }
                                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

                                Spacer(minLength: 8)
                            }
                            .padding(.horizontal, DesignTokens.Spacing.content)
                            .frame(minHeight: isCompact ? 40 : 28)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.bottom, DesignTokens.Spacing.control)
            }
        }
    }

    private func changedFileSection(_ file: WorkspaceChangedFile, isCompact: Bool) -> some View {
        let showsFileActions = fileActionsVisible(for: file)

        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Button {
                    toggle(file)
                } label: {
                    fileHeaderContent(file, isCompact: isCompact)
                }
                .buttonStyle(.plain)
                .frame(minWidth: 0, maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

                if showsFileActions {
                    fileHoverActions(file)
                }

                Button {
                    toggle(file)
                } label: {
                    Image(systemName: "chevron.down")
                        .font(.system(size: DesignTokens.IconSize.chevronSmall, weight: .semibold))
                        .foregroundStyle(AppTheme.textTertiary)
                        .rotationEffect(.degrees(isExpanded(file) ? 0 : -90))
                        .frame(width: DesignTokens.IconFrame.sidebar, height: DesignTokens.IconFrame.sidebar)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(.leading, DesignTokens.Spacing.content)
            .padding(.trailing, DesignTokens.Spacing.control)
            .padding(.vertical, isCompact ? 5 : 0)
            .frame(maxWidth: .infinity, minHeight: isCompact ? 46 : 36, alignment: .leading)
            .contentShape(Rectangle())
            .onHover { hovering in
                withAnimation(.easeOut(duration: 0.14)) {
                    hoveredFileID = hovering ? file.id : (hoveredFileID == file.id ? nil : hoveredFileID)
                }
            }
            .accessibilityLabel(file.path)
            .accessibilityValue(fileChangeAccessibilityValue(file))

            if isExpanded(file) {
                if file.hunks.isEmpty {
                    fileEmptyPreview(file)
                } else {
                    diffPreview(file, isCompact: isCompact)
                        .padding(.horizontal, DesignTokens.Spacing.content)
                        .padding(.bottom, DesignTokens.Spacing.control)
                }
            }
        }
    }

    @ViewBuilder
    private func fileHeaderContent(_ file: WorkspaceChangedFile, isCompact: Bool) -> some View {
        if isCompact {
            compactFileHeaderContent(file)
        } else {
            regularFileHeaderContent(file)
        }
    }

    private func regularFileHeaderContent(_ file: WorkspaceChangedFile) -> some View {
        HStack(spacing: 8) {
            Text(file.path)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                .truncationMode(.middle)
                .layoutPriority(-1)

            if file.status == .untracked {
                Circle()
                    .fill(AppTheme.accent)
                    .frame(width: 5, height: 5)
                    .accessibilityHidden(true)
            }

            Text("+\(file.additions)")
                .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                .foregroundStyle(AppTheme.diffAddedText)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)

            Text("-\(file.deletions)")
                .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                .foregroundStyle(AppTheme.diffRemovedText)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)

            Spacer(minLength: 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private func compactFileHeaderContent(_ file: WorkspaceChangedFile) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                Text(fileDisplayName(for: file.path))
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .layoutPriority(1)

                if file.status == .untracked {
                    Circle()
                        .fill(AppTheme.accent)
                        .frame(width: 5, height: 5)
                        .accessibilityHidden(true)
                }
            }

            HStack(spacing: 6) {
                if let parentPath = fileParentPath(for: file.path) {
                    Text(parentPath)
                        .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .layoutPriority(-1)
                }

                Text("+\(file.additions)")
                    .font(.system(size: DesignTokens.FontSize.metadata, weight: .semibold))
                    .foregroundStyle(AppTheme.diffAddedText)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)

                Text("-\(file.deletions)")
                    .font(.system(size: DesignTokens.FontSize.metadata, weight: .semibold))
                    .foregroundStyle(AppTheme.diffRemovedText)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private func fileHoverActions(_ file: WorkspaceChangedFile) -> some View {
        HStack(spacing: Self.fileActionSpacing) {
            WorkspaceFileActionButton(
                systemName: "arrow.uturn.backward",
                accessibilityLabel: tr("还原文件", "Restore file"),
                help: file.status == .untracked
                    ? tr("移除未跟踪文件", "Remove untracked file")
                    : tr("还原文件", "Restore file"),
                isEnabled: activeFileActionID == nil
            ) {
                performFileAction(.restore, for: file)
            }

            WorkspaceFileActionButton(
                systemName: "plus",
                accessibilityLabel: tr("暂存文件", "Stage file"),
                help: tr("暂存文件", "Stage file"),
                isEnabled: activeFileActionID == nil
            ) {
                performFileAction(.stage, for: file)
            }

            WorkspaceFileActionButton(
                systemName: "arrow.up.right.square",
                accessibilityLabel: tr("在编辑器中打开", "Open in editor"),
                help: tr("在编辑器中打开", "Open in editor"),
                isEnabled: activeFileActionID == nil
            ) {
                openFileInEditor(file)
            }
        }
        .frame(width: Self.fileActionSlotWidth, height: DesignTokens.IconFrame.sidebarAction)
        .transition(.opacity.combined(with: .move(edge: .trailing)))
    }

    @ViewBuilder
    private func diffPreview(_ file: WorkspaceChangedFile, isCompact: Bool) -> some View {
        if textDiffEnabled {
            if isCompact {
                unifiedDiffPreview(file, isCompact: true)
            } else {
                switch diffPresentationMode {
                case .unified:
                    unifiedDiffPreview(file, isCompact: false)
                case .split:
                    splitDiffPreview(file, isCompact: false)
                }
            }
        } else {
            fileEmptyPreview(file)
        }
    }

    private func unifiedDiffPreview(_ file: WorkspaceChangedFile, isCompact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(file.hunks) { hunk in
                hunkHeader(hunk.header)
                ForEach(visibleLines(in: hunk.lines)) { line in
                    diffLine(line, isCompact: isCompact)
                }
            }
        }
        .diffPreviewChrome()
    }

    private func splitDiffPreview(_ file: WorkspaceChangedFile, isCompact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(file.hunks) { hunk in
                hunkHeader(hunk.header)
                ForEach(visibleLines(in: hunk.lines)) { line in
                    splitDiffLine(line, isCompact: isCompact)
                }
            }
        }
        .diffPreviewChrome()
    }

    private func hunkHeader(_ text: String) -> some View {
        HStack(spacing: 0) {
            Text(text)
                .font(codeFont(weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 8)
        .frame(height: 24)
        .background(AppTheme.surfaceRaised.opacity(0.55))
    }

    private func diffLine(_ line: WorkspaceDiffLine, isCompact: Bool) -> some View {
        HStack(spacing: 6) {
            if isCompact {
                Text(compactLineNumberText(line))
                    .frame(width: 34, alignment: .trailing)
            } else {
                Text(lineNumberText(line.oldLineNumber))
                    .frame(width: 30, alignment: .trailing)
                Text(lineNumberText(line.newLineNumber))
                    .frame(width: 30, alignment: .trailing)
            }

            Text(linePrefix(for: line.kind) + line.text)
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                .lineLimit(isCompact || !isAutoWrapDisabled ? nil : 1)
                .truncationMode(.tail)

            Spacer(minLength: 0)
        }
        .font(codeFont())
        .foregroundStyle(lineForeground(for: line.kind))
        .padding(.leading, 4)
        .padding(.trailing, 8)
        .frame(minHeight: 21)
        .background(lineBackground(for: line.kind))
        .overlay(alignment: .leading) {
            if let marker = lineMarker(for: line.kind) {
                Rectangle()
                    .fill(marker)
                    .frame(width: 3)
            }
        }
    }

    private func splitDiffLine(_ line: WorkspaceDiffLine, isCompact: Bool) -> some View {
        Group {
            if line.kind == .metadata {
                diffLine(line, isCompact: isCompact)
            } else {
                HStack(spacing: 0) {
                    splitDiffCell(
                        lineNumber: lineNumberText(line.oldLineNumber),
                        text: splitOldText(for: line),
                        kind: splitOldKind(for: line),
                        isCompact: isCompact
                    )

                    Rectangle()
                        .fill(AppTheme.border)
                        .frame(width: DesignTokens.Stroke.hairline)

                    splitDiffCell(
                        lineNumber: lineNumberText(line.newLineNumber),
                        text: splitNewText(for: line),
                        kind: splitNewKind(for: line),
                        isCompact: isCompact
                    )
                }
                .font(codeFont())
                .frame(minHeight: 21)
            }
        }
    }

    private func splitDiffCell(lineNumber: String, text: String, kind: WorkspaceDiffLine.Kind, isCompact: Bool) -> some View {
        HStack(spacing: 6) {
            Text(lineNumber)
                .foregroundStyle(AppTheme.themePreviewLineNumber)
                .frame(width: isCompact ? 24 : 30, alignment: .trailing)

            Text(text)
                .foregroundStyle(lineForeground(for: kind))
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                .lineLimit(isCompact || !isAutoWrapDisabled ? nil : 1)
                .truncationMode(.tail)
        }
        .padding(.leading, 4)
        .padding(.trailing, 8)
        .frame(maxWidth: .infinity, minHeight: 21)
        .background(lineBackground(for: kind))
        .overlay(alignment: .leading) {
            if let marker = lineMarker(for: kind) {
                Rectangle()
                    .fill(marker)
                    .frame(width: 3)
            }
        }
    }

    private func fileEmptyPreview(_ file: WorkspaceChangedFile) -> some View {
        Text(file.status == .untracked ? tr("新文件尚未纳入差异预览。", "New files are not included in the diff preview yet.") : tr("该文件没有可显示的文本差异。", "No text diff is available for this file."))
            .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
            .foregroundStyle(AppTheme.textTertiary)
            .padding(.horizontal, DesignTokens.Spacing.content)
            .padding(.bottom, DesignTokens.Spacing.control)
    }

    private var truncationNotice: some View {
        InlineNotice(
            text: tr("差异内容较大，已截断显示。", "Large diff truncated for display."),
            tint: AppTheme.warning
        )
    }

    private func emptyState(systemName: String, title: String, detail: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: systemName)
                .font(.system(size: DesignTokens.IconSize.large, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)

            Text(title)
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)

            Text(detail)
                .font(.system(size: DesignTokens.FontSize.caption))
                .foregroundStyle(AppTheme.textSecondary)
                .multilineTextAlignment(.center)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(DesignTokens.Spacing.window)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func menuActionRow(title: String, systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            menuRowContent(title: title, systemName: systemName, trailingSystemName: nil)
        }
        .buttonStyle(.plain)
    }

    private func menuToggleRow(title: String, systemName: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            menuRowContent(title: title, systemName: systemName, trailingSystemName: isOn ? "checkmark" : nil)
        }
        .buttonStyle(.plain)
    }

    private func menuRowContent(title: String, systemName: String, trailingSystemName: String?) -> some View {
        HStack(spacing: 9) {
            Image(systemName: systemName)
                .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
                .frame(width: DesignTokens.IconFrame.sidebar)

            Text(title)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)

            Spacer(minLength: 8)

            if let trailingSystemName {
                Image(systemName: trailingSystemName)
                    .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.related)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ControlSize.menuRow, alignment: .leading)
        .contentShape(Rectangle())
    }

    private var loadedSnapshot: WorkspaceChangeSnapshot? {
        guard case .loaded(let snapshot) = loadState else {
            return nil
        }
        return snapshot
    }

    private var loadTaskID: String {
        "\(project?.path ?? "no-project")-\(reloadID.uuidString)"
    }

    private var headerTitle: String {
        tr("未提交", "Changes")
    }

    private var diffPresentationToggleTitle: String {
        diffPresentationMode == .unified
            ? tr("切换到拆分差异", "Switch to split diff")
            : tr("切换到统一差异", "Switch to unified diff")
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }

    private var projectRootURL: URL? {
        guard let path = project?.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !path.isEmpty else {
            return nil
        }
        return URL(fileURLWithPath: path).standardizedFileURL
    }

    private func loadChanges() async {
        guard let path = project?.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !path.isEmpty else {
            loadState = .failed(tr("选择项目后查看修改。", "Select a project to view changes."))
            return
        }

        loadState = .loading
        do {
            let snapshot = try await WorkspaceChangesLoader.load(projectPath: path)
            loadState = .loaded(snapshot)
            let validIDs = Set(snapshot.files.map(\.id))
            expandedFileIDs = expandedFileIDs.intersection(validIDs)
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }

    private func toggle(_ file: WorkspaceChangedFile) {
        if expandedFileIDs.contains(file.id) {
            expandedFileIDs.remove(file.id)
        } else {
            expandedFileIDs.insert(file.id)
        }
    }

    private func isExpanded(_ file: WorkspaceChangedFile) -> Bool {
        expandedFileIDs.contains(file.id)
    }

    private func localizedErrorMessage(_ message: String) -> String {
        switch message {
        case "No workspace folder is selected.":
            tr("选择项目后查看修改。", "Select a project to view changes.")
        case "The selected workspace is not a Git repository.":
            tr("当前项目不是 Git 仓库。", "The selected project is not a Git repository.")
        default:
            message
        }
    }

    private func fileChangeAccessibilityValue(_ file: WorkspaceChangedFile) -> String {
        let status = file.status == .untracked ? tr("未跟踪", "untracked") : tr("已修改", "modified")
        return "\(status), +\(file.additions), -\(file.deletions)"
    }

    private func fileActionsVisible(for file: WorkspaceChangedFile) -> Bool {
        hoveredFileID == file.id || activeFileActionID == file.id
    }

    private func fileDisplayName(for path: String) -> String {
        path.split(separator: "/").last.map(String.init) ?? path
    }

    private func fileParentPath(for path: String) -> String? {
        let parts = path.split(separator: "/").map(String.init)
        guard parts.count > 1 else {
            return nil
        }
        return parts.dropLast().joined(separator: "/")
    }

    private func lineNumberText(_ value: Int?) -> String {
        value.map(String.init) ?? ""
    }

    private func compactLineNumberText(_ line: WorkspaceDiffLine) -> String {
        switch (line.oldLineNumber, line.newLineNumber) {
        case let (old?, new?) where old == new:
            return "\(new)"
        case let (old?, new?):
            return "\(old)→\(new)"
        case let (old?, nil):
            return "-\(old)"
        case let (nil, new?):
            return "+\(new)"
        case (nil, nil):
            return ""
        }
    }

    private func linePrefix(for kind: WorkspaceDiffLine.Kind) -> String {
        switch kind {
        case .addition:
            "+"
        case .deletion:
            "-"
        case .context:
            " "
        case .metadata:
            ""
        }
    }

    private func visibleLines(in lines: [WorkspaceDiffLine]) -> [WorkspaceDiffLine] {
        guard hidesWhitespaceOnlyLines else {
            return lines
        }
        return lines.filter { line in
            line.kind == .metadata || !line.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    private func splitOldText(for line: WorkspaceDiffLine) -> String {
        switch line.kind {
        case .addition:
            return ""
        case .deletion:
            return line.text
        case .context:
            return line.text
        case .metadata:
            return line.text
        }
    }

    private func splitNewText(for line: WorkspaceDiffLine) -> String {
        switch line.kind {
        case .addition:
            return line.text
        case .deletion:
            return ""
        case .context:
            return line.text
        case .metadata:
            return line.text
        }
    }

    private func splitOldKind(for line: WorkspaceDiffLine) -> WorkspaceDiffLine.Kind {
        line.kind == .deletion ? .deletion : .context
    }

    private func splitNewKind(for line: WorkspaceDiffLine) -> WorkspaceDiffLine.Kind {
        line.kind == .addition ? .addition : .context
    }

    private func filteredFiles(in snapshot: WorkspaceChangeSnapshot) -> [WorkspaceChangedFile] {
        let query = fileFilterQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return snapshot.files
        }
        return snapshot.files.filter { file in
            file.path.localizedCaseInsensitiveContains(query)
        }
    }

    private func fileIconName(for file: WorkspaceChangedFile) -> String {
        if file.path.hasSuffix(".swift") {
            return "swift"
        }
        if file.path.hasSuffix(".md") {
            return "doc.richtext"
        }
        return file.status == .untracked ? "doc.badge.plus" : "doc.text"
    }

    private func performFileAction(_ action: WorkspaceChangedFileAction, for file: WorkspaceChangedFile) {
        Task {
            await runFileAction(action, for: file)
        }
    }

    @MainActor
    private func runFileAction(_ action: WorkspaceChangedFileAction, for file: WorkspaceChangedFile) async {
        activeFileActionID = file.id
        fileActionErrorMessage = nil
        let result = await workspaceActions.runFileAction(action, for: file, projectRootURL: projectRootURL)
        activeFileActionID = nil

        switch result {
        case let .success(completedAction):
            if completedAction == .restore {
                expandedFileIDs.remove(file.id)
            }
            reloadID = UUID()
        case let .failure(failure):
            fileActionErrorMessage = localizedFileActionFailure(failure)
            return
        }
    }

    private func openFileInEditor(_ file: WorkspaceChangedFile) {
        fileActionErrorMessage = nil
        if let failure = workspaceActions.openFile(file, projectRootURL: projectRootURL, defaultEditorRaw: defaultEditorRaw) {
            fileActionErrorMessage = localizedFileActionFailure(failure)
        }
    }

    private func localizedFileActionFailure(_ failure: WorkspaceChangeActionFailure) -> String {
        switch failure {
        case .missingProjectForFileAction:
            return tr("选择项目后再执行文件操作。", "Select a project before running file actions.")
        case .missingProjectForOpen:
            return tr("选择项目后再打开文件。", "Select a project before opening files.")
        case .missingFile:
            return tr("文件不存在，无法打开。", "The file does not exist and cannot be opened.")
        case .editorUnavailable:
            return tr("无法打开默认编辑器。", "Unable to open the default editor.")
        case let .commandFailed(output):
            let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                return tr("文件操作失败。", "File action failed.")
            }
            return trimmed
        }
    }

    private func copyGitApplyCommand() {
        workspaceActions.copyGitApplyCommand(projectPath: project?.path)
    }

    private func copyGitCommand(_ command: String) {
        workspaceActions.copyGitCommand(command, projectPath: project?.path)
    }

    private func lineForeground(for kind: WorkspaceDiffLine.Kind) -> Color {
        switch kind {
        case .addition:
            AppTheme.diffAddedText
        case .deletion:
            AppTheme.diffRemovedText
        case .context:
            AppTheme.themePreviewText
        case .metadata:
            AppTheme.textTertiary
        }
    }

    private func lineBackground(for kind: WorkspaceDiffLine.Kind) -> Color {
        switch kind {
        case .addition:
            AppTheme.diffAddedBackground
        case .deletion:
            AppTheme.diffRemovedBackground
        case .context, .metadata:
            AppTheme.transparent
        }
    }

    private func lineMarker(for kind: WorkspaceDiffLine.Kind) -> Color? {
        switch kind {
        case .addition:
            AppTheme.diffAddedText
        case .deletion:
            AppTheme.diffRemovedText
        case .context, .metadata:
            nil
        }
    }

    private func codeFont(weight: Font.Weight = .regular) -> Font {
        .system(size: DesignTokens.FontSize.metadata, weight: weight, design: .monospaced)
    }
}

private struct WorkspaceFileActionButton: View {
    let systemName: String
    let accessibilityLabel: String
    let help: String
    let isEnabled: Bool
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
                .foregroundStyle(isEnabled ? AppTheme.textTertiary : AppTheme.textTertiary.opacity(0.45))
                .frame(width: DesignTokens.IconFrame.sidebarAction, height: DesignTokens.IconFrame.sidebarAction)
                .background(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                        .fill(isHovered && isEnabled ? AppTheme.surfaceHover : AppTheme.transparent)
                )
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .onHover { hovering in
            isHovered = hovering
        }
        .animation(.easeOut(duration: 0.14), value: isHovered)
        .help(help)
        .accessibilityLabel(accessibilityLabel)
    }
}

private struct DiffPresentationGlyph: View {
    let mode: WorkspaceDiffPresentationMode

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 2)
                .stroke(AppTheme.textTertiary, lineWidth: DesignTokens.Stroke.hairline)
                .frame(width: 13, height: 11)

            if mode == .split {
                HStack(spacing: 1) {
                    Rectangle()
                        .fill(AppTheme.diffRemovedText)
                    Rectangle()
                        .fill(AppTheme.diffAddedText)
                }
                .frame(width: 8, height: 7)
            } else {
                VStack(spacing: 1) {
                    Rectangle()
                        .fill(AppTheme.diffRemovedText)
                    Rectangle()
                        .fill(AppTheme.diffAddedText)
                }
                .frame(width: 8, height: 7)
            }
        }
    }
}

private enum WorkspaceHeaderGlyph {
    case gitBranch
    case folder
}

private struct WorkspaceHeaderGlyphButton: View {
    let glyph: WorkspaceHeaderGlyph
    let accessibilityLabel: String
    let help: String
    let tint: Color
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            glyphView
                .frame(width: DesignTokens.ControlSize.standardButton, height: DesignTokens.ControlSize.standardButton)
                .background(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                        .fill(isHovered ? AppTheme.surfaceHover : AppTheme.transparent)
                )
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovered = hovering
        }
        .animation(.easeOut(duration: 0.14), value: isHovered)
        .help(help)
        .accessibilityLabel(accessibilityLabel)
    }

    @ViewBuilder
    private var glyphView: some View {
        switch glyph {
        case .gitBranch:
            GitBranchGlyph(tint: tint)
        case .folder:
            WorkspaceFolderGlyph(tint: tint)
        }
    }
}

private struct GitBranchGlyph: View {
    let tint: Color

    var body: some View {
        IconFontGitBranchShape()
            .fill(tint, style: FillStyle(eoFill: true))
        .frame(width: DesignTokens.ControlSize.standardButton, height: DesignTokens.ControlSize.standardButton)
    }
}

private struct IconFontGitBranchShape: Shape {
    private let viewBox: CGFloat = 1024

    func path(in rect: CGRect) -> Path {
        let side = min(rect.width, rect.height) * 0.62
        let scale = side / viewBox
        let origin = CGPoint(
            x: rect.midX - side / 2,
            y: rect.midY - side / 2
        )

        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: origin.x + x * scale, y: origin.y + y * scale)
        }

        var path = Path()
        let lineWidth = 85.333333 * scale
        let outerRadius = 149.333333 * scale
        let innerRadius = 64 * scale

        path.move(to: p(234.666667, 399.146667))
        path.addLine(to: p(234.666667, 624.853333))
        path.move(to: p(234.666667, 576))
        path.addCurve(
            to: p(362.666667, 533.333333),
            control1: p(265.770667, 576),
            control2: p(294.912, 533.333333)
        )
        path.addLine(to: p(661.333333, 533.333333))
        path.addCurve(
            to: p(789.333333, 405.333333),
            control1: p(732.032, 533.333333),
            control2: p(789.333333, 476.032)
        )
        path.addLine(to: p(789.333333, 399.146667))
        path = path.strokedPath(StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round))

        for center in [p(234.666667, 234.666667), p(789.333333, 234.666667), p(234.666667, 768)] {
            path.addEllipse(in: CGRect(
                x: center.x - outerRadius,
                y: center.y - outerRadius,
                width: outerRadius * 2,
                height: outerRadius * 2
            ))
            path.addEllipse(in: CGRect(
                x: center.x - innerRadius,
                y: center.y - innerRadius,
                width: innerRadius * 2,
                height: innerRadius * 2
            ))
        }

        return path
    }
}

private struct WorkspaceFolderGlyph: View {
    let tint: Color

    var body: some View {
        Path { path in
            path.move(to: CGPoint(x: 6.5, y: 10))
            path.addLine(to: CGPoint(x: 11.4, y: 10))
            path.addLine(to: CGPoint(x: 13.1, y: 12))
            path.addLine(to: CGPoint(x: 21.5, y: 12))
            path.addLine(to: CGPoint(x: 21.5, y: 19.5))
            path.addLine(to: CGPoint(x: 6.5, y: 19.5))
            path.closeSubpath()
        }
        .stroke(tint, style: StrokeStyle(lineWidth: 1.35, lineCap: .round, lineJoin: .round))
        .frame(width: DesignTokens.ControlSize.standardButton, height: DesignTokens.ControlSize.standardButton)
    }
}

private extension View {
    func diffPreviewChrome() -> some View {
        self
            .background(AppTheme.themePreviewCodeSurface)
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xSmall)
                    .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xSmall))
            .textSelection(.enabled)
    }
}
