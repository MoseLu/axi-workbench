import AppKit
import Foundation
import ImageIO

private enum PetRosterLimit {
    static let maxPets = 3
}

struct PetDefinition: Codable, Equatable, Sendable {
    var id: String
    var displayName: String
    var description: String?
    var spritesheetPath: String
    var modelPath: String?

    enum CodingKeys: String, CodingKey {
        case id
        case displayName
        case description
        case spritesheetPath
        case modelPath
    }

    init(
        id: String,
        displayName: String,
        description: String? = nil,
        spritesheetPath: String = "",
        modelPath: String? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.description = description
        self.spritesheetPath = spritesheetPath
        self.modelPath = modelPath
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        displayName = try container.decode(String.self, forKey: .displayName)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        spritesheetPath = try container.decodeIfPresent(String.self, forKey: .spritesheetPath) ?? ""
        modelPath = try container.decodeIfPresent(String.self, forKey: .modelPath)
    }
}

enum LoadedPetContent {
    case spritesheet(url: URL, image: CGImage, dimensions: PetImageDimensions, atlas: PetAtlasSpec)
    case model3D(url: URL)
}

struct LoadedPetAsset {
    var definition: PetDefinition
    var rootURL: URL
    var content: LoadedPetContent

    var spritesheetURL: URL? {
        if case let .spritesheet(url, _, _, _) = content {
            return url
        }
        return nil
    }

    var dimensions: PetImageDimensions? {
        if case let .spritesheet(_, _, dimensions, _) = content {
            return dimensions
        }
        return nil
    }

    var atlas: PetAtlasSpec? {
        if case let .spritesheet(_, _, _, atlas) = content {
            return atlas
        }
        return nil
    }
}

enum PetAssetError: LocalizedError {
    case unreadablePetJSON(URL, String)
    case invalidPetJSON(URL, String)
    case missingModel(URL)
    case missingSpritesheet(URL)
    case unreadableSpritesheet(URL)
    case invalidSpritesheetSize(URL, PetAtlasError)

    var errorDescription: String? {
        switch self {
        case let .unreadablePetJSON(url, reason):
            "Could not read pet.json at \(url.path): \(reason)"
        case let .invalidPetJSON(url, reason):
            "Invalid pet.json at \(url.path): \(reason)"
        case let .missingModel(url):
            "3D model file does not exist at \(url.path)."
        case let .missingSpritesheet(url):
            "Spritesheet file does not exist at \(url.path)."
        case let .unreadableSpritesheet(url):
            "Could not decode spritesheet image at \(url.path)."
        case let .invalidSpritesheetSize(url, error):
            "Invalid spritesheet at \(url.path): \(error.localizedDescription)"
        }
    }
}

enum PetAssetLoader {
    static let petDirectoryEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_DIRECTORY"
    static let petInstanceIDEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_INSTANCE_ID"
    static let petSlotIndexEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_SLOT_INDEX"
    static let petSlotCountEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_SLOT_COUNT"
    static let petAllowsDirectionalRunningEnvironmentKey = "OLLAMA_MENU_ASSISTANT_PET_ALLOWS_DIRECTIONAL_RUNNING"

    static let defaultPetDirectory = FileManager.default
        .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appending(path: "OllamaMenuAssistant/Pets/miku", directoryHint: .isDirectory)

    static var selectedPetDirectory: URL {
        guard let path = ProcessInfo.processInfo.environment[petDirectoryEnvironmentKey],
              !path.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            return defaultPetDirectory
        }

        return URL(fileURLWithPath: path, isDirectory: true)
    }

    static var selectedPetInstanceID: String {
        let rawValue = ProcessInfo.processInfo.environment[petInstanceIDEnvironmentKey] ?? "default"
        let sanitized = rawValue
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .filter { character in
                character.isLetter || character.isNumber || character == "-" || character == "_"
            }

        return sanitized.isEmpty ? "default" : sanitized
    }

    static var selectedPetGroupID: String {
        guard let value = ProcessInfo.processInfo.environment[PetRunnerIPC.groupIDEnvironmentKey]?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty
        else {
            return PetRunnerIPC.groupID
        }

        return value
    }

    static var selectedPetLanguage: PetRunnerLanguage {
        PetRunnerLanguage.resolved(
            from: ProcessInfo.processInfo.environment[PetRunnerIPC.languageEnvironmentKey]
        )
    }

    static var selectedPetSlotIndex: Int {
        clampedIntegerEnvironmentValue(
            key: petSlotIndexEnvironmentKey,
            defaultValue: 0,
            range: 0...(PetRosterLimit.maxPets - 1)
        )
    }

    static var selectedPetSlotCount: Int {
        clampedIntegerEnvironmentValue(
            key: petSlotCountEnvironmentKey,
            defaultValue: 1,
            range: 1...PetRosterLimit.maxPets
        )
    }

    static var selectedPetAllowsDirectionalRunning: Bool {
        let rawValue = (ProcessInfo.processInfo.environment[petAllowsDirectionalRunningEnvironmentKey] ?? "true")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return !["0", "false", "no", "off"].contains(rawValue)
    }

    static func loadDefaultPet() throws -> LoadedPetAsset {
        try loadPet(from: selectedPetDirectory)
    }

    private static func clampedIntegerEnvironmentValue(
        key: String,
        defaultValue: Int,
        range: ClosedRange<Int>
    ) -> Int {
        guard let rawValue = ProcessInfo.processInfo.environment[key],
              let value = Int(rawValue)
        else {
            return defaultValue
        }

        return min(max(value, range.lowerBound), range.upperBound)
    }

    static func loadPet(from rootURL: URL) throws -> LoadedPetAsset {
        let petJSONURL = rootURL.appending(path: "pet.json")
        let data: Data
        do {
            data = try Data(contentsOf: petJSONURL)
        } catch {
            throw PetAssetError.unreadablePetJSON(petJSONURL, error.localizedDescription)
        }

        let definition: PetDefinition
        do {
            definition = try JSONDecoder().decode(PetDefinition.self, from: data)
        } catch {
            throw PetAssetError.invalidPetJSON(petJSONURL, error.localizedDescription)
        }

        guard !definition.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !definition.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw PetAssetError.invalidPetJSON(petJSONURL, "id and displayName must be non-empty.")
        }

        let modelPath = definition.modelPath?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !modelPath.isEmpty {
            let modelURL = rootURL.appending(path: modelPath)
            guard FileManager.default.fileExists(atPath: modelURL.path) else {
                throw PetAssetError.missingModel(modelURL)
            }

            return LoadedPetAsset(
                definition: definition,
                rootURL: rootURL,
                content: .model3D(url: modelURL)
            )
        }

        guard !definition.spritesheetPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw PetAssetError.invalidPetJSON(petJSONURL, "spritesheetPath or modelPath must be non-empty.")
        }

        let preferredSpritesheets = [
            rootURL.appending(path: "spritesheet.redraw.webp"),
            rootURL.appending(path: "spritesheet.directional.webp"),
            rootURL.appending(path: definition.spritesheetPath),
        ]
        let spritesheetURL = preferredSpritesheets.first {
            FileManager.default.fileExists(atPath: $0.path)
        } ?? preferredSpritesheets[0]
        guard FileManager.default.fileExists(atPath: spritesheetURL.path) else {
            throw PetAssetError.missingSpritesheet(spritesheetURL)
        }

        guard let imageSource = CGImageSourceCreateWithURL(spritesheetURL as CFURL, nil),
              let spritesheet = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
        else {
            throw PetAssetError.unreadableSpritesheet(spritesheetURL)
        }

        let dimensions = PetImageDimensions(width: spritesheet.width, height: spritesheet.height)
        let atlas: PetAtlasSpec
        do {
            atlas = try PetAtlasSpec.detect(dimensions: dimensions)
        } catch let error as PetAtlasError {
            throw PetAssetError.invalidSpritesheetSize(spritesheetURL, error)
        }

        return LoadedPetAsset(
            definition: definition,
            rootURL: rootURL,
            content: .spritesheet(
                url: spritesheetURL,
                image: spritesheet,
                dimensions: dimensions,
                atlas: atlas
            )
        )
    }
}
