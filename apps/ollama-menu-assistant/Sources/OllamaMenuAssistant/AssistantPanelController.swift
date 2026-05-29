import AppKit
import Combine
import SwiftUI

@MainActor
final class AssistantPanelController: NSObject, NSWindowDelegate {
    private enum SidebarToggle {
        static let defaultsKey = AssistantLayoutPreferences.sidebarCollapsedKey
        static let expandedIdentifier = "sidebar.toggle.collapse"
        static let collapsedIdentifier = "sidebar.toggle.expand"
        static let buttonSize = NSSize(width: 28, height: 28)
        static let horizontalNudge: CGFloat = 3
        static let leadingGap: CGFloat = 16
        static let verticalNudge: CGFloat = 1
    }

    private enum HistoryNavigation {
        static let backIdentifier = "navigation.back"
        static let forwardIdentifier = "navigation.forward"
        static let leadingGap: CGFloat = 6
        static let itemGap: CGFloat = 0
    }

    private enum CollapsedNewConversation {
        static let identifier = "navigation.newChat"
        static let leadingGap: CGFloat = 0
    }

    private enum ChangesSidebarToggle {
        static let defaultsKey = AssistantLayoutPreferences.changesSidebarCollapsedKey
    }

    private enum TranslucentSidebar {
        static let defaultsKey = AppPreferenceKeys.Settings.translucentSidebar
        static let defaultValue = true
    }

    private struct ChromeControlBaseline {
        let closeMinX: CGFloat
        let miniaturizeDeltaX: CGFloat
        let zoomDeltaX: CGFloat
    }

    private let appModel: AppModel
    private let window: AssistantWindow
    private var hasPositionedWindow = false
    private var chromeControlBaseline: ChromeControlBaseline?
    private weak var sidebarToggleButton: AppKitIconButton?
    private weak var backButton: AppKitIconButton?
    private weak var forwardButton: AppKitIconButton?
    private weak var collapsedNewConversationButton: AppKitIconButton?
    private var cancellables = Set<AnyCancellable>()

    var isVisible: Bool {
        window.isVisible
    }

    init(appModel: AppModel) {
        self.appModel = appModel
        self.window = AssistantWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1180, height: 780),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        super.init()

        let rootView = AssistantPanelView()
            .environmentObject(appModel)
        let hostingController = NSHostingController(rootView: rootView)
        hostingController.view.setAccessibilityElement(true)
        hostingController.view.setAccessibilityIdentifier("window.content")
        hostingController.view.setAccessibilityLabel(tr("Ollama Menu Assistant 主内容", "Ollama Menu Assistant main content"))

        window.title = "Ollama Menu Assistant"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.titlebarSeparatorStyle = .none
        window.toolbarStyle = .unifiedCompact
        window.isMovableByWindowBackground = false
        window.collectionBehavior = [.fullScreenPrimary, .managed]
        window.isReleasedWhenClosed = false
        updateWindowBackdrop()
        updateWindowMinimumSize()
        window.contentViewController = hostingController
        window.delegate = self
        window.identifier = NSUserInterfaceItemIdentifier("mainWindow")
        window.setFrameAutosaveName("OllamaMenuAssistantMainWindow")

        installSidebarToggleButtonIfNeeded()
        observeNavigationHistory()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleUserDefaultsDidChange),
            name: UserDefaults.didChangeNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    func toggle(relativeTo button: NSStatusBarButton?) {
        if window.isVisible && NSApp.isActive {
            close()
        } else {
            open(relativeTo: button)
        }
    }

    func open(relativeTo button: NSStatusBarButton?) {
        NSApp.activate(ignoringOtherApps: true)
        installSidebarToggleButtonIfNeeded()
        updateSidebarToggleButton()
        updateHistoryNavigationButtons()
        updateCollapsedNewConversationButton()
        positionWindowIfNeeded(relativeTo: button)
        window.makeKeyAndOrderFront(nil)
        DispatchQueue.main.async { [weak self] in
            self?.layoutWindowChromeControls()
        }
    }

    private func observeNavigationHistory() {
        appModel.$navigationHistory
            .sink { [weak self] _ in
                self?.updateHistoryNavigationButtons()
            }
            .store(in: &cancellables)
    }

    func close() {
        window.orderOut(nil)
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        close()
        return false
    }

    func windowDidResize(_ notification: Notification) {
        updateSidebarToggleButton()
        layoutWindowChromeControls()
    }

    func windowDidBecomeKey(_ notification: Notification) {
        layoutWindowChromeControls()
    }

    private func positionWindowIfNeeded(relativeTo button: NSStatusBarButton?) {
        guard !hasPositionedWindow else {
            return
        }

        hasPositionedWindow = true
        if let screenFrame = (button?.window?.screen ?? NSScreen.main)?.visibleFrame {
            let size = window.frame.size
            let origin = NSPoint(
                x: screenFrame.midX - size.width / 2,
                y: screenFrame.midY - size.height / 2
            )
            window.setFrameOrigin(origin)
        } else {
            window.center()
        }
    }

    private func installSidebarToggleButtonIfNeeded() {
        guard sidebarToggleButton == nil,
              let zoomButton = window.standardWindowButton(.zoomButton),
              let titlebarView = zoomButton.superview else {
            return
        }

        let button = AppKitIconButton(
            systemName: sidebarToggleSystemName(isCollapsed: isSidebarCollapsed),
            accessibilityLabel: isSidebarCollapsed ? tr("展开侧栏", "Expand sidebar") : tr("收起侧栏", "Collapse sidebar"),
            hoverStyle: .titleBar,
            tintColor: NSColor(AppTheme.textTertiary),
            target: self,
            action: #selector(toggleSidebarFromTitlebar)
        )
        button.translatesAutoresizingMaskIntoConstraints = true
        button.frame = NSRect(origin: .zero, size: SidebarToggle.buttonSize)

        titlebarView.addSubview(button)

        sidebarToggleButton = button
        installHistoryNavigationButtons(in: titlebarView)
        updateSidebarToggleButton()
        updateHistoryNavigationButtons()
        updateCollapsedNewConversationButton()
        layoutWindowChromeControls()
    }

    private func installHistoryNavigationButtons(in titlebarView: NSView) {
        let back = makeHistoryButton(
            systemName: "arrow.left",
            label: tr("返回", "Back"),
            help: tr("返回 ⌘[", "Back ⌘["),
            keyEquivalent: "[",
            action: #selector(navigateBackFromTitlebar)
        )
        back.setAccessibilityIdentifier(HistoryNavigation.backIdentifier)

        let forward = makeHistoryButton(
            systemName: "arrow.right",
            label: tr("前进", "Forward"),
            help: tr("前进 ⌘]", "Forward ⌘]"),
            keyEquivalent: "]",
            action: #selector(navigateForwardFromTitlebar)
        )
        forward.setAccessibilityIdentifier(HistoryNavigation.forwardIdentifier)

        let newConversation = makeTitlebarButton(
            systemName: "square.and.pencil",
            accessibilityLabel: tr("新对话", "New chat"),
            help: tr("在当前项目中新建对话", "New chat in the current project"),
            action: #selector(startNewConversationFromTitlebar)
        )
        newConversation.setAccessibilityIdentifier(CollapsedNewConversation.identifier)

        titlebarView.addSubview(back)
        titlebarView.addSubview(forward)
        titlebarView.addSubview(newConversation)
        backButton = back
        forwardButton = forward
        collapsedNewConversationButton = newConversation
    }

    private func makeHistoryButton(
        systemName: String,
        label: String,
        help: String,
        keyEquivalent: String,
        action: Selector
    ) -> AppKitIconButton {
        let button = makeTitlebarButton(
            systemName: systemName,
            accessibilityLabel: label,
            help: help,
            action: action
        )
        button.keyEquivalent = keyEquivalent
        button.keyEquivalentModifierMask = [.command]
        return button
    }

    private func makeTitlebarButton(
        systemName: String,
        accessibilityLabel label: String,
        help: String,
        action: Selector
    ) -> AppKitIconButton {
        let button = AppKitIconButton(
            systemName: systemName,
            accessibilityLabel: label,
            help: help,
            hoverStyle: .titleBar,
            tintColor: NSColor(AppTheme.textTertiary),
            target: self,
            action: action
        )
        button.translatesAutoresizingMaskIntoConstraints = true
        button.frame = NSRect(origin: .zero, size: SidebarToggle.buttonSize)
        return button
    }

    @objc private func toggleSidebarFromTitlebar() {
        let nextCollapsed = !isEffectiveSidebarCollapsed
        UserDefaults.standard.set(nextCollapsed, forKey: SidebarToggle.defaultsKey)
        if !nextCollapsed {
            expandWindowIfNeeded(toContentWidth: AssistantPanelLayout.minimumWindowWidth)
        }
        updateSidebarToggleButton()
        updateWindowMinimumSize()
        layoutWindowChromeControls()
    }

    @objc private func navigateBackFromTitlebar() {
        appModel.navigateBack()
        updateHistoryNavigationButtons()
    }

    @objc private func navigateForwardFromTitlebar() {
        appModel.navigateForward()
        updateHistoryNavigationButtons()
    }

    @objc private func startNewConversationFromTitlebar() {
        appModel.startNewConversation(in: appModel.currentProject?.id)
        updateHistoryNavigationButtons()
    }

    @objc private func handleUserDefaultsDidChange() {
        updateWindowBackdrop()
        updateSidebarToggleButton()
        updateWindowMinimumSize()
        layoutWindowChromeControls()
    }

    private var isSidebarCollapsed: Bool {
        UserDefaults.standard.bool(forKey: SidebarToggle.defaultsKey)
    }

    private var isChangesSidebarCollapsed: Bool {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: ChangesSidebarToggle.defaultsKey) != nil else {
            return true
        }
        return defaults.bool(forKey: ChangesSidebarToggle.defaultsKey)
    }

    private var isEffectiveSidebarCollapsed: Bool {
        AssistantPanelLayout.responsiveSidebarState(
            availableWidth: currentContentWidth,
            prefersSidebarCollapsed: isSidebarCollapsed,
            prefersRightSidebarCollapsed: isChangesSidebarCollapsed
        ).isSidebarCollapsed
    }

    private var currentContentWidth: CGFloat {
        window.contentView?.bounds.width ?? window.contentLayoutRect.width
    }

    private var isTranslucentSidebarEnabled: Bool {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: TranslucentSidebar.defaultsKey) != nil else {
            return TranslucentSidebar.defaultValue
        }
        return defaults.bool(forKey: TranslucentSidebar.defaultsKey)
    }

    private var tr: LocalizedStrings {
        LocalizedStrings.current()
    }

    private func updateSidebarToggleButton() {
        guard let button = sidebarToggleButton else {
            return
        }

        let collapsed = isEffectiveSidebarCollapsed
        let label = collapsed ? tr("展开侧栏", "Expand sidebar") : tr("收起侧栏", "Collapse sidebar")
        button.configure(systemName: sidebarToggleSystemName(isCollapsed: collapsed), accessibilityLabel: label, help: label)
        button.setAccessibilityIdentifier(collapsed ? SidebarToggle.collapsedIdentifier : SidebarToggle.expandedIdentifier)
        updateCollapsedNewConversationButton()
    }

    private func updateHistoryNavigationButtons() {
        updateHistoryButton(backButton, enabled: appModel.canNavigateBack)
        updateHistoryButton(forwardButton, enabled: appModel.canNavigateForward)
    }

    private func updateHistoryButton(_ button: AppKitIconButton?, enabled: Bool) {
        button?.isEnabled = enabled
        button?.alphaValue = enabled ? 1 : 0.38
    }

    private func updateCollapsedNewConversationButton() {
        collapsedNewConversationButton?.isHidden = !isEffectiveSidebarCollapsed
    }

    private func updateWindowMinimumSize() {
        window.minSize = NSSize(
            width: AssistantPanelLayout.responsiveMinimumWindowWidth,
            height: AssistantPanelLayout.minimumWindowHeight
        )
    }

    private func updateWindowBackdrop() {
        let usesTranslucentSidebar = isTranslucentSidebarEnabled
        window.isOpaque = !usesTranslucentSidebar
        window.backgroundColor = usesTranslucentSidebar ? .clear : NSColor(AppTheme.canvas)
    }

    private func sidebarToggleSystemName(isCollapsed: Bool) -> String {
        isCollapsed ? "sidebar.right" : "sidebar.left"
    }

    private func expandWindowIfNeeded(toContentWidth targetContentWidth: CGFloat) {
        let contentWidth = currentContentWidth
        guard contentWidth > 0, contentWidth < targetContentWidth else {
            return
        }

        var frame = window.frame
        frame.size.width += targetContentWidth - contentWidth

        if let visibleFrame = window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame {
            frame.size.width = min(frame.size.width, visibleFrame.width)
            if frame.maxX > visibleFrame.maxX {
                frame.origin.x = visibleFrame.maxX - frame.width
            }
            if frame.minX < visibleFrame.minX {
                frame.origin.x = visibleFrame.minX
            }
        }

        window.setFrame(frame, display: true, animate: true)
    }

    private func layoutWindowChromeControls() {
        guard let closeButton = window.standardWindowButton(.closeButton),
              let miniaturizeButton = window.standardWindowButton(.miniaturizeButton),
              let zoomButton = window.standardWindowButton(.zoomButton),
              let titlebarView = closeButton.superview else {
            return
        }

        let buttons = [closeButton, miniaturizeButton, zoomButton]
        let desiredMidYFromTop = desiredChromeControlMidYFromTop(for: window)
        let baseline = chromeControlBaseline ?? ChromeControlBaseline(
            closeMinX: closeButton.frame.minX,
            miniaturizeDeltaX: miniaturizeButton.frame.minX - closeButton.frame.minX,
            zoomDeltaX: zoomButton.frame.minX - closeButton.frame.minX
        )
        chromeControlBaseline = baseline
        let closeOriginX = round(baseline.closeMinX + SidebarToggle.horizontalNudge)

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0
            context.allowsImplicitAnimation = false

            for button in buttons {
                var frame = button.frame
                if button === closeButton {
                    frame.origin.x = closeOriginX
                } else if button === miniaturizeButton {
                    frame.origin.x = round(closeOriginX + baseline.miniaturizeDeltaX)
                } else if button === zoomButton {
                    frame.origin.x = round(closeOriginX + baseline.zoomDeltaX)
                }
                frame.origin.y = originY(
                    forMidYFromTop: desiredMidYFromTop,
                    itemHeight: frame.height,
                    in: titlebarView
                )
                button.frame = frame
            }

            if let sidebarToggleButton {
                let originY = originY(
                    forMidYFromTop: desiredMidYFromTop,
                    itemHeight: SidebarToggle.buttonSize.height,
                    in: titlebarView
                )
                sidebarToggleButton.frame = NSRect(
                    x: zoomButton.frame.maxX + SidebarToggle.leadingGap,
                    y: originY,
                    width: SidebarToggle.buttonSize.width,
                    height: SidebarToggle.buttonSize.height
                )

                if let backButton {
                    backButton.frame = NSRect(
                        x: sidebarToggleButton.frame.maxX + HistoryNavigation.leadingGap,
                        y: originY,
                        width: SidebarToggle.buttonSize.width,
                        height: SidebarToggle.buttonSize.height
                    )
                }

                if let forwardButton {
                    let previousMaxX = backButton?.frame.maxX ?? sidebarToggleButton.frame.maxX
                    forwardButton.frame = NSRect(
                        x: previousMaxX + HistoryNavigation.itemGap,
                        y: originY,
                        width: SidebarToggle.buttonSize.width,
                        height: SidebarToggle.buttonSize.height
                    )
                }

                if let collapsedNewConversationButton {
                    let previousMaxX = forwardButton?.frame.maxX ?? backButton?.frame.maxX ?? sidebarToggleButton.frame.maxX
                    collapsedNewConversationButton.frame = NSRect(
                        x: previousMaxX + CollapsedNewConversation.leadingGap,
                        y: originY,
                        width: SidebarToggle.buttonSize.width,
                        height: SidebarToggle.buttonSize.height
                    )
                }
            }
        }
    }

    private func desiredChromeControlMidYFromTop(for window: NSWindow) -> CGFloat {
        let titleBarHeight = max(28, window.frame.height - window.contentLayoutRect.height)
        let visualHeaderHeight = max(40, min(44, titleBarHeight + 4))
        return visualHeaderHeight / 2 + SidebarToggle.verticalNudge
    }

    private func originY(forMidYFromTop midYFromTop: CGFloat, itemHeight: CGFloat, in container: NSView) -> CGFloat {
        if container.isFlipped {
            return round(midYFromTop - itemHeight / 2)
        }
        return round(container.bounds.height - midYFromTop - itemHeight / 2)
    }
}

@MainActor
private final class AssistantWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    override func accessibilityRole() -> NSAccessibility.Role? {
        .window
    }

    override func accessibilitySubrole() -> NSAccessibility.Subrole? {
        .standardWindow
    }

    override func accessibilityLabel() -> String? {
        "Ollama Menu Assistant"
    }

    override func accessibilityTitle() -> String? {
        title
    }

    override func accessibilityIdentifier() -> String {
        "window.main"
    }

    override func accessibilityChildren() -> [Any]? {
        guard let contentView else {
            return super.accessibilityChildren()
        }
        return [contentView]
    }
}
