import Foundation
import UniformTypeIdentifiers

enum AttachmentPayloadBuilder {
    private static let textPreviewLimit = 8_000
    private static let totalTextPreviewLimit = 24_000

    static func makeAttachments(from urls: [URL]) -> [MessageAttachment] {
        urls.compactMap { url in
            guard url.isFileURL else {
                return nil
            }

            let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentTypeKey, .nameKey])
            let fileSize = Int64(values?.fileSize ?? 0)
            let contentType = values?.contentType

            return MessageAttachment(
                name: values?.name ?? url.lastPathComponent,
                path: url.path,
                kind: attachmentKind(for: url, contentType: contentType),
                byteCount: fileSize
            )
        }
    }

    static func makePromptText(prompt: String, attachments: [MessageAttachment]) throws -> String {
        guard !attachments.isEmpty else {
            return prompt
        }

        let tr = LocalizedStrings.current()
        var sections = [String]()
        let trimmedPrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedPrompt.isEmpty {
            sections.append(trimmedPrompt)
        } else {
            sections.append(tr("请结合我附带的资料来回答。", "Please answer using the materials I attached."))
        }

        let fileLines = attachments.map { attachment in
            let size = ByteCountFormatter.string(fromByteCount: attachment.byteCount, countStyle: .file)
            switch attachment.kind {
            case .image:
                return tr("- \(attachment.name)（图片，\(size)）", "- \(attachment.name) (image, \(size))")
            case .text:
                return tr("- \(attachment.name)（文本，\(size)）", "- \(attachment.name) (text, \(size))")
            case .file:
                return tr("- \(attachment.name)（文件，\(size)）", "- \(attachment.name) (file, \(size))")
            }
        }
        sections.append(tr("已附加资料：", "Attached materials:") + "\n" + fileLines.joined(separator: "\n"))

        let textBlocks = try makeTextBlocks(from: attachments)
        if !textBlocks.isEmpty {
            sections.append(tr("可直接引用的附件内容：", "Attachment contents that can be quoted directly:") + "\n\n" + textBlocks.joined(separator: "\n\n"))
        }

        return sections.joined(separator: "\n\n")
    }

    static func makeImagePayloads(from attachments: [MessageAttachment]) -> [String]? {
        let payloads = attachments.compactMap { attachment -> String? in
            guard attachment.kind == .image,
                  let data = try? Data(contentsOf: attachment.url) else {
                return nil
            }
            return data.base64EncodedString()
        }

        return payloads.isEmpty ? nil : payloads
    }

    private static func makeTextBlocks(from attachments: [MessageAttachment]) throws -> [String] {
        let tr = LocalizedStrings.current()
        var remaining = totalTextPreviewLimit
        var blocks = [String]()

        for attachment in attachments where attachment.kind == .text && remaining > 0 {
            let content: String
            do {
                let data = try Data(contentsOf: attachment.url)
                guard let string = String(data: data, encoding: .utf8) else {
                    continue
                }
                content = string
            } catch {
                throw OllamaError.attachmentPreparationFailed(tr("读取附件 \(attachment.name) 失败。", "Failed to read attachment \(attachment.name)."))
            }

            let excerptLimit = min(textPreviewLimit, remaining)
            let excerpt = String(content.prefix(excerptLimit))
            remaining -= excerpt.count

            if AppLanguage.current() == .english {
                blocks.append("""
                Attachment: \(attachment.name)
                \(excerpt)
                """)
            } else {
                blocks.append("""
                《\(attachment.name)》
                \(excerpt)
                """)
            }
        }

        return blocks
    }

    private static func attachmentKind(for url: URL, contentType: UTType?) -> AttachmentKind {
        let inferredType = contentType ?? UTType(filenameExtension: url.pathExtension)

        if inferredType?.conforms(to: .image) == true {
            return .image
        }
        if inferredType?.conforms(to: .text) == true || isLikelyTextFile(url: url) {
            return .text
        }
        return .file
    }

    private static func isLikelyTextFile(url: URL) -> Bool {
        let textExtensions: Set<String> = [
            "txt", "md", "markdown", "json", "csv", "tsv", "yaml", "yml",
            "py", "js", "ts", "tsx", "jsx", "swift", "java", "go", "rb",
            "sh", "zsh", "css", "scss", "html", "xml", "sql", "log"
        ]
        return textExtensions.contains(url.pathExtension.lowercased())
    }
}
