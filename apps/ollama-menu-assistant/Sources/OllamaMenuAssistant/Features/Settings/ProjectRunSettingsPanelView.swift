import SwiftUI

struct ProjectRunSettingsPanelView: View {
    let project: ConversationProject?
    let initialCommand: String
    let onClose: () -> Void
    let onSaveAndRun: (String) -> Void

    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @State private var commandDraft: String
    @FocusState private var isCommandFocused: Bool

    init(
        project: ConversationProject?,
        initialCommand: String,
        onClose: @escaping () -> Void,
        onSaveAndRun: @escaping (String) -> Void
    ) {
        self.project = project
        self.initialCommand = initialCommand
        self.onClose = onClose
        self.onSaveAndRun = onSaveAndRun
        _commandDraft = State(initialValue: initialCommand)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            Text(tr("运行", "Run"))
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(AppTheme.textPrimary)
                .padding(.top, 16)

            Text(tr("告知 Assistant 如何安装依赖项并启动你的应用。", "Tell Assistant how to install dependencies and start your app."))
                .font(.system(size: DesignTokens.FontSize.body, weight: .regular))
                .foregroundStyle(AppTheme.textTertiary)
                .padding(.top, 8)

            Text(tr("要运行的命令", "Command to run"))
                .font(.system(size: DesignTokens.FontSize.caption, weight: .semibold))
                .foregroundStyle(AppTheme.textSecondary)
                .padding(.top, 26)

            commandEditor
                .padding(.top, 8)

            footer
                .padding(.top, 20)
        }
        .padding(20)
        .frame(width: 380, alignment: .topLeading)
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: Color.black.opacity(0.30), radius: 28, x: 0, y: 18)
        .onAppear {
            commandDraft = initialCommand
            isCommandFocused = true
        }
        .onChange(of: project?.id) { _, _ in
            commandDraft = project?.startupCommand ?? ""
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("project.runSettings.panel")
    }

    private var header: some View {
        HStack(alignment: .top) {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(AppTheme.surfaceRaised)
                .frame(width: 36, height: 36)
                .overlay {
                    Image(systemName: "play")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }

            Spacer(minLength: 0)

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AppTheme.textTertiary)
                    .frame(width: 26, height: 26)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help(tr("关闭", "Close"))
            .accessibilityLabel(tr("关闭", "Close"))
            .accessibilityIdentifier("project.runSettings.close")
        }
    }

    private var commandEditor: some View {
        ZStack(alignment: .topLeading) {
            if commandDraft.isEmpty {
                Text(tr("例如：npm install\nnpm run dev", "Example: npm install\nnpm run dev"))
                    .font(.system(size: DesignTokens.FontSize.caption, design: .monospaced))
                    .foregroundStyle(AppTheme.textTertiary)
                    .padding(.horizontal, 13)
                    .padding(.vertical, 12)
                    .allowsHitTesting(false)
            }

            TextEditor(text: $commandDraft)
                .font(.system(size: DesignTokens.FontSize.caption, design: .monospaced))
                .foregroundStyle(AppTheme.textPrimary)
                .scrollContentBackground(.hidden)
                .background(AppTheme.transparent)
                .padding(8)
                .focused($isCommandFocused)
        }
        .frame(height: 178)
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(isCommandFocused ? AppTheme.textPrimary : AppTheme.borderStrong, lineWidth: isCommandFocused ? 1.4 : 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .accessibilityLabel(tr("要运行的命令", "Command to run"))
        .accessibilityIdentifier("project.runSettings.command")
    }

    private var footer: some View {
        HStack(spacing: 12) {
            Spacer(minLength: 0)

            Button {
            } label: {
                Text(tr("环境设置", "Environment"))
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .frame(height: 34)
            }
            .buttonStyle(.plain)
            .disabled(true)
            .accessibilityIdentifier("project.runSettings.environment")

            Button {
                onSaveAndRun(commandDraft)
            } label: {
                Text(tr("保存并运行", "Save and run"))
                    .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                    .foregroundStyle(canSaveAndRun ? AppTheme.textPrimary : AppTheme.textTertiary)
                    .padding(.horizontal, 16)
                    .frame(height: 34)
                    .background(canSaveAndRun ? AppTheme.surfaceHover : AppTheme.surfaceRaised.opacity(0.72))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!canSaveAndRun)
            .accessibilityIdentifier("project.runSettings.saveAndRun")
        }
    }

    private var canSaveAndRun: Bool {
        project != nil && commandDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }
}
