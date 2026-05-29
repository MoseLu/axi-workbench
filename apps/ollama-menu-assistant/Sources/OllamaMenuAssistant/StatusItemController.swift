import AppKit
import Combine

@MainActor
final class StatusItemController: NSObject {
    private let statusItem: NSStatusItem
    private let panelController: AssistantPanelController
    private var cancellables = Set<AnyCancellable>()

    var statusButton: NSStatusBarButton? {
        statusItem.button
    }

    init(appModel: AppModel, panelController: AssistantPanelController) {
        self.statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        self.panelController = panelController
        super.init()

        statusItem.button?.target = self
        statusItem.button?.action = #selector(togglePanel)
        statusItem.button?.sendAction(on: [.leftMouseUp])

        appModel.$availability
            .receive(on: RunLoop.main)
            .sink { [weak self] availability in
                self?.updateButton(for: availability)
            }
            .store(in: &cancellables)

        updateButton(for: appModel.availability)
    }

    @objc private func togglePanel() {
        panelController.toggle(relativeTo: statusItem.button)
    }

    private func updateButton(for availability: AppAvailability) {
        let symbolName: String
        let tooltip: String

        switch availability {
        case .offline:
            symbolName = "wifi.exclamationmark"
            tooltip = tr("Ollama 助手 - 离线", "Ollama Assistant - Offline")
        case .idle:
            symbolName = "sparkles"
            tooltip = tr("Ollama 助手 - 就绪", "Ollama Assistant - Ready")
        case .generating:
            symbolName = "ellipsis.message"
            tooltip = tr("Ollama 助手 - 生成中", "Ollama Assistant - Generating")
        }

        statusItem.button?.image = NSImage(
            systemSymbolName: symbolName,
            accessibilityDescription: tooltip
        )
        statusItem.button?.toolTip = tooltip
    }

    private var tr: LocalizedStrings {
        LocalizedStrings.current()
    }
}
