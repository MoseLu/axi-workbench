import AppKit
import Foundation
import ImageIO

struct PetSelection: Equatable, Identifiable, Sendable {
    static let miku = PetSelection(id: PetCatalog.defaultPetID)
    static let none = PetSelection(id: "none")

    var id: String

    init(id: String) {
        let trimmed = id.trimmingCharacters(in: .whitespacesAndNewlines)
        self.id = trimmed.isEmpty ? PetCatalog.defaultPetID : trimmed
    }

    init(storedValue: String?) {
        let trimmed = (storedValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = trimmed.lowercased()

        switch normalized {
        case "none", "no", "off", "无":
            self = .none
        case "sakura-miku", "樱花初音":
            self = PetSelection(id: "miku-sakura")
        case "snow-miku", "冬雪初音":
            self = PetSelection(id: "miku-snow")
        case "", "miku", "hatsune", "hatsune miku", "初音", "codex", "classic", "经典":
            self = .miku
        default:
            self = PetSelection(id: trimmed)
        }
    }

    var storageValue: String {
        id
    }

    var launchesDesktopPet: Bool {
        self != .none
    }

    func title(language: AppLanguage, pets: [PetDescriptor] = []) -> String {
        if self == .none {
            return language == .english ? "None" : "无"
        }

        if let pet = pets.first(where: { $0.id == id }) {
            return pet.displayName(language: language)
        }

        if self == .miku {
            return language == .english ? "Miku" : "初音"
        }

        return id
    }

    static func selection(
        matching title: String,
        language: AppLanguage,
        pets: [PetDescriptor] = []
    ) -> PetSelection {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if let pet = pets.first(where: { $0.matchesTitle(trimmed) }) {
            return PetSelection(id: pet.id)
        }

        if trimmed == PetSelection.none.title(language: language, pets: pets) {
            return .none
        }

        return PetSelection(storedValue: trimmed)
    }
}

struct PetRoster: Equatable, Sendable {
    static let maxPets = 3

    var selections: [PetSelection]

    init(selections: [PetSelection]) {
        var seen = Set<String>()
        self.selections = selections
            .filter { $0 != .none }
            .filter { selection in
                seen.insert(selection.id).inserted
            }
            .prefix(Self.maxPets)
            .map { $0 }
    }

    init(storedValue: String?, legacyStoredValue: String?) {
        let source = storedValue ?? legacyStoredValue
        let trimmed = (source ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmed.isEmpty else {
            self.init(selections: [.miku])
            return
        }

        let normalized = trimmed.lowercased()
        if ["none", "no", "off", "无"].contains(normalized) {
            self.init(selections: [])
            return
        }

        let selections = trimmed
            .split(separator: ",")
            .map { PetSelection(storedValue: String($0)) }

        self.init(selections: selections)
    }

    var storageValue: String {
        guard !selections.isEmpty else {
            return PetSelection.none.storageValue
        }

        return selections.map(\.storageValue).joined(separator: ",")
    }

    var primarySelection: PetSelection {
        selections.first ?? .none
    }
}

struct PetFormationSlots: Equatable, Sendable {
    static let slotCount = PetRoster.maxPets

    static func assign(existingSlots: [String: Int], requestedIDs: [String]) -> [String: Int] {
        var usedSlots = Set<Int>()
        var assignments: [String: Int] = [:]

        for id in requestedIDs {
            guard let existingSlot = existingSlots[id],
                  (0..<slotCount).contains(existingSlot),
                  !usedSlots.contains(existingSlot)
            else {
                continue
            }

            assignments[id] = existingSlot
            usedSlots.insert(existingSlot)
        }

        for id in requestedIDs where assignments[id] == nil {
            guard let openSlot = (0..<slotCount).first(where: { !usedSlots.contains($0) }) else {
                break
            }

            assignments[id] = openSlot
            usedSlots.insert(openSlot)
        }

        return assignments
    }
}

enum PetRunnerError: LocalizedError, Equatable {
    case missingHelperApp
    case launchFailed

    var errorDescription: String? {
        switch self {
        case .missingHelperApp:
            "Ollama Pet Runner helper app was not found. Rebuild the application so the helper is embedded."
        case .launchFailed:
            "Ollama Pet Runner helper app did not return a running application."
        }
    }
}

struct PetLaunchRequest: Equatable, Sendable {
    var id: String
    var petDirectoryURL: URL
    var slotIndex: Int
    var slotCount: Int
    var allowsDirectionalRunning: Bool = true

    var signature: String {
        [
            id,
            petDirectoryURL.standardizedFileURL.path,
            String(slotIndex),
            String(slotCount),
            String(allowsDirectionalRunning),
        ].joined(separator: "|")
    }

    var processSignature: String {
        [
            id,
            petDirectoryURL.standardizedFileURL.path,
            String(allowsDirectionalRunning),
        ].joined(separator: "|")
    }
}

private enum PetSpritesheetCapability {
    static let frameWidth = 192
    static let frameHeight = 208
    static let columns = 8
    static let directionalRows = 15

    private struct PetDefinition: Decodable {
        var spritesheetPath: String?
        var modelPath: String?
    }

    static func supportsDirectionalRunning(in rootURL: URL, fileManager: FileManager = .default) -> Bool {
        guard let spritesheetURL = preferredSpritesheetURL(in: rootURL, fileManager: fileManager),
              let imageSource = CGImageSourceCreateWithURL(spritesheetURL as CFURL, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [String: Any],
              let width = properties[kCGImagePropertyPixelWidth as String] as? Int,
              let height = properties[kCGImagePropertyPixelHeight as String] as? Int
        else {
            return false
        }

        return width == columns * frameWidth
            && height >= directionalRows * frameHeight
            && height % frameHeight == 0
    }

    private static func preferredSpritesheetURL(in rootURL: URL, fileManager: FileManager) -> URL? {
        let petJSONURL = rootURL.appending(path: "pet.json")
        guard let data = try? Data(contentsOf: petJSONURL),
              let definition = try? JSONDecoder().decode(PetDefinition.self, from: data)
        else {
            return nil
        }

        return [
            rootURL.appending(path: "spritesheet.redraw.webp"),
            rootURL.appending(path: "spritesheet.directional.webp"),
            rootURL.appending(path: definition.spritesheetPath ?? ""),
        ].first { fileManager.fileExists(atPath: $0.path) }
    }
}

@MainActor
final class PetRunnerController {
    private enum Constants {
        static let bundleIdentifier = "com.mose.OllamaMenuAssistant.PetRunner"
        static let helperAppName = "Ollama Pet Runner.app"
        static let petDirectoryEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_DIRECTORY"
        static let petInstanceIDEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_INSTANCE_ID"
        static let petSlotIndexEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_SLOT_INDEX"
        static let petSlotCountEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_SLOT_COUNT"
        static let petAllowsDirectionalRunningEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_ALLOWS_DIRECTIONAL_RUNNING"
        static let formationUpdateNotificationName = Notification.Name("com.mose.OllamaMenuAssistant.PetRunner.formationUpdate")
        static let formationInstanceIDKey = "instanceID"
        static let formationSlotIndexKey = "slotIndex"
        static let formationSlotCountKey = "slotCount"
    }

    private var managedApplications: [String: NSRunningApplication] = [:]
    private var launchedPetRequests: [String: PetLaunchRequest] = [:]

    var isRunning: Bool {
        runningApplications.isEmpty == false
    }

    func launchIfNeeded(petDirectoryURL: URL) async throws {
        try await launchPets([
            PetLaunchRequest(
                id: petDirectoryURL.lastPathComponent,
                petDirectoryURL: petDirectoryURL,
                slotIndex: 0,
                slotCount: PetFormationSlots.slotCount
            ),
        ])
    }

    func launchPets(_ requests: [PetLaunchRequest]) async throws {
        let limitedRequests = Array(requests.prefix(PetRoster.maxPets))
        guard !limitedRequests.isEmpty else {
            terminate()
            return
        }

        pruneTerminatedManagedApplications()
        let assignedRequests = formationAssignedRequests(from: limitedRequests)

        if managedApplications.isEmpty, isRunning {
            await terminateAndWait()
        }

        let helperURL = try helperAppURL()
        let requestedIDs = Set(assignedRequests.map(\.id))
        var launchedThisCall: [NSRunningApplication] = []

        do {
            let removedIDs = managedApplications.keys.filter { !requestedIDs.contains($0) }
            for id in removedIDs {
                guard let application = managedApplications[id] else {
                    continue
                }
                application.terminate()
                managedApplications[id] = nil
                launchedPetRequests[id] = nil
            }

            for request in assignedRequests {
                if let existingRequest = launchedPetRequests[request.id],
                   existingRequest.processSignature == request.processSignature,
                   let application = managedApplications[request.id],
                   !application.isTerminated
                {
                    continue
                }

                if let application = managedApplications[request.id] {
                    application.terminate()
                    await waitUntilTerminated(application)
                    managedApplications[request.id] = nil
                    launchedPetRequests[request.id] = nil
                }

                let application = try await launchPet(request, helperURL: helperURL)
                managedApplications[request.id] = application
                launchedThisCall.append(application)
            }

            launchedPetRequests = Dictionary(uniqueKeysWithValues: assignedRequests.map { ($0.id, $0) })
            publishFormationUpdates(for: assignedRequests)
        } catch {
            for application in launchedThisCall {
                application.terminate()
            }
            throw error
        }
    }

    func terminate() {
        for application in runningApplications {
            application.terminate()
        }
        managedApplications = [:]
        launchedPetRequests = [:]
    }

    private func formationAssignedRequests(from requests: [PetLaunchRequest]) -> [PetLaunchRequest] {
        let existingSlots = launchedPetRequests.mapValues(\.slotIndex)
        let assignments = PetFormationSlots.assign(
            existingSlots: existingSlots,
            requestedIDs: requests.map(\.id)
        )
        let allowsDirectionalRunning = requests.allSatisfy {
            PetSpritesheetCapability.supportsDirectionalRunning(in: $0.petDirectoryURL)
        }

        return requests.compactMap { request in
            guard let slotIndex = assignments[request.id] else {
                return nil
            }

            return PetLaunchRequest(
                id: request.id,
                petDirectoryURL: request.petDirectoryURL,
                slotIndex: slotIndex,
                slotCount: PetFormationSlots.slotCount,
                allowsDirectionalRunning: allowsDirectionalRunning
            )
        }
    }

    private func launchPet(_ request: PetLaunchRequest, helperURL: URL) async throws -> NSRunningApplication {
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        configuration.addsToRecentItems = false
        configuration.createsNewApplicationInstance = true

        var environment = ProcessInfo.processInfo.environment
        environment[Constants.petDirectoryEnvironmentKey] = request.petDirectoryURL.path
        environment[Constants.petInstanceIDEnvironmentKey] = request.id
        environment[Constants.petSlotIndexEnvironmentKey] = String(request.slotIndex)
        environment[Constants.petSlotCountEnvironmentKey] = String(request.slotCount)
        environment[Constants.petAllowsDirectionalRunningEnvironmentKey] = request.allowsDirectionalRunning ? "true" : "false"
        configuration.environment = environment

        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<NSRunningApplication, Error>) in
            NSWorkspace.shared.openApplication(at: helperURL, configuration: configuration) { application, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let application {
                    continuation.resume(returning: application)
                } else {
                    continuation.resume(throwing: PetRunnerError.launchFailed)
                }
            }
        }
    }

    private var runningApplications: [NSRunningApplication] {
        NSRunningApplication.runningApplications(withBundleIdentifier: Constants.bundleIdentifier)
            .filter { !$0.isTerminated }
    }

    private func terminateAndWait() async {
        terminate()

        for _ in 0..<20 {
            guard isRunning else {
                return
            }

            try? await Task.sleep(for: .milliseconds(100))
        }
    }

    private func waitUntilTerminated(_ application: NSRunningApplication) async {
        for _ in 0..<20 {
            guard !application.isTerminated else {
                return
            }

            try? await Task.sleep(for: .milliseconds(100))
        }
    }

    private func pruneTerminatedManagedApplications() {
        managedApplications = managedApplications.filter { _, application in
            !application.isTerminated
        }
        launchedPetRequests = launchedPetRequests.filter { id, _ in
            managedApplications[id] != nil
        }
    }

    private func publishFormationUpdates(for requests: [PetLaunchRequest]) {
        for request in requests {
            DistributedNotificationCenter.default().postNotificationName(
                Constants.formationUpdateNotificationName,
                object: request.id,
                userInfo: [
                    Constants.formationInstanceIDKey: request.id,
                    Constants.formationSlotIndexKey: request.slotIndex,
                    Constants.formationSlotCountKey: request.slotCount,
                ],
                deliverImmediately: true
            )
        }
    }

    private func helperAppURL() throws -> URL {
        for candidate in helperAppCandidates where FileManager.default.fileExists(atPath: candidate.path) {
            return candidate
        }
        throw PetRunnerError.missingHelperApp
    }

    private var helperAppCandidates: [URL] {
        var candidates: [URL] = []

        candidates.append(
            Bundle.main.bundleURL
                .appending(path: "Contents", directoryHint: .isDirectory)
                .appending(path: "Library", directoryHint: .isDirectory)
                .appending(path: "Helpers", directoryHint: .isDirectory)
                .appending(path: Constants.helperAppName, directoryHint: .isDirectory)
        )

        if let resourceURL = Bundle.main.resourceURL {
            candidates.append(resourceURL.appending(path: Constants.helperAppName, directoryHint: .isDirectory))
        }

        candidates.append(URL(fileURLWithPath: "/Applications").appending(path: Constants.helperAppName, directoryHint: .isDirectory))
        candidates.append(projectRoot.appending(path: "dist", directoryHint: .isDirectory).appending(path: Constants.helperAppName, directoryHint: .isDirectory))

        return candidates
    }

    private var projectRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }
}
