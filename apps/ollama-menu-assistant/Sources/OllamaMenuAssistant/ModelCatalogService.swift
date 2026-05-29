import Foundation

struct ModelCatalogSnapshot: Sendable {
    let models: [ModelSummary]
    let selectedModel: String?
}

struct ModelCatalogService: Sendable {
    let client: OllamaClient

    init(client: OllamaClient) {
        self.client = client
    }

    func fetchCatalog(storedSelection: String?) async throws -> ModelCatalogSnapshot {
        let taggedModels = try await client.fetchModels()
        let runningNames = try await Set(client.fetchRunningModels().map(\.name))

        let detailsByName = try await withThrowingTaskGroup(of: (String, OllamaModelDetails).self) { group in
            for model in taggedModels {
                group.addTask {
                    (model.name, try await client.fetchModelDetails(model: model.name))
                }
            }

            var details: [String: OllamaModelDetails] = [:]
            for try await (name, response) in group {
                details[name] = response
            }
            return details
        }

        let completionModels = taggedModels.compactMap { model -> ModelSummary? in
            guard let details = detailsByName[model.name], details.capabilities.contains("completion") else {
                return nil
            }

            return ModelSummary(
                name: model.name,
                displayName: Self.displayName(for: model.name),
                size: model.size,
                capabilities: details.capabilities,
                contextLength: details.contextLength,
                isLoaded: runningNames.contains(model.name),
                modifiedAt: model.modifiedAt
            )
        }
        .sorted { lhs, rhs in
            if lhs.modifiedAt == rhs.modifiedAt {
                return lhs.name < rhs.name
            }
            return lhs.modifiedAt > rhs.modifiedAt
        }

        return ModelCatalogSnapshot(
            models: completionModels,
            selectedModel: Self.chooseDefaultModel(from: completionModels, storedSelection: storedSelection)
        )
    }

    static func chooseDefaultModel(from models: [ModelSummary], storedSelection: String?) -> String? {
        if let storedSelection, models.contains(where: { $0.name == storedSelection }) {
            return storedSelection
        }
        if models.contains(where: { $0.name == "main:latest" }) {
            return "main:latest"
        }
        return models.first?.name
    }

    static func displayName(for name: String) -> String {
        name.replacingOccurrences(of: ":latest", with: "")
    }
}
