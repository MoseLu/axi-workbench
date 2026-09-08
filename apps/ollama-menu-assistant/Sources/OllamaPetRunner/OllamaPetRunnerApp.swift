import AppKit

@MainActor
@main
final class OllamaPetRunnerApp: NSObject, NSApplicationDelegate {
    private var petWindowController: PetWindowController?

    static func main() {
        let app = NSApplication.shared
        let delegate = OllamaPetRunnerApp()
        app.delegate = delegate
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        let controller = PetWindowController(
            petDirectoryURL: PetAssetLoader.selectedPetDirectory,
            instanceID: PetAssetLoader.selectedPetInstanceID,
            groupID: PetAssetLoader.selectedPetGroupID,
            slotIndex: PetAssetLoader.selectedPetSlotIndex,
            slotCount: PetAssetLoader.selectedPetSlotCount,
            language: PetAssetLoader.selectedPetLanguage,
            allowsDirectionalRunning: PetAssetLoader.selectedPetAllowsDirectionalRunning
        )
        petWindowController = controller
        controller.show()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationWillTerminate(_ notification: Notification) {
        petWindowController?.stopClickTargetMonitor()
        petWindowController?.persistPosition()
    }
}
