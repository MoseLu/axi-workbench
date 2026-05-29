import Foundation
import Testing
@testable import OllamaMenuAssistant

@Test
func bundledSkillLibraryDiscoversInstalledAssistantSkills() throws {
    let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        .appending(path: "Resources/Skills", directoryHint: .isDirectory)
    let library = SkillLibrary(rootURL: root)

    let skills = library.discoverSkills()

    #expect(skills.count >= 8)
    #expect(skills.contains(where: { $0.name == "karpathy-guidelines" }))
    #expect(skills.contains(where: { $0.name == "skill-installer" }))
    #expect(skills.contains(where: { $0.name == "diagnose" }))
}

@Test
func skillLibraryReadsSkillEntrypointByName() throws {
    let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        .appending(path: "Resources/Skills", directoryHint: .isDirectory)
    let library = SkillLibrary(rootURL: root)

    let result = library.readSkillFile(skill: "karpathy-guidelines", maxBytes: 8_000)

    guard case .success(let text) = result else {
        Issue.record("Expected skill read to succeed")
        return
    }
    #expect(text.contains("karpathy-guidelines"))
}

@Test
func skillToolsListAndReadBundledSkills() async throws {
    let registry = WorkspaceToolService().makeRegistry()
    let context = ToolExecutionContext(project: nil, permissionMode: .default)

    let listResult = await registry.execute(AgentToolCall(name: "list_skills"), context: context)
    let readResult = await registry.execute(
        AgentToolCall(name: "read_skill", arguments: ["skill": .string("skill-installer")]),
        context: context
    )

    #expect(listResult.ok)
    #expect(listResult.content.contains("karpathy-guidelines"))
    #expect(readResult.ok)
    #expect(readResult.content.contains("Skill Installer"))
}
