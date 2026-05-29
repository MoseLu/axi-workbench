import SwiftUI

struct AttachmentButton: View {
    let count: Int
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        AppIconButton(
            systemName: "plus",
            accessibilityLabel: accessibilityLabel,
            hoverStyle: .toolbarCircle,
            tint: AppTheme.textTertiary,
            badgeText: count > 0 ? "\(count)" : nil,
            keyboardShortcut: KeyboardShortcut("o", modifiers: .command),
            action: action
        )
    }
}

struct RoutingModePicker: View {
    let selection: RoutingMode
    let language: AppLanguage
    let onSelect: (RoutingMode) -> Void

    var body: some View {
        HStack(spacing: 3) {
            ForEach(RoutingMode.allCases) { mode in
                Button(action: { onSelect(mode) }) {
                    Text(mode.title(language: language))
                        .font(.system(size: ComposerControlMetrics.modeFontSize, weight: .semibold))
                        .foregroundStyle(selection == mode ? AppTheme.textOnAccent : AppTheme.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .frame(minWidth: 38)
                        .background(selection == mode ? AppTheme.accent : AppTheme.transparent)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .help(mode.subtitle(language: language))
            }
        }
        .padding(2)
        .background(AppTheme.surfaceRaised)
        .overlay(
            Capsule()
                .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(Capsule())
    }
}

struct PermissionModePicker: View {
    let selection: ToolPermissionMode
    let language: AppLanguage
    let onSelect: (ToolPermissionMode) -> Void

    var body: some View {
        Group {
            if AppRuntime.isSnapshotRendering {
                label
            } else {
                Menu {
                    ForEach(ToolPermissionMode.allCases) { mode in
                        Button {
                            onSelect(mode)
                        } label: {
                            Label(selection == mode ? "\(mode.title(language: language)) ✓" : mode.title(language: language), systemImage: mode.systemName)
                        }
                        .help(mode.subtitle(language: language))
                    }
                } label: {
                    label
                }
                .menuStyle(.borderlessButton)
            }
        }
        .help(selection.subtitle(language: language))
    }

    private var label: some View {
        HStack(spacing: 6) {
            Image(systemName: selection.systemName)
                .font(.system(size: ComposerControlMetrics.permissionIconSize, weight: .semibold))
                .foregroundStyle(selection.tint)

            Text(selection.title(language: language))
                .font(.system(size: ComposerControlMetrics.modeFontSize, weight: .semibold))
                .foregroundStyle(selection.tint)
                .lineLimit(1)

            Image(systemName: "chevron.down")
                .font(.system(size: ComposerControlMetrics.chevronIconSize, weight: .bold))
                .foregroundStyle(AppTheme.permissionChevron(selection.tint))
        }
        .padding(.horizontal, 9)
        .frame(height: ComposerControlMetrics.compactButtonSize)
        .background(AppTheme.permissionBackground(selection.tint, isDefault: selection == .default))
        .overlay(
            Capsule()
                .stroke(AppTheme.permissionBorder(selection.tint, isDefault: selection == .default), lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(Capsule())
    }
}

private enum GitBranchPickerLoadState: Equatable {
    case idle
    case loading
    case loaded(GitBranchSnapshot)
    case failed(String)
}

struct GitBranchPicker: View {
    let project: ConversationProject?
    let language: AppLanguage

    @AppStorage(GitSettingsPreferences.branchPrefixKey) private var gitBranchPrefix = GitSettingsPreferences.defaultBranchPrefix
    @State private var loadState: GitBranchPickerLoadState = .idle
    @State private var isPopoverPresented = false
    @State private var searchQuery = ""
    @State private var isCreatingBranch = false
    @State private var newBranchName = ""
    @State private var isSwitchingBranch = false
    @State private var errorMessage: String?
    @State private var reloadID = UUID()

    var body: some View {
        Group {
            if project?.path?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
                Button {
                    isPopoverPresented.toggle()
                } label: {
                    label
                }
                .buttonStyle(.plain)
                .disabled(!isEnabled)
                .help(tr("切换分支", "Switch branch"))
                .popover(isPresented: $isPopoverPresented, arrowEdge: .bottom) {
                    panel
                }
                .task(id: loadTaskID) {
                    await loadBranches()
                }
                .onChange(of: project?.path ?? "") { _, _ in
                    resetPanelState()
                }
            }
        }
    }

    private var label: some View {
        HStack(spacing: 7) {
            ComposerGitBranchGlyph(tint: labelTint)
                .frame(width: 18, height: 18)

            Text(labelText)
                .font(.system(size: ComposerControlMetrics.modeFontSize, weight: .semibold))
                .foregroundStyle(labelTint)
                .lineLimit(1)
                .truncationMode(.tail)

            Image(systemName: "chevron.down")
                .font(.system(size: ComposerControlMetrics.chevronIconSize, weight: .bold))
                .foregroundStyle(labelTint.opacity(0.72))
        }
        .padding(.horizontal, 8)
        .frame(height: ComposerControlMetrics.compactButtonSize)
        .background(
            Capsule()
                .fill(isPopoverPresented ? AppTheme.surfaceRaised : AppTheme.transparent)
        )
        .contentShape(Capsule())
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 0) {
            searchField
                .padding(.horizontal, 14)
                .padding(.top, 10)

            Text(tr("分支", "Branches"))
                .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 6)

            branchList

            Divider()
                .padding(.horizontal, 16)
                .padding(.top, 6)

            createBranchArea
                .padding(.horizontal, 16)
                .padding(.vertical, 9)
        }
        .frame(width: 260, alignment: .topLeading)
        .fixedSize(horizontal: false, vertical: true)
        .background(AppTheme.surface)
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: DesignTokens.IconSize.tiny, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)

            TextField(tr("搜索分支", "Search branches"), text: $searchQuery)
                .textFieldStyle(.plain)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
        }
        .frame(height: 22)
    }

    @ViewBuilder
    private var branchList: some View {
        switch loadState {
        case .idle, .loading:
            ProgressView()
                .controlSize(.small)
                .frame(maxWidth: .infinity, minHeight: 44)
        case .failed(let message):
            VStack(alignment: .leading, spacing: 8) {
                Text(localizedErrorMessage(message))
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                    .foregroundStyle(AppTheme.destructive)
                Button(tr("重试", "Retry")) {
                    reloadID = UUID()
                }
                .buttonStyle(.plain)
                .font(.system(size: DesignTokens.FontSize.caption, weight: .semibold))
                .foregroundStyle(AppTheme.accent)
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .topLeading)
        case .loaded(let snapshot):
            let branches = filteredBranches(in: snapshot)
            if branches.isEmpty {
                Text(tr("没有匹配的分支", "No matching branches"))
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .padding(.horizontal, 16)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            } else if branches.count > 6 {
                ScrollView(.vertical, showsIndicators: true) {
                    branchRows(branches, snapshot: snapshot)
                }
                .frame(height: 214)
            } else {
                branchRows(branches, snapshot: snapshot)
            }
        }
    }

    private func branchRows(_ branches: [GitBranchInfo], snapshot: GitBranchSnapshot) -> some View {
        VStack(spacing: 0) {
            ForEach(branches) { branch in
                branchRow(branch, snapshot: snapshot)
            }
        }
        .padding(.horizontal, 10)
    }

    private func branchRow(_ branch: GitBranchInfo, snapshot: GitBranchSnapshot) -> some View {
        Button {
            switchToBranch(branch)
        } label: {
            HStack(alignment: .top, spacing: 10) {
                ComposerGitBranchGlyph(tint: AppTheme.textSecondary)
                    .frame(width: 15, height: 18)
                    .padding(.top, branch.isCurrent && snapshot.dirtyFileCount > 0 ? 2 : 0)

                VStack(alignment: .leading, spacing: 6) {
                    Text(branch.name)
                        .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)

                    if branch.isCurrent && snapshot.dirtyFileCount > 0 {
                        Text(tr("未提交：\(snapshot.dirtyFileCount) 个文件", "Uncommitted: \(snapshot.dirtyFileCount) files"))
                            .font(.system(size: DesignTokens.FontSize.caption, weight: .regular))
                            .foregroundStyle(AppTheme.textTertiary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 12)

                if branch.isCurrent {
                    Image(systemName: "checkmark")
                        .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .padding(.top, 2)
                } else if isSwitchingBranch {
                    ProgressView()
                        .controlSize(.small)
                        .padding(.top, 2)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 5)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(branch.isCurrent || isSwitchingBranch)
        .accessibilityLabel(branch.name)
    }

    @ViewBuilder
    private var createBranchArea: some View {
        if isCreatingBranch {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: "plus")
                        .font(.system(size: DesignTokens.IconSize.small, weight: .regular))
                        .foregroundStyle(AppTheme.textSecondary)

                    TextField(tr("新分支名称", "New branch name"), text: $newBranchName)
                        .textFieldStyle(.plain)
                        .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                        .foregroundStyle(AppTheme.textPrimary)
                        .onSubmit(createAndSwitchBranch)

                    Button(tr("创建", "Create")) {
                        createAndSwitchBranch()
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .semibold))
                    .foregroundStyle(canCreateBranch ? AppTheme.accent : AppTheme.textTertiary)
                    .disabled(!canCreateBranch)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                        .foregroundStyle(AppTheme.destructive)
                        .lineLimit(2)
                }
            }
        } else {
            Button {
                isCreatingBranch = true
                errorMessage = nil
                if newBranchName.isEmpty {
                    newBranchName = GitSettingsPreferences.normalizedBranchPrefix(gitBranchPrefix)
                }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "plus")
                        .font(.system(size: DesignTokens.IconSize.small, weight: .regular))
                        .foregroundStyle(AppTheme.textSecondary)
                    Text(tr("创建并检出新分支...", "Create and checkout new branch..."))
                        .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private var labelText: String {
        switch loadState {
        case .loaded(let snapshot):
            snapshot.currentBranch ?? tr("分支", "Branch")
        case .failed:
            tr("Git", "Git")
        case .idle, .loading:
            tr("分支", "Branch")
        }
    }

    private var labelTint: Color {
        isEnabled ? AppTheme.textTertiary : AppTheme.textTertiary.opacity(0.45)
    }

    private var isEnabled: Bool {
        if isSwitchingBranch {
            return false
        }
        if case .failed = loadState {
            return true
        }
        return true
    }

    private var loadTaskID: String {
        "\(project?.path ?? "")-\(reloadID.uuidString)"
    }

    private var canCreateBranch: Bool {
        normalizedNewBranchName.isEmpty == false && !isSwitchingBranch
    }

    private var normalizedNewBranchName: String {
        newBranchName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var projectPath: String? {
        guard let path = project?.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !path.isEmpty else {
            return nil
        }
        return path
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: language)
    }

    private func filteredBranches(in snapshot: GitBranchSnapshot) -> [GitBranchInfo] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return snapshot.branches
        }
        return snapshot.branches.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    private func loadBranches() async {
        guard let projectPath else {
            loadState = .idle
            return
        }

        loadState = .loading
        do {
            let snapshot = try await GitBranchService.load(projectPath: projectPath)
            loadState = .loaded(snapshot)
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }

    private func switchToBranch(_ branch: GitBranchInfo) {
        guard let projectPath, !branch.isCurrent else {
            return
        }

        isSwitchingBranch = true
        errorMessage = nil
        Task {
            do {
                try await GitBranchService.switchBranch(named: branch.name, projectPath: projectPath)
                await MainActor.run {
                    finishBranchChange(projectPath: projectPath)
                }
            } catch {
                await MainActor.run {
                    isSwitchingBranch = false
                    errorMessage = localizedErrorMessage(error.localizedDescription)
                    loadState = .failed(errorMessage ?? error.localizedDescription)
                }
            }
        }
    }

    private func createAndSwitchBranch() {
        guard let projectPath, canCreateBranch else {
            return
        }

        let branchName = normalizedNewBranchName
        isSwitchingBranch = true
        errorMessage = nil
        Task {
            do {
                try await GitBranchService.createAndSwitchBranch(named: branchName, projectPath: projectPath)
                await MainActor.run {
                    newBranchName = ""
                    isCreatingBranch = false
                    finishBranchChange(projectPath: projectPath)
                }
            } catch {
                await MainActor.run {
                    isSwitchingBranch = false
                    errorMessage = localizedErrorMessage(error.localizedDescription)
                }
            }
        }
    }

    private func finishBranchChange(projectPath: String) {
        isSwitchingBranch = false
        isPopoverPresented = false
        reloadID = UUID()
        NotificationCenter.default.post(
            name: .workspaceGitBranchDidChange,
            object: nil,
            userInfo: ["projectPath": projectPath]
        )
    }

    private func resetPanelState() {
        searchQuery = ""
        isCreatingBranch = false
        newBranchName = ""
        errorMessage = nil
        reloadID = UUID()
    }

    private func localizedErrorMessage(_ message: String) -> String {
        switch message {
        case "No workspace folder is selected.":
            tr("选择项目后切换分支。", "Select a project before switching branches.")
        case "The selected workspace is not a Git repository.":
            tr("当前项目不是 Git 仓库。", "The selected project is not a Git repository.")
        case "Git command failed.":
            tr("Git 命令失败。", "Git command failed.")
        default:
            message
        }
    }
}

private struct ComposerGitBranchGlyph: View {
    let tint: Color

    var body: some View {
        ComposerIconFontGitBranchShape()
            .fill(tint, style: FillStyle(eoFill: true))
    }
}

private struct ComposerIconFontGitBranchShape: Shape {
    private let viewBox: CGFloat = 1024

    func path(in rect: CGRect) -> Path {
        let side = min(rect.width, rect.height)
        let scale = side / viewBox
        let origin = CGPoint(x: rect.midX - side / 2, y: rect.midY - side / 2)

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

extension ToolPermissionMode {
    var systemName: String {
        switch self {
        case .default:
            return "hand.raised"
        case .autoReview:
            return "checkmark.shield"
        case .fullAccess:
            return "exclamationmark.shield"
        }
    }

    var tint: Color {
        switch self {
        case .default:
            return AppTheme.textSecondary
        case .autoReview:
            return AppTheme.accent
        case .fullAccess:
            return AppTheme.destructive
        }
    }
}

struct VoiceButton: View {
    let isActive: Bool
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        AppIconButton(
            systemName: isActive ? "waveform.circle.fill" : "mic",
            accessibilityLabel: accessibilityLabel,
            hoverStyle: .toolbarCircle,
            tint: isActive ? AppTheme.accent : AppTheme.textTertiary,
            action: action
        )
    }
}

struct ContextWindowIndicator: View {
    let usage: ContextWindowUsage
    let language: AppLanguage
    @State private var isPopoverPresented = false

    var body: some View {
        Button {
            isPopoverPresented.toggle()
        } label: {
            ContextWindowGlyph(fraction: usage.usedFraction, tint: tint)
                .frame(width: ComposerControlMetrics.compactButtonSize, height: ComposerControlMetrics.compactButtonSize)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .help(helpText)
        .popover(isPresented: $isPopoverPresented, arrowEdge: .bottom) {
            ContextWindowPopover(usage: usage, language: language)
        }
        .onHover { hovering in
            guard !AppRuntime.isSnapshotRendering else {
                return
            }
            isPopoverPresented = hovering
        }
        .accessibilityLabel(tr("上下文窗口", "Context window"))
        .accessibilityValue(accessibilityValue)
    }

    private var tint: Color {
        guard let fraction = usage.usedFraction else {
            return AppTheme.textTertiary
        }
        if fraction >= 0.9 {
            return AppTheme.destructive
        }
        if fraction >= 0.75 {
            return AppTheme.warning
        }
        return AppTheme.textTertiary
    }

    private var helpText: String {
        if let percent = usage.usedPercent {
            return tr("上下文窗口：\(percent)% 已用", "Context window: \(percent)% used")
        }
        return tr("上下文窗口：模型未报告长度", "Context window: model length unavailable")
    }

    private var accessibilityValue: String {
        if let maxTokens = usage.maxTokens,
           let percent = usage.usedPercent {
            return tr(
                "\(percent)% 已用，已用 \(formatTokenCount(usage.usedTokens)) 标记，共 \(formatTokenCount(maxTokens)) 标记",
                "\(percent)% used, \(formatTokenCount(usage.usedTokens)) tokens of \(formatTokenCount(maxTokens))"
            )
        }
        return tr("已用 \(formatTokenCount(usage.usedTokens)) 标记", "\(formatTokenCount(usage.usedTokens)) tokens used")
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: language)
    }
}

private struct ContextWindowGlyph: View {
    let fraction: Double?
    let tint: Color

    var body: some View {
        ZStack {
            Circle()
                .stroke(AppTheme.borderStrong, lineWidth: 1.6)
                .frame(width: 12, height: 12)

            if let fraction {
                Circle()
                    .trim(from: 0, to: max(0.02, fraction))
                    .stroke(tint, style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                    .frame(width: 12, height: 12)
                    .rotationEffect(.degrees(-90))
            } else {
                Circle()
                    .trim(from: 0, to: 0.72)
                    .stroke(tint, style: StrokeStyle(lineWidth: 1.6, lineCap: .round, dash: [1.4, 2.4]))
                    .frame(width: 12, height: 12)
                    .rotationEffect(.degrees(-90))
            }
        }
    }
}

private struct ContextWindowPopover: View {
    let usage: ContextWindowUsage
    let language: AppLanguage

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(tr("上下文窗口：", "Context window:") + usage.modelDisplayName)
                .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .lineLimit(1)

            if let maxTokens = usage.maxTokens,
               let percent = usage.usedPercent {
                Text(tr("\(percent)% 已用", "\(percent)% used"))
                    .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)

                Text(tr(
                    "已用 \(formatTokenCount(usage.usedTokens)) 标记，共 \(formatTokenCount(maxTokens))",
                    "\(formatTokenCount(usage.usedTokens)) tokens used, \(formatTokenCount(maxTokens)) total"
                ))
                .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
            } else {
                Text(tr("模型未报告上下文长度", "Model did not report a context length"))
                    .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)

                Text(tr(
                    "已用约 \(formatTokenCount(usage.usedTokens)) 标记",
                    "About \(formatTokenCount(usage.usedTokens)) tokens used"
                ))
                .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
            }

            Text(tr(
                "Ollama 不会自动压缩上下文，接近上限时请开启新会话或缩短输入。",
                "Ollama does not auto-compact context. Start a new chat or shorten input near the limit."
            ))
            .font(.system(size: DesignTokens.FontSize.caption, weight: .semibold))
            .foregroundStyle(AppTheme.textPrimary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(width: 238, alignment: .leading)
        .background(AppTheme.surface)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: language)
    }
}

private func formatTokenCount(_ value: Int) -> String {
    if value >= 100_000 {
        return "\(Int((Double(value) / 1_000).rounded()))k"
    }
    if value >= 10_000 {
        return "\(String(format: "%.1f", Double(value) / 1_000))k"
    }
    if value >= 1_000 {
        return "\(String(format: "%.1f", Double(value) / 1_000))k"
    }
    return "\(value)"
}

struct SendButton: View {
    let canSubmit: Bool
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "arrow.up")
                .font(.system(size: ComposerControlMetrics.iconSize, weight: .bold))
                .foregroundStyle(canSubmit ? AppTheme.textOnAccentSecondary : AppTheme.textSecondary)
                .frame(width: ComposerControlMetrics.sendButtonSize, height: ComposerControlMetrics.sendButtonSize)
                .background(canSubmit ? AppTheme.accent : AppTheme.surfaceRaised)
                .overlay(
                    Circle()
                        .stroke(canSubmit ? AppTheme.transparent : AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
                )
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!canSubmit)
        .help(accessibilityLabel)
        .accessibilityLabel(accessibilityLabel)
    }
}
