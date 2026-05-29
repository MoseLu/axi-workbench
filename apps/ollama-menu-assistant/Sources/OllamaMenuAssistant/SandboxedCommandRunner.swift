import Foundation

struct SandboxedCommandResult: Hashable, Sendable {
    var exitCode: Int32
    var output: String
    var didTimeOut: Bool
    var didTruncate: Bool
}

struct SandboxedCommandRunner: Sendable {
    var outputLimitBytes: Int = 48_000

    func run(
        command: String,
        cwd: URL,
        timeoutSeconds: Int = 60,
        useSandbox: Bool,
        workspaceRoot: URL?
    ) async -> SandboxedCommandResult {
        let timeout = max(1, min(timeoutSeconds, 300))
        let tempDirectory = FileManager.default.temporaryDirectory
            .appending(path: "OllamaMenuAssistantCommand-\(UUID().uuidString)", directoryHint: .isDirectory)
        let stdoutURL = tempDirectory.appending(path: "stdout.txt")
        let stderrURL = tempDirectory.appending(path: "stderr.txt")

        do {
            try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)
            FileManager.default.createFile(atPath: stdoutURL.path, contents: nil)
            FileManager.default.createFile(atPath: stderrURL.path, contents: nil)
        } catch {
            return SandboxedCommandResult(
                exitCode: -1,
                output: "failed to prepare command output files: \(error.localizedDescription)",
                didTimeOut: false,
                didTruncate: false
            )
        }

        defer {
            try? FileManager.default.removeItem(at: tempDirectory)
        }

        let process = Process()
        let stdoutHandle: FileHandle
        let stderrHandle: FileHandle

        do {
            stdoutHandle = try FileHandle(forWritingTo: stdoutURL)
            stderrHandle = try FileHandle(forWritingTo: stderrURL)
        } catch {
            return SandboxedCommandResult(
                exitCode: -1,
                output: "failed to open command output files: \(error.localizedDescription)",
                didTimeOut: false,
                didTruncate: false
            )
        }

        defer {
            try? stdoutHandle.close()
            try? stderrHandle.close()
        }

        let launch = makeLaunch(command: command, useSandbox: useSandbox, workspaceRoot: workspaceRoot)
        process.executableURL = launch.executableURL
        process.arguments = launch.arguments
        process.currentDirectoryURL = cwd
        process.standardOutput = stdoutHandle
        process.standardError = stderrHandle
        process.environment = makeEnvironment()

        do {
            try process.run()
        } catch {
            return SandboxedCommandResult(
                exitCode: -1,
                output: "failed to launch command: \(error.localizedDescription)",
                didTimeOut: false,
                didTruncate: false
            )
        }

        let deadline = Date().addingTimeInterval(TimeInterval(timeout))
        var didTimeOut = false
        while process.isRunning {
            if Date() >= deadline, !didTimeOut {
                didTimeOut = true
                process.terminate()
            }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }

        try? stdoutHandle.synchronize()
        try? stderrHandle.synchronize()

        let stdout = readPrefix(from: stdoutURL, label: "stdout")
        let stderr = readPrefix(from: stderrURL, label: "stderr")
        let combined = combine(stdout: stdout.text, stderr: stderr.text)
        let timeoutSuffix = didTimeOut ? "\n[timeout after \(timeout)s]" : ""
        return SandboxedCommandResult(
            exitCode: process.terminationStatus,
            output: combined + timeoutSuffix,
            didTimeOut: didTimeOut,
            didTruncate: stdout.truncated || stderr.truncated
        )
    }

    private func makeLaunch(
        command: String,
        useSandbox: Bool,
        workspaceRoot: URL?
    ) -> (executableURL: URL, arguments: [String]) {
        guard useSandbox,
              FileManager.default.isExecutableFile(atPath: "/usr/bin/sandbox-exec") else {
            return (URL(fileURLWithPath: "/bin/zsh"), ["-lc", command])
        }

        let profile = makeSandboxProfile(workspaceRoot: workspaceRoot)
        return (
            URL(fileURLWithPath: "/usr/bin/sandbox-exec"),
            ["-p", profile, "/bin/zsh", "-lc", command]
        )
    }

    private func makeSandboxProfile(workspaceRoot: URL?) -> String {
        var lines = [
            "(version 1)",
            "(deny default)",
            "(allow process*)",
            "(allow sysctl*)",
            "(allow file-read*)",
            "(allow file-write*",
            "  (subpath \"/private/tmp\")",
            "  (subpath \"/tmp\")",
            ")",
            "(deny network*)",
        ]

        if let workspaceRoot {
            lines.insert("(allow file-read* (subpath \"\(escapeSandboxPath(workspaceRoot.path))\"))", at: 4)
        }
        return lines.joined(separator: "\n")
    }

    private func escapeSandboxPath(_ path: String) -> String {
        path.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
    }

    private func makeEnvironment() -> [String: String] {
        var environment = ProcessInfo.processInfo.environment
        let pathSegments = [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
        ]
        environment["PATH"] = pathSegments.joined(separator: ":") + ":" + (environment["PATH"] ?? "")
        return environment
    }

    private func readPrefix(from url: URL, label: String) -> (text: String, truncated: Bool) {
        guard let handle = try? FileHandle(forReadingFrom: url) else {
            return ("[\(label) unavailable]", false)
        }
        defer {
            try? handle.close()
        }

        let data = handle.readData(ofLength: outputLimitBytes + 1)
        let truncated = data.count > outputLimitBytes
        let prefix = truncated ? data.prefix(outputLimitBytes) : data[...]
        let text = String(data: Data(prefix), encoding: .utf8) ?? Data(prefix).base64EncodedString()
        if truncated {
            return ("\(text)\n[\(label) truncated at \(outputLimitBytes) bytes]", true)
        }
        return (text, false)
    }

    private func combine(stdout: String, stderr: String) -> String {
        let trimmedStdout = stdout.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedStderr = stderr.trimmingCharacters(in: .whitespacesAndNewlines)

        switch (trimmedStdout.isEmpty, trimmedStderr.isEmpty) {
        case (true, true):
            return ""
        case (false, true):
            return stdout
        case (true, false):
            return "[stderr]\n\(stderr)"
        case (false, false):
            return "\(stdout)\n[stderr]\n\(stderr)"
        }
    }
}
