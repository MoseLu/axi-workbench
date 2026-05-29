import AppKit
import Foundation
import SwiftUI

private struct TerminalPanelEntry: Identifiable, Equatable {
    enum Role: Equatable {
        case command
        case output
        case error
        case metadata
    }

    let id = UUID()
    let text: String
    let role: Role
}

struct ProjectTerminalCommandRequest: Equatable, Identifiable {
    let id: UUID
    let command: String

    init(command: String) {
        self.id = UUID()
        self.command = command
    }
}

struct ProjectTerminalPanelView: View {
    let project: ConversationProject?
    var commandRequest: ProjectTerminalCommandRequest?
    let onClose: () -> Void

    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @State private var currentDirectory = FileManager.default.homeDirectoryForCurrentUser
    @State private var commandDraft = ""
    @State private var entries: [TerminalPanelEntry] = []
    @State private var isRunning = false
    @State private var focusRequestID = UUID()
    @State private var handledCommandRequestID: UUID?

    private let runner = SandboxedCommandRunner(outputLimitBytes: 64_000)
    private let outputAnchorID = "terminal.output.anchor"

    var body: some View {
        VStack(spacing: 0) {
            header
            Rectangle()
                .fill(AppTheme.border)
                .frame(height: DesignTokens.Stroke.hairline)
            terminalBody
        }
        .background(AppTheme.canvas)
        .onAppear {
            resetDirectory()
            handleCommandRequestIfNeeded()
            focusCommandField()
        }
        .onChange(of: project?.path ?? "") { _, _ in
            resetDirectory()
            focusCommandField()
        }
        .onChange(of: commandRequest?.id) { _, _ in
            handleCommandRequestIfNeeded()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("terminal.panel")
    }

    private var header: some View {
        HStack(spacing: 8) {
            tabLabel

            AppIconButton(
                systemName: "plus",
                accessibilityLabel: tr("新终端", "New terminal"),
                help: tr("新终端", "New terminal"),
                hoverStyle: .titleBar,
                tint: AppTheme.textTertiary
            ) {
                entries.removeAll()
                resetDirectory()
                focusCommandField()
            }
            .accessibilityIdentifier("terminal.new")

            Spacer(minLength: 8)

            AppIconButton(
                systemName: "xmark",
                accessibilityLabel: tr("关闭终端", "Close terminal"),
                help: tr("关闭终端", "Close terminal"),
                hoverStyle: .titleBar,
                tint: AppTheme.textTertiary,
                action: onClose
            )
            .accessibilityIdentifier("terminal.close")
        }
        .padding(.horizontal, DesignTokens.Spacing.content)
        .frame(height: 42)
    }

    private var tabLabel: some View {
        HStack(spacing: 7) {
            Image(systemName: "terminal")
                .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
            Text(tabTitle)
                .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                .lineLimit(1)
                .truncationMode(.middle)
        }
        .foregroundStyle(AppTheme.textPrimary)
        .padding(.leading, 8)
        .padding(.trailing, 10)
        .frame(height: 28)
        .frame(maxWidth: 210, alignment: .leading)
        .background(AppTheme.surfaceRaised)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
        .accessibilityIdentifier("terminal.tab")
    }

    private var terminalBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: true) {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(entries) { entry in
                            Text(verbatim: entry.text)
                                .font(terminalFont)
                                .foregroundStyle(color(for: entry.role))
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Color.clear
                            .frame(height: 1)
                            .id(outputAnchorID)
                    }
                    .padding(.horizontal, DesignTokens.Spacing.section)
                    .padding(.top, DesignTokens.Spacing.content)
                    .padding(.bottom, DesignTokens.Spacing.control)
                }
                .frame(maxHeight: .infinity)
                .background(AppTheme.canvas)
                .onChange(of: entries.map(\.id)) { _, _ in
                    withAnimation(.easeOut(duration: 0.12)) {
                        proxy.scrollTo(outputAnchorID, anchor: .bottom)
                    }
                }
            }

            inputLine
        }
    }

    private var inputLine: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(verbatim: prompt)
                .font(terminalFont)
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)

            ZStack(alignment: .leading) {
                HStack(spacing: 1) {
                    Text(verbatim: commandDraft)
                        .font(terminalFont)
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)

                    Rectangle()
                        .fill(AppTheme.textPrimary)
                        .frame(width: 1, height: 13)
                        .opacity(isRunning ? 0 : 1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                TerminalCommandField(
                    text: $commandDraft,
                    isEnabled: !isRunning,
                    focusRequestID: focusRequestID,
                    accessibilityLabel: tr("终端命令", "Terminal command"),
                    onSubmit: submitCommand
                )
                .opacity(0.001)
            }
            .frame(height: 18)
        }
        .padding(.horizontal, DesignTokens.Spacing.section)
        .padding(.vertical, DesignTokens.Spacing.content)
    }

    private var terminalFont: Font {
        .system(size: DesignTokens.FontSize.caption, design: .monospaced)
    }

    private var tabTitle: String {
        project?.name ?? currentDirectory.lastPathComponent
    }

    private var prompt: String {
        "\(NSUserName())@\(hostName) \(directoryDisplayName) %"
    }

    private var hostName: String {
        let raw = ProcessInfo.processInfo.hostName
        return raw.split(separator: ".").first.map(String.init) ?? raw
    }

    private var directoryDisplayName: String {
        let name = currentDirectory.lastPathComponent
        return name.isEmpty ? currentDirectory.path : name
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }

    private func color(for role: TerminalPanelEntry.Role) -> Color {
        switch role {
        case .command:
            return AppTheme.textPrimary
        case .output:
            return AppTheme.textSecondary
        case .error:
            return AppTheme.destructive
        case .metadata:
            return AppTheme.textTertiary
        }
    }

    private func submitCommand() {
        let command = commandDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        runCommand(command, clearsDraft: true)
    }

    private func runCommand(_ command: String, clearsDraft: Bool) {
        let command = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !command.isEmpty, !isRunning else {
            return
        }

        entries.append(TerminalPanelEntry(text: "\(prompt) \(command)", role: .command))
        if clearsDraft {
            commandDraft = ""
        }

        if handleBuiltInCommand(command) {
            focusCommandField()
            return
        }

        isRunning = true
        let cwd = currentDirectory
        let commandRunner = runner
        Task {
            let result = await commandRunner.run(
                command: command,
                cwd: cwd,
                timeoutSeconds: 60,
                useSandbox: false,
                workspaceRoot: nil
            )

            await MainActor.run {
                appendCommandResult(result)
            }
        }
    }

    private func appendCommandResult(_ result: SandboxedCommandResult) {
        let output = result.output.trimmingCharacters(in: .newlines)
        if !output.isEmpty {
            entries.append(
                TerminalPanelEntry(
                    text: output,
                    role: result.exitCode == 0 ? .output : .error
                )
            )
        }
        if result.exitCode != 0 {
            entries.append(TerminalPanelEntry(text: "[exit \(result.exitCode)]", role: .metadata))
        }
        isRunning = false
        focusCommandField()
        handleCommandRequestIfNeeded()
    }

    private func handleCommandRequestIfNeeded() {
        guard let commandRequest,
              handledCommandRequestID != commandRequest.id else {
            return
        }
        guard !isRunning else {
            return
        }

        handledCommandRequestID = commandRequest.id
        runCommand(commandRequest.command, clearsDraft: false)
    }

    private func handleBuiltInCommand(_ command: String) -> Bool {
        if command == "clear" {
            entries.removeAll()
            return true
        }

        if command == "exit" {
            onClose()
            return true
        }

        guard command == "cd" || command.hasPrefix("cd ") else {
            return false
        }

        let rawTarget = command == "cd"
            ? FileManager.default.homeDirectoryForCurrentUser.path
            : String(command.dropFirst(3))
        let resolved = resolvedDirectory(from: rawTarget)
        var isDirectory: ObjCBool = false
        if FileManager.default.fileExists(atPath: resolved.path, isDirectory: &isDirectory),
           isDirectory.boolValue {
            currentDirectory = resolved
        } else {
            entries.append(
                TerminalPanelEntry(
                    text: "cd: no such directory: \(rawTarget)",
                    role: .error
                )
            )
        }
        return true
    }

    private func resolvedDirectory(from rawTarget: String) -> URL {
        let unquoted = rawTarget
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .strippingMatchingQuotes()
        let expanded = (unquoted as NSString).expandingTildeInPath
        if expanded.hasPrefix("/") {
            return URL(fileURLWithPath: expanded).standardizedFileURL
        }
        return currentDirectory.appending(path: expanded, directoryHint: .isDirectory).standardizedFileURL
    }

    private func resetDirectory() {
        currentDirectory = initialDirectory
    }

    private var initialDirectory: URL {
        guard let path = project?.path?.trimmingCharacters(in: .whitespacesAndNewlines),
              !path.isEmpty else {
            return FileManager.default.homeDirectoryForCurrentUser
        }

        let url = URL(fileURLWithPath: path).standardizedFileURL
        var isDirectory: ObjCBool = false
        if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory),
           isDirectory.boolValue {
            return url
        }
        return FileManager.default.homeDirectoryForCurrentUser
    }

    private func focusCommandField() {
        Task { @MainActor in
            focusRequestID = UUID()
        }
    }
}

private struct TerminalCommandField: NSViewRepresentable {
    @Binding var text: String
    let isEnabled: Bool
    let focusRequestID: UUID
    let accessibilityLabel: String
    let onSubmit: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, onSubmit: onSubmit)
    }

    func makeNSView(context: Context) -> NSTextField {
        let textField = NSTextField(frame: .zero)
        textField.isBordered = false
        textField.drawsBackground = false
        textField.focusRingType = .none
        textField.usesSingleLineMode = true
        textField.lineBreakMode = .byTruncatingTail
        textField.font = .monospacedSystemFont(ofSize: DesignTokens.FontSize.caption, weight: .regular)
        textField.textColor = .labelColor
        textField.delegate = context.coordinator
        textField.target = context.coordinator
        textField.action = #selector(Coordinator.submit(_:))
        textField.setContentHuggingPriority(.defaultLow, for: .horizontal)
        textField.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        textField.setAccessibilityLabel(accessibilityLabel)
        return textField
    }

    func updateNSView(_ textField: NSTextField, context: Context) {
        context.coordinator.text = $text
        context.coordinator.onSubmit = onSubmit
        textField.isEnabled = isEnabled
        textField.textColor = isEnabled ? .labelColor : .secondaryLabelColor
        textField.setAccessibilityLabel(accessibilityLabel)
        if textField.stringValue != text {
            textField.stringValue = text
        }

        if context.coordinator.focusRequestID != focusRequestID {
            context.coordinator.focusRequestID = focusRequestID
            DispatchQueue.main.async {
                textField.window?.makeFirstResponder(textField)
            }
        }
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var text: Binding<String>
        var onSubmit: () -> Void
        var focusRequestID: UUID?

        init(text: Binding<String>, onSubmit: @escaping () -> Void) {
            self.text = text
            self.onSubmit = onSubmit
        }

        func controlTextDidChange(_ notification: Notification) {
            guard let textField = notification.object as? NSTextField else {
                return
            }
            text.wrappedValue = textField.stringValue
        }

        @MainActor
        @objc func submit(_ sender: NSTextField) {
            text.wrappedValue = sender.stringValue
            onSubmit()
        }
    }
}

private extension String {
    func strippingMatchingQuotes() -> String {
        guard count >= 2,
              let firstCharacter = first,
              let lastCharacter = last,
              (firstCharacter == "\"" && lastCharacter == "\"") || (firstCharacter == "'" && lastCharacter == "'") else {
            return self
        }
        return String(dropFirst().dropLast())
    }
}
