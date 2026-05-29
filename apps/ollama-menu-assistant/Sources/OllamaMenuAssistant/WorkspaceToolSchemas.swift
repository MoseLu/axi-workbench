import Foundation

extension WorkspaceToolService {
    static func parametersSchema(for name: String) -> JSONValue {
        switch name {
        case "list_skills":
            return objectSchema(["maxResults": numberSchema("Maximum number of skills to list.")])
        case "read_skill":
            return objectSchema([
                "skill": stringSchema("Skill name or relative skill path."),
                "file": stringSchema("Optional file path inside the skill directory. Defaults to SKILL.md."),
                "maxBytes": numberSchema("Maximum bytes to read."),
            ], required: ["skill"])
        case "list_dir", "tree":
            return objectSchema([
                "path": stringSchema("Workspace-relative path. Defaults to ."),
                "maxDepth": numberSchema("Maximum recursion depth."),
                "maxEntries": numberSchema("Maximum number of entries."),
            ])
        case "read_file":
            return objectSchema([
                "path": stringSchema("Workspace-relative file path."),
                "maxBytes": numberSchema("Maximum bytes to read."),
            ], required: ["path"])
        case "stat_path":
            return objectSchema(["path": stringSchema("Workspace-relative path.")], required: ["path"])
        case "glob_files":
            return objectSchema([
                "pattern": stringSchema("Glob pattern, for example **/*.swift."),
                "maxDepth": numberSchema("Maximum recursion depth."),
                "maxResults": numberSchema("Maximum number of results."),
            ], required: ["pattern"])
        case "find_files":
            return objectSchema([
                "query": stringSchema("Filename substring. Empty returns files."),
                "maxDepth": numberSchema("Maximum recursion depth."),
                "maxResults": numberSchema("Maximum number of results."),
            ])
        case "search":
            return objectSchema([
                "query": stringSchema("Filename text, glob pattern, or content query."),
                "path": stringSchema("Workspace-relative path to search. Defaults to ."),
                "mode": .object([
                    "type": .string("string"),
                    "description": .string("Search mode: auto, files, content, or glob."),
                    "enum": .array(["auto", "files", "content", "glob"].map(JSONValue.string)),
                ]),
                "maxDepth": numberSchema("Maximum depth for file searches."),
                "maxResults": numberSchema("Maximum total result count."),
                "timeoutSeconds": numberSchema("Timeout in seconds for content search."),
            ], required: ["query"])
        case "search_rg", "grep_text":
            return objectSchema([
                "query": stringSchema("Text or regex query."),
                "path": stringSchema("Workspace-relative path. Defaults to ."),
                "maxResults": numberSchema("Maximum result count."),
                "timeoutSeconds": numberSchema("Timeout in seconds."),
            ], required: ["query"])
        case "shell_command":
            return objectSchema([
                "command": stringSchema("Shell command to run."),
                "cwd": stringSchema("Workspace-relative cwd. Defaults to ."),
                "timeoutSeconds": numberSchema("Timeout in seconds."),
            ], required: ["command"])
        case "write_file":
            return objectSchema([
                "path": stringSchema("Path to write."),
                "content": stringSchema("UTF-8 text content."),
                "append": boolSchema("Append instead of replacing."),
            ], required: ["path", "content"])
        case "apply_patch":
            return objectSchema(["patch": stringSchema("Standard unified diff patch.")], required: ["patch"])
        case "move_path":
            return objectSchema([
                "from": stringSchema("Source path."),
                "to": stringSchema("Destination path."),
            ], required: ["from", "to"])
        case "delete_path":
            return objectSchema(["path": stringSchema("Path to delete.")], required: ["path"])
        default:
            return objectSchema([:])
        }
    }

    private static func objectSchema(_ properties: [String: JSONValue], required: [String] = []) -> JSONValue {
        .object([
            "type": .string("object"),
            "properties": .object(properties),
            "required": .array(required.map(JSONValue.string)),
        ])
    }

    private static func stringSchema(_ description: String) -> JSONValue {
        .object(["type": .string("string"), "description": .string(description)])
    }

    private static func numberSchema(_ description: String) -> JSONValue {
        .object(["type": .string("number"), "description": .string(description)])
    }

    private static func boolSchema(_ description: String) -> JSONValue {
        .object(["type": .string("boolean"), "description": .string(description)])
    }
}
