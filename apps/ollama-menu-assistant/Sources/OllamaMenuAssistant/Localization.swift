import Foundation

enum AppLanguageOption: String, CaseIterable, Identifiable, Sendable {
    case auto
    case simplifiedChinese
    case english

    var id: String { rawValue }

    init(storedValue: String) {
        switch storedValue {
        case Self.auto.rawValue, "自动检测", "Auto":
            self = .auto
        case Self.english.rawValue, "English", "en":
            self = .english
        case Self.simplifiedChinese.rawValue, "简体中文", "zh-Hans", "zh_CN":
            self = .simplifiedChinese
        default:
            self = .auto
        }
    }

    var storageValue: String {
        rawValue
    }

    func title(language: AppLanguage) -> String {
        switch self {
        case .auto:
            return language == .english ? "Auto" : "自动检测"
        case .simplifiedChinese:
            return language == .english ? "Simplified Chinese" : "简体中文"
        case .english:
            return "English"
        }
    }
}

enum AppLanguage: String, Sendable {
    case simplifiedChinese
    case english

    static func resolved(from storedValue: String, locale: Locale = .current) -> AppLanguage {
        switch AppLanguageOption(storedValue: storedValue) {
        case .simplifiedChinese:
            return .simplifiedChinese
        case .english:
            return .english
        case .auto:
            let identifier = locale.identifier.lowercased()
            let languageCode = locale.language.languageCode?.identifier.lowercased()
            return languageCode == "zh" || identifier.hasPrefix("zh") ? .simplifiedChinese : .english
        }
    }

    static func current(defaults: UserDefaults = .standard) -> AppLanguage {
        resolved(from: defaults.string(forKey: AppPreferenceKeys.Settings.language) ?? AppLanguageOption.auto.storageValue)
    }
}

struct LocalizedStrings: Sendable {
    let language: AppLanguage

    func callAsFunction(_ simplifiedChinese: String, _ english: String) -> String {
        language == .english ? english : simplifiedChinese
    }

    static func current(defaults: UserDefaults = .standard) -> LocalizedStrings {
        LocalizedStrings(language: AppLanguage.current(defaults: defaults))
    }
}
