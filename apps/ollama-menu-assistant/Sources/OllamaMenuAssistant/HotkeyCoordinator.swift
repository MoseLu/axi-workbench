import AppKit
import Carbon

@MainActor
final class HotkeyCoordinator {
    private static var nextIdentifier: UInt32 = 1
    private static var handlers: [UInt32: () -> Void] = [:]
    private static var eventHandlerRef: EventHandlerRef?

    private let identifier: UInt32
    private var hotKeyRef: EventHotKeyRef?

    init() {
        self.identifier = Self.nextIdentifier
        Self.nextIdentifier += 1
        Self.installHandlerIfNeeded()
    }

    func registerOptionSpace(handler: @escaping () -> Void) -> Bool {
        unregister()
        Self.handlers[identifier] = handler

        let hotKeyID = EventHotKeyID(signature: OSType(0x4F4D4148), id: identifier)
        let modifiers = UInt32(optionKey)
        let status = RegisterEventHotKey(UInt32(kVK_Space), modifiers, hotKeyID, GetApplicationEventTarget(), 0, &hotKeyRef)
        if status != noErr {
            hotKeyRef = nil
            Self.handlers.removeValue(forKey: identifier)
            return false
        }
        return true
    }

    func unregister() {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
            self.hotKeyRef = nil
        }
        Self.handlers.removeValue(forKey: identifier)
    }

    private static func installHandlerIfNeeded() {
        guard eventHandlerRef == nil else {
            return
        }

        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), hotKeyEventHandler, 1, &eventType, nil, &eventHandlerRef)
    }

    fileprivate static func invoke(id: UInt32) {
        handlers[id]?()
    }
}

private func hotKeyEventHandler(
    _ nextHandler: EventHandlerCallRef?,
    _ event: EventRef?,
    _ userData: UnsafeMutableRawPointer?
) -> OSStatus {
    var hotKeyID = EventHotKeyID()
    let status = GetEventParameter(
        event,
        EventParamName(kEventParamDirectObject),
        EventParamType(typeEventHotKeyID),
        nil,
        MemoryLayout<EventHotKeyID>.size,
        nil,
        &hotKeyID
    )

    guard status == noErr else {
        return OSStatus(eventNotHandledErr)
    }

    DispatchQueue.main.async {
        Task { @MainActor in
            HotkeyCoordinator.invoke(id: hotKeyID.id)
        }
    }
    return noErr
}
