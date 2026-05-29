import AppKit
import SwiftUI

enum AppIconButtonHoverStyle {
    case titleBar
    case toolbarCircle
}

struct AppIconButton: View {
    let systemName: String
    let accessibilityLabel: String
    var help: String?
    var hoverStyle: AppIconButtonHoverStyle
    var tint: Color = AppTheme.textTertiary
    var badgeText: String?
    var isEnabled = true
    var keyboardShortcut: KeyboardShortcut?
    let action: () -> Void
    @State private var isHovered = false

    @ViewBuilder
    var body: some View {
        let button = Button(action: action) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: systemName)
                    .font(.system(size: DesignTokens.IconSize.medium, weight: .semibold))
                    .foregroundStyle(isEnabled ? tint : AppTheme.textTertiary)
                    .frame(width: DesignTokens.ControlSize.standardButton, height: DesignTokens.ControlSize.standardButton)

                if let badgeText {
                    Text(badgeText)
                        .font(.system(size: DesignTokens.FontSize.badge, weight: .bold))
                        .foregroundStyle(AppTheme.textOnAccent)
                        .padding(.horizontal, 3)
                        .padding(.vertical, 1)
                        .background(AppTheme.accent)
                        .clipShape(Capsule())
                        .offset(x: 4, y: -4)
                }
            }
            .modifier(AppIconButtonHoverChrome(style: hoverStyle, isHovered: isEnabled && isHovered))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .onHover { hovering in
            isHovered = isEnabled && hovering
        }
        .animation(.easeOut(duration: 0.14), value: isHovered)
        .help(help ?? accessibilityLabel)
        .accessibilityLabel(accessibilityLabel)

        if let keyboardShortcut {
            button.keyboardShortcut(keyboardShortcut)
        } else {
            button
        }
    }
}

struct AppIconGlyphButton<Content: View>: View {
    let accessibilityLabel: String
    var help: String?
    var hoverStyle: AppIconButtonHoverStyle
    var isEnabled = true
    var keyboardShortcut: KeyboardShortcut?
    let action: () -> Void
    @ViewBuilder let content: () -> Content
    @State private var isHovered = false

    @ViewBuilder
    var body: some View {
        let button = Button(action: action) {
            content()
                .frame(width: DesignTokens.ControlSize.standardButton, height: DesignTokens.ControlSize.standardButton)
                .modifier(AppIconButtonHoverChrome(style: hoverStyle, isHovered: isEnabled && isHovered))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .onHover { hovering in
            isHovered = isEnabled && hovering
        }
        .animation(.easeOut(duration: 0.14), value: isHovered)
        .help(help ?? accessibilityLabel)
        .accessibilityLabel(accessibilityLabel)

        if let keyboardShortcut {
            button.keyboardShortcut(keyboardShortcut)
        } else {
            button
        }
    }
}

private struct AppIconButtonHoverChrome: ViewModifier {
    let style: AppIconButtonHoverStyle
    let isHovered: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        switch style {
        case .titleBar:
            content
                .background(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control)
                        .fill(isHovered ? AppTheme.surfaceHover : AppTheme.transparent)
                )
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.control))
        case .toolbarCircle:
            content
                .background(
                    Circle()
                        .fill(isHovered ? AppTheme.surfaceHover : AppTheme.transparent)
                )
                .clipShape(Circle())
        }
    }
}

@MainActor
final class AppKitIconButton: NSButton {
    var hoverStyle: AppIconButtonHoverStyle {
        didSet {
            needsDisplay = true
        }
    }

    var tintColor: NSColor {
        didSet {
            contentTintColor = tintColor
        }
    }

    private var isHovered = false {
        didSet {
            needsDisplay = true
        }
    }

    init(
        systemName: String,
        accessibilityLabel: String,
        help: String? = nil,
        hoverStyle: AppIconButtonHoverStyle,
        tintColor: NSColor = NSColor(AppTheme.textTertiary),
        target: AnyObject?,
        action: Selector?
    ) {
        self.hoverStyle = hoverStyle
        self.tintColor = tintColor
        super.init(frame: NSRect(origin: .zero, size: Self.buttonSize))

        self.target = target
        self.action = action
        isBordered = false
        imagePosition = .imageOnly
        imageScaling = .scaleProportionallyDown
        focusRingType = .none
        bezelStyle = .regularSquare
        contentTintColor = tintColor
        frame = NSRect(origin: .zero, size: Self.buttonSize)
        configure(systemName: systemName, accessibilityLabel: accessibilityLabel, help: help)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func configure(systemName: String, accessibilityLabel: String, help: String? = nil) {
        image = Self.symbolImage(systemName)
        toolTip = help ?? accessibilityLabel
        setAccessibilityLabel(accessibilityLabel)
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        if isHovered {
            switch hoverStyle {
            case .titleBar:
                NSColor(AppTheme.surfaceHover).setFill()
                NSBezierPath(
                    roundedRect: bounds,
                    xRadius: DesignTokens.CornerRadius.control,
                    yRadius: DesignTokens.CornerRadius.control
                )
                .fill()
            case .toolbarCircle:
                NSColor(AppTheme.surfaceHover).setFill()
                NSBezierPath(ovalIn: bounds).fill()
            }
        }

        super.draw(dirtyRect)
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()

        trackingAreas.forEach(removeTrackingArea)
        addTrackingArea(
            NSTrackingArea(
                rect: bounds,
                options: [.activeInKeyWindow, .inVisibleRect, .mouseEnteredAndExited],
                owner: self,
                userInfo: nil
            )
        )
    }

    override func mouseEntered(with event: NSEvent) {
        super.mouseEntered(with: event)
        isHovered = true
    }

    override func mouseExited(with event: NSEvent) {
        super.mouseExited(with: event)
        isHovered = false
    }

    private static let buttonSize = NSSize(
        width: DesignTokens.ControlSize.standardButton,
        height: DesignTokens.ControlSize.standardButton
    )

    private static func symbolImage(_ systemName: String) -> NSImage {
        let configuration = NSImage.SymbolConfiguration(
            pointSize: DesignTokens.IconSize.medium,
            weight: .semibold
        )
        let image = NSImage(systemSymbolName: systemName, accessibilityDescription: nil)?
            .withSymbolConfiguration(configuration) ?? NSImage()
        image.isTemplate = true
        return image
    }
}
