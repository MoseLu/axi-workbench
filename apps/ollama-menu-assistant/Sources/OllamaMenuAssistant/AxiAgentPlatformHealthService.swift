import Foundation

enum AxiAgentPlatformHealthSeverity: String, Codable, Comparable, Sendable {
    case ready
    case warning
    case error

    static func < (lhs: AxiAgentPlatformHealthSeverity, rhs: AxiAgentPlatformHealthSeverity) -> Bool {
        lhs.rank < rhs.rank
    }

    private var rank: Int {
        switch self {
        case .ready:
            return 0
        case .warning:
            return 1
        case .error:
            return 2
        }
    }
}

struct AxiAgentPlatformHealthCheck: Identifiable, Codable, Hashable, Sendable {
    var id: String
    var title: String
    var message: String
    var severity: AxiAgentPlatformHealthSeverity
}

struct AxiAgentPlatformHealthReport: Codable, Hashable, Sendable {
    var checkedAt: Date
    var checks: [AxiAgentPlatformHealthCheck]

    var overallSeverity: AxiAgentPlatformHealthSeverity {
        checks.map(\.severity).max() ?? .ready
    }

    var isReady: Bool {
        overallSeverity != .error
    }
}

enum AxiAgentPlatformProbeResult: Sendable {
    case success
    case failure(String)
}

struct AxiAgentPlatformHealthService: Sendable {
    typealias OllamaProbe = @Sendable () async -> AxiAgentPlatformProbeResult

    var commandPathEnvironment: String
    var ollamaProbe: OllamaProbe

    init(
        ollamaClient: OllamaClient = OllamaClient(),
        commandPathEnvironment: String = ProcessInfo.processInfo.environment["PATH"] ?? "",
        ollamaProbe: OllamaProbe? = nil
    ) {
        self.commandPathEnvironment = commandPathEnvironment
        self.ollamaProbe = ollamaProbe ?? {
            do {
                _ = try await ollamaClient.fetchModels()
                return .success
            } catch {
                return .failure(error.localizedDescription)
            }
        }
    }

    func makeReport(
        preferences: AxiAgentPlatformPreferences,
        language: AppLanguage = .simplifiedChinese
    ) async -> AxiAgentPlatformHealthReport {
        var checks = [AxiAgentPlatformHealthCheck]()
        checks.append(await ollamaCheck(language: language))
        checks.append(workspaceCheck(path: preferences.repositoryPath, language: language))
        checks.append(mcpCommandCheck(preferences: preferences, language: language))
        checks.append(providerCheck(preferences: preferences, language: language))
        checks.append(runtimeCheck(preferences: preferences, language: language))
        return AxiAgentPlatformHealthReport(checkedAt: .now, checks: checks)
    }

    private func ollamaCheck(language: AppLanguage) async -> AxiAgentPlatformHealthCheck {
        switch await ollamaProbe() {
        case .success:
            return check(
                id: "ollama",
                title: tr(language, "Ollama 服务", "Ollama service"),
                message: tr(language, "本地 Ollama 可连接。", "Local Ollama is reachable."),
                severity: .ready
            )
        case .failure(let message):
            return check(
                id: "ollama",
                title: tr(language, "Ollama 服务", "Ollama service"),
                message: tr(language, "无法连接本地 Ollama：\(message)", "Cannot reach local Ollama: \(message)"),
                severity: .error
            )
        }
    }

    private func workspaceCheck(path: String, language: AppLanguage) -> AxiAgentPlatformHealthCheck {
        let trimmedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPath.isEmpty else {
            return check(
                id: "workspace",
                title: tr(language, "工作区", "Workspace"),
                message: tr(language, "尚未设置仓库路径。", "Repository path is not set."),
                severity: .error
            )
        }

        let url = expandedFileURL(trimmedPath)
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            return check(
                id: "workspace",
                title: tr(language, "工作区", "Workspace"),
                message: tr(language, "仓库路径不存在或不是文件夹：\(url.path)", "Repository path does not exist or is not a directory: \(url.path)"),
                severity: .error
            )
        }

        guard FileManager.default.isReadableFile(atPath: url.path) else {
            return check(
                id: "workspace",
                title: tr(language, "工作区", "Workspace"),
                message: tr(language, "仓库路径不可读：\(url.path)", "Repository path is not readable: \(url.path)"),
                severity: .error
            )
        }

        let gitURL = url.appending(path: ".git")
        if FileManager.default.fileExists(atPath: gitURL.path) {
            return check(
                id: "workspace",
                title: tr(language, "工作区", "Workspace"),
                message: tr(language, "仓库路径有效，已检测到 Git 元数据。", "Repository path is valid and Git metadata was detected."),
                severity: .ready
            )
        }

        return check(
            id: "workspace",
            title: tr(language, "工作区", "Workspace"),
            message: tr(language, "仓库路径可读，但未检测到 .git 元数据。", "Repository path is readable, but .git metadata was not detected."),
            severity: .warning
        )
    }

    private func mcpCommandCheck(
        preferences: AxiAgentPlatformPreferences,
        language: AppLanguage
    ) -> AxiAgentPlatformHealthCheck {
        let command = preferences.mcpCommand.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !command.isEmpty else {
            return check(
                id: "mcp",
                title: tr(language, "Axi MCP", "Axi MCP"),
                message: tr(language, "MCP command 不能为空。", "MCP command cannot be empty."),
                severity: .error
            )
        }

        guard resolvedCommandURL(command) != nil else {
            return check(
                id: "mcp",
                title: tr(language, "Axi MCP", "Axi MCP"),
                message: tr(language, "无法在 PATH 中找到可执行命令：\(command)", "Cannot find executable command in PATH: \(command)"),
                severity: .error
            )
        }

        let cwd = preferences.mcpCWD.trimmingCharacters(in: .whitespacesAndNewlines)
        if !cwd.isEmpty {
            let cwdURL = expandedFileURL(cwd)
            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: cwdURL.path, isDirectory: &isDirectory), isDirectory.boolValue else {
                return check(
                    id: "mcp",
                    title: tr(language, "Axi MCP", "Axi MCP"),
                    message: tr(language, "MCP 工作目录不存在：\(cwdURL.path)", "MCP working directory does not exist: \(cwdURL.path)"),
                    severity: .error
                )
            }
        }

        return check(
            id: "mcp",
            title: tr(language, "Axi MCP", "Axi MCP"),
            message: tr(language, "MCP command 可执行。", "MCP command is executable."),
            severity: .ready
        )
    }

    private func providerCheck(
        preferences: AxiAgentPlatformPreferences,
        language: AppLanguage
    ) -> AxiAgentPlatformHealthCheck {
        let providerTitle = preferences.provider.title(language: language)
        let apiKey = preferences.selectedProviderAPIKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let model = preferences.selectedProviderModel.trimmingCharacters(in: .whitespacesAndNewlines)
        let baseURL = preferences.selectedProviderBaseURL.trimmingCharacters(in: .whitespacesAndNewlines)

        if apiKey.isEmpty {
            return check(
                id: "provider",
                title: tr(language, "模型 Provider", "Model provider"),
                message: tr(language, "\(providerTitle) API Key 未配置；保存允许继续，但远程模型调用会不可用。", "\(providerTitle) API key is missing; saving is allowed, but remote model calls will be unavailable."),
                severity: .warning
            )
        }

        if model.isEmpty {
            return check(
                id: "provider",
                title: tr(language, "模型 Provider", "Model provider"),
                message: tr(language, "\(providerTitle) 默认模型不能为空。", "\(providerTitle) default model cannot be empty."),
                severity: .warning
            )
        }

        if !baseURL.isEmpty, URL(string: baseURL)?.scheme == nil {
            return check(
                id: "provider",
                title: tr(language, "模型 Provider", "Model provider"),
                message: tr(language, "\(providerTitle) API URL 格式无效。", "\(providerTitle) API URL is invalid."),
                severity: .warning
            )
        }

        return check(
            id: "provider",
            title: tr(language, "模型 Provider", "Model provider"),
            message: tr(language, "\(providerTitle) 配置完整。", "\(providerTitle) configuration is complete."),
            severity: .ready
        )
    }

    private func runtimeCheck(
        preferences: AxiAgentPlatformPreferences,
        language: AppLanguage
    ) -> AxiAgentPlatformHealthCheck {
        guard (0...2).contains(preferences.defaultTemperature),
              preferences.defaultMaxTokens > 0,
              preferences.maxAgents > 0,
              preferences.maxWorktrees > 0,
              preferences.maxParallelAgents > 0,
              preferences.worktreesCleanupHours > 0,
              preferences.mcpTimeoutSeconds > 0 else {
            return check(
                id: "runtime",
                title: tr(language, "运行参数", "Runtime"),
                message: tr(language, "一个或多个运行参数超出允许范围。", "One or more runtime values are outside the allowed range."),
                severity: .error
            )
        }

        return check(
            id: "runtime",
            title: tr(language, "运行参数", "Runtime"),
            message: tr(language, "运行参数在允许范围内。", "Runtime values are within the allowed range."),
            severity: .ready
        )
    }

    private func resolvedCommandURL(_ command: String) -> URL? {
        let expandedCommand = expandedPath(command)
        if expandedCommand.contains("/") {
            return FileManager.default.isExecutableFile(atPath: expandedCommand)
                ? URL(fileURLWithPath: expandedCommand)
                : nil
        }

        for directory in commandPathEnvironment.split(separator: ":").map(String.init) {
            let candidate = URL(fileURLWithPath: expandedPath(directory)).appending(path: command)
            if FileManager.default.isExecutableFile(atPath: candidate.path) {
                return candidate
            }
        }
        return nil
    }

    private func expandedFileURL(_ path: String) -> URL {
        URL(fileURLWithPath: expandedPath(path)).standardizedFileURL
    }

    private func expandedPath(_ path: String) -> String {
        NSString(string: path).expandingTildeInPath
    }

    private func check(
        id: String,
        title: String,
        message: String,
        severity: AxiAgentPlatformHealthSeverity
    ) -> AxiAgentPlatformHealthCheck {
        AxiAgentPlatformHealthCheck(id: id, title: title, message: message, severity: severity)
    }

    private func tr(_ language: AppLanguage, _ simplifiedChinese: String, _ english: String) -> String {
        language == .english ? english : simplifiedChinese
    }
}
