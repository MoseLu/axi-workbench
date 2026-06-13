import AppKit

@MainActor
@main
final class MainApp: NSObject, NSApplicationDelegate {
    private var appModel: AppModel!
    private var automationScheduler: AutomationScheduler!
    private var panelController: AssistantPanelController!
    private var statusItemController: StatusItemController!
    private let hotkeyCoordinator = HotkeyCoordinator()
    private var hasShownInitialPanel = false

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

        let registered = hotkeyCoordinator.registerOptionSpace { [weak self] in
            self?.panelController.toggle(relativeTo: self?.statusItemController.statusButton)
        }
        appModel.setHotkeyRegistrationResult(success: registered)

        Task {
            await appModel.startup()
            self.automationScheduler.start()
            self.showPanelOnFirstLaunchIfNeeded()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        automationScheduler.stop()
        hotkeyCoordinator.unregister()
        appModel.stopPetRunnerForAppTermination()
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

    private func showPanelOnFirstLaunchIfNeeded() {
        guard !hasShownInitialPanel else {
            return
        }
        hasShownInitialPanel = true
        panelController.open(relativeTo: statusItemController.statusButton)
    }
}
