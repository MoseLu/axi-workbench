import AppKit
import SwiftUI

struct SlashCommandSuggestionMenu: View {
    let query: String
    let skills: [SkillSummary]
    let selectedSkillID: SkillSummary.ID?
    let language: AppLanguage
    let onSelect: (SkillSummary) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(tr("技能", "Skills"))
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(AppTheme.textTertiary)
                .padding(.horizontal, 12)
                .padding(.top, 9)
                .padding(.bottom, 4)

            if skills.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AppTheme.textTertiary)
                    Text(tr("没有匹配的技能", "No matching skills"))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(AppTheme.textSecondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
            } else {
                ForEach(skills) { skill in
                    Button {
                        onSelect(skill)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "cube.box")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(AppTheme.textSecondary)
                                .frame(width: 18)

                            Text(skill.name)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(AppTheme.textPrimary)
                                .lineLimit(1)
                                .frame(width: 150, alignment: .leading)

                            Text(skill.description.isEmpty ? skill.relativePath : skill.description)
                                .font(.system(size: 12))
                                .foregroundStyle(AppTheme.textTertiary)
                                .lineLimit(1)

                            Spacer(minLength: 8)

                            Text(tr("个人", "Personal"))
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(AppTheme.textTertiary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(skill.id == selectedSkillID ? AppTheme.surfaceHover : AppTheme.transparent)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(AppTheme.borderStrong, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: AppTheme.slashMenuShadow, radius: 18, x: 0, y: 10)
        .accessibilityIdentifier("composer.slashMenu")
        .accessibilityLabel(tr("斜杠命令技能菜单", "Slash command skills menu"))
        .accessibilityValue(query.isEmpty ? tr("全部技能", "All skills") : query)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: language)
    }
}

struct WorkspacePickerButton: View {
    let projects: [ConversationProject]
    let selectedProjectID: UUID?
    let allowsNoProjectSelection: Bool
    let onSelectWorkspace: (UUID?) -> Void
    let onPickWorkspaceFolder: () -> Void
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    private var selectedProject: ConversationProject? {
        guard let selectedProjectID else {
            return nil
        }
        return projects.first(where: { $0.id == selectedProjectID })
    }

    var body: some View {
        Group {
            if AppRuntime.isSnapshotRendering {
                label
                    .padding(.horizontal, 9)
                    .frame(height: 30)
                    .background(AppTheme.surfaceRaised)
                    .overlay(
                        Capsule()
                            .stroke(AppTheme.border, lineWidth: 1)
                    )
                    .clipShape(Capsule())
            } else {
                Menu {
                    if !projects.isEmpty {
                        ForEach(projects) { project in
                            Button {
                                onSelectWorkspace(project.id)
                            } label: {
                                Label(project.name, systemImage: selectedProjectID == project.id ? "checkmark" : "folder")
                            }
                        }

                        Divider()
                    }

                    if allowsNoProjectSelection {
                        Button {
                            onSelectWorkspace(nil)
                        } label: {
                            Label(tr("不使用项目", "No project"), systemImage: selectedProjectID == nil ? "checkmark" : "folder.badge.questionmark")
                        }

                        Divider()
                    }

                    Button {
                        onPickWorkspaceFolder()
                    } label: {
                        Label(tr("添加新项目…", "Add new project..."), systemImage: "folder.badge.plus")
                    }
                } label: {
                    label
                        .padding(.horizontal, 9)
                        .frame(height: 30)
                        .background(AppTheme.surfaceRaised)
                        .overlay(
                            Capsule()
                                .stroke(AppTheme.border, lineWidth: 1)
                        )
                        .clipShape(Capsule())
                }
                .menuStyle(.borderlessButton)
                .help(tr("选择新会话工作区", "Choose workspace for new chat"))
            }
        }
        .accessibilityLabel(tr("选择新会话工作区", "Choose workspace for new chat"))
        .accessibilityValue(selectedProject?.name ?? tr("不使用项目", "No project"))
    }

    private var label: some View {
        HStack(spacing: 6) {
            Image(systemName: selectedProject == nil ? "folder" : "folder.fill")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(AppTheme.textSecondary)

            Text(selectedProject?.name ?? tr("进入项目工作", "Enter project work"))
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: 180, alignment: .leading)

            Image(systemName: "chevron.down")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(AppTheme.textSecondary)
        }
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }
}

struct AttachmentPreviewItem: View {
    let attachment: MessageAttachment
    let onRemove: () -> Void
    let onPreview: () -> Void

    var body: some View {
        Group {
            if attachment.kind == .image {
                ImageAttachmentChip(attachment: attachment, onRemove: onRemove, onPreview: onPreview)
            } else {
                FileAttachmentChip(attachment: attachment, onRemove: onRemove)
            }
        }
    }
}

private struct ImageAttachmentChip: View {
    let attachment: MessageAttachment
    let onRemove: () -> Void
    let onPreview: () -> Void
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        HStack(spacing: 6) {
            Button(action: onPreview) {
                HStack(spacing: 6) {
                    AttachmentThumbnailImage(url: attachment.url)

                    Text(attachment.name)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(AppTheme.textPrimary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .frame(width: 104, alignment: .leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .onTapGesture(count: 2, perform: onPreview)
            .help(tr("查看缩略图", "View thumbnail"))
            .accessibilityLabel(tr("查看 \(attachment.name)", "View \(attachment.name)"))

            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(AppTheme.textSecondary)
            }
            .buttonStyle(.plain)
            .help(tr("移除 \(attachment.name)", "Remove \(attachment.name)"))
            .accessibilityLabel(tr("移除 \(attachment.name)", "Remove \(attachment.name)"))
        }
        .padding(.leading, 7)
        .padding(.trailing, 8)
        .padding(.vertical, 5)
        .background(AppTheme.surfaceRaised)
        .overlay(
            Capsule()
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .clipShape(Capsule())
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }
}

private struct AttachmentThumbnailImage: View {
    let url: URL
    @State private var image: NSImage?

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 7)
                .fill(AppTheme.surface)

            if let image {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "photo")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
        .frame(width: 22, height: 22)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .onAppear {
            guard image == nil else {
                return
            }
            image = NSImage(contentsOf: url)
        }
    }
}

struct ImageAttachmentPreviewSheet: View {
    let attachment: MessageAttachment
    @Environment(\.dismiss) private var dismiss
    @State private var image: NSImage?
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Text(attachment.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.middle)

                Spacer()

                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(width: 28, height: 28)
                        .background(AppTheme.surfaceRaised)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .help(tr("关闭预览", "Close preview"))
                .accessibilityLabel(tr("关闭预览", "Close preview"))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)

            Group {
                if let image {
                    Image(nsImage: image)
                        .resizable()
                        .scaledToFit()
                } else {
                    Image(systemName: "photo")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(16)
            .background(AppTheme.canvas)
        }
        .frame(width: 680, height: 460)
        .background(AppTheme.surface)
        .onAppear {
            image = NSImage(contentsOf: attachment.url)
        }
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }
}

private struct FileAttachmentChip: View {
    let attachment: MessageAttachment
    let onRemove: () -> Void
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: attachment.kind == .text ? "doc.text" : "doc")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(AppTheme.textSecondary)

            VStack(alignment: .leading, spacing: 2) {
                Text(attachment.name)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Text(ByteCountFormatter.string(fromByteCount: attachment.byteCount, countStyle: .file))
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
            }

            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(AppTheme.textSecondary)
            }
            .buttonStyle(.plain)
            .help(tr("移除 \(attachment.name)", "Remove \(attachment.name)"))
            .accessibilityLabel(tr("移除 \(attachment.name)", "Remove \(attachment.name)"))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(AppTheme.surfaceRaised)
        .overlay(
            Capsule()
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .clipShape(Capsule())
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }
}
