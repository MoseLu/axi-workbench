import AppKit
import SwiftUI

struct GeneratedFilePreviewCard: View {
    let link: WorkspaceFileLink
    let projectRootPath: String?
    let onPreviewFile: (String) -> Void
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue
    @State private var isHovering = false
    private let fileActions = GeneratedFilePreviewActions()

    var body: some View {
        HStack(spacing: 12) {
            Button {
                onPreviewFile(link.path)
            } label: {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                            .fill(AppTheme.surfaceRaised)
                            .frame(width: 42, height: 42)

                        Image(systemName: iconName)
                            .font(.system(size: DesignTokens.IconSize.large, weight: .semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(link.displayName)
                            .font(.system(size: DesignTokens.FontSize.body, weight: .semibold))
                            .foregroundStyle(AppTheme.textPrimary)
                            .lineLimit(1)
                            .truncationMode(.middle)

                        Text(fileKindText)
                            .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                            .foregroundStyle(AppTheme.textTertiary)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 10)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help(tr("预览 \(link.path)", "Preview \(link.path)"))

            openMenu
        }
        .padding(.leading, 14)
        .padding(.trailing, 12)
        .frame(maxWidth: .infinity, minHeight: 68, alignment: .leading)
        .background(isHovering ? AppTheme.surfaceHover : AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
        .onHover { hovering in
            isHovering = hovering
        }
        .animation(.easeOut(duration: 0.14), value: isHovering)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(tr("生成文件 \(link.displayName)", "Generated file \(link.displayName)"))
    }

    private var openMenu: some View {
        Menu {
            Button {
                onPreviewFile(link.path)
            } label: {
                Label(tr("预览", "Preview"), systemImage: "sidebar.right")
            }

            Button {
                openWithDefaultApplication()
            } label: {
                Label(tr("默认应用", "Default app"), systemImage: "app")
            }

            Button {
                openWith(.terminal)
            } label: {
                Label("Terminal", systemImage: "terminal")
            }

            Button {
                openWith(.xcode)
            } label: {
                Label("Xcode", systemImage: "hammer")
            }

            Divider()

            Button {
                revealInFinder()
            } label: {
                Label(tr("在文件夹中打开", "Show in folder"), systemImage: "folder")
            }
        } label: {
            HStack(spacing: 6) {
                Text(tr("打开", "Open"))
                    .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Image(systemName: "chevron.down")
                    .font(.system(size: DesignTokens.IconSize.chevronSmall, weight: .semibold))
                    .foregroundStyle(AppTheme.textTertiary)
            }
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(AppTheme.surfaceRaised)
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                    .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .help(tr("打开生成文件", "Open generated file"))
    }

    private var appLanguage: AppLanguage {
        AppLanguage.resolved(from: languageRaw)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: appLanguage)
    }

    private var iconName: String {
        switch fileExtension {
        case "md", "markdown":
            return "doc.richtext"
        case "png", "jpg", "jpeg", "gif", "webp", "tiff", "heic", "svg":
            return "photo"
        default:
            return "doc.text"
        }
    }

    private var fileKindText: String {
        let kind: String
        switch fileExtension {
        case "md", "markdown":
            kind = "MD"
        case "swift":
            kind = "Swift"
        case "json":
            kind = "JSON"
        case "png", "jpg", "jpeg", "gif", "webp", "tiff", "heic", "svg":
            kind = tr("图像", "Image")
        case "":
            kind = tr("文件", "File")
        default:
            kind = fileExtension.uppercased()
        }
        return tr("文档 · \(kind)", "Document · \(kind)")
    }

    private var fileExtension: String {
        URL(fileURLWithPath: link.path).pathExtension.lowercased()
    }

    private var fileURL: URL? {
        guard let projectRootPath,
              let normalized = WorkspacePathLinkExtractor.normalizedPath(link.path, projectRootPath: projectRootPath) else {
            return nil
        }

        let root = URL(fileURLWithPath: projectRootPath)
            .standardizedFileURL
            .resolvingSymlinksInPath()
        return root.appending(path: normalized)
            .standardizedFileURL
            .resolvingSymlinksInPath()
    }

    private func openWithDefaultApplication() {
        guard let fileURL else {
            return
        }
        fileActions.openWithDefaultApplication(fileURL)
    }

    private func openWith(_ target: DefaultEditorTarget) {
        guard let fileURL else {
            return
        }
        fileActions.open(fileURL, target: target)
    }

    private func revealInFinder() {
        guard let fileURL else {
            return
        }
        fileActions.revealInFinder(fileURL)
    }
}

private struct GeneratedFilePreviewActions {
    func openWithDefaultApplication(_ fileURL: URL) {
        NSWorkspace.shared.open(fileURL)
    }

    func open(_ fileURL: URL, target: DefaultEditorTarget) {
        target.open(fileURL)
    }

    func revealInFinder(_ fileURL: URL) {
        NSWorkspace.shared.activateFileViewerSelecting([fileURL])
    }
}
