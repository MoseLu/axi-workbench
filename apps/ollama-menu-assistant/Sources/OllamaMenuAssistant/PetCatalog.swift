import Foundation

struct PetDescriptor: Identifiable, Equatable, Sendable {
    var id: String
    var displayName: String
    var localizedDisplayNames: [String: String]
    var description: String
    var spritesheetPath: String
    var modelPath: String?
    var groupID: String?
    var groupLocalizedTitles: [String: String]
    var isInstalled: Bool
    var rootURL: URL

    init(
        id: String,
        displayName: String,
        localizedDisplayNames: [String: String] = [:],
        description: String,
        spritesheetPath: String,
        modelPath: String? = nil,
        groupID: String? = nil,
        groupLocalizedTitles: [String: String] = [:],
        isInstalled: Bool = true,
        rootURL: URL
    ) {
        self.id = id
        self.displayName = displayName
        self.localizedDisplayNames = localizedDisplayNames
        self.description = description
        self.spritesheetPath = spritesheetPath
        self.modelPath = modelPath
        self.groupID = groupID
        self.groupLocalizedTitles = groupLocalizedTitles
        self.isInstalled = isInstalled
        self.rootURL = rootURL
    }

    func displayName(language: AppLanguage) -> String {
        for key in Self.localizedNameKeys(for: language) {
            if let value = localizedDisplayNames[key]?.trimmingCharacters(in: .whitespacesAndNewlines),
               !value.isEmpty {
                return value
            }
        }
        return displayName
    }

    func matchesTitle(_ title: String) -> Bool {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return false
        }
        return trimmed == id
            || trimmed == displayName
            || localizedDisplayNames.values.contains { $0.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed }
    }

    static func preferredDisplayName(
        explicitDisplayName: String?,
        localizedDisplayNames: [String: String]
    ) -> String? {
        if let explicitDisplayName = explicitDisplayName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !explicitDisplayName.isEmpty {
            return explicitDisplayName
        }

        for key in localizedNameKeys(for: .simplifiedChinese) + localizedNameKeys(for: .english) {
            if let value = localizedDisplayNames[key]?.trimmingCharacters(in: .whitespacesAndNewlines),
               !value.isEmpty {
                return value
            }
        }

        return localizedDisplayNames
            .sorted { $0.key.localizedStandardCompare($1.key) == .orderedAscending }
            .compactMap { $0.value.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty }
    }

    private static func localizedNameKeys(for language: AppLanguage) -> [String] {
        switch language {
        case .simplifiedChinese:
            ["zh-Hans", "zh_CN", "zh", "simplifiedChinese", "chinese"]
        case .english:
            ["en", "en-US", "english"]
        }
    }
}

struct PetGroupDescriptor: Identifiable, Equatable, Sendable {
    var id: String
    var simplifiedChineseTitle: String
    var englishTitle: String
    var pets: [PetDescriptor]

    func title(language: AppLanguage) -> String {
        language == .english ? englishTitle : simplifiedChineseTitle
    }

    func petCharacters() -> [PetCharacterDescriptor] {
        var charactersByID: [String: PetCharacterDescriptor] = [:]
        var orderedIDs: [String] = []

        for pet in pets {
            let identity = petCharacterIdentity(pet)
            if charactersByID[identity.id] == nil {
                orderedIDs.append(identity.id)
                charactersByID[identity.id] = PetCharacterDescriptor(
                    id: identity.id,
                    simplifiedChineseTitle: identity.simplifiedChineseTitle,
                    englishTitle: identity.englishTitle,
                    pets: []
                )
            }
            charactersByID[identity.id]?.pets.append(pet)
        }

        return orderedIDs.compactMap { charactersByID[$0] }
    }

    func petCharacterTitle(_ pet: PetDescriptor, language: AppLanguage) -> String {
        petCharacterIdentity(pet).title(language: language)
    }

    func petSkinTitle(_ pet: PetDescriptor, language: AppLanguage) -> String {
        switch id {
        case "hatsune-miku":
            switch Self.normalizedPetID(pet.id) {
            case "miku":
                return language == .english ? "Classic" : "经典"
            case "miku-snow", "snow-miku":
                return language == .english ? "Snow" : "冬雪"
            case "miku-sakura", "sakura-miku":
                return language == .english ? "Sakura" : "樱花"
            default:
                return Self.splitDisplayName(pet.displayName(language: language))?.skin
                    ?? pet.displayName(language: language)
            }
        case "nekopara":
            return Self.knownVariantTitle(for: pet, language: language)
                ?? defaultPetSkinTitle(pet, language: language)
        case "sakurasou":
            return Self.knownVariantTitle(for: pet, language: language)
                ?? defaultPetSkinTitle(pet, language: language)
        case "date-a-live":
            return Self.dateALivePetSkinTitle(pet, language: language)
        default:
            return defaultPetSkinTitle(pet, language: language)
        }
    }

    func petTitle(_ pet: PetDescriptor, language: AppLanguage) -> String {
        switch id {
        case "hatsune-miku":
            switch pet.id {
            case "miku":
                return language == .english ? "Classic" : "经典"
            case "miku-snow":
                return language == .english ? "Snow" : "冬雪"
            case "miku-sakura":
                return language == .english ? "Sakura" : "樱花"
            default:
                return pet.displayName(language: language)
            }
        case "date-a-live":
            return Self.dateALivePetTitle(pet, language: language)
        default:
            return pet.displayName(language: language)
        }
    }

    private struct PetCharacterIdentity: Equatable, Sendable {
        var id: String
        var simplifiedChineseTitle: String
        var englishTitle: String

        func title(language: AppLanguage) -> String {
            language == .english ? englishTitle : simplifiedChineseTitle
        }
    }

    private func petCharacterIdentity(_ pet: PetDescriptor) -> PetCharacterIdentity {
        switch id {
        case "hatsune-miku":
            PetCharacterIdentity(id: "miku", simplifiedChineseTitle: "初音", englishTitle: "Miku")
        case "nekopara":
            nekoparaCharacterIdentity(pet)
        case "sakurasou":
            sakurasouCharacterIdentity(pet)
        case "date-a-live":
            dateALiveCharacterIdentity(pet)
        default:
            defaultPetCharacterIdentity(pet)
        }
    }

    private static func localizedIdentity(
        id: String,
        simplifiedChineseTitle: String,
        englishTitle: String
    ) -> PetCharacterIdentity {
        PetCharacterIdentity(
            id: id,
            simplifiedChineseTitle: simplifiedChineseTitle,
            englishTitle: englishTitle
        )
    }

    private func nekoparaCharacterIdentity(_ pet: PetDescriptor) -> PetCharacterIdentity {
        let searchText = Self.normalizedSearchText(for: pet)
        if searchText.contains("chocola") || searchText.contains("巧克力") {
            return Self.localizedIdentity(id: "chocola", simplifiedChineseTitle: "巧克力", englishTitle: "Chocola")
        }
        if searchText.contains("vanilla") || searchText.contains("香子兰") || searchText.contains("香子蘭") {
            return Self.localizedIdentity(id: "vanilla", simplifiedChineseTitle: "香子兰", englishTitle: "Vanilla")
        }
        return defaultPetCharacterIdentity(pet)
    }

    private func sakurasouCharacterIdentity(_ pet: PetDescriptor) -> PetCharacterIdentity {
        let searchText = Self.normalizedSearchText(for: pet)
        if searchText.contains("mashiro")
            || searchText.contains("shiina")
            || searchText.contains("椎名")
            || searchText.contains("真白") {
            return Self.localizedIdentity(id: "mashiro", simplifiedChineseTitle: "椎名真白", englishTitle: "Mashiro")
        }
        if searchText.contains("nanami")
            || searchText.contains("aoyama")
            || searchText.contains("青山")
            || searchText.contains("七海") {
            return Self.localizedIdentity(id: "nanami", simplifiedChineseTitle: "青山七海", englishTitle: "Nanami")
        }
        return defaultPetCharacterIdentity(pet)
    }

    private func defaultPetCharacterIdentity(_ pet: PetDescriptor) -> PetCharacterIdentity {
        let simplifiedChineseName = pet.displayName(language: .simplifiedChinese)
        let englishName = pet.displayName(language: .english)
        let simplifiedChineseTitle = Self.splitDisplayName(simplifiedChineseName)?.character ?? simplifiedChineseName
        let englishTitle = Self.splitDisplayName(englishName)?.character ?? englishName

        return PetCharacterIdentity(
            id: "pet-\(Self.normalizedPetID(simplifiedChineseTitle))",
            simplifiedChineseTitle: simplifiedChineseTitle,
            englishTitle: englishTitle
        )
    }

    private static func defaultSkinTitle(language: AppLanguage) -> String {
        language == .english ? "Default" : "默认"
    }

    private static func knownVariantTitle(for pet: PetDescriptor, language: AppLanguage) -> String? {
        let normalizedID = normalizedPetID(pet.id)
        let searchText = normalizedSearchText(for: pet)
        if normalizedID.contains("school") || searchText.contains("school") || searchText.contains("校服") {
            return language == .english ? "School" : "校服"
        }
        if normalizedID.contains("maid") || searchText.contains("maid") || searchText.contains("女仆") || searchText.contains("女僕") {
            return language == .english ? "Maid" : "女仆"
        }
        if normalizedID.contains("evening") || searchText.contains("evening") || searchText.contains("晚礼服") {
            return language == .english ? "Evening Dress" : "晚礼服"
        }
        return nil
    }

    private func defaultPetSkinTitle(_ pet: PetDescriptor, language: AppLanguage) -> String {
        let displayName = pet.displayName(language: language)
        return Self.splitDisplayName(displayName)?.skin ?? Self.defaultSkinTitle(language: language)
    }

    private static func splitDisplayName(_ value: String) -> (character: String, skin: String)? {
        for separator in [" - ", " — ", " – ", "-", "—", "–", "_"] {
            let pieces = value
                .components(separatedBy: separator)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if pieces.count >= 2 {
                return (
                    character: pieces[0],
                    skin: pieces.dropFirst().joined(separator: separator.trimmingCharacters(in: .whitespaces))
                )
            }
        }
        return nil
    }

    private static func dateALivePetTitle(_ pet: PetDescriptor, language: AppLanguage) -> String {
        switch normalizedPetID(pet.id) {
        case "tohka", "tohka-yatogami", "yatogami-tohka":
            return language == .english ? "Tohka" : "十香"
        case "origami", "origami-tobiichi", "tobiichi-origami":
            return language == .english ? "Origami" : "折纸"
        case "yoshino", "yoshino-himekawa", "himekawa-yoshino":
            return language == .english ? "Yoshino" : "四糸乃"
        case "kurumi", "kurumi-tokisaki", "tokisaki-kurumi":
            return language == .english ? "Fusion Spirit Dress Kurumi" : "融合灵装-狂三"
        case "kurumi-kimono", "kimono-kurumi":
            return language == .english ? "Kimono Kurumi" : "和服-狂三"
        case "kotori", "kotori-itsuka", "itsuka-kotori":
            return language == .english ? "Kotori" : "琴里"
        case "kaguya", "kaguya-yamai", "yamai-kaguya":
            return language == .english ? "Kaguya" : "耶俱矢"
        case "yuzuru", "yuzuru-yamai", "yamai-yuzuru":
            return language == .english ? "Yuzuru" : "夕弦"
        case "miku-izayoi", "izayoi-miku":
            return language == .english ? "Miku" : "美九"
        case "natsumi", "natsumi-kyouno", "kyouno-natsumi":
            return language == .english ? "Natsumi" : "七罪"
        case "nia", "nia-honjo", "nia-honjou", "honjo-nia", "honjou-nia":
            return language == .english ? "Nia" : "二亚"
        case "mukuro", "mukuro-hoshimiya", "hoshimiya-mukuro":
            return language == .english ? "Mukuro" : "六喰"
        case "mio", "mio-takamiya", "takamiya-mio":
            return language == .english ? "Mio" : "澪"
        default:
            return pet.displayName(language: language)
        }
    }

    private func dateALiveCharacterIdentity(_ pet: PetDescriptor) -> PetCharacterIdentity {
        let normalizedID = Self.normalizedPetID(pet.id)
        let searchText = Self.normalizedSearchText(for: pet)

        if ["tohka", "tohka-yatogami", "yatogami-tohka"].contains(normalizedID)
            || searchText.contains("tohka")
            || searchText.contains("yatogami")
            || searchText.contains("十香")
            || searchText.contains("夜刀神") {
            return Self.localizedIdentity(id: "tohka", simplifiedChineseTitle: "十香", englishTitle: "Tohka")
        }
        if ["yoshino", "yoshino-himekawa", "himekawa-yoshino"].contains(normalizedID)
            || searchText.contains("yoshino")
            || searchText.contains("himekawa")
            || searchText.contains("四糸乃") {
            return Self.localizedIdentity(id: "yoshino", simplifiedChineseTitle: "四糸乃", englishTitle: "Yoshino")
        }
        if ["kurumi", "kurumi-tokisaki", "tokisaki-kurumi", "kurumi-kimono", "kimono-kurumi"].contains(normalizedID)
            || searchText.contains("kurumi")
            || searchText.contains("tokisaki")
            || searchText.contains("狂三") {
            return Self.localizedIdentity(id: "kurumi", simplifiedChineseTitle: "狂三", englishTitle: "Kurumi")
        }
        if ["kotori", "kotori-itsuka", "itsuka-kotori"].contains(normalizedID)
            || searchText.contains("kotori")
            || searchText.contains("琴里") {
            return Self.localizedIdentity(id: "kotori", simplifiedChineseTitle: "琴里", englishTitle: "Kotori")
        }
        if ["kaguya", "kaguya-yamai", "yamai-kaguya"].contains(normalizedID)
            || searchText.contains("kaguya")
            || searchText.contains("耶俱矢")
            || searchText.contains("耶倶矢") {
            return Self.localizedIdentity(id: "kaguya", simplifiedChineseTitle: "耶俱矢", englishTitle: "Kaguya")
        }
        if ["yuzuru", "yuzuru-yamai", "yamai-yuzuru"].contains(normalizedID)
            || searchText.contains("yuzuru")
            || searchText.contains("夕弦") {
            return Self.localizedIdentity(id: "yuzuru", simplifiedChineseTitle: "夕弦", englishTitle: "Yuzuru")
        }
        if ["miku-izayoi", "izayoi-miku"].contains(normalizedID)
            || searchText.contains("izayoi")
            || searchText.contains("诱宵")
            || searchText.contains("誘宵")
            || searchText.contains("美九") {
            return Self.localizedIdentity(id: "miku-izayoi", simplifiedChineseTitle: "美九", englishTitle: "Miku")
        }
        if ["natsumi", "natsumi-kyouno", "kyouno-natsumi"].contains(normalizedID)
            || searchText.contains("natsumi")
            || searchText.contains("七罪") {
            return Self.localizedIdentity(id: "natsumi", simplifiedChineseTitle: "七罪", englishTitle: "Natsumi")
        }
        if ["origami", "origami-tobiichi", "tobiichi-origami"].contains(normalizedID)
            || searchText.contains("origami")
            || searchText.contains("tobiichi")
            || searchText.contains("折纸")
            || searchText.contains("折紙") {
            return Self.localizedIdentity(id: "origami", simplifiedChineseTitle: "折纸", englishTitle: "Origami")
        }
        if ["nia", "nia-honjo", "nia-honjou", "honjo-nia", "honjou-nia"].contains(normalizedID)
            || searchText.contains("nia")
            || searchText.contains("honjo")
            || searchText.contains("honjou")
            || searchText.contains("二亚")
            || searchText.contains("二亜") {
            return Self.localizedIdentity(id: "nia", simplifiedChineseTitle: "二亚", englishTitle: "Nia")
        }
        if ["mukuro", "mukuro-hoshimiya", "hoshimiya-mukuro"].contains(normalizedID)
            || searchText.contains("mukuro")
            || searchText.contains("hoshimiya")
            || searchText.contains("六喰") {
            return Self.localizedIdentity(id: "mukuro", simplifiedChineseTitle: "六喰", englishTitle: "Mukuro")
        }
        if ["mio", "mio-takamiya", "takamiya-mio"].contains(normalizedID)
            || searchText.contains("mio")
            || searchText.contains("takamiya")
            || searchText.contains("澪") {
            return Self.localizedIdentity(id: "mio", simplifiedChineseTitle: "澪", englishTitle: "Mio")
        }

        return defaultPetCharacterIdentity(pet)
    }

    private static func dateALivePetSkinTitle(_ pet: PetDescriptor, language: AppLanguage) -> String {
        let normalizedID = normalizedPetID(pet.id)
        let searchText = normalizedSearchText(for: pet)

        if ["kurumi", "kurumi-tokisaki", "tokisaki-kurumi"].contains(normalizedID)
            || searchText.contains("fusion")
            || searchText.contains("spirit dress")
            || searchText.contains("融合灵装") {
            return language == .english ? "Fusion Spirit Dress" : "融合灵装"
        }
        if ["kurumi-kimono", "kimono-kurumi"].contains(normalizedID)
            || searchText.contains("kimono")
            || searchText.contains("和服") {
            return language == .english ? "Kimono" : "和服"
        }
        if normalizedID.contains("school") || searchText.contains("school") || searchText.contains("校服") {
            return language == .english ? "School" : "校服"
        }
        if let splitName = splitDisplayName(pet.displayName(language: language)) {
            return splitName.character
        }
        return defaultSkinTitle(language: language)
    }

    private static func normalizedPetID(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: nil)
            .lowercased()
            .replacingOccurrences(of: "_", with: "-")
            .replacingOccurrences(of: " ", with: "-")
    }

    private static func normalizedSearchText(for pet: PetDescriptor) -> String {
        ([pet.id, pet.displayName, pet.description] + pet.localizedDisplayNames.values)
            .joined(separator: " ")
            .folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: nil)
            .lowercased()
            .replacingOccurrences(of: "_", with: "-")
    }
}

struct PetCharacterDescriptor: Identifiable, Equatable, Sendable {
    var id: String
    var simplifiedChineseTitle: String
    var englishTitle: String
    var pets: [PetDescriptor]

    func title(language: AppLanguage) -> String {
        language == .english ? englishTitle : simplifiedChineseTitle
    }
}

private struct PetCatalogDefinition: Decodable {
    var id: String
    var displayName: String?
    var localizedDisplayNames: [String: String]?
    var description: String?
    var spritesheetPath: String?
    var modelPath: String?
    var group: PetCatalogGroupDefinition?
}

private struct PetCatalogGroupDefinition: Decodable {
    var id: String
    var displayName: String?
    var localizedDisplayNames: [String: String]?

    enum CodingKeys: String, CodingKey {
        case id
        case displayName
        case localizedDisplayNames
        case localizedTitles
    }

    init(from decoder: Decoder) throws {
        if let container = try? decoder.singleValueContainer(),
           let id = try? container.decode(String.self) {
            self.id = id
            displayName = nil
            localizedDisplayNames = nil
            return
        }

        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName)
        localizedDisplayNames = try container.decodeIfPresent([String: String].self, forKey: .localizedDisplayNames)
            ?? container.decodeIfPresent([String: String].self, forKey: .localizedTitles)
    }
}

enum PetCatalog {
    static let defaultRootDirectory = FileManager.default
        .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appending(path: "OllamaMenuAssistant/Pets", directoryHint: .isDirectory)

    static let defaultPetID = "miku"

    private enum BuiltInGroup: String, CaseIterable {
        case hatsuneMiku = "hatsune-miku"
        case nekopara
        case sakurasou
        case dateALive = "date-a-live"

        var sortRank: Int {
            switch self {
            case .hatsuneMiku: 0
            case .nekopara: 1
            case .sakurasou: 2
            case .dateALive: 3
            }
        }

        var simplifiedChineseTitle: String {
            switch self {
            case .hatsuneMiku: "初音未来"
            case .nekopara: "猫娘乐园"
            case .sakurasou: "樱花庄的宠物女孩"
            case .dateALive: "约会大作战"
            }
        }

        var englishTitle: String {
            switch self {
            case .hatsuneMiku: "Hatsune Miku"
            case .nekopara: "Nekopara"
            case .sakurasou: "The Pet Girl of Sakurasou"
            case .dateALive: "Date A Live"
            }
        }

        var localizedTitles: [String: String] {
            [
                "zh-Hans": simplifiedChineseTitle,
                "en": englishTitle,
            ]
        }

        func petSortRank(_ pet: PetDescriptor) -> Int {
            switch self {
            case .hatsuneMiku:
                Self.hatsuneMikuSortRank(for: pet)
            case .nekopara:
                Self.nekoparaSortRank(for: pet)
            case .sakurasou:
                Self.sakurasouSortRank(for: pet)
            case .dateALive:
                Self.dateALiveSortRank(for: pet)
            }
        }

        func petVariantSortRank(_ pet: PetDescriptor) -> Int {
            switch self {
            case .hatsuneMiku:
                Self.hatsuneMikuVariantSortRank(for: pet)
            case .nekopara:
                Self.nekoparaVariantSortRank(for: pet)
            case .sakurasou:
                Self.sakurasouVariantSortRank(for: pet)
            case .dateALive:
                Self.dateALiveVariantSortRank(for: pet)
            }
        }

        init?(alias: String?) {
            let normalized = PetCatalog.normalizedGroupID(alias)
            guard !normalized.isEmpty else {
                return nil
            }
            switch normalized {
            case "hatsune-miku", "miku", "初音", "初音未来":
                self = .hatsuneMiku
            case "nekopara", "猫娘乐园":
                self = .nekopara
            case "sakurasou", "sakura-sou", "sakura-sou-no-pet-na-kanojo", "the-pet-girl-of-sakurasou", "樱花庄", "樱花庄的宠物女孩":
                self = .sakurasou
            case "date-a-live", "datealive", "dal", "约会大作战", "約會大作戰", "约战", "約戰", "デート・ア・ライブ", "デートアライブ":
                self = .dateALive
            default:
                return nil
            }
        }

        private static func hatsuneMikuSortRank(for pet: PetDescriptor) -> Int {
            let searchText = PetCatalog.normalizedSearchText(for: pet)
            if searchText.contains("miku")
                || searchText.contains("hatsune")
                || searchText.contains("初音") {
                return 0
            }
            return Int.max
        }

        private static func hatsuneMikuVariantSortRank(for pet: PetDescriptor) -> Int {
            let normalizedID = PetCatalog.normalizedIdentifier(pet.id)
            let searchText = PetCatalog.normalizedSearchText(for: pet)
            if normalizedID == "miku" {
                return 0
            }
            if searchText.contains("snow") || searchText.contains("冬雪") {
                return 10
            }
            if searchText.contains("sakura") || searchText.contains("樱花") || searchText.contains("櫻花") {
                return 20
            }
            return 100
        }

        private static func nekoparaSortRank(for pet: PetDescriptor) -> Int {
            let searchText = PetCatalog.normalizedSearchText(for: pet)
            if searchText.contains("chocola") || searchText.contains("巧克力") {
                return 0
            }
            if searchText.contains("vanilla") || searchText.contains("香子兰") || searchText.contains("香子蘭") {
                return 10
            }
            return Int.max
        }

        private static func nekoparaVariantSortRank(for pet: PetDescriptor) -> Int {
            let searchText = PetCatalog.normalizedSearchText(for: pet)
            if searchText.contains("school") || searchText.contains("校服") {
                return 10
            }
            if searchText.contains("maid") || searchText.contains("女仆") || searchText.contains("女僕") {
                return 20
            }
            return 0
        }

        private static func sakurasouSortRank(for pet: PetDescriptor) -> Int {
            let searchText = PetCatalog.normalizedSearchText(for: pet)
            if searchText.contains("mashiro")
                || searchText.contains("shiina")
                || searchText.contains("椎名")
                || searchText.contains("真白") {
                return 0
            }
            if searchText.contains("nanami")
                || searchText.contains("aoyama")
                || searchText.contains("青山")
                || searchText.contains("七海") {
                return 10
            }
            return Int.max
        }

        private static func sakurasouVariantSortRank(for pet: PetDescriptor) -> Int {
            let normalizedID = PetCatalog.normalizedIdentifier(pet.id)
            let searchText = PetCatalog.normalizedSearchText(for: pet)
            if normalizedID == "mashiro" {
                return 0
            }
            if searchText.contains("school") || searchText.contains("校服") {
                return 10
            }
            if searchText.contains("evening") || searchText.contains("晚礼服") {
                return 20
            }
            return 100
        }

        private static func dateALiveSortRank(for pet: PetDescriptor) -> Int {
            let searchText = PetCatalog.normalizedSearchText(for: pet)
            switch PetCatalog.normalizedIdentifier(pet.id) {
            case "tohka", "tohka-yatogami", "yatogami-tohka":
                return 0
            case "yoshino", "yoshino-himekawa", "himekawa-yoshino":
                return 10
            case "kurumi", "kurumi-tokisaki", "tokisaki-kurumi", "kurumi-kimono", "kimono-kurumi":
                return 20
            case "kotori", "kotori-itsuka", "itsuka-kotori":
                return 30
            case "kaguya", "kaguya-yamai", "yamai-kaguya":
                return 40
            case "yuzuru", "yuzuru-yamai", "yamai-yuzuru":
                return 50
            case "miku-izayoi", "izayoi-miku":
                return 60
            case "natsumi", "natsumi-kyouno", "kyouno-natsumi":
                return 70
            case "origami", "origami-tobiichi", "tobiichi-origami":
                return 80
            case "nia", "nia-honjo", "nia-honjou", "honjo-nia", "honjou-nia":
                return 90
            case "mukuro", "mukuro-hoshimiya", "hoshimiya-mukuro":
                return 100
            case "mio", "mio-takamiya", "takamiya-mio":
                return 110
            default:
                if searchText.contains("tohka") || searchText.contains("yatogami") || searchText.contains("十香") || searchText.contains("夜刀神") {
                    return 0
                }
                if searchText.contains("yoshino") || searchText.contains("himekawa") || searchText.contains("四糸乃") {
                    return 10
                }
                if searchText.contains("kurumi") || searchText.contains("tokisaki") || searchText.contains("狂三") {
                    return 20
                }
                if searchText.contains("kotori") || searchText.contains("itsuka") || searchText.contains("琴里") {
                    return 30
                }
                if searchText.contains("kaguya") || searchText.contains("耶俱矢") || searchText.contains("耶倶矢") {
                    return 40
                }
                if searchText.contains("yuzuru") || searchText.contains("夕弦") {
                    return 50
                }
                if searchText.contains("miku-izayoi") || searchText.contains("izayoi") || searchText.contains("诱宵") || searchText.contains("誘宵") || searchText.contains("美九") {
                    return 60
                }
                if searchText.contains("natsumi") || searchText.contains("七罪") {
                    return 70
                }
                if searchText.contains("origami") || searchText.contains("tobiichi") || searchText.contains("折纸") || searchText.contains("折紙") {
                    return 80
                }
                if searchText.contains("nia") || searchText.contains("honjo") || searchText.contains("honjou") || searchText.contains("二亚") || searchText.contains("二亜") {
                    return 90
                }
                if searchText.contains("mukuro") || searchText.contains("hoshimiya") || searchText.contains("六喰") {
                    return 100
                }
                if searchText.contains("mio") || searchText.contains("takamiya") || searchText.contains("澪") {
                    return 110
                }
                return Int.max
            }
        }

        private static func dateALiveVariantSortRank(for pet: PetDescriptor) -> Int {
            let normalizedID = PetCatalog.normalizedIdentifier(pet.id)
            let searchText = PetCatalog.normalizedSearchText(for: pet)
            if ["kurumi-kimono", "kimono-kurumi"].contains(normalizedID)
                || searchText.contains("kimono")
                || searchText.contains("和服") {
                return 10
            }
            if [
                "tohka",
                "tohka-yatogami",
                "yatogami-tohka",
                "yoshino",
                "yoshino-himekawa",
                "himekawa-yoshino",
                "kurumi",
                "kurumi-tokisaki",
                "tokisaki-kurumi",
                "kotori",
                "kotori-itsuka",
                "itsuka-kotori",
                "kaguya",
                "kaguya-yamai",
                "yamai-kaguya",
                "yuzuru",
                "yuzuru-yamai",
                "yamai-yuzuru",
                "miku-izayoi",
                "izayoi-miku",
                "natsumi",
                "natsumi-kyouno",
                "kyouno-natsumi",
                "origami",
                "origami-tobiichi",
                "tobiichi-origami",
                "nia",
                "nia-honjo",
                "nia-honjou",
                "honjo-nia",
                "honjou-nia",
                "mukuro",
                "mukuro-hoshimiya",
                "hoshimiya-mukuro",
                "mio",
                "mio-takamiya",
                "takamiya-mio",
            ].contains(normalizedID) || searchText.contains("融合灵装") {
                return 0
            }
            if searchText.contains("school") || searchText.contains("校服") {
                return 20
            }
            return 100
        }
    }

    private struct DateALivePetPlan {
        var id: String
        var simplifiedChineseName: String
        var englishName: String
        var codeName: String
    }

    private static let dateALivePetPlans: [DateALivePetPlan] = [
        DateALivePetPlan(id: "tohka-yatogami", simplifiedChineseName: "夜刀神十香", englishName: "Tohka Yatogami", codeName: "PRINCESS"),
        DateALivePetPlan(id: "yoshino", simplifiedChineseName: "四糸乃", englishName: "Yoshino", codeName: "HERMIT"),
        DateALivePetPlan(id: "kurumi-tokisaki", simplifiedChineseName: "融合灵装-狂三", englishName: "Fusion Spirit Dress Kurumi", codeName: "NIGHTMARE"),
        DateALivePetPlan(id: "kurumi-kimono", simplifiedChineseName: "和服-狂三", englishName: "Kimono Kurumi", codeName: "NIGHTMARE"),
        DateALivePetPlan(id: "kotori-itsuka", simplifiedChineseName: "五河琴里", englishName: "Kotori Itsuka", codeName: "EFREET"),
        DateALivePetPlan(id: "kaguya-yamai", simplifiedChineseName: "八舞耶俱矢", englishName: "Kaguya Yamai", codeName: "BERSERK"),
        DateALivePetPlan(id: "yuzuru-yamai", simplifiedChineseName: "八舞夕弦", englishName: "Yuzuru Yamai", codeName: "BERSERK"),
        DateALivePetPlan(id: "miku-izayoi", simplifiedChineseName: "诱宵美九", englishName: "Miku Izayoi", codeName: "DIVA"),
        DateALivePetPlan(id: "natsumi", simplifiedChineseName: "七罪", englishName: "Natsumi", codeName: "WITCH"),
        DateALivePetPlan(id: "origami-tobiichi", simplifiedChineseName: "鸢一折纸", englishName: "Origami Tobiichi", codeName: "ANGEL"),
        DateALivePetPlan(id: "nia-honjo", simplifiedChineseName: "本条二亚", englishName: "Nia Honjo", codeName: "SISTER"),
        DateALivePetPlan(id: "mukuro-hoshimiya", simplifiedChineseName: "星宫六喰", englishName: "Mukuro Hoshimiya", codeName: "ZODIAC"),
        DateALivePetPlan(id: "mio-takamiya", simplifiedChineseName: "崇宫澪", englishName: "Mio Takamiya", codeName: "DEUS"),
    ]

    static func loadAvailablePets(
        rootURL: URL = defaultRootDirectory,
        fileManager: FileManager = .default
    ) -> [PetDescriptor] {
        guard let directories = try? fileManager.contentsOfDirectory(
            at: rootURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        return directories
            .compactMap { directory -> PetDescriptor? in
                guard isDirectory(directory, fileManager: fileManager) else {
                    return nil
                }
                return loadPet(from: directory)
            }
            .sorted { lhs, rhs in
                lhs.displayName.localizedStandardCompare(rhs.displayName) == .orderedAscending
            }
    }

    static func groupedPets(_ pets: [PetDescriptor], includeEmptyBuiltInGroups: Bool = false) -> [PetGroupDescriptor] {
        var grouped: [String: [PetDescriptor]] = [:]
        var localizedTitlesByGroup: [String: [String: String]] = [:]

        for pet in pets {
            guard let groupID = groupID(for: pet) else {
                continue
            }

            grouped[groupID, default: []].append(pet)
            localizedTitlesByGroup[groupID, default: [:]].merge(pet.groupLocalizedTitles) { current, incoming in
                current.isEmpty ? incoming : current
            }
        }

        if includeEmptyBuiltInGroups {
            for group in BuiltInGroup.allCases {
                grouped[group.rawValue, default: []] = grouped[group.rawValue, default: []]
            }
        }

        return grouped.keys.sorted { lhs, rhs in
            groupSortPrecedes(
                lhs,
                rhs,
                localizedTitlesByGroup: localizedTitlesByGroup
            )
        }.map { groupID in
            let builtInTitles = BuiltInGroup(alias: groupID)?.localizedTitles ?? [:]
            let localizedTitles = builtInTitles.merging(localizedTitlesByGroup[groupID, default: [:]]) { _, incoming in incoming }
            return PetGroupDescriptor(
                id: groupID,
                simplifiedChineseTitle: localizedTitle(
                    for: .simplifiedChinese,
                    localizedTitles: localizedTitles,
                    fallback: groupID
                ),
                englishTitle: localizedTitle(
                    for: .english,
                    localizedTitles: localizedTitles,
                    fallback: localizedTitle(
                        for: .simplifiedChinese,
                        localizedTitles: localizedTitles,
                        fallback: groupID
                    )
                ),
                pets: sortedPets(grouped[groupID, default: []], in: groupID)
            )
        }
    }

    static func settingsGroups(
        availablePets: [PetDescriptor],
        rootURL: URL = defaultRootDirectory
    ) -> [PetGroupDescriptor] {
        let pets = availablePets + missingDateALivePetPlans(
            installedPets: availablePets,
            rootURL: rootURL
        )
        return groupedPets(pets, includeEmptyBuiltInGroups: !availablePets.isEmpty)
    }

    static func petDirectory(
        for selection: PetSelection,
        availablePets: [PetDescriptor],
        rootURL: URL = defaultRootDirectory
    ) -> URL {
        if let pet = availablePets.first(where: { $0.id == selection.id }) {
            return pet.rootURL
        }

        return rootURL.appending(path: selection.id, directoryHint: .isDirectory)
    }

    static func loadPet(from rootURL: URL) -> PetDescriptor? {
        let petJSONURL = rootURL.appending(path: "pet.json")
        guard let data = try? Data(contentsOf: petJSONURL),
              let definition = try? JSONDecoder().decode(PetCatalogDefinition.self, from: data)
        else {
            return nil
        }

        let id = definition.id.trimmingCharacters(in: .whitespacesAndNewlines)
        let localizedDisplayNames = (definition.localizedDisplayNames ?? [:])
            .reduce(into: [String: String]()) { result, entry in
                let key = entry.key.trimmingCharacters(in: .whitespacesAndNewlines)
                let value = entry.value.trimmingCharacters(in: .whitespacesAndNewlines)
                if !key.isEmpty && !value.isEmpty {
                    result[key] = value
                }
            }
        let displayName = PetDescriptor.preferredDisplayName(
            explicitDisplayName: definition.displayName,
            localizedDisplayNames: localizedDisplayNames
        ) ?? ""
        let spritesheetPath = definition.spritesheetPath?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let modelPath = definition.modelPath?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let groupMetadata = groupMetadata(from: definition.group)

        guard !id.isEmpty, !displayName.isEmpty, (!spritesheetPath.isEmpty || !modelPath.isEmpty) else {
            return nil
        }

        return PetDescriptor(
            id: id,
            displayName: displayName,
            localizedDisplayNames: localizedDisplayNames,
            description: definition.description?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
            spritesheetPath: spritesheetPath,
            modelPath: modelPath.isEmpty ? nil : modelPath,
            groupID: groupMetadata?.id,
            groupLocalizedTitles: groupMetadata?.localizedTitles ?? [:],
            rootURL: rootURL
        )
    }

    private struct GroupMetadata {
        var id: String
        var localizedTitles: [String: String]
    }

    private static func groupMetadata(from definition: PetCatalogGroupDefinition?) -> GroupMetadata? {
        guard let definition else {
            return nil
        }

        let builtInGroup = BuiltInGroup(alias: definition.id)
        let groupID = builtInGroup?.rawValue ?? normalizedGroupID(definition.id)
        guard !groupID.isEmpty else {
            return nil
        }

        var localizedTitles = builtInGroup?.localizedTitles ?? [:]
        localizedTitles.merge(
            normalizedLocalizedTitles(
                displayName: definition.displayName,
                localizedDisplayNames: definition.localizedDisplayNames
            )
        ) { _, incoming in incoming }

        return GroupMetadata(id: groupID, localizedTitles: localizedTitles)
    }

    private static func normalizedLocalizedTitles(
        displayName: String?,
        localizedDisplayNames: [String: String]?
    ) -> [String: String] {
        var result: [String: String] = [:]
        if let displayName = displayName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !displayName.isEmpty {
            result["default"] = displayName
        }

        for entry in localizedDisplayNames ?? [:] {
            let key = entry.key.trimmingCharacters(in: .whitespacesAndNewlines)
            let value = entry.value.trimmingCharacters(in: .whitespacesAndNewlines)
            if !key.isEmpty && !value.isEmpty {
                result[key] = value
            }
        }

        return result
    }

    private static func normalizedGroupID(_ value: String?) -> String {
        normalizedIdentifier(value ?? "")
    }

    private static func groupSortPrecedes(
        _ lhs: String,
        _ rhs: String,
        localizedTitlesByGroup: [String: [String: String]]
    ) -> Bool {
        let lhsRank = BuiltInGroup(alias: lhs)?.sortRank ?? Int.max
        let rhsRank = BuiltInGroup(alias: rhs)?.sortRank ?? Int.max
        if lhsRank != rhsRank {
            return lhsRank < rhsRank
        }

        let lhsTitle = localizedTitle(
            for: .simplifiedChinese,
            localizedTitles: localizedTitlesByGroup[lhs, default: [:]],
            fallback: lhs
        )
        let rhsTitle = localizedTitle(
            for: .simplifiedChinese,
            localizedTitles: localizedTitlesByGroup[rhs, default: [:]],
            fallback: rhs
        )
        return lhsTitle.localizedStandardCompare(rhsTitle) == .orderedAscending
    }

    private static func localizedTitle(
        for language: AppLanguage,
        localizedTitles: [String: String],
        fallback: String
    ) -> String {
        let keys: [String] = switch language {
        case .simplifiedChinese:
            ["zh-Hans", "zh_CN", "zh", "simplifiedChinese", "chinese"]
        case .english:
            ["en", "en-US", "english"]
        }

        for key in keys + ["default"] {
            if let value = localizedTitles[key]?.trimmingCharacters(in: .whitespacesAndNewlines),
               !value.isEmpty {
                return value
            }
        }

        return fallback
    }

    private static func sortedPets(_ pets: [PetDescriptor], in groupID: String) -> [PetDescriptor] {
        guard let builtInGroup = BuiltInGroup(alias: groupID) else {
            return pets
        }
        let rankedPets = pets.map { pet in
            (pet, builtInGroup.petSortRank(pet))
        }
        guard rankedPets.contains(where: { $0.1 != Int.max }) else {
            return pets
        }

        return rankedPets.sorted { lhs, rhs in
            let lhsRank = lhs.1
            let rhsRank = rhs.1
            if lhsRank != rhsRank {
                return lhsRank < rhsRank
            }

            let lhsVariantRank = builtInGroup.petVariantSortRank(lhs.0)
            let rhsVariantRank = builtInGroup.petVariantSortRank(rhs.0)
            if lhsVariantRank != rhsVariantRank {
                return lhsVariantRank < rhsVariantRank
            }

            return lhs.0.displayName.localizedStandardCompare(rhs.0.displayName) == .orderedAscending
        }.map(\.0)
    }

    private static func missingDateALivePetPlans(
        installedPets: [PetDescriptor],
        rootURL: URL
    ) -> [PetDescriptor] {
        let installedDateALiveIDs = Set(
            installedPets.compactMap { pet -> String? in
                guard groupID(for: pet) == BuiltInGroup.dateALive.rawValue else {
                    return nil
                }
                return normalizedIdentifier(pet.id)
            }
        )

        return dateALivePetPlans.compactMap { plan in
            guard installedDateALiveIDs.isDisjoint(with: dateALiveEquivalentIDs(for: plan.id)) else {
                return nil
            }

            return PetDescriptor(
                id: plan.id,
                displayName: plan.simplifiedChineseName,
                localizedDisplayNames: [
                    "zh-Hans": plan.simplifiedChineseName,
                    "en": plan.englishName,
                ],
                description: "Date A Live pet plan; slot \(plan.codeName).",
                spritesheetPath: "spritesheet.webp",
                groupID: BuiltInGroup.dateALive.rawValue,
                groupLocalizedTitles: BuiltInGroup.dateALive.localizedTitles,
                isInstalled: false,
                rootURL: rootURL.appending(path: plan.id, directoryHint: .isDirectory)
            )
        }
    }

    private static func dateALiveEquivalentIDs(for id: String) -> Set<String> {
        switch normalizedIdentifier(id) {
        case "tohka", "tohka-yatogami", "yatogami-tohka":
            ["tohka", "tohka-yatogami", "yatogami-tohka"]
        case "origami", "origami-tobiichi", "tobiichi-origami":
            ["origami", "origami-tobiichi", "tobiichi-origami"]
        case "yoshino", "yoshino-himekawa", "himekawa-yoshino":
            ["yoshino", "yoshino-himekawa", "himekawa-yoshino"]
        case "kurumi", "kurumi-tokisaki", "tokisaki-kurumi":
            ["kurumi", "kurumi-tokisaki", "tokisaki-kurumi"]
        case "kurumi-kimono", "kimono-kurumi":
            ["kurumi-kimono", "kimono-kurumi"]
        case "kotori", "kotori-itsuka", "itsuka-kotori":
            ["kotori", "kotori-itsuka", "itsuka-kotori"]
        case "kaguya", "kaguya-yamai", "yamai-kaguya":
            ["kaguya", "kaguya-yamai", "yamai-kaguya"]
        case "yuzuru", "yuzuru-yamai", "yamai-yuzuru":
            ["yuzuru", "yuzuru-yamai", "yamai-yuzuru"]
        case "miku-izayoi", "izayoi-miku":
            ["miku-izayoi", "izayoi-miku"]
        case "natsumi", "natsumi-kyouno", "kyouno-natsumi":
            ["natsumi", "natsumi-kyouno", "kyouno-natsumi"]
        case "nia", "nia-honjo", "nia-honjou", "honjo-nia", "honjou-nia":
            ["nia", "nia-honjo", "nia-honjou", "honjo-nia", "honjou-nia"]
        case "mukuro", "mukuro-hoshimiya", "hoshimiya-mukuro":
            ["mukuro", "mukuro-hoshimiya", "hoshimiya-mukuro"]
        case "mio", "mio-takamiya", "takamiya-mio":
            ["mio", "mio-takamiya", "takamiya-mio"]
        default:
            [normalizedIdentifier(id)]
        }
    }

    private static func normalizedIdentifier(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: nil)
            .lowercased()
            .replacingOccurrences(of: "_", with: "-")
            .replacingOccurrences(of: " ", with: "-")
    }

    private static func normalizedSearchText(for pet: PetDescriptor) -> String {
        ([pet.id, pet.displayName, pet.description] + pet.localizedDisplayNames.values)
            .joined(separator: " ")
            .folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: nil)
            .lowercased()
            .replacingOccurrences(of: "_", with: "-")
    }

    private static func groupID(for pet: PetDescriptor) -> String? {
        if let explicitGroupID = pet.groupID?.trimmingCharacters(in: .whitespacesAndNewlines),
           !explicitGroupID.isEmpty {
            return explicitGroupID
        }

        let searchText = normalizedSearchText(for: pet)

        if searchText.contains("date a live")
            || searchText.contains("date-a-live")
            || searchText.contains("datealive")
            || searchText.contains("约会大作战")
            || searchText.contains("約會大作戰")
            || searchText.contains("约战")
            || searchText.contains("約戰")
            || searchText.contains("デート・ア・ライブ")
            || searchText.contains("デートアライブ")
            || searchText.contains("tohka")
            || searchText.contains("yatogami")
            || searchText.contains("夜刀神")
            || searchText.contains("十香")
            || searchText.contains("origami")
            || searchText.contains("tobiichi")
            || searchText.contains("鸢一")
            || searchText.contains("鳶一")
            || searchText.contains("折纸")
            || searchText.contains("折紙")
            || searchText.contains("yoshino")
            || searchText.contains("himekawa")
            || searchText.contains("四糸乃")
            || searchText.contains("四系乃")
            || searchText.contains("kurumi")
            || searchText.contains("tokisaki")
            || searchText.contains("时崎")
            || searchText.contains("時崎")
            || searchText.contains("狂三")
            || searchText.contains("kotori")
            || searchText.contains("五河琴里")
            || searchText.contains("琴里")
            || searchText.contains("kaguya")
            || searchText.contains("yamai")
            || searchText.contains("八舞")
            || searchText.contains("耶俱矢")
            || searchText.contains("耶倶矢")
            || searchText.contains("yuzuru")
            || searchText.contains("夕弦")
            || searchText.contains("izayoi")
            || searchText.contains("诱宵")
            || searchText.contains("誘宵")
            || searchText.contains("美九")
            || searchText.contains("natsumi")
            || searchText.contains("kyouno")
            || searchText.contains("七罪")
            || searchText.contains("nia")
            || searchText.contains("honjo")
            || searchText.contains("honjou")
            || searchText.contains("本条二亚")
            || searchText.contains("本条二亜")
            || searchText.contains("二亚")
            || searchText.contains("二亜")
            || searchText.contains("mukuro")
            || searchText.contains("hoshimiya")
            || searchText.contains("星宫")
            || searchText.contains("星宮")
            || searchText.contains("六喰")
            || searchText.contains("mio")
            || searchText.contains("takamiya")
            || searchText.contains("崇宫")
            || searchText.contains("崇宮")
            || searchText.contains("澪") {
            return BuiltInGroup.dateALive.rawValue
        }

        if searchText.contains("miku")
            || searchText.contains("hatsune")
            || searchText.contains("初音") {
            return BuiltInGroup.hatsuneMiku.rawValue
        }

        if searchText.contains("nekopara")
            || searchText.contains("猫娘乐园")
            || searchText.contains("巧克力")
            || searchText.contains("香子兰")
            || searchText.contains("chocola")
            || searchText.contains("vanilla") {
            return BuiltInGroup.nekopara.rawValue
        }

        if searchText.contains("sakurasou")
            || searchText.contains("sakura-sou")
            || searchText.contains("sakura sou")
            || searchText.contains("樱花庄")
            || searchText.contains("櫻花莊")
            || searchText.contains("椎名")
            || searchText.contains("真白")
            || searchText.contains("shiina")
            || searchText.contains("mashiro")
            || searchText.contains("青山七海")
            || searchText.contains("aoyama nanami") {
            return BuiltInGroup.sakurasou.rawValue
        }

        return nil
    }

    private static func isDirectory(_ url: URL, fileManager: FileManager) -> Bool {
        var isDirectory: ObjCBool = false
        return fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory) && isDirectory.boolValue
    }
}

extension AppModel {
    func refreshPetCatalog() {
        availablePets = PetCatalog.loadAvailablePets(rootURL: petRootURL)
    }

    var petGroups: [PetGroupDescriptor] {
        PetCatalog.settingsGroups(availablePets: availablePets, rootURL: petRootURL)
    }

    var selectedPetDescriptor: PetDescriptor? {
        availablePets.first { $0.id == petSelection.id }
    }

    var selectedPetDescriptors: [PetDescriptor] {
        petSelections.compactMap { selection in
            availablePets.first { $0.id == selection.id }
        }
    }

    func isPetSelected(_ pet: PetDescriptor) -> Bool {
        petSelections.contains(PetSelection(id: pet.id))
    }

    func petDirectoryURL(for selection: PetSelection) -> URL {
        PetCatalog.petDirectory(for: selection, availablePets: availablePets, rootURL: petRootURL)
    }

    func petOptionTitles(language: AppLanguage) -> [String] {
        var titles = availablePets.map { $0.displayName(language: language) }
        let noneTitle = PetSelection.none.title(language: language, pets: availablePets)
        titles.append(noneTitle)
        return titles
    }

    func petSelectionTitle(language: AppLanguage) -> String {
        petSelection.title(language: language, pets: availablePets)
    }

    func petSelectionSummary(language: AppLanguage) -> String {
        guard !petSelections.isEmpty else {
            return PetSelection.none.title(language: language, pets: availablePets)
        }

        return petSelections
            .map { $0.title(language: language, pets: availablePets) }
            .joined(separator: " + ")
    }

    func petSelection(matching title: String, language: AppLanguage) -> PetSelection {
        PetSelection.selection(matching: title, language: language, pets: availablePets)
    }
}
