import AppKit
import SwiftUI

enum ComposerTextMetrics {
    static let inputFontSize = DesignTokens.FontSize.bodyLarge
    static let placeholderFontSize = DesignTokens.FontSize.body
    static let expandedLineHeight: CGFloat = 20
    static let snapshotLineSpacing: CGFloat = 3
}

struct PromptComposer: NSViewRepresentable {
    @Binding var text: String
    let onSubmit: () -> Void
    let onDropAttachments: ([URL]) -> Bool
    let onDropTargetChange: (Bool) -> Void
    var onMoveSlashSelection: (Int) -> Bool = { _ in false }
    var onAcceptSlashSelection: () -> Bool = { false }
    var onDismissSlashMenu: () -> Bool = { false }
    var onTextActivityChange: (Bool) -> Void = { _ in }
    var accessibilityLabel: String = "Message input"
    var accessibilityIdentifier: String = "composer.input"
    var accessibilityHint: String = "Press Enter to send, Shift-Enter for a new line"
    var emptyAccessibilityValue: String = "Blank"
    var focusOnAppear = false

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, onSubmit: onSubmit, onDropAttachments: onDropAttachments)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = false
        scrollView.autohidesScrollers = true
        scrollView.borderType = .noBorder
        scrollView.drawsBackground = false
        scrollView.scrollerStyle = .overlay
        scrollView.automaticallyAdjustsContentInsets = false
        scrollView.setAccessibilityElement(false)

        let textView = SubmitTextView()
        textView.delegate = context.coordinator
        textView.font = .systemFont(ofSize: ComposerTextMetrics.inputFontSize)
        textView.drawsBackground = false
        textView.isRichText = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticTextCompletionEnabled = false
        textView.isContinuousSpellCheckingEnabled = false
        textView.focusRingType = .none
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.minSize = NSSize(width: 0, height: 0)
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.textContainerInset = NSSize(width: 0, height: 3)
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.containerSize = NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude)
        textView.registerForDraggedTypes([.fileURL])
        textView.submitHandler = onSubmit
        textView.moveSlashSelectionHandler = onMoveSlashSelection
        textView.acceptSlashSelectionHandler = onAcceptSlashSelection
        textView.dismissSlashMenuHandler = onDismissSlashMenu
        textView.textActivityChangeHandler = onTextActivityChange
        textView.attachmentDropHandler = context.coordinator.handleAttachmentDrop(urls:)
        textView.attachmentDropTargetChangeHandler = onDropTargetChange
        textView.accessibilityLabelText = accessibilityLabel
        textView.accessibilityIdentifierText = accessibilityIdentifier
        textView.accessibilityHelpText = accessibilityHint
        textView.emptyAccessibilityValueText = emptyAccessibilityValue
        textView.string = text
        applyTheme(to: textView)
        textView.publishTextActivity()
        focus(textView, context: context)

        scrollView.documentView = textView
        return scrollView
    }

    func updateNSView(_ nsView: NSScrollView, context: Context) {
        guard let textView = nsView.documentView as? SubmitTextView else {
            return
        }

        if textView.string != text {
            textView.string = text
        }
        textView.submitHandler = onSubmit
        textView.moveSlashSelectionHandler = onMoveSlashSelection
        textView.acceptSlashSelectionHandler = onAcceptSlashSelection
        textView.dismissSlashMenuHandler = onDismissSlashMenu
        textView.textActivityChangeHandler = onTextActivityChange
        textView.attachmentDropHandler = context.coordinator.handleAttachmentDrop(urls:)
        textView.attachmentDropTargetChangeHandler = onDropTargetChange
        textView.accessibilityLabelText = accessibilityLabel
        textView.accessibilityIdentifierText = accessibilityIdentifier
        textView.accessibilityHelpText = accessibilityHint
        textView.emptyAccessibilityValueText = emptyAccessibilityValue
        applyTheme(to: textView)
        textView.publishTextActivity()
        focus(textView, context: context)
    }

    private func applyTheme(to textView: SubmitTextView) {
        let textColor = NSColor(AppTheme.textPrimary)
        textView.textColor = textColor
        textView.insertionPointColor = textColor
        textView.typingAttributes[.foregroundColor] = textColor
    }

    private func focus(_ textView: SubmitTextView, context: Context) {
        guard focusOnAppear, !context.coordinator.didFocus else {
            return
        }

        DispatchQueue.main.async {
            guard let window = textView.window else {
                return
            }
            window.makeFirstResponder(textView)
            textView.setSelectedRange(NSRange(location: textView.string.count, length: 0))
            context.coordinator.didFocus = true
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        @Binding private var text: String
        private let onSubmit: () -> Void
        private let onDropAttachments: ([URL]) -> Bool
        var didFocus = false

        init(text: Binding<String>, onSubmit: @escaping () -> Void, onDropAttachments: @escaping ([URL]) -> Bool) {
            self._text = text
            self.onSubmit = onSubmit
            self.onDropAttachments = onDropAttachments
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else {
                return
            }
            text = textView.string
        }

        func handleAttachmentDrop(urls: [URL]) -> Bool {
            onDropAttachments(urls)
        }
    }
}

private final class SubmitTextView: NSTextView {
    var submitHandler: (() -> Void)?
    var moveSlashSelectionHandler: ((Int) -> Bool)?
    var acceptSlashSelectionHandler: (() -> Bool)?
    var dismissSlashMenuHandler: (() -> Bool)?
    var textActivityChangeHandler: ((Bool) -> Void)?
    var attachmentDropHandler: (([URL]) -> Bool)?
    var attachmentDropTargetChangeHandler: ((Bool) -> Void)?
    var accessibilityLabelText = "Message input"
    var accessibilityIdentifierText = "composer.input"
    var accessibilityHelpText = "Press Enter to send, Shift-Enter for a new line"
    var emptyAccessibilityValueText = "Blank"

    override func keyDown(with event: NSEvent) {
        if event.keyCode == 53, dismissSlashMenuHandler?() == true {
            return
        }

        if event.keyCode == 125, moveSlashSelectionHandler?(1) == true {
            return
        }

        if event.keyCode == 126, moveSlashSelectionHandler?(-1) == true {
            return
        }

        if event.keyCode == 36 {
            if acceptSlashSelectionHandler?() == true {
                return
            }
            if event.modifierFlags.contains(.shift) {
                insertNewline(nil)
            } else {
                submitHandler?()
            }
            return
        }

        super.keyDown(with: event)
    }

    override func setMarkedText(_ string: Any, selectedRange: NSRange, replacementRange: NSRange) {
        super.setMarkedText(string, selectedRange: selectedRange, replacementRange: replacementRange)
        publishTextActivity()
    }

    override func unmarkText() {
        super.unmarkText()
        publishTextActivity()
    }

    override func insertText(_ insertString: Any, replacementRange: NSRange) {
        super.insertText(insertString, replacementRange: replacementRange)
        publishTextActivity()
    }

    override func didChangeText() {
        super.didChangeText()
        publishTextActivity()
    }

    func publishTextActivity() {
        textActivityChangeHandler?(!string.isEmpty || hasMarkedText())
    }

    override func isAccessibilityElement() -> Bool {
        true
    }

    override func draggingEntered(_ sender: any NSDraggingInfo) -> NSDragOperation {
        if droppedFileURLs(from: sender.draggingPasteboard).isEmpty == false {
            attachmentDropTargetChangeHandler?(true)
            return .copy
        }
        return super.draggingEntered(sender)
    }

    override func performDragOperation(_ sender: any NSDraggingInfo) -> Bool {
        defer { attachmentDropTargetChangeHandler?(false) }
        let fileURLs = droppedFileURLs(from: sender.draggingPasteboard)
        if fileURLs.isEmpty == false, attachmentDropHandler?(fileURLs) == true {
            return true
        }
        return super.performDragOperation(sender)
    }

    override func draggingExited(_ sender: (any NSDraggingInfo)?) {
        attachmentDropTargetChangeHandler?(false)
        super.draggingExited(sender)
    }

    override func accessibilityRole() -> NSAccessibility.Role? {
        .textArea
    }

    override func accessibilityLabel() -> String? {
        accessibilityLabelText
    }

    override func accessibilityIdentifier() -> String {
        accessibilityIdentifierText
    }

    override func accessibilityHelp() -> String? {
        accessibilityHelpText
    }

    override func accessibilityValue() -> String? {
        string.isEmpty ? emptyAccessibilityValueText : string
    }

    private func droppedFileURLs(from pasteboard: NSPasteboard) -> [URL] {
        guard let items = pasteboard.readObjects(forClasses: [NSURL.self]) as? [URL] else {
            return []
        }
        return items.filter(\.isFileURL)
    }
}
