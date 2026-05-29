import Foundation

enum BrowserComputerSettingsPreferences {
    static let browserNavigationApprovalKey = AppPreferenceKeys.BrowserComputer.browserNavigationApproval
    static let browserHistoryApprovalKey = AppPreferenceKeys.BrowserComputer.browserHistoryApproval
    static let browserBlockedDomainsKey = AppPreferenceKeys.BrowserComputer.browserBlockedDomains
    static let browserAllowedDomainsKey = AppPreferenceKeys.BrowserComputer.browserAllowedDomains
    static let computerAlwaysAllowedAppsKey = AppPreferenceKeys.BrowserComputer.computerAlwaysAllowedApps

    enum PermissionPolicy: String, CaseIterable, Sendable {
        case alwaysAsk
        case allow
        case deny

        init(storedValue: String) {
            self = PermissionPolicy(rawValue: storedValue) ?? .alwaysAsk
        }

        func title(language: AppLanguage) -> String {
            switch self {
            case .alwaysAsk:
                language == .english ? "Always ask" : "始终询问"
            case .allow:
                language == .english ? "Allow" : "允许"
            case .deny:
                language == .english ? "Deny" : "拒绝"
            }
        }
    }

    static func decodeStringList(_ rawValue: String) -> [String] {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return []
        }

        if let data = trimmed.data(using: .utf8),
           let values = try? JSONDecoder().decode([String].self, from: data) {
            return uniqueTrimmed(values)
        }

        return uniqueTrimmed(trimmed.components(separatedBy: .newlines))
    }

    static func encodeStringList(_ values: [String]) -> String {
        let values = uniqueTrimmed(values)
        guard let data = try? JSONEncoder().encode(values),
              let encoded = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return encoded
    }

    static func normalizedDomain(_ rawValue: String) -> String? {
        let trimmed = rawValue
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !trimmed.isEmpty else {
            return nil
        }

        if trimmed.hasPrefix("*.") {
            guard let suffix = normalizedDomain(String(trimmed.dropFirst(2))) else {
                return nil
            }
            return "*.\(suffix)"
        }

        let candidate = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        let host = URLComponents(string: candidate)?.host ?? trimmed
        let normalized = host.trimmingCharacters(in: CharacterSet(charactersIn: "."))
        guard !normalized.isEmpty,
              normalized.rangeOfCharacter(from: .whitespacesAndNewlines) == nil,
              normalized.rangeOfCharacter(from: CharacterSet(charactersIn: "/?#[]@")) == nil else {
            return nil
        }
        return normalized
    }

    static func clearBrowsingData() {
        URLCache.shared.removeAllCachedResponses()
        HTTPCookieStorage.shared.removeCookies(since: .distantPast)
    }

    private static func uniqueTrimmed(_ values: [String]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []

        for value in values {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                continue
            }
            let key = trimmed.lowercased()
            guard seen.insert(key).inserted else {
                continue
            }
            result.append(trimmed)
        }

        return result
    }
}
