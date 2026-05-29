import AppKit
import SwiftUI

struct WorkspaceFilePreviewSelection: Identifiable, Equatable {
    var projectID: UUID?
    var projectName: String
    var projectPath: String
    var path: String
    var line: Int?
    var column: Int?

    var id: String {
        "\(projectPath)|\(path)|\(line.map(String.init) ?? "")|\(column.map(String.init) ?? "")"
    }

    var locationText: String? {
        guard let line else {
            return nil
        }
        if let column {
            return "line \(line):\(column)"
        }
        return "line \(line)"
    }

    var pathWithLocation: String {
        guard let line else {
            return path
        }
        if let column {
            return "\(path):\(line):\(column)"
        }
        return "\(path):\(line)"
    }

    var fileURL: URL? {
        let root = URL(fileURLWithPath: projectPath)
            .standardizedFileURL
            .resolvingSymlinksInPath()
        let url: URL
        if path.hasPrefix("/") {
            url = URL(fileURLWithPath: path)
                .standardizedFileURL
                .resolvingSymlinksInPath()
        } else {
            url = root.appending(path: path)
                .standardizedFileURL
                .resolvingSymlinksInPath()
        }
        guard url.path == root.path || url.path.hasPrefix(root.path + "/") else {
            return nil
        }
        return url
    }
}

private enum WorkspaceFilePreviewLoadState {
    case idle
    case loading
    case text(WorkspaceFilePreviewText)
    case image(NSImage)
    case failed(String)
}

private struct WorkspaceFilePreviewText {
    var content: String
    var isMarkdown: Bool
    var didTruncate: Bool
}

struct WorkspaceFilePreviewSidebarView: View {
    let selection: WorkspaceFilePreviewSelection
    let onClose: () -> Void

    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @AppStorage(DefaultEditorTarget.storageKey) private var defaultEditorRaw = DefaultEditorTarget.finder.rawValue
    @State private var loadState: WorkspaceFilePreviewLoadState = .idle
    @State private var actionMessage: String?
    @State private var scrollMetrics = AppScrollMetrics()
    @State private var scrollController = AppScrollController()

    private let maxPreviewBytes = 420_000
    private let workspaceActions = WorkspaceChangeActions()

    var body: some View {
        VStack(spacing: 0) {
            header
            Rectangle()
                .fill(AppTheme.border)
                .frame(height: DesignTokens.Stroke.hairline)
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(AppTheme.canvas)
        .task(id: selection.id) {
            await loadPreview()
        }
        .onChange(of: selection.id) { _, _ in
            actionMessage = nil
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("file.preview.sidebar")
    }

    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: iconName)
                .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                .foregroundStyle(AppTheme.accent)
                .frame(width: DesignTokens.IconFrame.sidebar)

            VStack(alignment: .leading, spacing: 2) {
                Text(selection.path)
                    .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.middle)

                Text(selectionSubtitle)
                    .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            AppIconButton(
                systemName: "doc.on.doc",
                accessibilityLabel: tr("复制路径", "Copy path"),
                help: tr("复制路径", "Copy path"),
                hoverStyle: .titleBar,
                tint: AppTheme.textTertiary
            ) {
                copyPath()
            }

            AppIconButton(
                systemName: "arrow.up.right.square",
                accessibilityLabel: tr("在编辑器中打开", "Open in editor"),
                help: tr("在编辑器中打开", "Open in editor"),
                hoverStyle: .titleBar,
                tint: AppTheme.textTertiary
            ) {
                openInEditor()
            }

            AppIconButton(
                systemName: "xmark",
                accessibilityLabel: tr("关闭预览", "Close preview"),
                help: tr("关闭预览", "Close preview"),
                hoverStyle: .titleBar,
                tint: AppTheme.textTertiary,
                action: onClose
            )
        }
        .padding(.horizontal, DesignTokens.Spacing.content)
        .frame(height: 48)
    }

    @ViewBuilder
    private var content: some View {
        VStack(spacing: 0) {
            if let actionMessage {
                InlineNotice(text: actionMessage, tint: AppTheme.warning)
                    .padding(.horizontal, DesignTokens.Spacing.content)
                    .padding(.top, DesignTokens.Spacing.control)
                    .padding(.bottom, DesignTokens.Spacing.compact)
            }

            switch loadState {
            case .idle, .loading:
                ProgressView()
                    .controlSize(.small)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityLabel(tr("正在加载预览", "Loading preview"))
            case .failed(let message):
                emptyState(
                    systemName: "exclamationmark.triangle",
                    title: tr("无法预览文件", "Unable to preview file"),
                    detail: message
                )
            case .image(let image):
                imagePreview(image)
            case .text(let preview):
                textPreview(preview)
            }
        }
    }

    private func imagePreview(_ image: NSImage) -> some View {
        ScrollView([.vertical, .horizontal], showsIndicators: false) {
            Image(nsImage: image)
                .resizable()
                .scaledToFit()
                .padding(DesignTokens.Spacing.content)
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    @ViewBuilder
    private func textPreview(_ preview: WorkspaceFilePreviewText) -> some View {
        VStack(spacing: 0) {
            if preview.didTruncate {
                InlineNotice(
                    text: tr("文件较大，已截断预览。", "Large file truncated for preview."),
                    tint: AppTheme.warning
                )
                .padding(.horizontal, DesignTokens.Spacing.content)
                .padding(.top, DesignTokens.Spacing.control)
                .padding(.bottom, DesignTokens.Spacing.compact)
            }

            if preview.isMarkdown {
                ScrollView(.vertical, showsIndicators: false) {
                    AssistantMarkdownView(content: preview.content)
                        .padding(DesignTokens.Spacing.content)
                        .background(
                            AppScrollMetricsReader(
                                metrics: $scrollMetrics,
                                controller: scrollController
                            )
                        )
                }
                .overlay(alignment: .topTrailing) {
                    scrollIndicator
                }
            } else {
                codePreview(preview.content)
            }
        }
    }

    private func codePreview(_ text: String) -> some View {
        ScrollView([.vertical, .horizontal], showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(text.split(separator: "\n", omittingEmptySubsequences: false).enumerated()), id: \.offset) { index, line in
                    let isSelectedLine = selection.line == index + 1
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(index + 1)")
                            .font(codeFont)
                            .foregroundStyle(isSelectedLine ? AppTheme.accent : AppTheme.themePreviewLineNumber)
                            .frame(width: 42, alignment: .trailing)

                        Text(verbatim: line.isEmpty ? " " : String(line))
                            .font(codeFont)
                            .foregroundStyle(isSelectedLine ? AppTheme.textPrimary : AppTheme.themePreviewText)
                            .fixedSize(horizontal: true, vertical: false)
                    }
                    .padding(.horizontal, 10)
                    .frame(minHeight: 21, alignment: .leading)
                    .background(isSelectedLine ? AppTheme.accentSoft : AppTheme.transparent)
                }
            }
            .padding(.vertical, 10)
            .background(
                AppScrollMetricsReader(
                    metrics: $scrollMetrics,
                    controller: scrollController
                )
            )
        }
        .background(AppTheme.themePreviewCodeSurface)
        .overlay(alignment: .topTrailing) {
            scrollIndicator
        }
    }

    private var scrollIndicator: some View {
        AppVerticalScrollIndicator(
            metrics: scrollMetrics,
            controller: scrollController,
            width: 6,
            trailingInset: 3,
            verticalInset: 6,
            minimumThumbHeight: 34
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
                .lineLimit(4)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(DesignTokens.Spacing.window)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @MainActor
    private func loadPreview() async {
        loadState = .loading
        guard let url = selection.fileURL else {
            loadState = .failed(tr("路径不在当前项目中。", "Path is outside the current project."))
            return
        }

        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory) else {
            loadState = .failed(tr("文件不存在：\(selection.path)", "File does not exist: \(selection.path)"))
            return
        }
        guard !isDirectory.boolValue else {
            loadState = .failed(tr("目录不能作为文件预览。", "Directories cannot be previewed as files."))
            return
        }

        if isImageFile(url),
           let image = NSImage(contentsOf: url) {
            loadState = .image(image)
            return
        }

        do {
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            let data = handle.readData(ofLength: maxPreviewBytes + 1)
            let didTruncate = data.count > maxPreviewBytes
            let prefix = didTruncate ? data.prefix(maxPreviewBytes) : data[...]
            guard let text = String(data: Data(prefix), encoding: .utf8) else {
                loadState = .failed(tr("二进制或非 UTF-8 文件无法预览。", "Binary or non-UTF-8 files cannot be previewed."))
                return
            }

            let isMarkdown = isMarkdownFile(url) && selection.line == nil
            loadState = .text(
                WorkspaceFilePreviewText(
                    content: text,
                    isMarkdown: isMarkdown,
                    didTruncate: didTruncate
                )
            )
            scheduleLineScrollIfNeeded(isMarkdown: isMarkdown)
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }

    private func copyPath() {
        workspaceActions.copyPath(selection.pathWithLocation)
        actionMessage = tr("已复制路径。", "Path copied.")
    }

    private func scheduleLineScrollIfNeeded(isMarkdown: Bool) {
        guard !isMarkdown,
              let line = selection.line,
              line > 1 else {
            return
        }

        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 140_000_000)
            scrollController.scroll(toOffset: CGFloat(line - 1) * 21)
        }
    }

    private func openInEditor() {
        if let failure = workspaceActions.openFileURL(selection.fileURL, defaultEditorRaw: defaultEditorRaw) {
            actionMessage = actionFailureMessage(failure)
        } else {
            actionMessage = nil
        }
    }

    private var iconName: String {
        if selection.path.hasSuffix(".md") || selection.path.hasSuffix(".markdown") {
            return "doc.richtext"
        }
        if isImageExtension(URL(fileURLWithPath: selection.path).pathExtension) {
            return "photo"
        }
        return "doc.text"
    }

    private var codeFont: Font {
        .system(size: DesignTokens.FontSize.caption, design: .monospaced)
    }

    private var selectionSubtitle: String {
        guard let locationText = selection.locationText else {
            return selection.projectName
        }
        return "\(selection.projectName) · \(locationText)"
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }

    private func actionFailureMessage(_ failure: WorkspaceChangeActionFailure) -> String {
        switch failure {
        case .missingProjectForFileAction, .missingProjectForOpen:
            return tr("路径不在当前项目中。", "Path is outside the current project.")
        case .missingFile:
            return tr("文件不存在，无法打开。", "The file does not exist and cannot be opened.")
        case .editorUnavailable:
            return tr("无法打开默认编辑器。", "Unable to open the default editor.")
        case .commandFailed(let message):
            let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty
                ? tr("操作失败。", "Action failed.")
                : trimmed
        }
    }

    private func isImageFile(_ url: URL) -> Bool {
        isImageExtension(url.pathExtension)
    }

    private func isMarkdownFile(_ url: URL) -> Bool {
        ["md", "markdown"].contains(url.pathExtension.lowercased())
    }

    private func isImageExtension(_ value: String) -> Bool {
        ["png", "jpg", "jpeg", "gif", "webp", "tiff", "heic"].contains(value.lowercased())
    }
}
