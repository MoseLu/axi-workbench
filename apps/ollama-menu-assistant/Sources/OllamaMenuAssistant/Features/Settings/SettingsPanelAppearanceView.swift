import AppKit
import ImageIO
import SwiftUI

struct ThemePresetOption: Identifiable, Equatable {
    let name: String
    let accentHex: String
    let backgroundHex: String
    let foregroundHex: String
    let contrast: Double
    let translucentSidebar: Bool

    var id: String { name }

    init(
        name: String,
        accentHex: String,
        backgroundHex: String,
        foregroundHex: String,
        contrast: Double,
        translucentSidebar: Bool = true
    ) {
        self.name = name
        self.accentHex = accentHex
        self.backgroundHex = backgroundHex
        self.foregroundHex = foregroundHex
        self.contrast = contrast
        self.translucentSidebar = translucentSidebar
    }
}

struct ThemeDiffFragment {
    let text: String
    let color: Color
}

struct ThemeDiffLine: Identifiable {
    let number: String
    let isChanged: Bool
    let background: Color
    let fragments: [ThemeDiffFragment]

    var id: String { number }
}

private enum PetThumbnailLoader {
    static func thumbnail(for pet: PetDescriptor?) -> NSImage? {
        guard let pet,
              pet.isInstalled,
              let spritesheetURL = spritesheetURL(for: pet),
              let source = CGImageSourceCreateWithURL(spritesheetURL as CFURL, nil),
              let sheet = CGImageSourceCreateImageAtIndex(source, 0, nil)
        else {
            return nil
        }

        let frameWidth = min(192, sheet.width)
        let frameHeight = min(208, sheet.height)
        guard frameWidth > 0,
              frameHeight > 0,
              let frame = sheet.cropping(to: CGRect(x: 0, y: 0, width: frameWidth, height: frameHeight))
        else {
            return nil
        }

        return NSImage(cgImage: frame, size: NSSize(width: frameWidth, height: frameHeight))
    }

    private static func spritesheetURL(for pet: PetDescriptor) -> URL? {
        let trimmedSpritesheetPath = pet.spritesheetPath.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidates = [
            pet.rootURL.appending(path: "spritesheet.redraw.webp"),
            pet.rootURL.appending(path: "spritesheet.directional.webp"),
            trimmedSpritesheetPath.isEmpty ? nil : pet.rootURL.appending(path: trimmedSpritesheetPath),
        ].compactMap { $0 }

        return candidates.first { FileManager.default.fileExists(atPath: $0.path) }
    }
}

private struct PetThumbnailView: View {
    var pet: PetDescriptor?
    var fallbackSystemName: String
    var isSelected: Bool = false
    var isUnavailable: Bool = false
    var size: CGFloat = 24

    @State private var image: NSImage?

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            RoundedRectangle(cornerRadius: 7)
                .fill(AppTheme.surface.opacity(0.86))
                .overlay(
                    RoundedRectangle(cornerRadius: 7)
                        .stroke(AppTheme.border.opacity(0.72), lineWidth: 1)
                )

            if let image {
                Image(nsImage: image)
                    .resizable()
                    .interpolation(.none)
                    .scaledToFit()
                    .padding(2)
            } else {
                Image(systemName: fallbackSystemName)
                    .font(.system(size: max(10, size * 0.46), weight: .semibold))
                    .foregroundStyle(isSelected ? AppTheme.accent : AppTheme.textTertiary)
            }

            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: max(10, size * 0.42), weight: .bold))
                    .foregroundStyle(AppTheme.accent)
                    .background(Circle().fill(AppTheme.surface))
                    .offset(x: 4, y: 4)
            }
        }
        .frame(width: size, height: size)
        .opacity(isUnavailable ? 0.55 : 1)
        .onAppear(perform: loadThumbnail)
        .onChange(of: pet?.rootURL.path ?? "") { _, _ in
            loadThumbnail()
        }
    }

    private func loadThumbnail() {
        image = PetThumbnailLoader.thumbnail(for: pet)
    }
}

extension SettingsPanelView {
    var appearanceSettings: some View {
        VStack(alignment: .leading, spacing: 22) {
            settingsCard {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top, spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(tr("主题", "Theme"))
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(AppTheme.textPrimary)
                            Text(tr("使用浅色、深色、玻璃态，或匹配系统设置", "Use light, dark, glass, or match system settings"))
                                .font(.system(size: 12))
                                .foregroundStyle(AppTheme.textSecondary)
                        }

                        Spacer()

                        HStack(spacing: 8) {
                            ForEach([AppearanceMode.light, .dark, .system]) { mode in
                                appearanceModeButton(mode)
                            }
                            glassAppearanceButton
                        }
                    }

                    themeDiffPreview
                }
                .padding(14)
            }

            themeControlsCard

            petRosterCard
        }
        .onAppear {
            appModel.refreshPetCatalog()
            migrateLegacyThemeDefaultsIfNeeded()
        }
    }

    var themeControlsCard: some View {
        settingsCard {
            themePresetRow
            divider
            colorRow(title: tr("强调色", "Accent"), hex: $themeAccentHex, fallback: AppTheme.themeAccentFallback)
            divider
            colorRow(title: tr("背景", "Background"), hex: $themeBackgroundHex, fallback: AppTheme.themeBackgroundFallback)
            divider
            colorRow(title: tr("前景", "Foreground"), hex: $themeForegroundHex, fallback: AppTheme.themeForegroundFallback)
            divider
            settingsValueRow(title: tr("UI 字体", "UI font"), value: "-apple-system, BlinkMacSystemFont")
            divider
            settingsValueRow(title: tr("代码字体", "Code font"), value: "ui-monospace, \"SFMono-Regular\"")
            divider
            settingsToggleRow(title: tr("半透明侧边栏", "Translucent sidebar"), description: "", isOn: $translucentSidebar)
            divider
            settingsSliderRow(title: tr("对比度", "Contrast"), value: $contrast, range: 0...100)
            divider
            settingsToggleRow(
                title: tr("使用指针光标", "Use pointer cursor"),
                description: tr("悬停交互元素时切换为指针光标", "Switch to the pointer cursor when hovering interactive elements"),
                isOn: $pointerCursor
            )
            divider
            settingsStepperRow(
                title: tr("UI 字号", "UI font size"),
                description: tr("调整 Assistant UI 使用的基准字号", "Adjust the base font size used by the Assistant UI"),
                value: $uiFontSize,
                range: 11...18
            )
            divider
            settingsStepperRow(
                title: tr("代码字体大小", "Code font size"),
                description: tr("调整聊天和差异视图中代码使用的基础字号", "Adjust the base code font size used in chats and diff views"),
                value: $codeFontSize,
                range: 10...18
            )
            divider
            settingsToggleRow(
                title: tr("字体平滑", "Font smoothing"),
                description: tr("使用 macOS 原生字体抗锯齿", "Use native macOS font antialiasing"),
                isOn: $fontSmoothing
            )
        }
        .overlay(alignment: .topTrailing) {
            if isThemePresetMenuPresented {
                themePresetMenu
                    .offset(x: -8, y: 44)
                    .zIndex(20)
            }
        }
        .zIndex(isThemePresetMenuPresented ? 20 : 0)
    }

    var petRosterCard: some View {
        settingsCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .center, spacing: 14) {
                    settingsRowText(title: tr("宠物", "Pet"), description: "")
                    Spacer(minLength: 18)
                    Text("\(appModel.petSelections.count)/\(PetRoster.maxPets)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AppTheme.textTertiary)
                        .frame(width: 34, alignment: .trailing)
                    settingsSwitch(isOn: petRosterEnabledBinding)
                }

                if appModel.petGroups.isEmpty {
                    Text(tr("没有可用宠物", "No pets available"))
                        .font(.system(size: 12))
                        .foregroundStyle(AppTheme.textSecondary)
                } else {
                    petRosterBrowser
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
        }
    }

    var activePetGroup: PetGroupDescriptor? {
        appModel.petGroups.first { $0.id == selectedPetGroupID }
            ?? appModel.petGroups.first { group in
                group.pets.contains { appModel.isPetSelected($0) }
            }
            ?? appModel.petGroups.first
    }

    var petRosterBrowser: some View {
        HStack(alignment: .top, spacing: 12) {
            petGroupList

            Rectangle()
                .fill(AppTheme.border)
                .frame(width: 1)
                .frame(maxHeight: SettingsPanelMetrics.petRosterBrowserMaxHeight)

            if let group = activePetGroup {
                petCharacterList(group)

                Rectangle()
                    .fill(AppTheme.border)
                    .frame(width: 1)
                    .frame(maxHeight: SettingsPanelMetrics.petRosterBrowserMaxHeight)

                petSkinSection(group)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
    }

    var petGroupList: some View {
        petWeakScrollColumn(needsScrolling: appModel.petGroups.count > 7) {
            ForEach(appModel.petGroups) { group in
                petGroupRow(group)
            }
        }
        .frame(width: SettingsPanelMetrics.petRosterGroupListWidth)
        .frame(maxHeight: SettingsPanelMetrics.petRosterBrowserMaxHeight, alignment: .topLeading)
    }

    @ViewBuilder
    func petWeakScrollColumn<Content: View>(
        needsScrolling: Bool,
        @ViewBuilder content: () -> Content
    ) -> some View {
        if needsScrolling {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 4) {
                    content()
                }
                .padding(.trailing, 4)
            }
            .overlay(petScrollEdgeFade)
        } else {
            VStack(alignment: .leading, spacing: 4) {
                content()
            }
        }
    }

    var petScrollEdgeFade: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [AppTheme.surface.opacity(0.95), AppTheme.surface.opacity(0)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 14)

            Spacer()

            LinearGradient(
                colors: [AppTheme.surface.opacity(0), AppTheme.surface.opacity(0.95)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 14)
        }
        .allowsHitTesting(false)
    }

    func petGroupRow(_ group: PetGroupDescriptor) -> some View {
        let isSelected = activePetGroup?.id == group.id
        let representativePet = representativePet(for: group)

        return Button {
            selectedPetGroupID = group.id
            selectedPetCharacterID = nil
        } label: {
            HStack(spacing: 8) {
                PetThumbnailView(
                    pet: representativePet,
                    fallbackSystemName: isSelected ? "books.vertical.fill" : "books.vertical",
                    isSelected: isSelected,
                    isUnavailable: representativePet?.isInstalled == false,
                    size: 24
                )

                Text(group.title(language: appLanguage))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(isSelected ? AppTheme.textPrimary : AppTheme.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text("\(group.pets.count)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(isSelected ? AppTheme.accent : AppTheme.textTertiary)
                    .frame(minWidth: 18, minHeight: 16)
                    .background(isSelected ? AppTheme.surface : AppTheme.surfaceRaised.opacity(0.72))
                    .clipShape(Capsule())
            }
            .padding(.leading, 10)
            .padding(.trailing, 8)
            .frame(height: 40)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? AppTheme.surfaceRaised : AppTheme.transparent)
            .overlay(alignment: .leading) {
                if isSelected {
                    Rectangle()
                        .fill(AppTheme.accent)
                        .frame(width: 3, height: 18)
                        .clipShape(Capsule())
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .contentShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    var petRosterEnabledBinding: Binding<Bool> {
        Binding(
            get: {
                !appModel.petSelections.isEmpty
            },
            set: { enabled in
                if enabled {
                    if appModel.petSelections.isEmpty {
                        appModel.setPetSelection(.miku, enabled: true)
                    }
                } else {
                    appModel.clearPetSelections()
                }
            }
        )
    }

    func activePetCharacter(in group: PetGroupDescriptor) -> PetCharacterDescriptor? {
        let characters = group.petCharacters()
        return characters.first { $0.id == selectedPetCharacterID }
            ?? characters.first { character in
                character.pets.contains { appModel.isPetSelected($0) }
            }
            ?? characters.first
    }

    func representativePet(for group: PetGroupDescriptor) -> PetDescriptor? {
        group.pets.first { appModel.isPetSelected($0) }
            ?? group.pets.first { $0.isInstalled }
            ?? group.pets.first
    }

    func representativePet(for character: PetCharacterDescriptor) -> PetDescriptor? {
        character.pets.first { appModel.isPetSelected($0) }
            ?? character.pets.first { $0.isInstalled }
            ?? character.pets.first
    }

    @ViewBuilder
    func petCharacterList(_ group: PetGroupDescriptor) -> some View {
        let characters = group.petCharacters()

        VStack(alignment: .leading, spacing: 7) {
            Text(tr("角色", "Character"))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
                .padding(.horizontal, 2)

            if characters.isEmpty {
                emptyPetColumnMessage
            } else {
                petWeakScrollColumn(needsScrolling: characters.count > 7) {
                    ForEach(characters) { character in
                        petCharacterRow(character, in: group)
                    }
                }
            }
        }
        .frame(width: SettingsPanelMetrics.petRosterCharacterListWidth)
        .frame(maxHeight: SettingsPanelMetrics.petRosterBrowserMaxHeight, alignment: .topLeading)
    }

    func petCharacterRow(_ character: PetCharacterDescriptor, in group: PetGroupDescriptor) -> some View {
        let isSelected = activePetCharacter(in: group)?.id == character.id
        let hasSelectedPet = character.pets.contains { appModel.isPetSelected($0) }
        let representativePet = representativePet(for: character)

        return Button {
            selectedPetGroupID = group.id
            selectedPetCharacterID = character.id
        } label: {
            HStack(spacing: 8) {
                PetThumbnailView(
                    pet: representativePet,
                    fallbackSystemName: hasSelectedPet ? "person.crop.circle.fill" : "person.crop.circle",
                    isSelected: hasSelectedPet,
                    isUnavailable: representativePet?.isInstalled == false,
                    size: 22
                )

                Text(character.title(language: appLanguage))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(isSelected ? AppTheme.textPrimary : AppTheme.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if character.pets.count > 1 {
                    Text("\(character.pets.count)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(isSelected ? AppTheme.accent : AppTheme.textTertiary)
                        .frame(minWidth: 18, minHeight: 16)
                        .background(isSelected ? AppTheme.surface : AppTheme.surfaceRaised.opacity(0.72))
                        .clipShape(Capsule())
                }
            }
            .padding(.leading, 9)
            .padding(.trailing, 8)
            .frame(height: 38)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? AppTheme.surfaceRaised : AppTheme.transparent)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .contentShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .help(character.title(language: appLanguage))
    }

    @ViewBuilder
    func petSkinSection(_ group: PetGroupDescriptor) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(tr("皮肤", "Skin"))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
                .padding(.horizontal, 2)

            if group.pets.isEmpty {
                emptyPetColumnMessage
            } else if let character = activePetCharacter(in: group) {
                ScrollView(.vertical, showsIndicators: character.pets.count > 7) {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(character.pets) { pet in
                            petSkinButton(pet, in: group)
                        }
                    }
                    .padding(.trailing, character.pets.count > 7 ? 4 : 0)
                }
                .overlay(petScrollEdgeFade)
                .frame(maxHeight: SettingsPanelMetrics.petRosterBrowserMaxHeight, alignment: .topLeading)
            }
        }
    }

    var emptyPetColumnMessage: some View {
        Text(tr("这个分类还没有宠物资源", "No pet assets in this category yet"))
            .font(.system(size: 12))
            .foregroundStyle(AppTheme.textSecondary)
            .frame(maxWidth: .infinity, minHeight: 32, alignment: .leading)
    }

    func petSkinButton(_ pet: PetDescriptor, in group: PetGroupDescriptor) -> some View {
        let selection = PetSelection(id: pet.id)
        let isSelected = appModel.isPetSelected(pet)
        let isUnavailable = !pet.isInstalled
        let isDisabled = !isSelected && (isUnavailable || appModel.petSelections.count >= PetRoster.maxPets)

        return Button {
            appModel.setPetSelection(selection, enabled: !isSelected)
        } label: {
            HStack(spacing: 9) {
                PetThumbnailView(
                    pet: pet,
                    fallbackSystemName: isSelected ? "checkmark.circle.fill" : "circle",
                    isSelected: isSelected,
                    isUnavailable: isUnavailable,
                    size: 30
                )

                Text(group.petSkinTitle(pet, language: appLanguage))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(isDisabled ? AppTheme.textTertiary : AppTheme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(SettingsPanelMetrics.textMinimumScale)
                    .allowsTightening(true)

                if isUnavailable {
                    Text(tr("预案", "Planned"))
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(AppTheme.textTertiary)
                        .padding(.horizontal, 6)
                        .frame(height: 18)
                        .background(AppTheme.surfaceRaised.opacity(0.7))
                        .clipShape(Capsule())
                }

                Spacer(minLength: 4)
            }
            .padding(.horizontal, 10)
            .frame(height: 44)
            .background(isSelected ? AppTheme.surfaceRaised : AppTheme.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? AppTheme.borderStrong : AppTheme.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .contentShape(RoundedRectangle(cornerRadius: 8))
            .opacity(isDisabled ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .help(
            isUnavailable
                ? tr("资源生成后即可选择", "Available after the pet assets are generated")
                : "\(group.petCharacterTitle(pet, language: appLanguage)) · \(group.petSkinTitle(pet, language: appLanguage))"
        )
    }

    var appearanceModeDescription: String {
        switch appearanceMode {
        case .system:
            tr("当前使用系统外观，应用会跟随 macOS 自动切换浅色或深色。", "Using the system appearance. The app follows macOS light and dark mode.")
        case .light:
            tr("当前固定使用浅色外观，应用不会跟随 macOS 自动切换。", "Light appearance is fixed. The app will not follow macOS automatically.")
        case .dark:
            tr("当前固定使用深色外观，应用不会跟随 macOS 自动切换。", "Dark appearance is fixed. The app will not follow macOS automatically.")
        }
    }

    var isPreviewingDarkTheme: Bool {
        appearanceMode == .dark || (appearanceMode == .system && colorScheme == .dark)
    }

    var themePresetRowTitle: String {
        isPreviewingDarkTheme ? tr("深色主题", "Dark theme") : tr("浅色主题", "Light theme")
    }

    var themePresetOptions: [ThemePresetOption] {
        [
            ThemePresetOption(name: "Ayu", accentHex: "#FFCC66", backgroundHex: "#0B0E14", foregroundHex: "#B3B1AD", contrast: 62),
            ThemePresetOption(name: "Catppuccin", accentHex: "#CBA6F7", backgroundHex: "#1E1E2E", foregroundHex: "#CDD6F4", contrast: 64),
            ThemePresetOption(name: "Assistant", accentHex: "#339CFF", backgroundHex: "#181818", foregroundHex: "#FFFFFF", contrast: 68),
            ThemePresetOption(name: "Glass", accentHex: "#F5B84B", backgroundHex: "#123C3F", foregroundHex: "#F6EDDC", contrast: 42, translucentSidebar: true),
            ThemePresetOption(name: "Dracula", accentHex: "#FF79C6", backgroundHex: "#282A36", foregroundHex: "#F8F8F2", contrast: 66),
            ThemePresetOption(name: "Everforest", accentHex: "#A7C080", backgroundHex: "#2D353B", foregroundHex: "#D3C6AA", contrast: 60),
            ThemePresetOption(name: "GitHub", accentHex: "#2F81F7", backgroundHex: "#0D1117", foregroundHex: "#C9D1D9", contrast: 64),
            ThemePresetOption(name: "Gruvbox", accentHex: "#83A598", backgroundHex: "#282828", foregroundHex: "#EBDBB2", contrast: 58),
            ThemePresetOption(name: "Linear", accentHex: "#5E6AD2", backgroundHex: "#08090A", foregroundHex: "#F7F8F8", contrast: 70),
            ThemePresetOption(name: "Lobster", accentHex: "#E95050", backgroundHex: "#1B1111", foregroundHex: "#FFF4F4", contrast: 66),
            ThemePresetOption(name: "Material", accentHex: "#80CBC4", backgroundHex: "#263238", foregroundHex: "#EEFFFF", contrast: 62),
        ]
    }

    var selectedThemePreset: ThemePresetOption {
        themePresetOptions.first { $0.name == themePreset } ?? themePresetOptions[2]
    }

    var glassThemePreset: ThemePresetOption {
        themePresetOptions.first { $0.name == "Glass" } ?? themePresetOptions[3]
    }

    var normalizedThemeAccentHex: String {
        normalizedHex(themeAccentHex, fallback: AppTheme.themeAccentFallback)
    }

    var normalizedThemeBackgroundHex: String {
        normalizedHex(themeBackgroundHex, fallback: AppTheme.themeBackgroundFallback)
    }

    var normalizedThemeForegroundHex: String {
        normalizedHex(themeForegroundHex, fallback: AppTheme.themeForegroundFallback)
    }

    var themeAccentColor: Color {
        themeColor(themeAccentHex, fallback: AppTheme.themeAccentFallback)
    }

    func themeColor(_ hex: String, fallback: AppTheme.ColorFallbackToken) -> Color {
        AppTheme.customThemeColor(fromHex: hex, fallback: fallback)
    }

    func hexString(from color: Color, fallback: AppTheme.ColorFallbackToken) -> String {
        AppTheme.customThemeHexString(from: color, fallback: fallback)
    }

    func sanitizedHexInput(_ value: String, fallback: AppTheme.ColorFallbackToken) -> String {
        let digits = value
            .uppercased()
            .filter { character in
                character.isNumber || ("A"..."F").contains(character)
            }
            .prefix(6)

        if digits.isEmpty {
            return "#"
        }

        return "#\(digits)"
    }

    func normalizedHex(_ value: String, fallback: AppTheme.ColorFallbackToken) -> String {
        AppTheme.normalizedCustomThemeHex(value, fallback: fallback)
    }

    var themePresetRow: some View {
        HStack(alignment: .center, spacing: 14) {
            Text(themePresetRowTitle)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(AppTheme.textPrimary)

            Spacer(minLength: 18)

            Button(tr("导入", "Import")) {}
                .font(.system(size: 12, weight: .medium))
                .buttonStyle(.plain)
                .foregroundStyle(AppTheme.textTertiary)

            Button(tr("复制主题", "Copy theme")) {
                AppClipboard().copyText(themeExportText)
            }
            .font(.system(size: 12, weight: .medium))
            .buttonStyle(.plain)
            .foregroundStyle(AppTheme.textTertiary)

            themePresetMenuButton
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    var themePresetMenuButton: some View {
        Button {
            isThemePresetMenuPresented.toggle()
        } label: {
            HStack(spacing: 8) {
                themePresetBadge(selectedThemePreset)

                Text(selectedThemePreset.name)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Spacer(minLength: 8)

                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(AppTheme.textTertiary)
            }
            .padding(.leading, 10)
            .padding(.trailing, 9)
            .frame(minWidth: 160, maxWidth: 240, minHeight: 30, maxHeight: 30)
            .background(AppTheme.surfaceRaised)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .contentShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(themePresetRowTitle)
        .accessibilityValue(selectedThemePreset.name)
    }

    var themePresetMenu: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(alignment: .leading, spacing: 3) {
                ForEach(themePresetOptions) { preset in
                    themePresetMenuItem(preset)
                }
            }
            .padding(8)
        }
        .frame(width: 240, height: 322)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(colorScheme == .dark ? .thinMaterial : .regularMaterial)
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(AppTheme.surface.opacity(themePresetMenuSurfaceOpacity))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AppTheme.borderStrong.opacity(themePresetMenuBorderOpacity), lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: AppTheme.sidebarMenuPrimaryShadow(colorScheme: colorScheme), radius: 18, x: 0, y: 12)
        .shadow(color: AppTheme.sidebarMenuSecondaryShadow(colorScheme: colorScheme), radius: 4, x: 0, y: 1)
    }

    func themePresetMenuItem(_ preset: ThemePresetOption) -> some View {
        let isSelected = preset == selectedThemePreset
        let isHovered = hoveredThemePreset == preset.name

        return Button {
            applyThemePreset(preset)
            isThemePresetMenuPresented = false
        } label: {
            HStack(spacing: 10) {
                themePresetBadge(preset)

                Text(preset.name)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Spacer(minLength: 8)

                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
            .padding(.horizontal, 8)
            .frame(height: 31)
            .background(isHovered ? AppTheme.surfaceHover.opacity(themePresetMenuHoverOpacity) : AppTheme.transparent)
            .clipShape(RoundedRectangle(cornerRadius: 7))
            .contentShape(RoundedRectangle(cornerRadius: 7))
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            hoveredThemePreset = hovering ? preset.name : nil
        }
    }

    func themePresetBadge(_ preset: ThemePresetOption) -> some View {
        let accent = themeColor(preset.accentHex, fallback: AppTheme.themeAccentFallback)
        let background = themeColor(preset.backgroundHex, fallback: AppTheme.themeBackgroundFallback)

        return Text("Aa")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(accent)
            .frame(width: 23, height: 23)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(accent.opacity(0.42), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    var themePresetMenuSurfaceOpacity: Double {
        colorScheme == .dark ? 0.30 : 0.72
    }

    var themePresetMenuBorderOpacity: Double {
        colorScheme == .dark ? 0.92 : 0.72
    }

    var themePresetMenuHoverOpacity: Double {
        colorScheme == .dark ? 0.42 : 0.60
    }

    func applyThemePreset(_ preset: ThemePresetOption) {
        themePreset = preset.name
        themeAccentHex = preset.accentHex
        themeBackgroundHex = preset.backgroundHex
        themeForegroundHex = preset.foregroundHex
        contrast = preset.contrast
        translucentSidebar = preset.translucentSidebar
    }

    func applyGlassAppearance() {
        appearanceMode = .dark
        applyThemePreset(glassThemePreset)
    }

    func migrateLegacyThemeDefaultsIfNeeded() {
        if themePreset == "Codex" {
            themePreset = "Assistant"
        }

        guard themePreset == "Assistant",
              themeAccentHex == "#3A7CBA",
              themeBackgroundHex == "#FFFFFF",
              themeForegroundHex == "#1A1C1F" else {
            return
        }

        applyThemePreset(selectedThemePreset)
    }

    func themeChipTextColor(hex: String, fallback: AppTheme.ColorFallbackToken) -> Color {
        chipLuminance(hex: hex, fallback: fallback) > 0.62 ? Color.black.opacity(0.84) : Color.white
    }

    func chipLuminance(hex: String, fallback: AppTheme.ColorFallbackToken) -> Double {
        let normalized = normalizedHex(hex, fallback: fallback)
        let scanner = Scanner(string: String(normalized.dropFirst()))
        var rgb: UInt64 = 0

        guard scanner.scanHexInt64(&rgb) else {
            return 0
        }

        let red = Double((rgb >> 16) & 0xFF) / 255
        let green = Double((rgb >> 8) & 0xFF) / 255
        let blue = Double(rgb & 0xFF) / 255

        return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
    }

    var themeExportText: String {
        """
        const themePreview = {
          surface: "sidebar-elevated",
          accent: "\(normalizedThemeAccentHex)",
          background: "\(normalizedThemeBackgroundHex)",
          foreground: "\(normalizedThemeForegroundHex)",
          contrast: \(Int(contrast)),
        };
        """
    }

    var themePreviewCodeSurface: Color {
        isPreviewingDarkTheme ? AppTheme.themePreviewCodeSurface : Color.white
    }

    var themePreviewTextColor: Color {
        isPreviewingDarkTheme ? AppTheme.themePreviewText : DesignTokens.ColorToken(hex: 0x24292F).color
    }

    var themePreviewLineNumberColor: Color {
        isPreviewingDarkTheme ? AppTheme.themePreviewLineNumber : DesignTokens.ColorToken(hex: 0x57606A).color
    }

    var themePreviewKeywordColor: Color {
        isPreviewingDarkTheme ? AppTheme.themePreviewSyntaxKeyword : DesignTokens.ColorToken(hex: 0x8250DF).color
    }

    var themePreviewNameColor: Color {
        isPreviewingDarkTheme ? AppTheme.themePreviewSyntaxName : DesignTokens.ColorToken(hex: 0x953800).color
    }

    var themePreviewStringColor: Color {
        isPreviewingDarkTheme ? AppTheme.themePreviewSyntaxString : DesignTokens.ColorToken(hex: 0x116329).color
    }

    var themePreviewRemovedTextColor: Color {
        isPreviewingDarkTheme ? AppTheme.diffRemovedText : DesignTokens.ColorToken(hex: 0xCF222E).color
    }

    var themePreviewRemovedBackground: Color {
        isPreviewingDarkTheme ? AppTheme.diffRemovedBackground : DesignTokens.ColorToken(hex: 0xFFEBE9).color
    }

    var themePreviewAddedTextColor: Color {
        isPreviewingDarkTheme ? AppTheme.diffAddedText : DesignTokens.ColorToken(hex: 0x1A7F37).color
    }

    var themePreviewAddedBackground: Color {
        isPreviewingDarkTheme ? AppTheme.diffAddedBackground : DesignTokens.ColorToken(hex: 0xE6FFEC).color
    }

    var themeDiffPreview: some View {
        HStack(spacing: 0) {
            diffPane(
                markerColor: themePreviewRemovedTextColor,
                lines: [
                    themeHeaderLine(),
                    themeCodeLine(number: "2", key: "surface", value: "\"sidebar\"", changedBackground: themePreviewRemovedBackground),
                    themeCodeLine(number: "3", key: "accent", value: "\"\(AppTheme.themePreviewPreviousAccentHex)\"", changedBackground: themePreviewRemovedBackground),
                    themeCodeLine(number: "4", key: "contrast", value: "42", changedBackground: themePreviewRemovedBackground),
                    themeFooterLine(),
                ]
            )

            Rectangle()
                .fill(themeAccentColor)
                .frame(width: 3)

            diffPane(
                markerColor: themePreviewAddedTextColor,
                lines: [
                    themeHeaderLine(),
                    themeCodeLine(number: "2", key: "surface", value: "\"sidebar-elevated\"", changedBackground: themePreviewAddedBackground),
                    themeCodeLine(number: "3", key: "accent", value: "\"\(normalizedThemeAccentHex)\"", changedBackground: themePreviewAddedBackground),
                    themeCodeLine(number: "4", key: "contrast", value: "68", changedBackground: themePreviewAddedBackground),
                    themeFooterLine(),
                ]
            )
        }
        .frame(minWidth: 0, maxWidth: .infinity)
        .frame(height: 124)
        .background(themePreviewCodeSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    func diffPane(
        markerColor: Color,
        lines: [ThemeDiffLine]
    ) -> some View {
        ZStack(alignment: .leading) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(lines) { line in
                    HStack(spacing: 8) {
                        Text(line.number)
                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                            .foregroundStyle(themePreviewLineNumberColor)
                            .frame(width: 22, alignment: .trailing)

                        HStack(spacing: 0) {
                            ForEach(Array(line.fragments.enumerated()), id: \.offset) { _, fragment in
                                Text(fragment.text)
                                    .foregroundStyle(fragment.color)
                            }
                        }
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                        .clipped()

                        Spacer(minLength: 0)
                    }
                    .padding(.leading, 8)
                    .padding(.trailing, 10)
                    .frame(height: 22)
                    .background(line.isChanged ? line.background : AppTheme.transparent)
                }
            }
            .padding(.top, 8)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            Rectangle()
                .fill(markerColor)
                .frame(width: 3, height: 66)
                .padding(.top, 30)
                .frame(maxHeight: .infinity, alignment: .top)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    func themeHeaderLine() -> ThemeDiffLine {
        ThemeDiffLine(
            number: "1",
            isChanged: false,
            background: AppTheme.transparent,
            fragments: [
                ThemeDiffFragment(text: "const ", color: themePreviewKeywordColor),
                ThemeDiffFragment(text: "themePreview", color: themePreviewNameColor),
                ThemeDiffFragment(text: ": ", color: themePreviewTextColor),
                ThemeDiffFragment(text: "ThemeConfig", color: themePreviewKeywordColor),
                ThemeDiffFragment(text: " = {", color: themePreviewTextColor),
            ]
        )
    }

    func themeCodeLine(number: String, key: String, value: String, changedBackground: Color) -> ThemeDiffLine {
        let isQuotedValue = value.hasPrefix("\"")
        return ThemeDiffLine(
            number: number,
            isChanged: true,
            background: changedBackground,
            fragments: [
                ThemeDiffFragment(text: "  \(key)", color: themePreviewNameColor),
                ThemeDiffFragment(text: ": ", color: themePreviewTextColor),
                ThemeDiffFragment(text: value, color: isQuotedValue ? themePreviewStringColor : themePreviewNameColor),
                ThemeDiffFragment(text: ",", color: themePreviewTextColor),
            ]
        )
    }

    func themeFooterLine() -> ThemeDiffLine {
        ThemeDiffLine(
            number: "5",
            isChanged: false,
            background: AppTheme.transparent,
            fragments: [
                ThemeDiffFragment(text: "};", color: themePreviewTextColor),
            ]
        )
    }

    func appearanceModeButton(_ mode: AppearanceMode) -> some View {
        Button {
            appearanceMode = mode
        } label: {
            let isSelected = appearanceMode == mode

            HStack(spacing: 6) {
                Image(systemName: mode.systemName)
                    .font(.system(size: 12, weight: .medium))
                Text(mode.title(language: appLanguage))
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
            .foregroundStyle(isSelected ? AppTheme.textPrimary : AppTheme.textSecondary)
            .padding(.horizontal, 10)
            .frame(minWidth: 58)
            .frame(height: 28)
            .background(isSelected ? AppTheme.surfaceRaised : AppTheme.transparent)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? AppTheme.borderStrong : AppTheme.transparent, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .fixedSize(horizontal: true, vertical: false)
    }

    var glassAppearanceButton: some View {
        Button {
            applyGlassAppearance()
        } label: {
            let isSelected = selectedThemePreset.name == "Glass" && translucentSidebar

            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.system(size: 12, weight: .medium))
                Text(tr("玻璃", "Glass"))
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
            .foregroundStyle(isSelected ? AppTheme.textPrimary : AppTheme.textSecondary)
            .padding(.horizontal, 10)
            .frame(minWidth: 58)
            .frame(height: 28)
            .background(isSelected ? AppTheme.surfaceRaised : AppTheme.transparent)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? AppTheme.borderStrong : AppTheme.transparent, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .fixedSize(horizontal: true, vertical: false)
        .help(tr("应用 Glass 主题并启用半透明侧边栏", "Apply the Glass theme and enable the translucent sidebar"))
    }

    func appearancePreviewCard(
        title: String,
        subtitle: String,
        palette: AppearancePreviewPalette,
        isSelected: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            ZStack(alignment: .bottomLeading) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(palette.canvas)

                HStack(spacing: 0) {
                    Rectangle()
                        .fill(palette.sidebar)
                        .frame(width: 42)

                    VStack(alignment: .leading, spacing: 8) {
                        Capsule().fill(palette.borderStrong).frame(width: 96, height: 5)
                        Capsule().fill(palette.border).frame(width: 132, height: 5)
                        RoundedRectangle(cornerRadius: 5).fill(palette.surfaceRaised).frame(width: 76, height: 18)
                        RoundedRectangle(cornerRadius: 5).fill(palette.surfaceHover).frame(width: 76, height: 18)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)

                    Spacer(minLength: 0)
                }
                .frame(height: 104)
                .background(palette.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(12)
            }
            .frame(height: 132)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? AppTheme.borderStrong : AppTheme.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(isSelected ? AppTheme.surfaceRaised : AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? AppTheme.borderStrong : AppTheme.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
