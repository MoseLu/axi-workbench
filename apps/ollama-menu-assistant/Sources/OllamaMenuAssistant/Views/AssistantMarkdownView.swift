import SwiftUI

struct AssistantMarkdownView: View {
    let content: String
    var projectRootPath: String?
    var onOpenWorkspaceFile: ((String) -> Void)?
    var transcriptMessageID: UUID?
    @State private var documentCache: AssistantMarkdownDocumentCache

    init(
        content: String,
        projectRootPath: String? = nil,
        onOpenWorkspaceFile: ((String) -> Void)? = nil,
        transcriptMessageID: UUID? = nil
    ) {
        self.content = content
        self.projectRootPath = projectRootPath
        self.onOpenWorkspaceFile = onOpenWorkspaceFile
        self.transcriptMessageID = transcriptMessageID
        _documentCache = State(initialValue: AssistantMarkdownDocumentCache(content: content))
    }

    private var document: ChatMarkdownDocument {
        if documentCache.content == content {
            return documentCache.document
        }
        return ChatMarkdownDocument.parse(content)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(document.blocks.enumerated()), id: \.offset) { index, block in
                blockView(block)
                    .transcriptContentAnchor(
                        messageID: transcriptMessageID,
                        componentID: "markdown.\(index)"
                    )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
        .fixedSize(horizontal: false, vertical: true)
        .environment(\.openURL, OpenURLAction { url in
            guard let path = workspacePath(from: url) else {
                return .systemAction
            }
            onOpenWorkspaceFile?(path)
            return .handled
        })
        .onChange(of: content) { _, newContent in
            documentCache = AssistantMarkdownDocumentCache(content: newContent)
        }
    }

    @ViewBuilder
    private func blockView(_ block: ChatMarkdownBlock) -> some View {
        switch block {
        case .paragraph(let text):
            MarkdownInlineContent(
                text: text,
                projectRootPath: projectRootPath,
                onOpenWorkspaceFile: onOpenWorkspaceFile
            )
        case .heading(let level, let text):
            MarkdownInlineContent(
                text: text,
                projectRootPath: projectRootPath,
                onOpenWorkspaceFile: onOpenWorkspaceFile,
                fontSize: headingFontSize(for: level),
                weight: .semibold
            )
            .padding(.top, level == 1 ? 2 : 0)
        case .unorderedList(let items), .orderedList(let items):
            markdownList(items)
        case .codeBlock(let language, let code):
            MarkdownCodeBlock(language: language, code: code)
        case .table(let table):
            MarkdownTableView(
                table: table,
                projectRootPath: projectRootPath,
                onOpenWorkspaceFile: onOpenWorkspaceFile
            )
        case .quote(let text):
            MarkdownQuoteView(
                text: text,
                projectRootPath: projectRootPath,
                onOpenWorkspaceFile: onOpenWorkspaceFile
            )
        case .divider:
            Rectangle()
                .fill(AppTheme.border)
                .frame(height: DesignTokens.Stroke.hairline)
                .padding(.vertical, 2)
        }
    }

    private func markdownList(_ items: [ChatMarkdownListItem]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(item.marker)
                        .font(.system(size: DesignTokens.FontSize.callout, weight: .medium))
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(width: 20, alignment: .trailing)

                    MarkdownInlineContent(
                        text: item.text,
                        projectRootPath: projectRootPath,
                        onOpenWorkspaceFile: onOpenWorkspaceFile
                    )
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.leading, CGFloat(item.depth) * 18)
            }
        }
    }

    private func headingFontSize(for level: Int) -> CGFloat {
        switch level {
        case 1:
            DesignTokens.FontSize.bodyLarge + 3
        case 2:
            DesignTokens.FontSize.bodyLarge + 1
        default:
            DesignTokens.FontSize.callout
        }
    }

    private func workspacePath(from url: URL) -> String? {
        guard onOpenWorkspaceFile != nil else {
            return nil
        }
        if let scheme = url.scheme?.lowercased(),
           scheme != "file" {
            return nil
        }

        var rawPath = url.isFileURL ? url.path : url.relativeString
        if let queryIndex = rawPath.firstIndex(of: "?") {
            rawPath = String(rawPath[..<queryIndex])
        }
        if let fragmentIndex = rawPath.firstIndex(of: "#") {
            rawPath = String(rawPath[..<fragmentIndex])
        }

        return WorkspacePathLinkExtractor
            .reference(from: rawPath, projectRootPath: projectRootPath)?
            .navigationTarget
    }
}

private struct AssistantMarkdownDocumentCache: Equatable {
    let content: String
    let document: ChatMarkdownDocument

    init(content: String) {
        self.content = content
        document = ChatMarkdownDocument.parse(content)
    }
}

private struct MarkdownInlineContent: View {
    let text: String
    var projectRootPath: String?
    var onOpenWorkspaceFile: ((String) -> Void)?
    var fontSize: CGFloat = DesignTokens.FontSize.callout
    var weight: Font.Weight = .regular
    var color: Color = AppTheme.textPrimary

    private var canRenderWorkspaceReferences: Bool {
        onOpenWorkspaceFile != nil
            && projectRootPath?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
    }

    private var segments: [WorkspaceFileReferenceInlineSegment] {
        WorkspaceFileReferenceInlineParser.segments(in: text, projectRootPath: projectRootPath)
    }

    private var hasWorkspaceReference: Bool {
        segments.contains { segment in
            if case .reference = segment {
                return true
            }
            return false
        }
    }

    var body: some View {
        if canRenderWorkspaceReferences, hasWorkspaceReference {
            InlineWrappingLayout(spacing: 4, lineSpacing: 4) {
                ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                    switch segment {
                    case .text(let value):
                        MarkdownInlineText(
                            text: value.isEmpty ? " " : value,
                            fontSize: fontSize,
                            weight: weight,
                            color: color
                        )
                    case .reference(let reference):
                        WorkspaceFileReferenceButton(
                            reference: reference,
                            fontSize: fontSize,
                            onOpenWorkspaceFile: onOpenWorkspaceFile
                        )
                    }
                }
            }
            .fixedSize(horizontal: false, vertical: true)
        } else {
            MarkdownInlineText(
                text: text,
                fontSize: fontSize,
                weight: weight,
                color: color
            )
        }
    }
}

private struct MarkdownInlineText: View {
    let text: String
    var fontSize: CGFloat = DesignTokens.FontSize.callout
    var weight: Font.Weight = .regular
    var color: Color = AppTheme.textPrimary

    var body: some View {
        Text(attributedText)
            .lineSpacing(4)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var attributedText: AttributedString {
        var attributed = (
            try? AttributedString(
                markdown: text,
                options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
            )
        ) ?? AttributedString(text)

        let fullRange = attributed.startIndex..<attributed.endIndex
        attributed[fullRange].font = .system(size: fontSize, weight: weight)
        attributed[fullRange].foregroundColor = color

        let runs = attributed.runs.map { run in
            (range: run.range, intent: run.inlinePresentationIntent, link: run.link)
        }

        for run in runs {
            var runFont = Font.system(size: fontSize, weight: weight)
            if run.intent?.contains(.stronglyEmphasized) == true {
                runFont = .system(size: fontSize, weight: .semibold)
            }
            if run.intent?.contains(.emphasized) == true {
                runFont = runFont.italic()
            }
            if run.intent?.contains(.code) == true {
                runFont = .system(size: max(fontSize - 1, 11), weight: .regular, design: .monospaced)
                attributed[run.range].backgroundColor = AppTheme.surfaceRaised
                attributed[run.range].foregroundColor = AppTheme.textPrimary
            }
            if run.link != nil {
                attributed[run.range].foregroundColor = AppTheme.accent
                attributed[run.range].underlineStyle = .single
            }
            attributed[run.range].font = runFont
        }

        return attributed
    }
}

private struct WorkspaceFileReferenceButton: View {
    let reference: WorkspaceFileReference
    let fontSize: CGFloat
    let onOpenWorkspaceFile: ((String) -> Void)?
    @State private var isHovering = false

    var body: some View {
        Button {
            onOpenWorkspaceFile?(reference.navigationTarget)
        } label: {
            HStack(spacing: 4) {
                WorkspaceFileReferenceIcon(path: reference.path)

                Text(reference.displayName)
                    .font(.system(size: fontSize, weight: .semibold))
                    .foregroundStyle(AppTheme.accent)
                    .lineLimit(1)

                if let locationText = reference.locationText {
                    Text("(\(locationText))")
                        .font(.system(size: fontSize, weight: .medium))
                        .foregroundStyle(AppTheme.accent.opacity(0.86))
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 2)
            .padding(.vertical, 1)
            .background(isHovering ? AppTheme.accentSoft : AppTheme.transparent)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.tiny))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovering = hovering
        }
        .help(reference.navigationTarget)
        .accessibilityLabel(referenceAccessibilityLabel)
    }

    private var referenceAccessibilityLabel: String {
        if let locationText = reference.locationText {
            return "\(reference.displayName), \(locationText)"
        }
        return reference.displayName
    }
}

private struct WorkspaceFileReferenceIcon: View {
    let path: String

    var body: some View {
        Group {
            if usesSymbolIcon {
                Image(systemName: symbolName)
                    .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                    .foregroundStyle(AppTheme.accent)
                    .frame(width: 16, height: 16)
            } else {
                Text(extensionBadge)
                    .font(.system(size: 8.5, weight: .bold, design: .rounded))
                    .foregroundStyle(AppTheme.accent)
                    .frame(width: 17, height: 14)
                    .background(AppTheme.accentSoft)
                    .overlay(
                        RoundedRectangle(cornerRadius: 3)
                            .stroke(AppTheme.accent.opacity(0.36), lineWidth: DesignTokens.Stroke.hairline)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 3))
            }
        }
        .accessibilityHidden(true)
    }

    private var fileExtension: String {
        URL(fileURLWithPath: path).pathExtension.lowercased()
    }

    private var usesSymbolIcon: Bool {
        ["md", "markdown", "png", "jpg", "jpeg", "gif", "webp", "svg"].contains(fileExtension)
    }

    private var symbolName: String {
        switch fileExtension {
        case "md", "markdown":
            return "doc.richtext"
        case "png", "jpg", "jpeg", "gif", "webp", "svg":
            return "photo"
        default:
            return "doc.text"
        }
    }

    private var extensionBadge: String {
        let value = fileExtension.isEmpty ? "FILE" : fileExtension.uppercased()
        return String(value.prefix(2))
    }
}

private struct InlineWrappingLayout: Layout {
    var spacing: CGFloat
    var lineSpacing: CGFloat
    private let wrappedTextHeight: CGFloat = 32

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout ()
    ) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var cursorX: CGFloat = 0
        var cursorY: CGFloat = 0
        var rowHeight: CGFloat = 0
        var measuredWidth: CGFloat = 0

        for subview in subviews {
            var size = measuredSize(for: subview, remainingWidth: maxWidth - cursorX, maxWidth: maxWidth)
            if maxWidth.isFinite, cursorX > 0, size.width > max(maxWidth - cursorX, 0) + 0.5 {
                finishRow(cursorY: &cursorY, cursorX: &cursorX, rowHeight: &rowHeight)
                size = measuredSize(for: subview, remainingWidth: maxWidth, maxWidth: maxWidth)
            }

            measuredWidth = max(measuredWidth, cursorX + size.width)
            cursorX += size.width + spacing
            rowHeight = max(rowHeight, size.height)

            if maxWidth.isFinite, size.height > wrappedTextHeight {
                finishRow(cursorY: &cursorY, cursorX: &cursorX, rowHeight: &rowHeight)
            }
        }

        let height = cursorY + rowHeight
        return CGSize(
            width: proposal.width ?? measuredWidth,
            height: max(height, 1)
        )
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal _: ProposedViewSize,
        subviews: Subviews,
        cache _: inout ()
    ) {
        let maxWidth = bounds.width
        var cursorX: CGFloat = 0
        var cursorY: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            var size = measuredSize(for: subview, remainingWidth: maxWidth - cursorX, maxWidth: maxWidth)
            if cursorX > 0, size.width > max(maxWidth - cursorX, 0) + 0.5 {
                finishRow(cursorY: &cursorY, cursorX: &cursorX, rowHeight: &rowHeight)
                size = measuredSize(for: subview, remainingWidth: maxWidth, maxWidth: maxWidth)
            }

            subview.place(
                at: CGPoint(x: bounds.minX + cursorX, y: bounds.minY + cursorY),
                proposal: ProposedViewSize(width: size.width, height: size.height)
            )

            cursorX += size.width + spacing
            rowHeight = max(rowHeight, size.height)

            if size.height > wrappedTextHeight {
                finishRow(cursorY: &cursorY, cursorX: &cursorX, rowHeight: &rowHeight)
            }
        }
    }

    private func measuredSize(
        for subview: LayoutSubview,
        remainingWidth: CGFloat,
        maxWidth: CGFloat
    ) -> CGSize {
        guard maxWidth.isFinite else {
            return subview.sizeThatFits(.unspecified)
        }
        return subview.sizeThatFits(
            ProposedViewSize(width: max(remainingWidth, 1), height: nil)
        )
    }

    private func finishRow(cursorY: inout CGFloat, cursorX: inout CGFloat, rowHeight: inout CGFloat) {
        guard cursorX > 0 || rowHeight > 0 else {
            return
        }
        cursorY += rowHeight + lineSpacing
        cursorX = 0
        rowHeight = 0
    }
}

private struct MarkdownCodeBlock: View {
    let language: String?
    let code: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let language, !language.isEmpty {
                Text(language)
                    .font(.system(size: DesignTokens.FontSize.micro, weight: .semibold))
                    .foregroundStyle(AppTheme.textTertiary)
                    .padding(.horizontal, 10)
                    .padding(.top, 8)
                    .padding(.bottom, 2)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                Text(verbatim: code.isEmpty ? " " : code)
                    .font(.system(size: DesignTokens.FontSize.caption, design: .monospaced))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineSpacing(3)
                    .padding(.horizontal, 10)
                    .padding(.vertical, language == nil ? 8 : 7)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
        )
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
    }
}

private struct MarkdownTableView: View {
    let table: ChatMarkdownTable
    var projectRootPath: String?
    var onOpenWorkspaceFile: ((String) -> Void)?
    // Horizontal ScrollView proposes an unbounded width; a fixed column width lets text report wrapped height.
    private let columnWidth: CGFloat = 220

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
                GridRow {
                    ForEach(table.headers.indices, id: \.self) { column in
                        cell(
                            table.headers[column],
                            column: column,
                            isHeader: true
                        )
                    }
                }

                ForEach(Array(table.rows.enumerated()), id: \.offset) { _, row in
                    GridRow {
                        ForEach(table.headers.indices, id: \.self) { column in
                            cell(
                                column < row.count ? row[column] : "",
                                column: column,
                                isHeader: false
                            )
                        }
                    }
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                    .stroke(AppTheme.border, lineWidth: DesignTokens.Stroke.hairline)
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
        }
    }

    private func cell(_ text: String, column: Int, isHeader: Bool) -> some View {
        MarkdownInlineContent(
            text: text.isEmpty ? " " : text,
            projectRootPath: projectRootPath,
            onOpenWorkspaceFile: onOpenWorkspaceFile,
            fontSize: DesignTokens.FontSize.caption,
            weight: isHeader ? .semibold : .regular,
            color: isHeader ? AppTheme.textPrimary : AppTheme.textSecondary
        )
        .lineLimit(nil)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .frame(width: columnWidth, alignment: alignment(for: column))
        .background(isHeader ? AppTheme.surfaceRaised : AppTheme.transparent)
        .border(AppTheme.border, width: DesignTokens.Stroke.hairline)
    }

    private func alignment(for column: Int) -> Alignment {
        guard column < table.alignments.count else {
            return .leading
        }
        switch table.alignments[column] {
        case .leading:
            return .leading
        case .center:
            return .center
        case .trailing:
            return .trailing
        }
    }
}

private struct MarkdownQuoteView: View {
    let text: String
    var projectRootPath: String?
    var onOpenWorkspaceFile: ((String) -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.tiny)
                .fill(AppTheme.borderStrong)
                .frame(width: 3)

            MarkdownInlineContent(
                text: text,
                projectRootPath: projectRootPath,
                onOpenWorkspaceFile: onOpenWorkspaceFile,
                color: AppTheme.textSecondary
            )
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 2)
    }
}
