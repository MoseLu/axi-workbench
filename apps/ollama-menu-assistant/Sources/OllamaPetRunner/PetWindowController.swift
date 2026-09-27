import AppKit
import QuartzCore

@MainActor
final class PetPanel: NSPanel {
    override var canBecomeKey: Bool {
        false
    }

    override var canBecomeMain: Bool {
        false
    }
}

@MainActor
final class PetWindowController: NSObject {
    static let defaultDisplaySize = CGSize(width: 128, height: 139)

    private enum DefaultsKey {
        static let originX = "OllamaPetRunner.windowOriginX"
        static let originY = "OllamaPetRunner.windowOriginY"
    }

    private enum GroupInteraction {
        static let notificationName = Notification.Name("com.mose.OllamaMenuAssistant.PetRunner.groupInteraction")
        static let senderKey = "senderInstanceID"
    }

    private enum FormationUpdate {
        static let notificationName = Notification.Name("com.mose.OllamaMenuAssistant.PetRunner.formationUpdate")
        static let instanceIDKey = "instanceID"
        static let slotIndexKey = "slotIndex"
        static let slotCountKey = "slotCount"
    }

    private let petDirectoryURL: URL
    private let instanceID: String
    private let groupID: String
    private var slotIndex: Int
    private var slotCount: Int
    private var language: PetRunnerLanguage
    private var dragMode: PetRunnerDragMode
    private var activeGroupDragSessionID: String?
    private var activeGroupDragSenderID: String?
    private let allowsDirectionalRunning: Bool
    private let defaults: UserDefaults
    private let panel: PetPanel
    private var petView: (NSView & PetDisplayView)
    private var wanderModel = PetWanderModel()
    private var wanderTimer: Timer?
    private var leftClickMonitor: Any?
    private var clickTargetVisibleFrame: CGRect?
    private var lastTickTime: CFTimeInterval?
    private var lastPersistTime: CFTimeInterval = 0

    init(
        petDirectoryURL: URL = PetAssetLoader.defaultPetDirectory,
        instanceID: String = "default",
        groupID: String = PetRunnerIPC.groupID,
        slotIndex: Int = 0,
        slotCount: Int = 1,
        language: PetRunnerLanguage = .current,
        dragMode: PetRunnerDragMode? = nil,
        allowsDirectionalRunning: Bool = true,
        defaults: UserDefaults = .standard
    ) {
        self.petDirectoryURL = petDirectoryURL
        self.instanceID = instanceID
        self.groupID = groupID
        self.slotIndex = min(max(slotIndex, 0), 2)
        self.slotCount = min(max(slotCount, 1), 3)
        self.language = language
        self.dragMode = dragMode ?? PetAssetLoader.selectedPetDragMode
        self.allowsDirectionalRunning = allowsDirectionalRunning
        self.defaults = defaults
        self.petView = PetSpriteView(
            frame: NSRect(origin: .zero, size: Self.defaultDisplaySize)
        )
        self.panel = PetPanel(
            contentRect: NSRect(origin: .zero, size: Self.defaultDisplaySize),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        super.init()
        configurePanel()
        configureInteractions()
        startGroupInteractionObserver()
        startGroupCommandObserver()
        startGroupDragObserver()
        startLanguageObserver()
        startFormationUpdateObserver()
    }

    deinit {
        DistributedNotificationCenter.default().removeObserver(self)
    }

    func show() {
        reloadPet()
        panel.setFrame(
            NSRect(origin: initialOrigin(), size: Self.defaultDisplaySize),
            display: true
        )
        panel.orderFrontRegardless()
        startClickTargetMonitor()
        startWandering()
    }

    func persistPosition() {
        defaults.set(panel.frame.origin.x, forKey: originXKey)
        defaults.set(panel.frame.origin.y, forKey: originYKey)
        if slotCount == 1 {
            defaults.set(panel.frame.origin.x, forKey: DefaultsKey.originX)
            defaults.set(panel.frame.origin.y, forKey: DefaultsKey.originY)
        }
    }

    func stopClickTargetMonitor() {
        if let leftClickMonitor {
            NSEvent.removeMonitor(leftClickMonitor)
            self.leftClickMonitor = nil
        }
    }

    func runToClick(at screenPoint: CGPoint) {
        guard !wanderModel.isDragging else {
            return
        }

        let visibleFrame = screen(containing: screenPoint)?.visibleFrame
            ?? currentVisibleFrame(preferMainScreen: true)
        let origin = PetWanderModel.clickTargetOrigin(
            for: screenPoint,
            visibleFrame: visibleFrame,
            windowSize: Self.defaultDisplaySize
        )
        let arrangedOrigin = formationOrigin(around: origin, visibleFrame: visibleFrame)
        clickTargetVisibleFrame = visibleFrame
        wanderModel.runToward(arrangedOrigin)
    }

    func interactWithPet() {
        clickTargetVisibleFrame = nil
        wanderModel.interruptForInteraction()
        petView.playOnce(.waving)
        publishGroupInteraction()
    }

    func interactWithPet(at localPoint: CGPoint) {
        clickTargetVisibleFrame = nil
        wanderModel.interruptForInteraction()
        petView.playOnce(interactionState(for: localPoint))
        publishGroupInteraction()
    }

    private func configurePanel() {
        panel.title = "Ollama Pet Runner"
        panel.contentView = petView
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.acceptsMouseMovedEvents = true
        panel.collectionBehavior = [
            .canJoinAllSpaces,
            .fullScreenAuxiliary,
            .ignoresCycle,
        ]
    }

    private func configureInteractions() {
        attachInteractions(to: petView)
    }

    private func attachInteractions(to view: NSView & PetDisplayView) {
        view.onLeftClick = { [weak self] localPoint, _ in
            self?.interactWithPet(at: localPoint)
        }

        view.onDragBegan = { [weak self] in
            guard let self else {
                return
            }
            beginDragging()
        }

        view.onDragMoved = { [weak self] origin in
            guard let self else {
                return
            }
            moveWindow(to: origin, persist: false)
            publishGroupDragMoveIfNeeded()
        }

        view.onDragEnded = { [weak self] in
            guard let self else {
                return
            }
            moveWindow(to: panel.frame.origin, persist: true)
            publishGroupDragEndIfNeeded()
            wanderModel.endDragging(resumeDelay: 1)
        }

        view.onRightClick = { [weak self] event in
            self?.showContextMenu(for: event)
        }
    }

    @objc private func toggleWandering(_ sender: Any?) {
        let command: PetRunnerIPC.Command = wanderModel.isPaused ? .resume : .pause
        publishGroupCommand(command)
        applyGroupCommand(command)
    }

    @objc private func comeHere(_ sender: Any?) {
        let command = PetRunnerIPC.Command.runToCursor
        publishGroupCommand(command)
        applyGroupCommand(command)
    }

    @objc private func reloadPetFromMenu(_ sender: Any?) {
        let command = PetRunnerIPC.Command.reload
        publishGroupCommand(command)
        applyGroupCommand(command)
    }

    @objc private func quit(_ sender: Any?) {
        let command = PetRunnerIPC.Command.quit
        publishGroupCommand(command)
        applyGroupCommand(command)
    }

    @objc private func selectIndividualDragMode(_ sender: Any?) {
        setDragMode(.individual, publish: true)
    }

    @objc private func selectAllPetsDragMode(_ sender: Any?) {
        setDragMode(.allPets, publish: true)
    }

    @objc private func handleGroupInteraction(_ notification: Notification) {
        guard slotCount > 1 else {
            return
        }

        let senderID = notification.userInfo?[GroupInteraction.senderKey] as? String
            ?? notification.object as? String
        guard senderID != instanceID, !wanderModel.isDragging else {
            return
        }

        clickTargetVisibleFrame = nil
        wanderModel.interruptForInteraction()
        petView.playOnce(groupReactionState)
    }

    @objc private func handleGroupCommand(_ notification: Notification) {
        guard slotCount > 1,
              stringValue(notification.userInfo?[PetRunnerIPC.groupIDKey]) == groupID,
              let rawCommand = stringValue(notification.userInfo?[PetRunnerIPC.commandKey]),
              let command = PetRunnerIPC.Command(rawValue: rawCommand),
              stringValue(notification.userInfo?[PetRunnerIPC.senderInstanceIDKey]) != instanceID
        else {
            return
        }

        let requestedDragMode = stringValue(notification.userInfo?[PetRunnerIPC.dragModeKey])
            .flatMap(PetRunnerDragMode.init(rawValue:))
        guard command != .setDragMode || requestedDragMode != nil else {
            return
        }

        applyGroupCommand(command, dragMode: requestedDragMode)
    }

    @objc private func handleGroupDrag(_ notification: Notification) {
        guard slotCount > 1,
              stringValue(notification.userInfo?[PetRunnerIPC.groupIDKey]) == groupID,
              let senderID = stringValue(notification.userInfo?[PetRunnerIPC.senderInstanceIDKey]),
              senderID != instanceID,
              let sessionID = stringValue(notification.userInfo?[PetRunnerIPC.dragSessionIDKey]),
              let rawEvent = stringValue(notification.userInfo?[PetRunnerIPC.dragEventKey]),
              let event = PetRunnerIPC.DragEvent(rawValue: rawEvent)
        else {
            return
        }

        switch event {
        case .began:
            activeGroupDragSessionID = sessionID
            activeGroupDragSenderID = senderID
            clickTargetVisibleFrame = nil
            wanderModel.beginDragging()
            petView.setLoopingState(.dragging)
        case .moved:
            guard activeGroupDragSessionID == sessionID,
                  activeGroupDragSenderID == senderID,
                  let anchor = pointValue(
                      x: notification.userInfo?[PetRunnerIPC.dragAnchorXKey],
                      y: notification.userInfo?[PetRunnerIPC.dragAnchorYKey]
                  )
            else {
                return
            }
            moveGroupWindow(around: anchor)
        case .ended:
            guard activeGroupDragSessionID == sessionID,
                  activeGroupDragSenderID == senderID
            else {
                return
            }
            if let anchor = pointValue(
                x: notification.userInfo?[PetRunnerIPC.dragAnchorXKey],
                y: notification.userInfo?[PetRunnerIPC.dragAnchorYKey]
            ) {
                moveGroupWindow(around: anchor)
            }
            activeGroupDragSessionID = nil
            activeGroupDragSenderID = nil
            clickTargetVisibleFrame = nil
            wanderModel.endDragging(resumeDelay: 1)
            petView.setLoopingState(.idle)
        }
    }

    @objc private func handleLanguageUpdate(_ notification: Notification) {
        guard stringValue(notification.userInfo?[PetRunnerIPC.groupIDKey]) == groupID,
              let rawLanguage = stringValue(notification.userInfo?[PetRunnerIPC.languageKey])
        else {
            return
        }

        language = PetRunnerLanguage.resolved(from: rawLanguage)
    }

    @objc private func handleFormationUpdate(_ notification: Notification) {
        let targetID = notification.userInfo?[FormationUpdate.instanceIDKey] as? String
            ?? notification.object as? String
        guard targetID == instanceID,
              let nextSlotIndex = integerValue(notification.userInfo?[FormationUpdate.slotIndexKey]),
              let nextSlotCount = integerValue(notification.userInfo?[FormationUpdate.slotCountKey])
        else {
            return
        }

        let oldAnchor = formationAnchor(for: panel.frame.origin)
        let clampedSlotIndex = min(max(nextSlotIndex, 0), 2)
        let clampedSlotCount = min(max(nextSlotCount, 1), 3)
        let didChange = slotIndex != clampedSlotIndex || slotCount != clampedSlotCount

        slotIndex = clampedSlotIndex
        slotCount = clampedSlotCount

        guard didChange, panel.isVisible, !wanderModel.isDragging else {
            return
        }

        let visibleFrame = currentVisibleFrame()
        let arrangedOrigin = formationOrigin(around: oldAnchor, visibleFrame: visibleFrame)
        clickTargetVisibleFrame = visibleFrame
        wanderModel.runToward(arrangedOrigin, speed: 180)
    }

    private func showContextMenu(for event: NSEvent) {
        let menu = NSMenu()
        let labels = PetRunnerMenuLabels(language: language)
        let pauseTitle = wanderModel.isPaused ? labels.resumeMovement : labels.pauseMovement
        menu.addItem(NSMenuItem(title: pauseTitle, action: #selector(toggleWandering(_:)), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: labels.runToCursor, action: #selector(comeHere(_:)), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: labels.reloadPet, action: #selector(reloadPetFromMenu(_:)), keyEquivalent: ""))
        let dragModeMenuItem = NSMenuItem(title: labels.dragMode, action: nil, keyEquivalent: "")
        let dragModeMenu = NSMenu(title: labels.dragMode)
        let individualDragItem = NSMenuItem(
            title: labels.individualDrag,
            action: #selector(selectIndividualDragMode(_:)),
            keyEquivalent: ""
        )
        individualDragItem.state = dragMode == .individual ? .on : .off
        dragModeMenu.addItem(individualDragItem)
        let allPetsDragItem = NSMenuItem(
            title: labels.allPetsDrag,
            action: #selector(selectAllPetsDragMode(_:)),
            keyEquivalent: ""
        )
        allPetsDragItem.state = dragMode == .allPets ? .on : .off
        dragModeMenu.addItem(allPetsDragItem)
        dragModeMenuItem.submenu = dragModeMenu
        menu.addItem(dragModeMenuItem)
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: labels.quit, action: #selector(quit(_:)), keyEquivalent: ""))

        for item in menu.items {
            item.target = self
            item.submenu?.items.forEach { $0.target = self }
        }

        NSMenu.popUpContextMenu(menu, with: event, for: petView)
    }

    private func reloadPet() {
        do {
            let asset = try PetAssetLoader.loadPet(from: petDirectoryURL)
            switch asset.content {
            case let .spritesheet(_, image, _, atlas):
                let spriteView = currentSpriteView()
                spriteView.allowsDirectionalRunning = allowsDirectionalRunning
                spriteView.spriteSheet = PetSpriteSheet(image: image, atlas: atlas)
            case let .model3D(url):
                let modelView = currentModelView()
                try modelView.loadModel(from: url)
            }
            panel.title = asset.definition.displayName
        } catch {
            fputs("OllamaPetRunner reload failed: \(error.localizedDescription)\n", stderr)
        }
    }

    private func startWandering() {
        wanderTimer?.invalidate()
        lastTickTime = CACurrentMediaTime()

        let timer = Timer(timeInterval: 1 / 60, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.stepWandering()
            }
        }
        wanderTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    private func startClickTargetMonitor() {
        guard leftClickMonitor == nil else {
            return
        }

        leftClickMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown]) { [weak self] _ in
            let screenPoint = NSEvent.mouseLocation
            DispatchQueue.main.async {
                Task { @MainActor in
                    guard let self, self.shouldHandleDesktopClick(at: screenPoint) else {
                        return
                    }
                    self.runToClick(at: screenPoint)
                }
            }
        }
    }

    private func startGroupInteractionObserver() {
        DistributedNotificationCenter.default().addObserver(
            self,
            selector: #selector(handleGroupInteraction(_:)),
            name: GroupInteraction.notificationName,
            object: nil
        )
    }

    private func startGroupCommandObserver() {
        DistributedNotificationCenter.default().addObserver(
            self,
            selector: #selector(handleGroupCommand(_:)),
            name: PetRunnerIPC.groupCommandNotificationName,
            object: nil
        )
    }

    private func startGroupDragObserver() {
        DistributedNotificationCenter.default().addObserver(
            self,
            selector: #selector(handleGroupDrag(_:)),
            name: PetRunnerIPC.groupDragNotificationName,
            object: nil
        )
    }

    private func startLanguageObserver() {
        DistributedNotificationCenter.default().addObserver(
            self,
            selector: #selector(handleLanguageUpdate(_:)),
            name: PetRunnerIPC.languageUpdateNotificationName,
            object: nil
        )
    }

    private func startFormationUpdateObserver() {
        DistributedNotificationCenter.default().addObserver(
            self,
            selector: #selector(handleFormationUpdate(_:)),
            name: FormationUpdate.notificationName,
            object: nil
        )
    }

    private func publishGroupInteraction() {
        guard slotCount > 1 else {
            return
        }

        DistributedNotificationCenter.default().postNotificationName(
            GroupInteraction.notificationName,
            object: instanceID,
            userInfo: [GroupInteraction.senderKey: instanceID],
            deliverImmediately: true
        )
    }

    private func publishGroupCommand(
        _ command: PetRunnerIPC.Command,
        dragMode: PetRunnerDragMode? = nil
    ) {
        guard slotCount > 1 else {
            return
        }

        PetRunnerIPC.publishGroupCommand(
            command,
            groupID: groupID,
            senderInstanceID: instanceID,
            dragMode: dragMode
        )
    }

    private func applyGroupCommand(
        _ command: PetRunnerIPC.Command,
        dragMode: PetRunnerDragMode? = nil
    ) {
        switch command {
        case .pause:
            wanderModel.setPaused(true)
            petView.setLoopingState(.idle)
        case .resume:
            wanderModel.setPaused(false)
            petView.setLoopingState(.idle)
        case .runToCursor:
            runToClick(at: NSEvent.mouseLocation)
        case .reload:
            reloadPet()
        case .quit:
            persistPosition()
            NSApp.terminate(nil)
        case .setDragMode:
            guard let dragMode else {
                return
            }
            setDragMode(dragMode, publish: false)
        }
    }

    private func setDragMode(_ nextMode: PetRunnerDragMode, publish: Bool) {
        guard dragMode != nextMode else {
            return
        }

        dragMode = nextMode
        defaults.set(nextMode.rawValue, forKey: PetRunnerIPC.dragModeDefaultsKey)
        if publish {
            publishGroupCommand(.setDragMode, dragMode: nextMode)
        }
    }

    private func beginDragging() {
        activeGroupDragSessionID = nil
        activeGroupDragSenderID = nil
        wanderModel.beginDragging()
        petView.setLoopingState(.dragging)

        guard dragMode == .allPets, slotCount > 1 else {
            return
        }

        let sessionID = UUID().uuidString
        activeGroupDragSessionID = sessionID
        activeGroupDragSenderID = instanceID
        PetRunnerIPC.publishGroupDrag(
            .began,
            groupID: groupID,
            senderInstanceID: instanceID,
            sessionID: sessionID
        )
    }

    private func publishGroupDragMoveIfNeeded() {
        guard dragMode == .allPets,
              let sessionID = activeGroupDragSessionID,
              activeGroupDragSenderID == instanceID,
              slotCount > 1
        else {
            return
        }

        PetRunnerIPC.publishGroupDrag(
            .moved,
            groupID: groupID,
            senderInstanceID: instanceID,
            sessionID: sessionID,
            anchor: formationAnchor(for: panel.frame.origin)
        )
    }

    private func publishGroupDragEndIfNeeded() {
        guard dragMode == .allPets,
              let sessionID = activeGroupDragSessionID,
              activeGroupDragSenderID == instanceID,
              slotCount > 1
        else {
            return
        }

        PetRunnerIPC.publishGroupDrag(
            .ended,
            groupID: groupID,
            senderInstanceID: instanceID,
            sessionID: sessionID,
            anchor: formationAnchor(for: panel.frame.origin)
        )
        activeGroupDragSessionID = nil
        activeGroupDragSenderID = nil
    }

    private func moveGroupWindow(around anchor: CGPoint) {
        let visibleFrame = screen(containing: anchor)?.visibleFrame ?? currentVisibleFrame()
        let arrangedOrigin = formationOrigin(around: anchor, visibleFrame: visibleFrame)
        moveWindow(to: arrangedOrigin, persist: false, visibleFrame: visibleFrame)
    }

    private var groupReactionState: PetAnimationState {
        switch slotIndex % 3 {
        case 0:
            return .waving
        case 1:
            return .arrivePeace
        default:
            return .idleLookAroundTap
        }
    }

    private func shouldHandleDesktopClick(at screenPoint: CGPoint) -> Bool {
        DesktopClickPolicy.shouldHandleDesktopClick(
            at: screenPoint,
            visibleFrame: screen(containing: screenPoint)?.visibleFrame,
            windows: windowSnapshots()
        )
    }

    private func stepWandering() {
        let now = CACurrentMediaTime()
        let deltaTime = min(max(now - (lastTickTime ?? now), 0), 0.25)
        lastTickTime = now
        let visibleFrame = clickTargetVisibleFrame ?? currentVisibleFrame()

        let tick = wanderModel.tick(
            currentOrigin: panel.frame.origin,
            visibleFrame: visibleFrame,
            windowSize: Self.defaultDisplaySize,
            deltaTime: deltaTime
        )

        moveWindow(to: tick.origin, persist: false, visibleFrame: visibleFrame)
        petView.setMovementReferenceState(wanderModel.lastRunningState)
        petView.setLoopingState(tick.animationState)
        if wanderModel.target == nil {
            clickTargetVisibleFrame = nil
        }

        if now - lastPersistTime > 1 {
            persistPosition()
            lastPersistTime = now
        }
    }

    private func moveWindow(to origin: CGPoint, persist: Bool, visibleFrame: CGRect? = nil) {
        let clamped = PetWanderModel.clamped(
            origin: origin,
            visibleFrame: visibleFrame ?? currentVisibleFrame(for: origin),
            windowSize: Self.defaultDisplaySize
        )
        panel.setFrameOrigin(clamped)
        if persist {
            persistPosition()
            lastPersistTime = CACurrentMediaTime()
        }
    }

    private func initialOrigin() -> CGPoint {
        let visibleFrame = currentVisibleFrame(preferMainScreen: true)
        let fallback = formationOrigin(
            around: PetWanderModel.comeHereOrigin(
                visibleFrame: visibleFrame,
                windowSize: Self.defaultDisplaySize
            ),
            visibleFrame: visibleFrame
        )
        guard slotCount == 1 else {
            return fallback
        }

        let xKey = defaults.object(forKey: originXKey) != nil ? originXKey : legacyOriginXKey
        let yKey = defaults.object(forKey: originYKey) != nil ? originYKey : legacyOriginYKey

        guard defaults.object(forKey: xKey) != nil,
              defaults.object(forKey: yKey) != nil
        else {
            return fallback
        }

        let saved = CGPoint(
            x: defaults.double(forKey: xKey),
            y: defaults.double(forKey: yKey)
        )
        return PetWanderModel.clamped(
            origin: saved,
            visibleFrame: currentVisibleFrame(for: saved),
            windowSize: Self.defaultDisplaySize
        )
    }

    private var originXKey: String {
        "OllamaPetRunner.\(instanceID).windowOriginX"
    }

    private var originYKey: String {
        "OllamaPetRunner.\(instanceID).windowOriginY"
    }

    private var legacyOriginXKey: String {
        slotCount == 1 ? DefaultsKey.originX : originXKey
    }

    private var legacyOriginYKey: String {
        slotCount == 1 ? DefaultsKey.originY : originYKey
    }

    private func formationOrigin(around origin: CGPoint, visibleFrame: CGRect) -> CGPoint {
        PetFormationLayout(
            slotCount: slotCount,
            windowSize: Self.defaultDisplaySize
        ).origin(
            for: slotIndex,
            around: origin,
            visibleFrame: visibleFrame
        )
    }

    private func formationAnchor(for origin: CGPoint) -> CGPoint {
        let offset = PetFormationLayout(
            slotCount: slotCount,
            windowSize: Self.defaultDisplaySize
        ).offset(for: slotIndex)
        return CGPoint(x: origin.x - offset.x, y: origin.y - offset.y)
    }

    private func integerValue(_ value: Any?) -> Int? {
        if let intValue = value as? Int {
            return intValue
        }
        if let numberValue = value as? NSNumber {
            return numberValue.intValue
        }
        if let stringValue = value as? String {
            return Int(stringValue)
        }
        return nil
    }

    private func stringValue(_ value: Any?) -> String? {
        if let stringValue = value as? String {
            return stringValue
        }
        if let numberValue = value as? NSNumber {
            return numberValue.stringValue
        }
        return nil
    }

    private func pointValue(x: Any?, y: Any?) -> CGPoint? {
        guard let x = doubleValue(x), let y = doubleValue(y) else {
            return nil
        }
        return CGPoint(x: x, y: y)
    }

    private func doubleValue(_ value: Any?) -> Double? {
        if let doubleValue = value as? Double {
            return doubleValue
        }
        if let numberValue = value as? NSNumber {
            return numberValue.doubleValue
        }
        if let stringValue = value as? String {
            return Double(stringValue)
        }
        return nil
    }

    private func currentVisibleFrame(preferMainScreen: Bool = false) -> CGRect {
        if preferMainScreen, let main = NSScreen.main {
            return main.visibleFrame
        }
        return currentVisibleFrame(for: panel.frame.origin)
    }

    private func currentVisibleFrame(for origin: CGPoint) -> CGRect {
        let center = CGPoint(
            x: origin.x + Self.defaultDisplaySize.width / 2,
            y: origin.y + Self.defaultDisplaySize.height / 2
        )
        return screen(containing: center)?.visibleFrame
            ?? NSScreen.main?.visibleFrame
            ?? CGRect(x: 0, y: 0, width: 1024, height: 768)
    }

    private func screen(containing point: CGPoint) -> NSScreen? {
        NSScreen.screens.first { screen in
            screen.frame.contains(point)
        }
    }

    private func interactionState(for localPoint: CGPoint) -> PetAnimationState {
        let x = localPoint.x / max(petView.bounds.width, 1)
        let y = localPoint.y / max(petView.bounds.height, 1)

        if y >= 0.62 {
            return .headPat
        }
        if y <= 0.22 {
            return .feetTap
        }
        if x <= 0.28 {
            return .leftTailTap
        }
        if x >= 0.72 {
            return .rightTailTap
        }
        return wanderModel.currentIdleVariant.bodyInteractionState
    }

    private func windowSnapshots() -> [DesktopWindowSnapshot] {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        guard let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
            return []
        }

        return windowList.compactMap { info in
            guard let boundsDictionary = info[kCGWindowBounds as String] as? [String: Any],
                  let bounds = CGRect(dictionaryRepresentation: boundsDictionary as CFDictionary)
            else {
                return nil
            }

            return DesktopWindowSnapshot(
                ownerName: info[kCGWindowOwnerName as String] as? String ?? "",
                windowName: info[kCGWindowName as String] as? String ?? "",
                layer: info[kCGWindowLayer as String] as? Int ?? 0,
                bounds: appKitRect(fromCGWindowBounds: bounds)
            )
        }
    }

    private func appKitRect(fromCGWindowBounds bounds: CGRect) -> CGRect {
        let unionFrame = NSScreen.screens.reduce(CGRect.null) { partial, screen in
            partial.union(screen.frame)
        }
        return CGRect(
            x: bounds.minX,
            y: unionFrame.maxY - bounds.minY - bounds.height,
            width: bounds.width,
            height: bounds.height
        )
    }

    private func currentSpriteView() -> PetSpriteView {
        if let spriteView = petView as? PetSpriteView {
            return spriteView
        }
        let spriteView = PetSpriteView(frame: NSRect(origin: .zero, size: Self.defaultDisplaySize))
        replacePetView(with: spriteView)
        return spriteView
    }

    private func currentModelView() -> PetModelView {
        if let modelView = petView as? PetModelView {
            return modelView
        }
        let modelView = PetModelView(frame: NSRect(origin: .zero, size: Self.defaultDisplaySize))
        replacePetView(with: modelView)
        return modelView
    }

    private func replacePetView(with view: NSView & PetDisplayView) {
        view.frame = NSRect(origin: .zero, size: Self.defaultDisplaySize)
        attachInteractions(to: view)
        petView = view
        panel.contentView = view
    }
}
