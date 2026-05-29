import SwiftUI

enum MessageBubbleMetrics {
    static let assistantHorizontalPadding: CGFloat = 10
}

struct MessageVisibleContentCache: Equatable {
    private static let fullRenderByteLimit = 500_000
    private static let previewCharacterLimit = 160_000

    let id: UUID
    let role: ChatRole
    let timestamp: Date
    let contentByteCount: Int
    let text: String

    init(message: ChatMessage) {
        id = message.id
        role = message.role
        timestamp = message.timestamp
        contentByteCount = message.content.utf8.count
        text = Self.visibleText(for: message.content, byteCount: contentByteCount)
    }

    func matches(_ message: ChatMessage) -> Bool {
        id == message.id
            && role == message.role
            && timestamp == message.timestamp
            && contentByteCount == message.content.utf8.count
    }

    static func visibleText(for content: String) -> String {
        visibleText(for: content, byteCount: content.utf8.count)
    }

    private static func visibleText(for content: String, byteCount: Int) -> String {
        if byteCount > fullRenderByteLimit {
            return ChatMessageDisplayContent.visiblePreview(from: content, maxCharacters: previewCharacterLimit)
        }
        return ChatMessageDisplayContent.visibleText(from: content)
    }
}

struct AssistantLoadingView: View {
    let statusText: String

    var body: some View {
        HStack(spacing: 8) {
            LoadingDots()

            Text(statusText)
                .font(.system(size: DesignTokens.FontSize.body, weight: .medium))
                .foregroundStyle(AppTheme.textSecondary)
        }
        .padding(.vertical, 3)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(statusText)
        .accessibilityIdentifier("message.assistant.loading")
    }
}

private struct LoadingDots: View {
    @State private var isAnimating = false

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(AppTheme.textTertiary)
                    .frame(width: DesignTokens.Spacing.compact, height: DesignTokens.Spacing.compact)
                    .scaleEffect(dotScale(for: index))
                    .opacity(dotOpacity(for: index))
                    .animation(
                        AppRuntime.isSnapshotRendering ? nil : .easeInOut(duration: 0.54)
                            .repeatForever()
                            .delay(Double(index) * 0.12),
                        value: isAnimating
                    )
            }
        }
        .frame(width: 18, height: 14)
        .onAppear {
            guard !AppRuntime.isSnapshotRendering else {
                return
            }
            isAnimating = true
        }
    }

    private func dotScale(for index: Int) -> CGFloat {
        guard !AppRuntime.isSnapshotRendering else {
            return 1
        }
        return isAnimating ? 1.22 : 0.72
    }

    private func dotOpacity(for index: Int) -> Double {
        guard !AppRuntime.isSnapshotRendering else {
            return 0.78
        }
        return isAnimating ? 0.92 : 0.48
    }
}

struct MessageChrome: ViewModifier {
    let role: ChatRole

    func body(content: Content) -> some View {
        if role == .assistant {
            content
                .padding(.horizontal, MessageBubbleMetrics.assistantHorizontalPadding)
                .padding(.vertical, 2)
        } else {
            content
                .padding(.horizontal, 16)
                .padding(.vertical, DesignTokens.Spacing.panel)
                .background(AppTheme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.overlay)
                        .stroke(AppTheme.borderStrong, lineWidth: DesignTokens.Stroke.hairline)
                )
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.overlay))
        }
    }
}

enum HoverActionGlyph {
    case system(String)
    case copy
}

struct HoverActionButton: View {
    let glyph: HoverActionGlyph
    let help: String
    var isEnabled = true
    let action: () -> Void
    @State private var isHovered = false

    init(systemName: String, help: String, isEnabled: Bool = true, action: @escaping () -> Void) {
        glyph = .system(systemName)
        self.help = help
        self.isEnabled = isEnabled
        self.action = action
    }

    init(glyph: HoverActionGlyph, help: String, isEnabled: Bool = true, action: @escaping () -> Void) {
        self.glyph = glyph
        self.help = help
        self.isEnabled = isEnabled
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            glyphView(tint: isEnabled ? AppTheme.textSecondary : AppTheme.textTertiary)
                .frame(width: DesignTokens.IconFrame.hoverAction, height: DesignTokens.IconFrame.hoverAction)
                .background(isHovered ? AppTheme.surfaceHover : AppTheme.transparent)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xSmall))
                .animation(.easeOut(duration: 0.14), value: isHovered)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .onHover { hovering in
            guard isEnabled else {
                isHovered = false
                return
            }
            isHovered = hovering
        }
        .help(help)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(help)
    }

    @ViewBuilder
    private func glyphView(tint: Color) -> some View {
        switch glyph {
        case .system(let systemName):
            Image(systemName: systemName)
                .font(.system(size: DesignTokens.IconSize.regular, weight: .medium))
                .foregroundStyle(tint)
        case .copy:
            CopyActionGlyph(tint: tint)
        }
    }
}

private struct CopyActionGlyph: View {
    let tint: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 1.9)
                .stroke(tint, lineWidth: 1.35)
                .frame(width: 8.7, height: 8.7)
                .offset(x: 2.5, y: -2.5)

            RoundedRectangle(cornerRadius: 1.9)
                .stroke(tint, lineWidth: 1.35)
                .frame(width: 8.7, height: 8.7)
                .offset(x: -2.5, y: 2.5)
        }
        .frame(width: DesignTokens.IconFrame.hoverAction, height: DesignTokens.IconFrame.hoverAction)
    }
}
