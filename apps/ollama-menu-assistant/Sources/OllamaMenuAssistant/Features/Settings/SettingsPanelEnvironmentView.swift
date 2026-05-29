import SwiftUI

enum EnvironmentScriptKind {
    case setup
    case cleanup
}

private enum EnvironmentPanelMetrics {
    static let contentWidth: CGFloat = 560
    static let sectionSpacing: CGFloat = 22
    static let compactSectionSpacing: CGFloat = 12
    static let rowSpacing: CGFloat = 10
    static let rowHeight: CGFloat = 56
    static let summaryHeight: CGFloat = 50
    static let primaryButtonHeight: CGFloat = 30
    static let iconButtonSize: CGFloat = 30
    static let cornerRadius: CGFloat = 8
    static let scriptEditorHeight: CGFloat = 104
    static let operationEditorHeight: CGFloat = 72
}

extension SettingsPanelView {
    @ViewBuilder
    var environmentHeaderNavigation: some View {
        if selectedSection == .environment, let project = selectedEnvironmentProject {
            HStack(spacing: 14) {
                Button {
                    environmentGoBack()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.left")
                            .font(.system(size: 13, weight: .medium))
                        Text(tr("返回", "Back"))
                            .font(.system(size: 14, weight: .medium))
                    }
                    .foregroundStyle(AppTheme.textSecondary)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("settings.environment.back")

                HStack(spacing: 9) {
                    environmentBreadcrumbButton(title: tr("环境", "Environment")) {
                        resetEnvironmentNavigation()
                    }

                    environmentBreadcrumbSeparator

                    environmentBreadcrumbButton(title: project.name) {
                        openEnvironmentProjectHome(project)
                    }

                    if isEnvironmentEditorPresented {
                        environmentBreadcrumbSeparator

                        Text(tr("编辑", "Edit"))
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(AppTheme.textPrimary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(height: 24)
        }
    }

    @ViewBuilder
    var environmentSettings: some View {
        Group {
            if let project = selectedEnvironmentProject {
                if isEnvironmentEditorPresented {
                    environmentEditor(project)
                } else {
                    environmentProjectHome(project)
                }
            } else {
                environmentProjectList
            }
        }
        .frame(maxWidth: EnvironmentPanelMetrics.contentWidth, alignment: .leading)
    }

    var environmentProjectList: some View {
        VStack(alignment: .leading, spacing: EnvironmentPanelMetrics.sectionSpacing) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(tr("本地环境用于指示 Codex 如何为项目设置工作树。", "Local environments tell Codex how to set up a worktree for a project."))
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.textSecondary)
                Text(tr("了解更多。", "Learn more."))
                    .font(.system(size: 13))
                    .foregroundStyle(AppTheme.accent)
            }

            VStack(alignment: .leading, spacing: EnvironmentPanelMetrics.compactSectionSpacing) {
                HStack(alignment: .center) {
                    Text(tr("选择项目", "Choose project"))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)

                    Spacer(minLength: 16)

                    Button {
                        if let project = appModel.addProjectFromSettings() {
                            openEnvironmentProjectHome(project)
                        }
                    } label: {
                        Text(tr("添加项目", "Add project"))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(AppTheme.textPrimary)
                            .padding(.horizontal, 12)
                            .frame(height: EnvironmentPanelMetrics.primaryButtonHeight)
                            .background(AppTheme.surfaceRaised)
                            .clipShape(RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("settings.environment.addProject")
                }

                if appModel.projects.isEmpty {
                    environmentEmptyCard(
                        text: tr("还没有项目。添加项目后即可配置本地环境。", "No projects yet. Add one to configure its local environment.")
                    )
                } else {
                    VStack(spacing: EnvironmentPanelMetrics.rowSpacing) {
                        ForEach(appModel.projects) { project in
                            environmentProjectRow(project)
                        }
                    }
                }
            }
        }
    }

    func environmentProjectHome(_ project: ConversationProject) -> some View {
        VStack(alignment: .leading, spacing: EnvironmentPanelMetrics.sectionSpacing) {
            settingsGroup(title: tr("项目", "Project")) {
                environmentProjectSummaryCard(project)
            }

            settingsGroup(title: tr("环境详细信息", "Environment details")) {
                if let environment = project.localEnvironment {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack(alignment: .center, spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(environment.name)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(AppTheme.textPrimary)
                                Text(tr("已配置本地环境。", "Local environment configured."))
                                    .font(.system(size: 12))
                                    .foregroundStyle(AppTheme.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            Button {
                                openEnvironmentEditor(project)
                            } label: {
                                Text(tr("编辑本地环境", "Edit local environment"))
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(AppTheme.textPrimary)
                                    .padding(.horizontal, 12)
                                    .frame(height: EnvironmentPanelMetrics.primaryButtonHeight)
                                    .background(AppTheme.surfaceRaised)
                                    .clipShape(RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("settings.environment.editLocal")
                        }
                    }
                    .padding(12)
                    .appCard(cornerRadius: EnvironmentPanelMetrics.cornerRadius)
                } else {
                    VStack(alignment: .trailing, spacing: EnvironmentPanelMetrics.compactSectionSpacing) {
                        environmentEmptyCard(
                            text: tr("尚未对此项目配置任何本地环境。", "No local environment has been configured for this project yet.")
                        )

                        Button {
                            openEnvironmentEditor(project)
                        } label: {
                            Text(tr("创建本地环境", "Create local environment"))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AppTheme.textOnAccent)
                                .padding(.horizontal, 14)
                                .frame(height: EnvironmentPanelMetrics.primaryButtonHeight)
                                .background(AppTheme.textPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("settings.environment.createLocal")
                    }
                }
            }
        }
    }

    func environmentEditor(_ project: ConversationProject) -> some View {
        VStack(alignment: .leading, spacing: EnvironmentPanelMetrics.sectionSpacing) {
            settingsGroup(title: tr("本地环境", "Local environment")) {
                environmentProjectSummaryCard(project)
            }

            environmentNameField(project)

            environmentScriptEditor(
                project: project,
                kind: .setup,
                title: tr("设置脚本", "Setup script"),
                description: tr("创建工作树时在项目根目录下运行", "Runs in the project root when creating a worktree."),
                selection: $setupScriptScope,
                placeholder: tr("添加创建工作树时要运行的命令。", "Add commands to run when creating a worktree.")
            )

            environmentScriptEditor(
                project: project,
                kind: .cleanup,
                title: tr("清理脚本", "Cleanup script"),
                description: tr("清理工作树之前在项目根目录下运行", "Runs in the project root before cleaning a worktree."),
                selection: $cleanupScriptScope,
                placeholder: tr("添加清理工作树前要运行的命令。", "Add commands to run before cleaning a worktree.")
            )

            environmentOperationsSection(project)

            HStack(alignment: .center, spacing: 12) {
                if let environmentStatusMessage {
                    Text(environmentStatusMessage)
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.textSecondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)

                Button {
                    saveEnvironment(project)
                } label: {
                    Text(tr("保存", "Save"))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(canSaveEnvironment(project) ? AppTheme.textPrimary : AppTheme.textTertiary)
                        .padding(.horizontal, 14)
                        .frame(height: EnvironmentPanelMetrics.primaryButtonHeight)
                        .background(canSaveEnvironment(project) ? AppTheme.surfaceHover : AppTheme.surfaceRaised.opacity(0.72))
                        .clipShape(RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(!canSaveEnvironment(project))
                .accessibilityIdentifier("settings.environment.save")
            }
        }
        .onAppear {
            if environmentDraft == nil {
                environmentDraft = project.localEnvironment ?? ProjectLocalEnvironment.template(for: project)
            }
        }
    }

    func environmentProjectRow(_ project: ConversationProject) -> some View {
        HStack(spacing: 12) {
            Button {
                openEnvironmentProjectHome(project)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "folder")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(width: 20)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(project.name)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(AppTheme.textPrimary)
                            .lineLimit(1)
                        if let path = project.path, !path.isEmpty {
                            Text(projectListDetail(for: path))
                                .font(.system(size: 11))
                                .foregroundStyle(AppTheme.textTertiary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                openEnvironmentEditor(project)
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 17, weight: .regular))
                    .foregroundStyle(AppTheme.textPrimary)
                    .frame(width: 34, height: EnvironmentPanelMetrics.iconButtonSize)
                    .background(AppTheme.surfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous))
            }
            .buttonStyle(.plain)
            .help(tr("配置本地环境", "Configure local environment"))
            .accessibilityLabel(tr("配置 \(project.name) 的本地环境", "Configure local environment for \(project.name)"))
            .accessibilityIdentifier("settings.environment.project.add.\(project.id.uuidString)")
        }
        .padding(.horizontal, 14)
        .frame(height: EnvironmentPanelMetrics.rowHeight)
        .appCard(cornerRadius: EnvironmentPanelMetrics.cornerRadius)
    }

    func environmentProjectSummaryCard(_ project: ConversationProject) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "folder")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 3) {
                Text(project.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Text(project.path ?? tr("未设置路径", "No path set"))
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.textSecondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 14)
        .frame(height: EnvironmentPanelMetrics.summaryHeight)
        .appCard(cornerRadius: EnvironmentPanelMetrics.cornerRadius)
    }

    func environmentNameField(_ project: ConversationProject) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(tr("名称", "Name"))
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(AppTheme.textPrimary)

            TextField("", text: environmentNameBinding(project))
                .textFieldStyle(.plain)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
                .padding(.horizontal, 12)
                .frame(width: 260, height: EnvironmentPanelMetrics.primaryButtonHeight)
                .background(AppTheme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous)
                        .stroke(AppTheme.borderStrong, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous))
                .accessibilityIdentifier("settings.environment.name")
        }
    }

    func environmentScriptEditor(
        project: ConversationProject,
        kind: EnvironmentScriptKind,
        title: String,
        description: String,
        selection: Binding<ProjectEnvironmentScriptScope>,
        placeholder: String
    ) -> some View {
        let scope = selection.wrappedValue
        let scriptBinding = environmentScriptBinding(project: project, kind: kind, scope: scope)

        return VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                Text(description)
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.textSecondary)
            }

            HStack(alignment: .center, spacing: 10) {
                environmentScopeTabs(selection: selection)

                Spacer(minLength: 0)

                Menu {
                    ForEach(["$CODEX_WORKTREE_PATH", "$CODEX_PROJECT_PATH", "$HOME"], id: \.self) { variable in
                        Button(variable) {
                            appendVariable(variable, project: project, kind: kind, scope: scope)
                        }
                    }
                } label: {
                    Text(tr("变量", "Variables"))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .padding(.horizontal, 10)
                        .frame(height: 26)
                        .background(AppTheme.transparent)
                }
                .buttonStyle(.plain)
            }

            ZStack(alignment: .topLeading) {
                if scriptBinding.wrappedValue.isEmpty {
                    Text(placeholder)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(AppTheme.textTertiary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 11)
                        .allowsHitTesting(false)
                }

                TextEditor(text: scriptBinding)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(AppTheme.textPrimary)
                    .scrollContentBackground(.hidden)
                    .background(AppTheme.transparent)
                    .padding(8)
            }
            .frame(height: EnvironmentPanelMetrics.scriptEditorHeight)
            .background(AppTheme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous)
                    .stroke(AppTheme.borderStrong, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous))
            .accessibilityIdentifier(kind == .setup ? "settings.environment.setupScript" : "settings.environment.cleanupScript")
        }
    }

    func environmentOperationsSection(_ project: ConversationProject) -> some View {
        let operations = environmentDraftOrTemplate(for: project).operations

        return VStack(alignment: .leading, spacing: EnvironmentPanelMetrics.compactSectionSpacing) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(tr("操作", "Actions"))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                    Text(tr("这些操作可以运行任意命令并将显示在标头中。", "These actions can run arbitrary commands and appear in the header."))
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    addEnvironmentOperation(project)
                } label: {
                    Text(tr("添加操作", "Add action"))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AppTheme.textPrimary)
                        .padding(.horizontal, 12)
                        .frame(height: EnvironmentPanelMetrics.primaryButtonHeight)
                        .background(AppTheme.surfaceRaised)
                        .clipShape(RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("settings.environment.addOperation")
            }

            if operations.isEmpty {
                environmentEmptyCard(text: tr("添加操作，以便从本地工具栏运行命令。", "Add actions to run commands from the local toolbar."))
            } else {
                VStack(spacing: EnvironmentPanelMetrics.rowSpacing) {
                    ForEach(Array(operations.enumerated()), id: \.element.id) { index, _ in
                        environmentOperationRow(project: project, index: index)
                    }
                }
            }
        }
    }

    func environmentOperationRow(project: ConversationProject, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                TextField(tr("操作名称", "Action name"), text: environmentOperationTitleBinding(project: project, index: index))
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .padding(.horizontal, 10)
                    .frame(height: EnvironmentPanelMetrics.primaryButtonHeight)
                    .background(AppTheme.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous)
                            .stroke(AppTheme.borderStrong, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous))

                Button {
                    removeEnvironmentOperation(project: project, index: index)
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tr("删除操作", "Delete action"))
            }

            ZStack(alignment: .topLeading) {
                let commandBinding = environmentOperationCommandBinding(project: project, index: index)
                if commandBinding.wrappedValue.isEmpty {
                    Text(tr("例如：npm run lint", "Example: npm run lint"))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(AppTheme.textTertiary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 11)
                        .allowsHitTesting(false)
                }

                TextEditor(text: commandBinding)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(AppTheme.textPrimary)
                    .scrollContentBackground(.hidden)
                    .background(AppTheme.transparent)
                    .padding(8)
            }
            .frame(height: EnvironmentPanelMetrics.operationEditorHeight)
            .background(AppTheme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous)
                    .stroke(AppTheme.borderStrong, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: EnvironmentPanelMetrics.cornerRadius, style: .continuous))
        }
        .padding(10)
        .appCard(cornerRadius: EnvironmentPanelMetrics.cornerRadius)
    }

    func environmentScopeTabs(selection: Binding<ProjectEnvironmentScriptScope>) -> some View {
        HStack(spacing: 2) {
            ForEach(ProjectEnvironmentScriptScope.allCases) { scope in
                Button {
                    selection.wrappedValue = scope
                } label: {
                    Text(scope.title(language: appLanguage))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(selection.wrappedValue == scope ? AppTheme.textPrimary : AppTheme.textTertiary)
                        .lineLimit(1)
                        .padding(.horizontal, 9)
                        .frame(height: 24)
                        .background(selection.wrappedValue == scope ? AppTheme.surfaceRaised : AppTheme.transparent)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    func environmentEmptyCard(text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundStyle(AppTheme.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .frame(minHeight: 38)
            .appCard(cornerRadius: EnvironmentPanelMetrics.cornerRadius)
    }

    var selectedEnvironmentProject: ConversationProject? {
        guard let selectedEnvironmentProjectID else {
            return nil
        }
        return appModel.projects.first(where: { $0.id == selectedEnvironmentProjectID })
    }

    var environmentBreadcrumbSeparator: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(AppTheme.textTertiary)
    }

    func environmentBreadcrumbButton(title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
                .lineLimit(1)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    func openEnvironmentProjectHome(_ project: ConversationProject) {
        selectedEnvironmentProjectID = project.id
        isEnvironmentEditorPresented = false
        environmentDraft = nil
        environmentStatusMessage = nil
    }

    func openEnvironmentEditor(_ project: ConversationProject) {
        selectedEnvironmentProjectID = project.id
        isEnvironmentEditorPresented = true
        environmentDraft = project.localEnvironment ?? ProjectLocalEnvironment.template(for: project)
        setupScriptScope = .default
        cleanupScriptScope = .default
        environmentStatusMessage = nil
    }

    func environmentGoBack() {
        if isEnvironmentEditorPresented {
            isEnvironmentEditorPresented = false
            environmentDraft = nil
            environmentStatusMessage = nil
        } else {
            resetEnvironmentNavigation()
        }
    }

    func resetEnvironmentNavigation() {
        selectedEnvironmentProjectID = nil
        isEnvironmentEditorPresented = false
        environmentDraft = nil
        environmentStatusMessage = nil
        setupScriptScope = .default
        cleanupScriptScope = .default
    }

    func environmentDraftOrTemplate(for project: ConversationProject) -> ProjectLocalEnvironment {
        environmentDraft ?? project.localEnvironment ?? ProjectLocalEnvironment.template(for: project)
    }

    func updateEnvironmentDraft(for project: ConversationProject, mutate: (inout ProjectLocalEnvironment) -> Void) {
        var draft = environmentDraftOrTemplate(for: project)
        mutate(&draft)
        environmentDraft = draft
        environmentStatusMessage = nil
    }

    func environmentNameBinding(_ project: ConversationProject) -> Binding<String> {
        Binding(
            get: { environmentDraftOrTemplate(for: project).name },
            set: { newValue in
                updateEnvironmentDraft(for: project) { draft in
                    draft.name = newValue
                }
            }
        )
    }

    func environmentScriptBinding(
        project: ConversationProject,
        kind: EnvironmentScriptKind,
        scope: ProjectEnvironmentScriptScope
    ) -> Binding<String> {
        Binding(
            get: {
                let draft = environmentDraftOrTemplate(for: project)
                switch kind {
                case .setup:
                    return draft.setupScripts.script(for: scope)
                case .cleanup:
                    return draft.cleanupScripts.script(for: scope)
                }
            },
            set: { newValue in
                updateEnvironmentDraft(for: project) { draft in
                    switch kind {
                    case .setup:
                        draft.setupScripts.setScript(newValue, for: scope)
                    case .cleanup:
                        draft.cleanupScripts.setScript(newValue, for: scope)
                    }
                }
            }
        )
    }

    func environmentOperationTitleBinding(project: ConversationProject, index: Int) -> Binding<String> {
        Binding(
            get: {
                let operations = environmentDraftOrTemplate(for: project).operations
                guard operations.indices.contains(index) else {
                    return ""
                }
                return operations[index].title
            },
            set: { newValue in
                updateEnvironmentDraft(for: project) { draft in
                    guard draft.operations.indices.contains(index) else {
                        return
                    }
                    draft.operations[index].title = newValue
                }
            }
        )
    }

    func environmentOperationCommandBinding(project: ConversationProject, index: Int) -> Binding<String> {
        Binding(
            get: {
                let operations = environmentDraftOrTemplate(for: project).operations
                guard operations.indices.contains(index) else {
                    return ""
                }
                return operations[index].command
            },
            set: { newValue in
                updateEnvironmentDraft(for: project) { draft in
                    guard draft.operations.indices.contains(index) else {
                        return
                    }
                    draft.operations[index].command = newValue
                }
            }
        )
    }

    func addEnvironmentOperation(_ project: ConversationProject) {
        updateEnvironmentDraft(for: project) { draft in
            draft.operations.append(
                ProjectEnvironmentOperation(
                    title: tr("新操作", "New action"),
                    command: ""
                )
            )
        }
    }

    func removeEnvironmentOperation(project: ConversationProject, index: Int) {
        updateEnvironmentDraft(for: project) { draft in
            guard draft.operations.indices.contains(index) else {
                return
            }
            draft.operations.remove(at: index)
        }
    }

    func appendVariable(
        _ variable: String,
        project: ConversationProject,
        kind: EnvironmentScriptKind,
        scope: ProjectEnvironmentScriptScope
    ) {
        updateEnvironmentDraft(for: project) { draft in
            switch kind {
            case .setup:
                let script = draft.setupScripts.script(for: scope)
                draft.setupScripts.setScript(script.appendingVariable(variable), for: scope)
            case .cleanup:
                let script = draft.cleanupScripts.script(for: scope)
                draft.cleanupScripts.setScript(script.appendingVariable(variable), for: scope)
            }
        }
    }

    func normalizedEnvironmentDraft(for project: ConversationProject) -> ProjectLocalEnvironment {
        var draft = environmentDraftOrTemplate(for: project)
        let name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        draft.name = name.isEmpty ? project.name : name
        draft.operations = draft.operations.compactMap { operation in
            let title = operation.title.trimmingCharacters(in: .whitespacesAndNewlines)
            let command = operation.command.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty || !command.isEmpty else {
                return nil
            }
            return ProjectEnvironmentOperation(
                id: operation.id,
                title: title.isEmpty ? tr("未命名操作", "Untitled action") : title,
                command: command
            )
        }
        return draft
    }

    func canSaveEnvironment(_ project: ConversationProject) -> Bool {
        normalizedEnvironmentDraft(for: project) != project.localEnvironment
    }

    func saveEnvironment(_ project: ConversationProject) {
        let environment = normalizedEnvironmentDraft(for: project)
        appModel.updateProjectLocalEnvironment(project, environment: environment)
        environmentDraft = environment
        environmentStatusMessage = tr("已保存", "Saved")
    }

    func projectListDetail(for path: String) -> String {
        let url = URL(fileURLWithPath: path)
        let parent = url.deletingLastPathComponent().lastPathComponent
        guard !parent.isEmpty else {
            return path
        }
        return parent
    }
}

private extension String {
    func appendingVariable(_ variable: String) -> String {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return variable
        }
        return self + "\n" + variable
    }
}
