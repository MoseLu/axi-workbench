# apps/ollama-menu-assistant/Resources/Skills/ — M18 Status

**Audit wave**: M18-doc-audit (2026-10-11)
**Finding ID**: M18-43

## Status: IN USE — RETAIN

`Sources/OllamaMenuAssistant/SkillLibrary.swift` actively loads this subtree:

```swift
let sourceURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appending(path: "Resources/Skills", directoryHint: .isDirectory)
    .standardizedFileURL
if FileManager.default.fileExists(atPath: sourceURL.path) {
    roots.append(sourceURL)
}
```

`SkillLibrary.default()` falls back to the in-tree `Resources/Skills/` when running from source (development mode). The 8 top-level skill directories (`git-commit-batch`, `karpathy-guidelines`, `matt-pocock-skills`, `minimax-docx`, `minimax-pdf`, `minimax-xlsx`, `stabilize-clash-node`, `summary`) are aggregated as the app's default skill menu entries.

## Why retained

Per M18 instruction: "If unused, prune entire subtree". This subtree **is used** by the Swift app, so no prune.

The 2026-05-29 mtime reflects a one-time scaffold copy, but the Swift binding code is active and references the path; pruning would break the dev-mode skill loader. Owner may later sync content from upstream if staleness becomes a problem.

Added 2026-10-11 by fix-agent-4 (M18 doc-cleanup wave).
