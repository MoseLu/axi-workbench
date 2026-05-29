import SwiftUI

struct AutomationsPanelView: View {
    let automations: [AutomationTask]
    let projects: [ConversationProject]
    let isLoading: Bool
    let errorMessage: String?
    let onRefresh: () -> Void
    let onCreate: () -> Void

    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.horizontal, 52)
                .padding(.top, 46)

            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 22) {
                    currentSection
                }
                .frame(maxWidth: 980, alignment: .leading)
                .padding(.horizontal, 52)
                .padding(.top, 52)
                .padding(.bottom, 48)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(AppTheme.canvas)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("automations.panel")
    }

    private var header: some View {
        HStack(alignment: .center) {
            Text(tr("自动化", "Automations"))
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)

            Spacer(minLength: 20)

            Button(action: onCreate) {
                HStack(spacing: 8) {
                    Image(systemName: "plus")
                        .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                    Text(tr("新建自动化功能", "New automation"))
                        .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                }
                .foregroundStyle(AppTheme.textPrimary)
                .padding(.horizontal, 16)
                .frame(height: 36)
                .background(AppTheme.surfaceHover)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("automations.create")
        }
    }

    private var currentSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Text(tr("当前", "Current"))
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .bold))
                    .foregroundStyle(AppTheme.textPrimary)

                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                }

                Spacer(minLength: 0)

                Button(action: onRefresh) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                        .foregroundStyle(AppTheme.textTertiary)
                        .frame(width: DesignTokens.ControlSize.standardButton, height: DesignTokens.ControlSize.standardButton)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(tr("刷新", "Refresh"))
                .accessibilityLabel(tr("刷新", "Refresh"))
            }

            Rectangle()
                .fill(AppTheme.border)
                .frame(height: 1)
                .padding(.top, 16)

            if let errorMessage {
                InlineNotice(text: errorMessage, tint: AppTheme.destructive)
                    .padding(.top, 16)
            }

            if automations.isEmpty && !isLoading {
                emptyState
                    .padding(.top, 28)
            } else {
                VStack(spacing: 0) {
                    ForEach(automations) { automation in
                        automationRow(automation)
                    }
                }
                .padding(.top, 24)
            }
        }
    }

    private var emptyState: some View {
        HStack(spacing: 12) {
            Image(systemName: "clock.badge.plus")
                .font(.system(size: DesignTokens.IconSize.large, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 5) {
                Text(tr("还没有自动化任务", "No automations yet"))
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                Text(tr("点击右上角创建第一个任务。", "Create the first one from the button above."))
                    .font(.system(size: DesignTokens.FontSize.body, weight: .regular))
                    .foregroundStyle(AppTheme.textTertiary)
            }
        }
        .padding(.vertical, 4)
    }

    private func automationRow(_ automation: AutomationTask) -> some View {
        HStack(alignment: .center, spacing: 18) {
            Circle()
                .stroke(AppTheme.textTertiary, lineWidth: 1.6)
                .frame(width: 15, height: 15)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 9) {
                    Text(automation.name)
                        .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)

                    let projectText = automation.projectText(projects: projects)
                    if !projectText.isEmpty {
                        Text(projectText)
                            .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                            .foregroundStyle(AppTheme.textTertiary)
                            .lineLimit(1)
                    }
                }

                if let branch = automation.branch {
                    Text(branch)
                        .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 16)

            Text(automation.scheduleText(language: appLanguage))
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.vertical, 16)
        .contentShape(Rectangle())
        .accessibilityIdentifier("automations.row.\(automation.id)")
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }
}

struct AutomationCreatePanelView: View {
    let projects: [ConversationProject]
    let initialProjectID: UUID?
    let selectedModelName: String
    let onCancel: () -> Void
    let onCreate: (AutomationDraft) -> Void

    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @State private var titleDraft = ""
    @State private var promptDraft = ""
    @State private var selectedProjectID: UUID?
    @State private var selectedBranch: String?
    @State private var executionEnvironment: AutomationExecutionEnvironment = .worktree
    @State private var schedule = AutomationSchedule()
    @State private var reasoningEffort = "medium"
    @FocusState private var isPromptFocused: Bool

    init(
        projects: [ConversationProject],
        initialProjectID: UUID?,
        selectedModelName: String,
        onCancel: @escaping () -> Void,
        onCreate: @escaping (AutomationDraft) -> Void
    ) {
        self.projects = projects
        self.initialProjectID = initialProjectID
        self.selectedModelName = selectedModelName
        self.onCancel = onCancel
        self.onCreate = onCreate
        _selectedProjectID = State(initialValue: initialProjectID ?? projects.first?.id)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            topBar

            TextField(tr("自动化功能标题", "Automation title"), text: $titleDraft)
                .textFieldStyle(.plain)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(AppTheme.textPrimary)
                .padding(.horizontal, 38)
                .padding(.top, 26)
                .accessibilityIdentifier("automation.create.title")

            promptEditor
                .padding(.horizontal, 38)
                .padding(.top, 18)

            Spacer(minLength: 24)

            bottomBar
                .padding(.horizontal, 38)
                .padding(.bottom, 32)
        }
        .frame(width: 980, height: 460, alignment: .topLeading)
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: Color.black.opacity(0.34), radius: 32, x: 0, y: 18)
        .onAppear {
            isPromptFocused = true
            if selectedProjectID == nil {
                selectedProjectID = projects.first?.id
            }
        }
        .onChange(of: selectedProjectID) { _, _ in
            selectedBranch = nil
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("automation.create.panel")
    }

    private var topBar: some View {
        HStack(spacing: 14) {
            Spacer(minLength: 0)

            Image(systemName: "info.circle")
                .font(.system(size: DesignTokens.IconSize.large, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)

            Button {
            } label: {
                Text(tr("使用模板", "Use template"))
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .padding(.horizontal, 13)
                    .frame(height: 32)
                    .background(AppTheme.transparent)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium, style: .continuous)
                            .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
                    )
            }
            .buttonStyle(.plain)
            .disabled(true)
            .opacity(0.74)

            Button(action: onCancel) {
                Image(systemName: "xmark")
                    .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(width: 30, height: 30)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help(tr("关闭", "Close"))
            .accessibilityLabel(tr("关闭", "Close"))
        }
        .padding(.top, 24)
        .padding(.trailing, 32)
    }

    private var promptEditor: some View {
        ZStack(alignment: .topLeading) {
            if promptDraft.isEmpty {
                Text(tr("添加提示词，例如：在 $sentry 中查找崩溃", "Add a prompt, for example: find crashes in $sentry"))
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 8)
                    .allowsHitTesting(false)
            }

            TextEditor(text: $promptDraft)
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .scrollContentBackground(.hidden)
                .background(AppTheme.transparent)
                .padding(-5)
                .focused($isPromptFocused)
        }
        .frame(maxWidth: .infinity, minHeight: 190, alignment: .topLeading)
        .accessibilityIdentifier("automation.create.prompt")
    }

    private var bottomBar: some View {
        HStack(alignment: .center, spacing: 14) {
            executionEnvironmentMenu
            projectMenu
            AutomationBranchSelectionButton(project: selectedProject, selectedBranch: $selectedBranch)
            AutomationSchedulePicker(schedule: $schedule)

            AutomationReasoningMenu(selection: $reasoningEffort)

            Spacer(minLength: 18)

            Button(action: onCancel) {
                Text(tr("取消", "Cancel"))
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .frame(height: 34)
            }
            .buttonStyle(.plain)

            Button {
                onCreate(draft)
            } label: {
                Text(tr("创建", "Create"))
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                    .foregroundStyle(draft.canCreate ? AppTheme.textPrimary : AppTheme.textTertiary)
                    .padding(.horizontal, 18)
                    .frame(height: 36)
                    .background(draft.canCreate ? AppTheme.surfaceHover : AppTheme.surfaceRaised.opacity(0.74))
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!draft.canCreate)
            .accessibilityIdentifier("automation.create.submit")
        }
    }

    private var executionEnvironmentMenu: some View {
        Menu {
            ForEach(AutomationExecutionEnvironment.allCases) { environment in
                Button {
                    executionEnvironment = environment
                } label: {
                    Label(environment.title(language: appLanguage), systemImage: environment == executionEnvironment ? "checkmark" : "circle")
                }
            }
        } label: {
            AutomationControlLabel(
                systemName: "arrow.triangle.branch",
                title: executionEnvironment.title(language: appLanguage),
                showsChevron: true
            )
        }
        .menuStyle(.borderlessButton)
        .accessibilityIdentifier("automation.create.environment")
    }

    private var projectMenu: some View {
        Menu {
            if projects.isEmpty {
                Text(tr("暂无项目", "No projects"))
            } else {
                ForEach(projects) { project in
                    Button {
                        selectedProjectID = project.id
                    } label: {
                        Label(project.name, systemImage: project.id == selectedProjectID ? "checkmark" : "folder")
                    }
                }
            }
        } label: {
            AutomationControlLabel(
                systemName: "folder",
                title: selectedProject?.name ?? tr("选择项目", "Choose project"),
                showsChevron: true
            )
        }
        .menuStyle(.borderlessButton)
        .accessibilityIdentifier("automation.create.project")
    }

    private var selectedProject: ConversationProject? {
        guard let selectedProjectID else {
            return nil
        }
        return projects.first(where: { $0.id == selectedProjectID })
    }

    private var draft: AutomationDraft {
        AutomationDraft(
            title: titleDraft,
            prompt: promptDraft,
            projectPath: selectedProject?.path ?? "",
            branch: selectedBranch,
            executionEnvironment: executionEnvironment,
            schedule: schedule,
            model: selectedModelName,
            reasoningEffort: reasoningEffort
        )
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }
}

private struct AutomationControlLabel: View {
    let systemName: String
    let title: String
    var showsChevron = false
    var isEnabled = true

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: systemName)
                .font(.system(size: DesignTokens.IconSize.regular, weight: .medium))
                .foregroundStyle(isEnabled ? AppTheme.textSecondary : AppTheme.textTertiary)

            Text(title)
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                .foregroundStyle(isEnabled ? AppTheme.textPrimary : AppTheme.textTertiary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: 150, alignment: .leading)

            if showsChevron {
                Image(systemName: "chevron.down")
                    .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                    .foregroundStyle(AppTheme.textTertiary)
            }
        }
        .padding(.horizontal, 6)
        .frame(height: 32)
        .contentShape(Rectangle())
    }
}

private enum AutomationBranchLoadState: Equatable {
    case idle
    case loading
    case loaded(GitBranchSnapshot)
    case failed(String)
}

private struct AutomationBranchSelectionButton: View {
    let project: ConversationProject?
    @Binding var selectedBranch: String?

    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @State private var isPresented = false
    @State private var loadState: AutomationBranchLoadState = .idle
    @State private var reloadID = UUID()

    var body: some View {
        Button {
            isPresented.toggle()
        } label: {
            AutomationControlLabel(
                systemName: "point.3.connected.trianglepath.dotted",
                title: labelText,
                showsChevron: true,
                isEnabled: projectPath != nil
            )
        }
        .buttonStyle(.plain)
        .disabled(projectPath == nil)
        .popover(isPresented: $isPresented, arrowEdge: .bottom) {
            panel
        }
        .task(id: loadTaskID) {
            await loadBranches()
        }
        .onChange(of: project?.id) { _, _ in
            selectedBranch = nil
            loadState = .idle
            reloadID = UUID()
        }
        .accessibilityIdentifier("automation.create.branch")
    }

    private var panel: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(tr("分支", "Branches"))
                .font(.system(size: DesignTokens.FontSize.caption, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 8)

            branchContent
        }
        .frame(width: 260, alignment: .topLeading)
        .padding(.bottom, 10)
        .background(AppTheme.surface)
    }

    @ViewBuilder
    private var branchContent: some View {
        switch loadState {
        case .idle, .loading:
            ProgressView()
                .controlSize(.small)
                .frame(maxWidth: .infinity, minHeight: 52)
        case .failed(let message):
            VStack(alignment: .leading, spacing: 10) {
                Text(localizedErrorMessage(message))
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                    .foregroundStyle(AppTheme.destructive)
                    .lineLimit(3)

                Button(tr("重试", "Retry")) {
                    reloadID = UUID()
                }
                .buttonStyle(.plain)
                .font(.system(size: DesignTokens.FontSize.caption, weight: .semibold))
                .foregroundStyle(AppTheme.accent)
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading)
        case .loaded(let snapshot):
            let branches = snapshot.branches
            if branches.isEmpty {
                Text(tr("没有分支", "No branches"))
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .padding(.horizontal, 16)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            } else {
                ScrollView(.vertical, showsIndicators: branches.count > 6) {
                    VStack(spacing: 0) {
                        ForEach(branches) { branch in
                            branchRow(branch)
                        }
                    }
                    .padding(.horizontal, 10)
                }
                .frame(height: min(CGFloat(branches.count) * 34, 214))
            }
        }
    }

    private func branchRow(_ branch: GitBranchInfo) -> some View {
        Button {
            selectedBranch = branch.name
            isPresented = false
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "point.3.connected.trianglepath.dotted")
                    .font(.system(size: DesignTokens.IconSize.small, weight: .medium))
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(width: DesignTokens.IconFrame.sidebar)

                Text(branch.name)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Spacer(minLength: 10)

                if selectedBranch == branch.name || (selectedBranch == nil && branch.isCurrent) {
                    Image(systemName: "checkmark")
                        .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var labelText: String {
        selectedBranch ?? currentBranchFromSnapshot ?? tr("选择分支", "Choose branch")
    }

    private var currentBranchFromSnapshot: String? {
        if case .loaded(let snapshot) = loadState {
            return snapshot.currentBranch
        }
        return nil
    }

    private var projectPath: String? {
        guard let path = project?.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !path.isEmpty else {
            return nil
        }
        return path
    }

    private var loadTaskID: String {
        "\(projectPath ?? "")-\(reloadID.uuidString)"
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
            if selectedBranch == nil {
                selectedBranch = snapshot.currentBranch
            }
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }

    private func localizedErrorMessage(_ message: String) -> String {
        switch message {
        case "The selected workspace is not a Git repository.":
            tr("当前项目不是 Git 仓库。", "The selected project is not a Git repository.")
        case "No workspace folder is selected.":
            tr("先选择项目。", "Choose a project first.")
        default:
            message
        }
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }
}

private struct AutomationSchedulePicker: View {
    @Binding var schedule: AutomationSchedule
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented.toggle()
        } label: {
            AutomationControlLabel(
                systemName: "clock",
                title: schedule.label(language: appLanguage),
                showsChevron: true
            )
        }
        .buttonStyle(.plain)
        .popover(isPresented: $isPresented, arrowEdge: .bottom) {
            AutomationScheduleEditor(schedule: $schedule)
        }
        .accessibilityIdentifier("automation.create.schedule")
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }
}

private struct AutomationScheduleEditor: View {
    @Binding var schedule: AutomationSchedule
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(AutomationRecurrence.allCases) { recurrence in
                recurrenceRow(recurrence)
            }

            Divider()
                .padding(.vertical, 8)

            if schedule.recurrence == .weekly {
                weekdaySelector
                    .padding(.horizontal, 14)
                    .padding(.bottom, 10)
            }

            if schedule.recurrence == .custom {
                TextField("RRULE:FREQ=DAILY;BYHOUR=9;BYMINUTE=0", text: $schedule.customRRule)
                    .textFieldStyle(.plain)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium, design: .monospaced))
                    .foregroundStyle(AppTheme.textPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(AppTheme.surfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control, style: .continuous))
                    .padding(.horizontal, 14)
                    .padding(.bottom, 12)
            } else if schedule.recurrence != .hourly {
                DatePicker("", selection: timeBinding, displayedComponents: .hourAndMinute)
                    .labelsHidden()
                    .datePickerStyle(.compact)
                    .padding(.horizontal, 14)
                    .padding(.bottom, 12)
            }
        }
        .padding(.vertical, 8)
        .frame(width: 220, alignment: .topLeading)
        .background(AppTheme.surface)
    }

    private func recurrenceRow(_ recurrence: AutomationRecurrence) -> some View {
        Button {
            schedule.recurrence = recurrence
        } label: {
            HStack(spacing: 10) {
                Text(recurrence.title(language: appLanguage))
                    .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                Spacer(minLength: 12)
                if schedule.recurrence == recurrence {
                    Image(systemName: "checkmark")
                        .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var weekdaySelector: some View {
        HStack(spacing: 6) {
            ForEach(AutomationWeekday.allCases) { weekday in
                Button {
                    if schedule.weekdays.contains(weekday) {
                        schedule.weekdays.remove(weekday)
                    } else {
                        schedule.weekdays.insert(weekday)
                    }
                } label: {
                    Text(weekday.shortTitle(language: appLanguage))
                        .font(.system(size: DesignTokens.FontSize.caption, weight: .semibold))
                        .foregroundStyle(schedule.weekdays.contains(weekday) ? AppTheme.textOnAccent : AppTheme.textSecondary)
                        .frame(width: 26, height: 24)
                        .background(schedule.weekdays.contains(weekday) ? AppTheme.accent : AppTheme.surfaceRaised)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xSmall, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var timeBinding: Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(from: DateComponents(hour: schedule.hour, minute: schedule.minute)) ?? .now
            },
            set: { date in
                let components = Calendar.current.dateComponents([.hour, .minute], from: date)
                schedule.hour = components.hour ?? schedule.hour
                schedule.minute = components.minute ?? schedule.minute
            }
        )
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }
}

private struct AutomationReasoningMenu: View {
    @Binding var selection: String
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    private let options = ["low", "medium", "high", "xhigh"]

    var body: some View {
        Menu {
            ForEach(options, id: \.self) { option in
                Button {
                    selection = option
                } label: {
                    Label(title(for: option), systemImage: selection == option ? "checkmark" : "brain")
                }
            }
        } label: {
            Image(systemName: "brain")
                .font(.system(size: DesignTokens.IconSize.regular, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .menuStyle(.borderlessButton)
        .help(tr("推理强度", "Reasoning effort"))
        .accessibilityIdentifier("automation.create.reasoning")
    }

    private func title(for option: String) -> String {
        switch option {
        case "low":
            tr("低", "Low")
        case "high":
            tr("高", "High")
        case "xhigh":
            tr("超高", "Extra high")
        default:
            tr("中", "Medium")
        }
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }
}
