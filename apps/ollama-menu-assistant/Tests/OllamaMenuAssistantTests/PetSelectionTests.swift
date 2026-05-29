import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func petSelectionParsesLegacyLocalizedValues() {
    #expect(PetSelection(storedValue: nil) == .miku)
    #expect(PetSelection(storedValue: "miku") == .miku)
    #expect(PetSelection(storedValue: "Codex") == .miku)
    #expect(PetSelection(storedValue: "经典") == .miku)
    #expect(PetSelection(storedValue: "Classic") == .miku)
    #expect(PetSelection(storedValue: "sakura-miku") == PetSelection(id: "miku-sakura"))
    #expect(PetSelection(storedValue: "snow-miku") == PetSelection(id: "miku-snow"))
    #expect(PetSelection(storedValue: "樱花初音") == PetSelection(id: "miku-sakura"))
    #expect(PetSelection(storedValue: "冬雪初音") == PetSelection(id: "miku-snow"))
    #expect(PetSelection(storedValue: "无") == .none)
    #expect(PetSelection(storedValue: "None") == .none)
}

@Test
func petSelectionUsesStableStorageValuesAndLocalizedTitles() {
    #expect(PetSelection.miku.storageValue == "miku")
    #expect(PetSelection.none.storageValue == "none")
    #expect(PetSelection(id: "teto").storageValue == "teto")

    #expect(PetSelection.miku.title(language: .simplifiedChinese) == "初音")
    #expect(PetSelection.miku.title(language: .english) == "Miku")
    #expect(PetSelection.none.title(language: .simplifiedChinese) == "无")
    #expect(PetSelection.none.title(language: .english) == "None")
}

@Test
func petRosterParsesLegacyValuesAndStoresLists() {
    #expect(PetRoster(storedValue: nil, legacyStoredValue: nil).selections == [.miku])
    #expect(PetRoster(storedValue: nil, legacyStoredValue: "Codex").selections == [.miku])
    #expect(PetRoster(storedValue: "none", legacyStoredValue: "miku").selections == [])
    #expect(
        PetRoster(storedValue: "chocola, vanilla, miku", legacyStoredValue: nil).selections == [
            PetSelection(id: "chocola"),
            PetSelection(id: "vanilla"),
            .miku,
        ]
    )
    #expect(PetRoster(storedValue: "chocola,vanilla", legacyStoredValue: nil).storageValue == "chocola,vanilla")
    #expect(PetRoster(storedValue: "none", legacyStoredValue: nil).storageValue == "none")
}

@Test
func petRosterDeduplicatesAndLimitsToThreePets() {
    let roster = PetRoster(selections: [
        PetSelection(id: "chocola"),
        PetSelection(id: "vanilla"),
        PetSelection(id: "chocola"),
        PetSelection(id: "miku"),
        PetSelection(id: "teto"),
    ])

    #expect(roster.selections == [
        PetSelection(id: "chocola"),
        PetSelection(id: "vanilla"),
        .miku,
    ])
    #expect(roster.primarySelection == PetSelection(id: "chocola"))
}

@Test
func petFormationSlotsKeepExistingPetsAndFillOpenSlots() {
    let assignments = PetFormationSlots.assign(
        existingSlots: [
            "chocola": 0,
            "miku": 2,
        ],
        requestedIDs: [
            "chocola",
            "vanilla",
            "miku",
        ]
    )

    #expect(assignments["chocola"] == 0)
    #expect(assignments["vanilla"] == 1)
    #expect(assignments["miku"] == 2)
}

@Test
func petFormationSlotsDropRemovedPetsWithoutRepackingRemainingPets() {
    let assignments = PetFormationSlots.assign(
        existingSlots: [
            "chocola": 0,
            "vanilla": 1,
            "miku": 2,
        ],
        requestedIDs: [
            "chocola",
            "miku",
        ]
    )

    #expect(assignments["chocola"] == 0)
    #expect(assignments["miku"] == 2)
    #expect(assignments["vanilla"] == nil)
}

@Test
func petLaunchRequestProcessSignatureIncludesDirectionalMode() {
    let directory = URL(fileURLWithPath: "/tmp/miku")
    let directional = PetLaunchRequest(
        id: "miku",
        petDirectoryURL: directory,
        slotIndex: 0,
        slotCount: 3,
        allowsDirectionalRunning: true
    )
    let baseOnly = PetLaunchRequest(
        id: "miku",
        petDirectoryURL: directory,
        slotIndex: 0,
        slotCount: 3,
        allowsDirectionalRunning: false
    )

    #expect(directional.processSignature != baseOnly.processSignature)
}

@Test
func petSelectionPreservesDynamicPetIDs() {
    #expect(PetSelection(storedValue: "teto") == PetSelection(id: "teto"))
    #expect(PetSelection(storedValue: "KasaneTeto") == PetSelection(id: "KasaneTeto"))
}

@Test
func petSelectionMapsLocalizedMenuTitlesBackToCases() {
    #expect(PetSelection.selection(matching: "初音", language: .simplifiedChinese) == .miku)
    #expect(PetSelection.selection(matching: "Miku", language: .english) == .miku)
    #expect(PetSelection.selection(matching: "无", language: .simplifiedChinese) == .none)
    #expect(PetSelection.selection(matching: "None", language: .english) == .none)
    #expect(PetSelection.selection(matching: "Codex", language: .english) == .miku)
    #expect(PetSelection.selection(matching: "经典", language: .simplifiedChinese) == .miku)
}

@Test
func petSelectionMapsScannedPetNamesBackToIDs() {
    let pets = [
        PetDescriptor(
            id: "teto",
            displayName: "重音テト",
            description: "test pet",
            spritesheetPath: "spritesheet.webp",
            rootURL: URL(fileURLWithPath: "/tmp/teto")
        ),
    ]

    #expect(PetSelection.selection(matching: "重音テト", language: .simplifiedChinese, pets: pets) == PetSelection(id: "teto"))
    #expect(PetSelection(id: "teto").title(language: .english, pets: pets) == "重音テト")
}

@Test
func petSelectionUsesLocalizedScannedPetNames() {
    let pets = [
        PetDescriptor(
            id: "miku-snow",
            displayName: "初音-冬雪",
            localizedDisplayNames: [
                "zh-Hans": "初音-冬雪",
                "en": "Miku - Snow",
            ],
            description: "test pet",
            spritesheetPath: "spritesheet.webp",
            rootURL: URL(fileURLWithPath: "/tmp/miku-snow")
        ),
    ]

    #expect(PetSelection(id: "miku-snow").title(language: .simplifiedChinese, pets: pets) == "初音-冬雪")
    #expect(PetSelection(id: "miku-snow").title(language: .english, pets: pets) == "Miku - Snow")
    #expect(PetSelection.selection(matching: "初音-冬雪", language: .simplifiedChinese, pets: pets) == PetSelection(id: "miku-snow"))
    #expect(PetSelection.selection(matching: "Miku - Snow", language: .english, pets: pets) == PetSelection(id: "miku-snow"))
    #expect(PetSelection.selection(matching: "miku-snow", language: .english, pets: pets) == PetSelection(id: "miku-snow"))
}

@Test
func petCatalogScansPetDirectories() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    defer { try? FileManager.default.removeItem(at: root) }

    try makePet(root: root, directoryName: "teto", id: "teto", displayName: "重音テト")
    try makePet(root: root, directoryName: "miku", id: "miku", displayName: "初音")
    try "ignore me".write(to: root.appending(path: "notes.txt"), atomically: true, encoding: .utf8)

    let pets = PetCatalog.loadAvailablePets(rootURL: root)

    #expect(pets.map(\.id) == ["miku", "teto"])
    #expect(pets.first { $0.id == "teto" }?.spritesheetPath == "spritesheet.webp")
}

@Test
func petCatalogScansModelOnlyPetDirectories() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    defer { try? FileManager.default.removeItem(at: root) }

    let directory = root.appending(path: "shiina-3d", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try """
    {
      "id": "shiina-3d",
      "displayName": "椎名3D",
      "description": "test 3D pet",
      "modelPath": "model.dae"
    }
    """.write(to: directory.appending(path: "pet.json"), atomically: true, encoding: .utf8)

    let pets = PetCatalog.loadAvailablePets(rootURL: root)

    #expect(pets.map(\.id) == ["shiina-3d"])
    #expect(pets[0].spritesheetPath.isEmpty)
    #expect(pets[0].modelPath == "model.dae")
}

@Test
func petCatalogReadsLocalizedDisplayNames() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    defer { try? FileManager.default.removeItem(at: root) }

    let directory = root.appending(path: "miku-snow", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try """
    {
      "id": "miku-snow",
      "localizedDisplayNames": {
        "zh-Hans": "初音-冬雪",
        "en": "Miku - Snow"
      },
      "description": "test pet",
      "spritesheetPath": "spritesheet.webp"
    }
    """.write(to: directory.appending(path: "pet.json"), atomically: true, encoding: .utf8)

    let pets = PetCatalog.loadAvailablePets(rootURL: root)

    #expect(pets.count == 1)
    #expect(pets[0].displayName == "初音-冬雪")
    #expect(pets[0].displayName(language: .english) == "Miku - Snow")
}

@Test
func petCatalogReadsInjectedGroupMetadata() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    defer { try? FileManager.default.removeItem(at: root) }

    try makePet(
        root: root,
        directoryName: "teto",
        id: "teto",
        displayName: "重音テト",
        groupJSON: #"{"id":"utau","localizedTitles":{"zh-Hans":"UTAU","en":"UTAU"}}"#
    )

    let pets = PetCatalog.loadAvailablePets(rootURL: root)
    let groups = PetCatalog.groupedPets(pets)

    #expect(pets.map(\.groupID) == ["utau"])
    #expect(groups.map(\.id) == ["utau"])
    #expect(groups[0].title(language: .simplifiedChinese) == "UTAU")
    #expect(groups[0].pets.map(\.id) == ["teto"])
}

@Test
func petCatalogMapsDateALiveGroupAliases() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: UUID().uuidString, directoryHint: .isDirectory)
    defer { try? FileManager.default.removeItem(at: root) }

    try makePet(
        root: root,
        directoryName: "tohka-yatogami",
        id: "tohka-yatogami",
        displayName: "夜刀神十香",
        groupJSON: #"{"id":"dal"}"#
    )

    let pets = PetCatalog.loadAvailablePets(rootURL: root)
    let groups = PetCatalog.groupedPets(pets)

    #expect(pets.map(\.groupID) == ["date-a-live"])
    #expect(groups.map(\.id) == ["date-a-live"])
    #expect(groups[0].title(language: .simplifiedChinese) == "约会大作战")
    #expect(groups[0].title(language: .english) == "Date A Live")
}

@Test
func petCatalogGroupsPetsByTypeInRequestedOrder() {
    let pets = [
        petDescriptor(id: "vanilla", displayName: "香子兰"),
        petDescriptor(id: "miku-snow", displayName: "初音-冬雪"),
        petDescriptor(id: "mashiro", displayName: "椎名真白"),
        petDescriptor(id: "tohka-yatogami", displayName: "夜刀神十香"),
        petDescriptor(id: "chocola", displayName: "巧克力"),
        petDescriptor(id: "miku", displayName: "初音"),
    ]

    let groups = PetCatalog.groupedPets(pets)

    #expect(groups.map(\.id) == ["hatsune-miku", "nekopara", "sakurasou", "date-a-live"])
    #expect(groups.map { $0.title(language: .simplifiedChinese) } == ["初音未来", "猫娘乐园", "樱花庄的宠物女孩", "约会大作战"])
    #expect(groups[0].pets.map(\.id) == ["miku", "miku-snow"])
    #expect(groups[1].pets.map(\.id) == ["chocola", "vanilla"])
    #expect(groups[2].pets.map(\.id) == ["mashiro"])
    #expect(groups[3].pets.map(\.id) == ["tohka-yatogami"])
}

@Test
func petCatalogCanIncludeEmptyBuiltInGroupsForSettingsBrowser() {
    let groups = PetCatalog.groupedPets(
        [
            petDescriptor(id: "miku", displayName: "初音"),
        ],
        includeEmptyBuiltInGroups: true
    )

    #expect(groups.map(\.id) == ["hatsune-miku", "nekopara", "sakurasou", "date-a-live"])
    #expect(groups.map(\.pets.count) == [1, 0, 0, 0])
    #expect(groups[3].title(language: .simplifiedChinese) == "约会大作战")
}

@Test
func petCatalogSettingsGroupsIncludeDateALivePlans() throws {
    let root = URL(fileURLWithPath: "/tmp/pets")
    let groups = PetCatalog.settingsGroups(
        availablePets: [
            petDescriptor(id: "miku", displayName: "初音"),
        ],
        rootURL: root
    )

    let dateALiveGroup = try #require(groups.first { $0.id == "date-a-live" })

    #expect(dateALiveGroup.pets.map(\.id) == [
        "tohka-yatogami",
        "yoshino",
        "kurumi-tokisaki",
        "kurumi-kimono",
        "kotori-itsuka",
        "kaguya-yamai",
        "yuzuru-yamai",
        "miku-izayoi",
        "natsumi",
        "origami-tobiichi",
        "nia-honjo",
        "mukuro-hoshimiya",
        "mio-takamiya",
    ])
    #expect(dateALiveGroup.pets.allSatisfy { !$0.isInstalled })
    #expect(dateALiveGroup.pets.map { dateALiveGroup.petTitle($0, language: .simplifiedChinese) } == [
        "十香",
        "四糸乃",
        "融合灵装-狂三",
        "和服-狂三",
        "琴里",
        "耶俱矢",
        "夕弦",
        "美九",
        "七罪",
        "折纸",
        "二亚",
        "六喰",
        "澪",
    ])
    #expect(dateALiveGroup.pets.map { dateALiveGroup.petTitle($0, language: .english) } == [
        "Tohka",
        "Yoshino",
        "Fusion Spirit Dress Kurumi",
        "Kimono Kurumi",
        "Kotori",
        "Kaguya",
        "Yuzuru",
        "Miku",
        "Natsumi",
        "Origami",
        "Nia",
        "Mukuro",
        "Mio",
    ])
}

@Test
func petCatalogSettingsGroupsPreferInstalledDateALivePets() throws {
    let installedKurumi = petDescriptor(
        id: "kurumi-tokisaki",
        displayName: "时崎狂三",
        groupID: "date-a-live"
    )
    let groups = PetCatalog.settingsGroups(
        availablePets: [
            installedKurumi,
        ],
        rootURL: URL(fileURLWithPath: "/tmp/pets")
    )

    let dateALiveGroup = try #require(groups.first { $0.id == "date-a-live" })
    let kurumiEntries = dateALiveGroup.pets.filter { $0.id == "kurumi-tokisaki" }

    #expect(kurumiEntries.count == 1)
    #expect(kurumiEntries[0].isInstalled)
    #expect(dateALiveGroup.pets.count == 13)
}

@Test
func petCatalogSettingsGroupsTreatDateALiveAliasesAsInstalledPlans() throws {
    let groups = PetCatalog.settingsGroups(
        availablePets: [
            petDescriptor(id: "kurumi", displayName: "时崎狂三", groupID: "date-a-live"),
            petDescriptor(id: "kaguya-yamai", displayName: "八舞耶俱矢", groupID: "date-a-live"),
        ],
        rootURL: URL(fileURLWithPath: "/tmp/pets")
    )

    let dateALiveGroup = try #require(groups.first { $0.id == "date-a-live" })

    #expect(dateALiveGroup.pets.count == 13)
    #expect(dateALiveGroup.pets.contains { $0.id == "kurumi" && $0.isInstalled })
    #expect(dateALiveGroup.pets.contains { $0.id == "kaguya-yamai" && $0.isInstalled })
    #expect(!dateALiveGroup.pets.contains { $0.id == "kurumi-tokisaki" })
    #expect(dateALiveGroup.pets.contains { $0.id == "kurumi-kimono" && !$0.isInstalled })
    #expect(dateALiveGroup.pets.contains { $0.id == "yuzuru-yamai" && !$0.isInstalled })
}

@Test
func petCatalogSettingsGroupsSortDateALiveVariantsByCharacter() throws {
    let groups = PetCatalog.settingsGroups(
        availablePets: [
            petDescriptor(id: "kurumi-school", displayName: "校服-狂三", groupID: "date-a-live"),
            petDescriptor(id: "tohka-school", displayName: "校服-十香", groupID: "date-a-live"),
        ],
        rootURL: URL(fileURLWithPath: "/tmp/pets")
    )

    let dateALiveGroup = try #require(groups.first { $0.id == "date-a-live" })
    let ids = dateALiveGroup.pets.map(\.id)

    #expect(ids.firstIndex(of: "tohka-yatogami")! + 1 == ids.firstIndex(of: "tohka-school")!)
    #expect(ids.firstIndex(of: "kurumi-tokisaki")! + 1 == ids.firstIndex(of: "kurumi-kimono")!)
    #expect(ids.firstIndex(of: "kurumi-kimono")! + 1 == ids.firstIndex(of: "kurumi-school")!)
}

@Test
func petCatalogGroupsBuiltInVariantsByCharacter() throws {
    let groups = PetCatalog.groupedPets([
        petDescriptor(id: "miku-sakura", displayName: "初音-樱花"),
        petDescriptor(id: "miku", displayName: "初音"),
        petDescriptor(id: "miku-snow", displayName: "初音-冬雪"),
        petDescriptor(id: "vanilla-school", displayName: "香子兰-校服"),
        petDescriptor(id: "chocola-school", displayName: "巧克力-校服"),
        petDescriptor(id: "vanilla", displayName: "香子兰"),
        petDescriptor(id: "chocola", displayName: "巧克力"),
        petDescriptor(id: "mashiro-school", displayName: "椎名真白-校服"),
        petDescriptor(id: "mashiro", displayName: "椎名真白-晚礼服"),
    ])

    let mikuGroup = try #require(groups.first { $0.id == "hatsune-miku" })
    let nekoparaGroup = try #require(groups.first { $0.id == "nekopara" })
    let sakurasouGroup = try #require(groups.first { $0.id == "sakurasou" })

    #expect(mikuGroup.pets.map(\.id) == ["miku", "miku-snow", "miku-sakura"])
    #expect(nekoparaGroup.pets.map(\.id) == ["chocola", "chocola-school", "vanilla", "vanilla-school"])
    #expect(sakurasouGroup.pets.map(\.id) == ["mashiro", "mashiro-school"])
}

@Test
func petCatalogSettingsGroupsIncludeMioAndTreatMioAliasesAsInstalledPlans() throws {
    let groups = PetCatalog.settingsGroups(
        availablePets: [
            petDescriptor(id: "mio", displayName: "崇宫澪", groupID: "date-a-live"),
        ],
        rootURL: URL(fileURLWithPath: "/tmp/pets")
    )

    let dateALiveGroup = try #require(groups.first { $0.id == "date-a-live" })

    #expect(dateALiveGroup.pets.count == 13)
    #expect(dateALiveGroup.pets.contains { $0.id == "mio" && $0.isInstalled })
    #expect(!dateALiveGroup.pets.contains { $0.id == "mio-takamiya" })
    #expect(dateALiveGroup.petTitle(petDescriptor(id: "mio-takamiya", displayName: "崇宫澪"), language: .simplifiedChinese) == "澪")
    #expect(dateALiveGroup.petTitle(petDescriptor(id: "mio-takamiya", displayName: "Mio Takamiya"), language: .english) == "Mio")
}

@Test
func petCatalogUsesGroupScopedPetTitles() throws {
    let groups = PetCatalog.groupedPets([
        petDescriptor(id: "miku", displayName: "初音"),
        petDescriptor(id: "miku-snow", displayName: "初音-冬雪"),
        petDescriptor(id: "miku-sakura", displayName: "初音-樱花"),
        petDescriptor(
            id: "mashiro",
            displayName: "椎名真白-晚礼服",
            localizedDisplayNames: ["en": "Shiina Mashiro - Evening Dress"]
        ),
        petDescriptor(id: "tohka-yatogami", displayName: "夜刀神十香"),
        petDescriptor(id: "miku-izayoi", displayName: "诱宵美九"),
        petDescriptor(id: "mukuro-hoshimiya", displayName: "星宫六喰"),
    ])

    let mikuGroup = try #require(groups.first { $0.id == "hatsune-miku" })
    let sakurasouGroup = try #require(groups.first { $0.id == "sakurasou" })
    let dateALiveGroup = try #require(groups.first { $0.id == "date-a-live" })

    #expect(mikuGroup.pets.map { mikuGroup.petTitle($0, language: .simplifiedChinese) } == ["经典", "冬雪", "樱花"])
    #expect(mikuGroup.pets.map { mikuGroup.petTitle($0, language: .english) } == ["Classic", "Snow", "Sakura"])
    #expect(sakurasouGroup.pets.map { sakurasouGroup.petTitle($0, language: .simplifiedChinese) } == ["椎名真白-晚礼服"])
    #expect(sakurasouGroup.pets.map { sakurasouGroup.petTitle($0, language: .english) } == ["Shiina Mashiro - Evening Dress"])
    #expect(dateALiveGroup.pets.map { dateALiveGroup.petTitle($0, language: .simplifiedChinese) } == ["十香", "美九", "六喰"])
    #expect(dateALiveGroup.pets.map { dateALiveGroup.petTitle($0, language: .english) } == ["Tohka", "Miku", "Mukuro"])
}

@Test
func petCatalogGroupsPetsIntoCharactersAndSkins() throws {
    let groups = PetCatalog.groupedPets([
        petDescriptor(id: "miku", displayName: "初音"),
        petDescriptor(id: "miku-snow", displayName: "初音-冬雪"),
        petDescriptor(id: "chocola", displayName: "巧克力"),
        petDescriptor(id: "chocola-school", displayName: "巧克力-校服"),
        petDescriptor(id: "kurumi-tokisaki", displayName: "融合灵装-狂三", groupID: "date-a-live"),
        petDescriptor(id: "kurumi-kimono", displayName: "和服-狂三", groupID: "date-a-live"),
        petDescriptor(id: "kotori-itsuka", displayName: "五河琴里", groupID: "date-a-live"),
    ])

    let mikuGroup = try #require(groups.first { $0.id == "hatsune-miku" })
    let nekoparaGroup = try #require(groups.first { $0.id == "nekopara" })
    let dateALiveGroup = try #require(groups.first { $0.id == "date-a-live" })

    #expect(mikuGroup.petCharacters().map { $0.title(language: .simplifiedChinese) } == ["初音"])
    #expect(mikuGroup.petCharacters()[0].pets.map { mikuGroup.petSkinTitle($0, language: .simplifiedChinese) } == ["经典", "冬雪"])

    #expect(nekoparaGroup.petCharacters().map { $0.title(language: .simplifiedChinese) } == ["巧克力"])
    #expect(nekoparaGroup.petCharacters()[0].pets.map { nekoparaGroup.petSkinTitle($0, language: .simplifiedChinese) } == ["默认", "校服"])

    #expect(dateALiveGroup.petCharacters().map { $0.title(language: .simplifiedChinese) } == ["狂三", "琴里"])
    #expect(dateALiveGroup.petCharacters()[0].pets.map { dateALiveGroup.petSkinTitle($0, language: .simplifiedChinese) } == ["融合灵装", "和服"])
}

@Test
func petCatalogKeepsDateALiveMikuSeparateFromHatsuneMiku() {
    let groups = PetCatalog.groupedPets([
        petDescriptor(id: "miku", displayName: "初音"),
        petDescriptor(id: "miku-izayoi", displayName: "诱宵美九"),
    ])

    #expect(groups.map(\.id) == ["hatsune-miku", "date-a-live"])
    #expect(groups[0].pets.map(\.id) == ["miku"])
    #expect(groups[1].pets.map(\.id) == ["miku-izayoi"])
}

@Test
func petCatalogUsesInjectedGroupMetadata() {
    let groups = PetCatalog.groupedPets([
        petDescriptor(
            id: "teto",
            displayName: "重音テト",
            groupID: "utau",
            groupLocalizedTitles: [
                "zh-Hans": "UTAU",
                "en": "UTAU",
            ]
        ),
    ])

    #expect(groups.map(\.id) == ["utau"])
    #expect(groups[0].title(language: .simplifiedChinese) == "UTAU")
    #expect(groups[0].pets.map(\.id) == ["teto"])
}

@Test
func petCatalogKeepsInjectedGroupsAlongsideBuiltInGroups() {
    let groups = PetCatalog.groupedPets([
        petDescriptor(id: "miku", displayName: "初音"),
        petDescriptor(id: "chocola", displayName: "巧克力"),
        petDescriptor(id: "mashiro", displayName: "椎名真白"),
        petDescriptor(
            id: "teto",
            displayName: "重音テト",
            groupID: "utau",
            groupLocalizedTitles: [
                "zh-Hans": "UTAU",
                "en": "UTAU",
            ]
        ),
    ])

    #expect(groups.map(\.id) == ["hatsune-miku", "nekopara", "sakurasou", "utau"])
    #expect(groups.map { $0.title(language: .simplifiedChinese) } == ["初音未来", "猫娘乐园", "樱花庄的宠物女孩", "UTAU"])
}

@Test
func petCatalogDoesNotCreateUnknownGroupForUnclassifiedPets() {
    let groups = PetCatalog.groupedPets([
        petDescriptor(id: "teto", displayName: "重音テト"),
    ])

    #expect(groups.isEmpty)
}

private func petDescriptor(
    id: String,
    displayName: String,
    localizedDisplayNames: [String: String] = [:],
    description: String = "test pet",
    groupID: String? = nil,
    groupLocalizedTitles: [String: String] = [:]
) -> PetDescriptor {
    PetDescriptor(
        id: id,
        displayName: displayName,
        localizedDisplayNames: localizedDisplayNames,
        description: description,
        spritesheetPath: "spritesheet.webp",
        groupID: groupID,
        groupLocalizedTitles: groupLocalizedTitles,
        rootURL: URL(fileURLWithPath: "/tmp/\(id)")
    )
}

private func makePet(
    root: URL,
    directoryName: String,
    id: String,
    displayName: String,
    groupJSON: String? = nil
) throws {
    let directory = root.appending(path: directoryName, directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let groupLine = groupJSON.map { #"      "group": \#($0),"# } ?? ""
    try """
    {
      "id": "\(id)",
      "displayName": "\(displayName)",
    \(groupLine)
      "description": "test pet",
      "spritesheetPath": "spritesheet.webp"
    }
    """.write(to: directory.appending(path: "pet.json"), atomically: true, encoding: .utf8)
}
