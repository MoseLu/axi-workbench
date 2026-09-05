import AppKit

@MainActor
@main
final class MainApp: NSObject, NSApplicationDelegate {
    private var appModel: AppModel!
    private var automationScheduler: AutomationScheduler!
    private var panelController: AssistantPanelController!
    private var statusItemController: StatusItemController!
    private let hotkeyCoordinator = HotkeyCoordinator()
    private var isHandlingInitialPresentation = false

    static func main() {
        if SnapshotRenderer.handleCommandLineIfNeeded() {
            return
        }

        let app = NSApplication.shared
        let delegate = MainApp()
        app.delegate = delegate
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        AssistantLayoutPreferences.resetForAppLaunch()
        NSApp.setActivationPolicy(.regular)

        let client = OllamaClient()
        let catalogService = ModelCatalogService(client: client)
        let conversationStore = ConversationStore()
        let launchAtLoginCoordinator = LaunchAtLoginCoordinator()

        appModel = AppModel(
            client: client,
            catalogService: catalogService,
            conversationStore: conversationStore,
            launchAtLoginCoordinator: launchAtLoginCoordinator
        )

        panelController = AssistantPanelController(appModel: appModel)
        statusItemController = StatusItemController(appModel: appModel, panelController: panelController)
        automationScheduler = AutomationScheduler(appModel: appModel)

        scheduleInitialPanelPresentation()

        let registered = hotkeyCoordinator.registerOptionSpace { [weak self] in
            self?.panelController.toggle(relativeTo: self?.statusItemController.statusButton)
        }
        appModel.setHotkeyRegistrationResult(success: registered)
        startAppModelAfterInitialPanelPresentation()
    }

    func applicationWillTerminate(_ notification: Notification) {
        automationScheduler.stop()
        hotkeyCoordinator.unregister()
        appModel.stopPetRunnerForAppTermination()
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        showInitialPanelDuringLaunch()
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        panelController.open(relativeTo: statusItemController.statusButton)
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    @objc func openMainPanel(_ sender: Any?) {
        panelController.open(relativeTo: statusItemController.statusButton)
    }

    private func scheduleInitialPanelPresentation() {
        isHandlingInitialPresentation = true
        for delay in [0.1, 0.35, 0.75, 1.5, 3.0, 5.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.showInitialPanelDuringLaunch()
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 6.0) { [weak self] in
            self?.isHandlingInitialPresentation = false
        }
    }

    private func showInitialPanelDuringLaunch() {
        guard isHandlingInitialPresentation else {
            return
        }
        NSRunningApplication.current.activate(options: [.activateAllWindows])
        panelController.open(relativeTo: statusItemController.statusButton)
    }

    private func startAppModelAfterInitialPanelPresentation() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            guard let self else {
                return
            }
            Task {
                await self.appModel.startup()
                self.automationScheduler.start()
            }
        }
    }
}
