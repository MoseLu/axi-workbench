import Foundation

extension AppModel {
    func applySelectedModel(_ name: String) {
        selectedModelName = name
        defaults.set(name, forKey: DefaultsKeys.selectedModelName)
    }

    func localized(_ simplifiedChinese: String, _ english: String) -> String {
        LocalizedStrings.current(defaults: defaults)(simplifiedChinese, english)
    }

    func stopVoiceInputIfNeeded() {
        guard isVoiceInputActive else {
            return
        }

        speechInputCoordinator.stop()
        isVoiceInputActive = false
        voiceDraftPrefix = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func selectedModelNameOrFallback() -> String {
        if !selectedModelName.isEmpty {
            return selectedModelName
        }
        return models.first?.name ?? "main:latest"
    }

    func resolvedModel(for attachments: [MessageAttachment]) -> ModelSummary? {
        RoutingModelResolver.resolve(
            mode: routingMode,
            models: models,
            preferredExpertModelName: selectedModelNameOrFallback(),
            attachments: attachments
        )
    }
}
