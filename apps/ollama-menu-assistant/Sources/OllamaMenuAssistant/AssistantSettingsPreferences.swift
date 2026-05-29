import Foundation

enum AssistantSettingsPreferences {
    static let configScopeKey = AppPreferenceKeys.AssistantConfiguration.configScope
    static let approvalPolicyKey = AppPreferenceKeys.AssistantConfiguration.approvalPolicy
    static let sandboxModeKey = AppPreferenceKeys.AssistantConfiguration.sandboxMode
    static let bundledDependenciesEnabledKey = AppPreferenceKeys.AssistantConfiguration.bundledDependenciesEnabled
    static let personalityToneKey = AppPreferenceKeys.Personalization.personalityTone
    static let customInstructionsKey = AppPreferenceKeys.Personalization.customInstructions
    static let memoryEnabledKey = AppPreferenceKeys.Personalization.memoryEnabled
    static let skipToolAssistedMemoryKey = AppPreferenceKeys.Personalization.skipToolAssistedMemory

    enum ConfigScope: String, CaseIterable, Sendable {
        case user
        case workspace

        init(storedValue: String) {
            self = ConfigScope(rawValue: storedValue) ?? .user
        }

        func title(language: AppLanguage) -> String {
            switch self {
            case .user:
                language == .english ? "User config" : "用户配置"
            case .workspace:
                language == .english ? "Workspace config" : "工作区配置"
            }
        }
    }

    enum ApprovalPolicy: String, CaseIterable, Sendable {
        case onRequest
        case onFailure
        case never

        init(storedValue: String) {
            self = ApprovalPolicy(rawValue: storedValue) ?? .onRequest
        }

        func title(language: AppLanguage) -> String {
            switch self {
            case .onRequest:
                language == .english ? "On request" : "按需询问"
            case .onFailure:
                language == .english ? "On failure" : "失败时询问"
            case .never:
                language == .english ? "Never" : "从不询问"
            }
        }
    }

    enum SandboxMode: String, CaseIterable, Sendable {
        case readOnly
        case workspaceWrite
        case fullAccess

        init(storedValue: String) {
            self = SandboxMode(rawValue: storedValue) ?? .readOnly
        }

        func title(language: AppLanguage) -> String {
            switch self {
            case .readOnly:
                language == .english ? "Read only" : "只读"
            case .workspaceWrite:
                language == .english ? "Workspace write" : "工作区写入"
            case .fullAccess:
                language == .english ? "Full access" : "完全访问"
            }
        }
    }

    enum PersonalityTone: String, CaseIterable, Sendable {
        case warm
        case pragmatic

        init(storedValue: String) {
            self = PersonalityTone(rawValue: storedValue) ?? .warm
        }

        func title(language: AppLanguage) -> String {
            switch self {
            case .warm:
                language == .english ? "Warm" : "亲和"
            case .pragmatic:
                language == .english ? "Pragmatic" : "务实"
            }
        }

        func subtitle(language: AppLanguage) -> String {
            switch self {
            case .warm:
                language == .english ? "Warm, collaborative, caring" : "温暖、协作、贴心"
            case .pragmatic:
                language == .english ? "Concise, focused, direct" : "简洁、专注、直接"
            }
        }

        func runtimeInstruction(language: AppLanguage) -> String {
            switch self {
            case .warm:
                return language == .english
                    ? "Use a warm, collaborative, caring tone by default."
                    : "默认使用温暖、协作、贴心的语气。"
            case .pragmatic:
                return language == .english
                    ? "Use a concise, focused, direct tone by default."
                    : "默认使用简洁、专注、直接的语气。"
            }
        }
    }

    static func runtimePrompt(defaults: UserDefaults = .standard, language: AppLanguage) -> String? {
        let tone = PersonalityTone(storedValue: defaults.string(forKey: personalityToneKey) ?? "")
        let instructions = defaults.string(forKey: customInstructionsKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        var lines = [
            language == .english ? "Personalization:" : "个性化：",
            "- \(tone.runtimeInstruction(language: language))",
        ]

        if !instructions.isEmpty {
            lines.append(language == .english ? "- Follow these custom instructions:" : "- 遵循这些自定义指令：")
            lines.append(instructions)
        }

        return lines.joined(separator: "\n")
    }

    static func defaultConfigToml(
        approvalPolicy: ApprovalPolicy,
        sandboxMode: SandboxMode,
        bundledDependenciesEnabled: Bool
    ) -> String {
        """
        approval_policy = "\(approvalPolicy.rawValue)"
        sandbox_mode = "\(sandboxMode.rawValue)"
        bundled_dependencies = \(bundledDependenciesEnabled ? "true" : "false")
        """
    }
}
