import AppKit
import SwiftUI

struct ScrollViewAccessibilityBridge: NSViewRepresentable {
    let identifier: String
    let label: String
    let value: String

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        view.setAccessibilityElement(false)
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        nsView.setAccessibilityElement(false)
        DispatchQueue.main.async {
            guard let scrollView = nsView.enclosingScrollView ?? findScrollView(from: nsView) else {
                return
            }

            scrollView.setAccessibilityElement(true)
            scrollView.setAccessibilityIdentifier(identifier)
            scrollView.setAccessibilityLabel(label)
            scrollView.setAccessibilityValue(value)

            scrollView.documentView?.setAccessibilityElement(true)
            scrollView.documentView?.setAccessibilityIdentifier("\(identifier).document")
            scrollView.documentView?.setAccessibilityLabel(LocalizedStrings.current()("\(label)内容", "\(label) content"))
            scrollView.documentView?.setAccessibilityValue(value)
        }
    }

    private func findScrollView(from view: NSView) -> NSScrollView? {
        var current = view.superview
        while let view = current {
            if let scrollView = view as? NSScrollView {
                return scrollView
            }
            current = view.superview
        }
        return nil
    }
}

struct ScrollViewAppearanceBridge: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        view.isHidden = true
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            guard let scrollView = nsView.enclosingScrollView ?? findScrollView(from: nsView) else {
                return
            }

            scrollView.drawsBackground = false
            scrollView.borderType = .noBorder
            scrollView.scrollerStyle = .overlay
            scrollView.autohidesScrollers = true
            scrollView.hasVerticalScroller = true
            scrollView.hasHorizontalScroller = false
            scrollView.verticalScroller?.controlSize = .regular
        }
    }

    private func findScrollView(from view: NSView) -> NSScrollView? {
        var current = view.superview
        while let view = current {
            if let scrollView = view as? NSScrollView {
                return scrollView
            }
            current = view.superview
        }
        return nil
    }
}

struct AppScrollMetrics: Equatable {
    var offset: CGFloat = 0
    var viewportWidth: CGFloat = 0
    var viewportHeight: CGFloat = 0
    var contentHeight: CGFloat = 0
}

enum AppScrollPositionPreserver {
    static func targetOffsetPreservingRelativeAnchor(
        previousOffset: CGFloat,
        previousFrame: CGRect,
        newFrame: CGRect
    ) -> CGFloat {
        let previousHeight = max(previousFrame.height, 1)
        let relativeY = min(max((previousOffset - previousFrame.minY) / previousHeight, 0), 1)
        return newFrame.minY + relativeY * max(newFrame.height, 1)
    }

    static func targetOffsetPreservingVisibleAnchor(
        previousOffset: CGFloat,
        previousFrame: CGRect,
        newFrame: CGRect
    ) -> CGFloat {
        let anchorDistance = previousOffset - previousFrame.minY
        let preservedOffset = newFrame.minY + anchorDistance
        guard anchorDistance > 0 else {
            return preservedOffset
        }

        return min(preservedOffset, max(newFrame.minY, newFrame.maxY - 1))
    }

    static func targetOffsetPreservingBottomDistance(
        previous: AppScrollMetrics,
        newContentHeight: CGFloat,
        newViewportHeight: CGFloat,
        threshold: CGFloat
    ) -> CGFloat? {
        guard previous.viewportHeight > 0,
              newViewportHeight > 0 else {
            return nil
        }

        let previousMaxOffset = max(previous.contentHeight - previous.viewportHeight, 0)
        let previousOffset = min(max(previous.offset, 0), previousMaxOffset)
        let bottomDistance = previousMaxOffset - previousOffset
        guard bottomDistance <= threshold else {
            return nil
        }

        let newMaxOffset = max(newContentHeight - newViewportHeight, 0)
        return min(max(newMaxOffset - bottomDistance, 0), newMaxOffset)
    }

    static func bottomDistanceToPreserveDuringResize(
        previous: AppScrollMetrics,
        current: AppScrollMetrics,
        threshold: CGFloat
    ) -> CGFloat? {
        let previousBottomDistance = bottomDistance(in: previous)
        if previousBottomDistance <= threshold {
            return previousBottomDistance
        }

        let currentBottomDistance = bottomDistance(in: current)
        if currentBottomDistance <= threshold {
            return currentBottomDistance
        }

        return nil
    }

    private static func bottomDistance(in metrics: AppScrollMetrics) -> CGFloat {
        let maxOffset = max(metrics.contentHeight - metrics.viewportHeight, 0)
        let clampedOffset = min(max(metrics.offset, 0), maxOffset)
        return maxOffset - clampedOffset
    }
}

final class AppScrollController {
    private weak var scrollView: NSScrollView?
    private weak var documentView: NSView?

    @MainActor
    func attach(scrollView: NSScrollView, documentView: NSView?) {
        self.scrollView = scrollView
        self.documentView = documentView
    }

    @MainActor
    func scroll(toOffset offset: CGFloat) {
        guard let scrollView,
              let documentView = documentView ?? scrollView.documentView else {
            return
        }

        let viewport = scrollView.contentView.bounds
        let contentHeight = max(documentView.bounds.height, documentView.frame.height)
        let maxOffset = max(contentHeight - viewport.height, 0)
        let clampedOffset = min(max(offset, 0), maxOffset)
        let documentY = documentView.isFlipped ? clampedOffset : maxOffset - clampedOffset

        scrollView.contentView.scroll(to: NSPoint(x: viewport.origin.x, y: documentY))
        scrollView.reflectScrolledClipView(scrollView.contentView)
    }

    @MainActor
    func scroll(toBottomDistance bottomDistance: CGFloat) {
        guard let scrollView,
              let documentView = documentView ?? scrollView.documentView else {
            return
        }

        let viewport = scrollView.contentView.bounds
        let contentHeight = max(documentView.bounds.height, documentView.frame.height)
        let maxOffset = max(contentHeight - viewport.height, 0)
        scroll(toOffset: maxOffset - max(bottomDistance, 0))
    }
}

struct AppScrollMetricsReader: NSViewRepresentable {
    @Binding var metrics: AppScrollMetrics
    var controller: AppScrollController?
    var preservesBottomDistanceOnContentResize = false
    var bottomPreservationThreshold: CGFloat = 0

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        view.isHidden = true
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            context.coordinator.configure(
                from: nsView,
                metrics: $metrics,
                controller: controller,
                preservesBottomDistanceOnContentResize: preservesBottomDistanceOnContentResize,
                bottomPreservationThreshold: bottomPreservationThreshold
            )
        }
    }

    @MainActor
    final class Coordinator {
        private weak var scrollView: NSScrollView?
        private weak var documentView: NSView?
        private var boundsObserver: NSObjectProtocol?
        private var frameObserver: NSObjectProtocol?
        private var metrics: Binding<AppScrollMetrics>?
        private var lastMetrics: AppScrollMetrics?
        private var preservesBottomDistanceOnContentResize = false
        private var bottomPreservationThreshold: CGFloat = 0

        deinit {
            MainActor.assumeIsolated {
                removeObservers()
            }
        }

        func configure(
            from view: NSView,
            metrics: Binding<AppScrollMetrics>,
            controller: AppScrollController?,
            preservesBottomDistanceOnContentResize: Bool,
            bottomPreservationThreshold: CGFloat
        ) {
            self.metrics = metrics
            self.preservesBottomDistanceOnContentResize = preservesBottomDistanceOnContentResize
            self.bottomPreservationThreshold = bottomPreservationThreshold
            guard let scrollView = view.enclosingScrollView ?? findScrollView(from: view) else {
                return
            }

            scrollView.drawsBackground = false
            scrollView.borderType = .noBorder
            scrollView.hasVerticalScroller = false
            scrollView.verticalScroller = nil
            scrollView.hasHorizontalScroller = false
            scrollView.automaticallyAdjustsContentInsets = false
            controller?.attach(scrollView: scrollView, documentView: scrollView.documentView)

            if self.scrollView !== scrollView || self.documentView !== scrollView.documentView {
                removeObservers()
                self.scrollView = scrollView
                self.documentView = scrollView.documentView
                installObservers(scrollView: scrollView, documentView: scrollView.documentView)
            }

            updateMetrics()
        }

        private func installObservers(scrollView: NSScrollView, documentView: NSView?) {
            scrollView.contentView.postsBoundsChangedNotifications = true
            boundsObserver = NotificationCenter.default.addObserver(
                forName: NSView.boundsDidChangeNotification,
                object: scrollView.contentView,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor in
                    self?.updateMetrics()
                }
            }

            if let documentView {
                documentView.postsFrameChangedNotifications = true
                frameObserver = NotificationCenter.default.addObserver(
                    forName: NSView.frameDidChangeNotification,
                    object: documentView,
                    queue: .main
                ) { [weak self] _ in
                    Task { @MainActor in
                        self?.documentFrameDidChange()
                    }
                }
            }
        }

        private func documentFrameDidChange() {
            restoreBottomDistanceIfNeeded()
            updateMetrics()
        }

        private func restoreBottomDistanceIfNeeded() {
            guard preservesBottomDistanceOnContentResize,
                  let scrollView,
                  let documentView,
                  let previous = lastMetrics else {
                return
            }

            let viewport = scrollView.contentView.bounds
            let contentHeight = max(documentView.bounds.height, documentView.frame.height)
            guard abs(contentHeight - previous.contentHeight) > 0.5,
                  let targetOffset = AppScrollPositionPreserver.targetOffsetPreservingBottomDistance(
                    previous: previous,
                    newContentHeight: contentHeight,
                    newViewportHeight: viewport.height,
                    threshold: bottomPreservationThreshold
                  ) else {
                return
            }

            scroll(
                toOffset: targetOffset,
                scrollView: scrollView,
                documentView: documentView,
                viewport: viewport,
                contentHeight: contentHeight
            )
        }

        private func updateMetrics() {
            guard let scrollView,
                  let documentView,
                  let metrics else {
                return
            }

            let viewport = scrollView.contentView.bounds
            let contentHeight = max(documentView.bounds.height, documentView.frame.height)
            let maxOffset = max(contentHeight - viewport.height, 0)
            let rawOffset = documentView.isFlipped ? viewport.origin.y : maxOffset - viewport.origin.y
            let updated = AppScrollMetrics(
                offset: min(max(rawOffset, 0), maxOffset),
                viewportWidth: viewport.width,
                viewportHeight: viewport.height,
                contentHeight: contentHeight
            )
            lastMetrics = updated

            if metrics.wrappedValue != updated {
                metrics.wrappedValue = updated
            }
        }

        private func scroll(
            toOffset offset: CGFloat,
            scrollView: NSScrollView,
            documentView: NSView,
            viewport: NSRect,
            contentHeight: CGFloat
        ) {
            let maxOffset = max(contentHeight - viewport.height, 0)
            let clampedOffset = min(max(offset, 0), maxOffset)
            let documentY = documentView.isFlipped ? clampedOffset : maxOffset - clampedOffset

            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0
                context.allowsImplicitAnimation = false
                scrollView.contentView.scroll(to: NSPoint(x: viewport.origin.x, y: documentY))
                scrollView.reflectScrolledClipView(scrollView.contentView)
            }
        }

        private func findScrollView(from view: NSView) -> NSScrollView? {
            var current: NSView? = view
            while let candidate = current {
                if let scrollView = candidate as? NSScrollView {
                    return scrollView
                }
                current = candidate.superview
            }
            return nil
        }

        private func removeObservers() {
            if let boundsObserver {
                NotificationCenter.default.removeObserver(boundsObserver)
                self.boundsObserver = nil
            }

            if let frameObserver {
                NotificationCenter.default.removeObserver(frameObserver)
                self.frameObserver = nil
            }
        }
    }
}

struct AppVerticalScrollIndicator: View {
    let metrics: AppScrollMetrics
    var controller: AppScrollController?
    var width: CGFloat = 7
    var trailingInset: CGFloat = 2
    var verticalInset: CGFloat = 6
    var minimumThumbHeight: CGFloat = 36

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .topTrailing) {
                AppTheme.transparent
                    .contentShape(Rectangle())

                scrollThumb(availableHeight: geometry.size.height)
            }
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .onChanged { value in
                        scroll(with: value, availableHeight: geometry.size.height)
                    }
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        }
        .frame(width: width + trailingInset)
        .frame(maxHeight: .infinity, alignment: .topTrailing)
        .allowsHitTesting(controller != nil && isScrollable)
    }

    @ViewBuilder
    private func scrollThumb(availableHeight: CGFloat) -> some View {
        let contentHeight = metrics.contentHeight
        let viewportHeight = metrics.viewportHeight
        if contentHeight > viewportHeight + 1, viewportHeight > 0, availableHeight > verticalInset * 2 {
            let trackHeight = max(0, availableHeight - verticalInset * 2)
            let thumbHeight = min(
                trackHeight,
                max(minimumThumbHeight, trackHeight * viewportHeight / contentHeight)
            )
            let maxOffset = max(contentHeight - viewportHeight, 1)
            let offset = min(max(metrics.offset, 0), maxOffset)
            let progress = offset / maxOffset
            let y = verticalInset + (trackHeight - thumbHeight) * progress

            Capsule()
                .fill(AppTheme.scrollbarThumb)
                .frame(width: width, height: thumbHeight)
                .padding(.trailing, trailingInset)
                .offset(y: y)
        }
    }

    private var isScrollable: Bool {
        metrics.contentHeight > metrics.viewportHeight + 1 && metrics.viewportHeight > 0
    }

    private func scroll(with value: DragGesture.Value, availableHeight: CGFloat) {
        guard let controller,
              let targetOffset = targetOffset(for: value, availableHeight: availableHeight) else {
            return
        }

        Task { @MainActor in
            controller.scroll(toOffset: targetOffset)
        }
    }

    private func targetOffset(for value: DragGesture.Value, availableHeight: CGFloat) -> CGFloat? {
        let contentHeight = metrics.contentHeight
        let viewportHeight = metrics.viewportHeight
        guard contentHeight > viewportHeight + 1,
              viewportHeight > 0,
              availableHeight > verticalInset * 2 else {
            return nil
        }

        let trackHeight = max(0, availableHeight - verticalInset * 2)
        let thumbHeight = min(
            trackHeight,
            max(minimumThumbHeight, trackHeight * viewportHeight / contentHeight)
        )
        let draggableHeight = max(trackHeight - thumbHeight, 1)
        let maxOffset = max(contentHeight - viewportHeight, 1)
        let currentProgress = min(max(metrics.offset, 0), maxOffset) / maxOffset
        let currentThumbY = verticalInset + draggableHeight * currentProgress
        let startedOnThumb = value.startLocation.y >= currentThumbY
            && value.startLocation.y <= currentThumbY + thumbHeight

        let targetThumbY = startedOnThumb
            ? currentThumbY + value.translation.height
            : value.location.y - thumbHeight / 2
        let targetProgress = min(max((targetThumbY - verticalInset) / draggableHeight, 0), 1)
        return targetProgress * maxOffset
    }
}

struct ModelSelector: NSViewRepresentable {
    let models: [ModelSummary]
    let selectedModelName: String
    let onSelect: (String) -> Void
    @AppStorage(AppPreferenceKeys.Settings.language) private var languageRaw = AppLanguageOption.auto.storageValue

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelect: onSelect)
    }

    func makeNSView(context: Context) -> ModelSelectorPopUpButton {
        let button = ModelSelectorPopUpButton(frame: .zero, pullsDown: false)
        button.target = context.coordinator
        button.action = #selector(Coordinator.selectionChanged(_:))
        button.setAccessibilityLabel(tr("当前模型", "Current model"))
        button.setAccessibilityIdentifier("header.modelMenu")
        button.setAccessibilityHelp(tr("切换模型", "Switch model"))
        return button
    }

    func updateNSView(_ nsView: ModelSelectorPopUpButton, context: Context) {
        context.coordinator.onSelect = onSelect
        context.coordinator.isApplyingUpdate = true
        defer { context.coordinator.isApplyingUpdate = false }

        nsView.removeAllItems()
        nsView.addItems(withTitles: models.map(menuTitle(for:)))
        nsView.isEnabled = !models.isEmpty

        for (index, model) in models.enumerated() {
            let item = nsView.itemArray[index]
            item.representedObject = model.name
            item.toolTip = menuTooltip(for: model)
            item.state = model.name == selectedModelName ? .on : .off
        }

        if let selectedIndex = models.firstIndex(where: { $0.name == selectedModelName }) {
            nsView.selectItem(at: selectedIndex)
            nsView.setAccessibilityValue(menuTooltip(for: models[selectedIndex]))
        } else if let firstModel = models.first {
            nsView.selectItem(at: 0)
            nsView.setAccessibilityValue(menuTooltip(for: firstModel))
        } else {
            nsView.setAccessibilityValue(tr("没有可用模型", "No models available"))
        }

        nsView.applyTheme()
    }

    private func menuTitle(for model: ModelSummary) -> String {
        model.isLoaded ? tr("\(model.displayName)  已加载", "\(model.displayName)  Loaded") : model.displayName
    }

    private func menuTooltip(for model: ModelSummary) -> String {
        model.isLoaded ? tr("\(model.displayName)，已加载", "\(model.displayName), loaded") : model.displayName
    }

    private var tr: LocalizedStrings {
        LocalizedStrings(language: AppLanguage.resolved(from: languageRaw))
    }

    @MainActor
    final class Coordinator: NSObject {
        var onSelect: (String) -> Void
        var isApplyingUpdate = false

        init(onSelect: @escaping (String) -> Void) {
            self.onSelect = onSelect
        }

        @objc func selectionChanged(_ sender: NSPopUpButton) {
            guard !isApplyingUpdate,
                  let selectedName = sender.selectedItem?.representedObject as? String else {
                return
            }
            onSelect(selectedName)
        }
    }
}

final class ModelSelectorPopUpButton: NSPopUpButton {
    override init(frame buttonFrame: NSRect, pullsDown flag: Bool) {
        super.init(frame: buttonFrame, pullsDown: flag)
        configure()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var intrinsicContentSize: NSSize {
        var size = super.intrinsicContentSize
        size.width = max(size.width + 24, 160)
        size.height = 34
        return size
    }

    override func layout() {
        super.layout()
        applyStyling()
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        applyStyling()
    }

    private func configure() {
        controlSize = .regular
        font = .systemFont(ofSize: 13, weight: .medium)
        isBordered = false
        focusRingType = .none
        setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        applyStyling()
    }

    func applyTheme() {
        applyStyling()
    }

    private func applyStyling() {
        wantsLayer = true
        contentTintColor = NSColor(AppTheme.textPrimary)
        layer?.cornerRadius = 10
        layer?.backgroundColor = NSColor(AppTheme.surfaceRaised).cgColor
        layer?.borderWidth = 1
        layer?.borderColor = NSColor(AppTheme.border).cgColor
        alphaValue = isEnabled ? 1.0 : 0.52
    }
}
