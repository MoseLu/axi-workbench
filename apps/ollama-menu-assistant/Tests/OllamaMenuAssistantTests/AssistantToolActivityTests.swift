import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func assistantToolActivityExtractsMetadataAndSummaryFileLinks() throws {
    let events = [
        ToolExecutionEvent(
            toolName: "write_file",
            status: .allowed,
            summary: "Wrote 24 bytes to docs/logs/submit/20260506-053341-batch-submit.md.",
            metadata: [
                "paths": .array([.string("docs/logs/submit/20260506-053341-batch-submit.md")]),
                "created": .bool(true),
            ]
        ),
        ToolExecutionEvent(
            toolName: "apply_patch",
            status: .allowed,
            summary: "patching file Sources/OllamaMenuAssistant/Views/MessageBubbleView.swift"
        ),
    ]

    let activity = AssistantToolActivity.make(events: events, projectRootPath: "/tmp/workspace")
    let paths = activity.fileLinks.map(\.path)

    #expect(paths.contains("docs/logs/submit/20260506-053341-batch-submit.md"))
    #expect(paths.contains("Sources/OllamaMenuAssistant/Views/MessageBubbleView.swift"))
    #expect(activity.createdFileCount == 1)
    #expect(activity.editCount == 2)
}

@Test
func assistantToolActivityMergesCreatedStateForDuplicatePaths() throws {
    let summary = AssistantChangeSummary(
        files: [
            AssistantChangedFileSummary(
                path: "docs/generated.md",
                state: .untracked,
                additions: 3,
                deletions: 0
            )
        ],
        didTruncate: false
    )
    let activity = AssistantToolActivity.make(
        events: [
            ToolExecutionEvent(
                toolName: "apply_patch",
                status: .allowed,
                summary: "patching file docs/generated.md"
            )
        ],
        changeSummary: summary,
        projectRootPath: "/tmp/workspace"
    )

    #expect(activity.fileLinks == [WorkspaceFileLink(path: "docs/generated.md", isCreated: true)])
    #expect(activity.createdFileCount == 1)
}

@Test
func workspacePathLinkExtractorNormalizesWorkspacePaths() throws {
    let root = "/tmp/workspace"

    #expect(
        WorkspacePathLinkExtractor.normalizedPath(
            "/tmp/workspace/Sources/AppModel.swift:42:7",
            projectRootPath: root
        ) == "Sources/AppModel.swift"
    )
    #expect(
        WorkspacePathLinkExtractor.normalizedPath(
            "file:///tmp/workspace/docs/notes.md",
            projectRootPath: root
        ) == "docs/notes.md"
    )
    #expect(
        WorkspacePathLinkExtractor.normalizedPath(
            "/tmp/outside/notes.md",
            projectRootPath: root
        ) == nil
    )
}

@Test
func workspacePathLinkExtractorPreservesReferenceLocations() throws {
    let root = "/tmp/workspace"

    let absolute = WorkspacePathLinkExtractor.reference(
        from: "/tmp/workspace/Sources/AppModel.swift:42:7",
        projectRootPath: root
    )
    #expect(absolute?.path == "Sources/AppModel.swift")
    #expect(absolute?.line == 42)
    #expect(absolute?.column == 7)
    #expect(absolute?.navigationTarget == "Sources/AppModel.swift:42:7")

    let lineLabel = WorkspacePathLinkExtractor.reference(
        from: "README.md (line 18)",
        projectRootPath: root
    )
    #expect(lineLabel?.path == "README.md")
    #expect(lineLabel?.line == 18)
    #expect(lineLabel?.column == nil)
}

@Test
func workspaceFileReferenceInlineParserExtractsMarkdownAndPlainReferences() throws {
    let segments = WorkspaceFileReferenceInlineParser.segments(
        in: "看 [AppRoutes.tsx](/tmp/workspace/src/AppRoutes.tsx:1)，以及 README.md (line 18)。",
        projectRootPath: "/tmp/workspace"
    )

    let references = segments.compactMap { segment -> WorkspaceFileReference? in
        if case .reference(let reference) = segment {
            return reference
        }
        return nil
    }

    #expect(references.map(\.path) == ["src/AppRoutes.tsx", "README.md"])
    #expect(references.map(\.line) == [1, 18])
}

@Test
func assistantToolActivityFormatsDurations() throws {
    #expect(AssistantToolActivity.durationText(seconds: 9) == "9s")
    #expect(AssistantToolActivity.durationText(seconds: 73) == "1m 13s")
    #expect(AssistantToolActivity.durationText(seconds: 3_729) == "1h 2m 9s")
}
