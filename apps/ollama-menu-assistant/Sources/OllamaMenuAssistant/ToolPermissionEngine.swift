import Foundation

struct ToolPermissionDecision: Hashable, Sendable {
    var allowed: Bool
    var useSandbox: Bool
    var errorCode: String?
    var message: String

    static func allow(useSandbox: Bool = false, message: String = "allowed") -> ToolPermissionDecision {
        ToolPermissionDecision(allowed: true, useSandbox: useSandbox, errorCode: nil, message: message)
    }

    static func deny(_ code: String, _ message: String) -> ToolPermissionDecision {
        ToolPermissionDecision(allowed: false, useSandbox: false, errorCode: code, message: message)
    }
}

struct ToolPermissionEngine {
    private static let safeShellCommands: Set<String> = [
        "awk",
        "cat",
        "file",
        "find",
        "git",
        "grep",
        "head",
        "ls",
        "pwd",
        "rg",
        "sed",
        "stat",
        "tail",
        "tree",
        "wc",
    ]

    private static let safeGitSubcommands: Set<String> = [
        "branch",
        "diff",
        "log",
        "ls-files",
        "rev-parse",
        "show",
        "status",
    ]

    private static let destructiveShellPatterns: [String] = [
        #"\brm\b"#,
        #"\brmdir\b"#,
        #"\bmv\b"#,
        #"\bcp\b"#,
        #"\bmkdir\b"#,
        #"\btouch\b"#,
        #"\bchmod\b"#,
        #"\bchown\b"#,
        #"\bkill\b"#,
        #"\bpkill\b"#,
        #"\blaunchctl\b"#,
        #"\bcurl\b"#,
        #"\bwget\b"#,
        #"\bssh\b"#,
        #"\bscp\b"#,
        #"\bnpm\b"#,
        #"\bpnpm\b"#,
        #"\byarn\b"#,
        #"\bpython3?\b"#,
        #"\bnode\b"#,
        #"\bswift\b"#,
    ]

    private static let shellMetacharacters: [String] = [
        ";",
        "&&",
        "||",
        ">",
        "<",
        "`",
        "$(",
        "\n",
    ]

    static func review(
        operation: WorkspaceToolOperation,
        mode: ToolPermissionMode,
        targetURLs: [URL] = [],
        command: String? = nil,
        cwd: URL? = nil,
        workspaceRoot: URL?
    ) -> ToolPermissionDecision {
        if mode == .fullAccess {
            return .allow(useSandbox: false)
        }

        guard let workspaceRoot else {
            return .deny("no_workspace", "No workspace is selected for this conversation.")
        }

        let normalizedRoot = workspaceRoot.standardizedFileURL.resolvingSymlinksInPath()
        for targetURL in targetURLs {
            let normalizedTarget = targetURL.standardizedFileURL.resolvingSymlinksInPath()
            guard isPath(normalizedTarget, inside: normalizedRoot) else {
                return .deny(
                    "outside_workspace",
                    "Path is outside the selected workspace: \(normalizedTarget.path)"
                )
            }
        }

        if let cwd {
            let normalizedCWD = cwd.standardizedFileURL.resolvingSymlinksInPath()
            guard isPath(normalizedCWD, inside: normalizedRoot) else {
                return .deny("outside_workspace", "Command cwd is outside the selected workspace.")
            }
        }

        switch operation {
        case .read:
            return .allow(useSandbox: false)
        case .write:
            if mode == .autoReview {
                return .allow(useSandbox: false, message: "auto_review_write_inside_workspace")
            }
            return .deny("permission_denied", "Default permission mode is read-only.")
        case .delete:
            return .deny("destructive_command", "Delete operations require full access.")
        case .shell:
            guard let command,
                  isSafeReadOnlyShell(command: command, workspaceRoot: normalizedRoot) else {
                return .deny("destructive_command", "Shell command is not classified as read-only.")
            }
            return .allow(useSandbox: true, message: "read_only_shell_sandbox")
        }
    }

    static func isPath(_ url: URL, inside rootURL: URL) -> Bool {
        let path = url.standardizedFileURL.resolvingSymlinksInPath().path
        let rootPath = rootURL.standardizedFileURL.resolvingSymlinksInPath().path
        return path == rootPath || path.hasPrefix(rootPath + "/")
    }

    static func isSafeReadOnlyShell(command: String, workspaceRoot: URL) -> Bool {
        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return false
        }

        for metacharacter in shellMetacharacters where trimmed.contains(metacharacter) {
            return false
        }

        for pattern in destructiveShellPatterns {
            if trimmed.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil {
                return false
            }
        }

        let tokens = tokenizeShell(trimmed)
        guard let first = tokens.first else {
            return false
        }
        let executable = URL(fileURLWithPath: first).lastPathComponent
        guard safeShellCommands.contains(executable) else {
            return false
        }

        if executable == "git",
           tokens.count > 1,
           !tokens[1].hasPrefix("-"),
           !safeGitSubcommands.contains(tokens[1]) {
            return false
        }

        for token in tokens.dropFirst() {
            if token.hasPrefix("~") {
                return false
            }
            guard token.hasPrefix("/") else {
                continue
            }
            if token.hasPrefix("/bin/")
                || token.hasPrefix("/usr/bin/")
                || token.hasPrefix("/opt/homebrew/bin/") {
                continue
            }
            let url = URL(fileURLWithPath: token)
            guard isPath(url, inside: workspaceRoot) else {
                return false
            }
        }

        return true
    }

    private static func tokenizeShell(_ command: String) -> [String] {
        var tokens: [String] = []
        var current = ""
        var quote: Character?
        var iterator = command.makeIterator()

        while let character = iterator.next() {
            if let activeQuote = quote {
                if character == activeQuote {
                    quote = nil
                } else {
                    current.append(character)
                }
                continue
            }

            if character == "'" || character == "\"" {
                quote = character
            } else if character == "\\" {
                if let next = iterator.next() {
                    current.append(next)
                }
            } else if character.isWhitespace {
                if !current.isEmpty {
                    tokens.append(current)
                    current = ""
                }
            } else {
                current.append(character)
            }
        }

        if !current.isEmpty {
            tokens.append(current)
        }

        return tokens
    }
}
