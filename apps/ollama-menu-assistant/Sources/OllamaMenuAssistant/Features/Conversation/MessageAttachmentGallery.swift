import AppKit
import SwiftUI

struct MessageAttachmentGallery: View {
    let attachments: [MessageAttachment]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                ForEach(attachments) { attachment in
                    if attachment.kind == .image {
                        BubbleImageAttachment(attachment: attachment)
                    } else {
                        BubbleFileAttachment(attachment: attachment)
                    }
                }
            }
        }
    }
}

private struct BubbleImageAttachment: View {
    let attachment: MessageAttachment
    @State private var image: NSImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Group {
                if let image {
                    Image(nsImage: image)
                        .resizable()
                        .scaledToFit()
                        .padding(6)
                } else {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(AppTheme.surfaceRaised)
                        .overlay(
                            Image(systemName: "photo")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        )
                }
            }
            .frame(width: 152, height: 112)
            .background(AppTheme.surfaceRaised)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card))

            Text(attachment.name)
                .font(.system(size: DesignTokens.FontSize.metadata, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
                .lineLimit(1)
        }
        .onAppear {
            guard image == nil else {
                return
            }
            image = NSImage(contentsOf: attachment.url)
        }
    }
}

private struct BubbleFileAttachment: View {
    let attachment: MessageAttachment

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: attachment.kind == .text ? "doc.text" : "doc")
                .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                .foregroundStyle(AppTheme.textSecondary)

            VStack(alignment: .leading, spacing: 2) {
                Text(attachment.name)
                    .font(.system(size: DesignTokens.FontSize.caption, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Text(ByteCountFormatter.string(fromByteCount: attachment.byteCount, countStyle: .file))
                    .font(.system(size: DesignTokens.FontSize.micro, weight: .medium))
                    .foregroundStyle(AppTheme.textTertiary)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.row)
        .padding(.vertical, DesignTokens.Spacing.control)
        .background(AppTheme.surfaceRaised)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card)
                .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card))
    }
}
