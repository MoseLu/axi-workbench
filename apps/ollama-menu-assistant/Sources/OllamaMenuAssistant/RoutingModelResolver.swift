import Foundation

enum RoutingModelResolver {
    private static let minimumGeneralModelSize: Int64 = 4_000_000_000

    static func resolve(
        mode: RoutingMode,
        models: [ModelSummary],
        preferredExpertModelName: String,
        attachments: [MessageAttachment] = []
    ) -> ModelSummary? {
        if attachments.requiresVisionModel {
            return resolveVision(
                mode: mode,
                models: models,
                preferredExpertModelName: preferredExpertModelName
            )
        }

        return resolveText(
            mode: mode,
            models: models,
            preferredExpertModelName: preferredExpertModelName
        )
    }

    private static func resolveText(
        mode: RoutingMode,
        models: [ModelSummary],
        preferredExpertModelName: String
    ) -> ModelSummary? {
        let stableModels = stableCompletionModels(from: models)
        guard !stableModels.isEmpty else {
            return nil
        }

        switch mode {
        case .expert:
            return preferredModel(
                named: [
                    preferredExpertModelName,
                    "qwen3.5:35b-a3b",
                    "qwen3.5:34b-q4_k_m",
                    "qwen3.5-34b-q4_k_m",
                    "main:latest",
                    "qwen3.5:27b",
                    "gemma3:12b",
                    "qwen3.5:9b",
                ],
                in: stableModels
            ) ?? stableModels.max(by: { $0.size < $1.size })
        case .balanced:
            return preferredModel(
                named: [
                    "qwen3.5:27b",
                    "qwen3.5:9b",
                    "gemma3:12b",
                    "qwen3.5:35b-a3b",
                    "main:latest",
                    "qwen3.5-9b-opus:latest",
                ],
                in: stableModels
            ) ?? nearest(to: 12_000_000_000, in: stableModels)
        case .quick:
            return preferredModel(
                named: [
                    "qwen3.5:9b",
                    "qwen3.5-9b-opus:latest",
                    "gemma3:12b",
                    "qwen3.5:27b",
                    "qwen3.5:35b-a3b",
                    "main:latest",
                ],
                in: stableModels
            ) ?? nearest(to: 5_000_000_000, in: stableModels)
        }
    }

    private static func resolveVision(
        mode: RoutingMode,
        models: [ModelSummary],
        preferredExpertModelName: String
    ) -> ModelSummary? {
        let stableModels = stableCompletionModels(from: models, requiringVision: true)
        guard !stableModels.isEmpty else {
            return nil
        }

        switch mode {
        case .expert:
            return preferredModel(
                named: [
                    "qwen3-vl:32b",
                    preferredExpertModelName,
                    "qwen3-vl:30b",
                    "qwen3-vl:8b",
                    "gemma3:27b",
                    "gemma3:12b",
                    "qwen2.5vl:32b",
                    "qwen2.5vl:7b",
                    "minicpm-v-4.5:latest",
                    "openbmb/minicpm-v4.5",
                    "llava:13b",
                    "llava:7b",
                ],
                in: stableModels
            ) ?? stableModels.max(by: { $0.size < $1.size })
        case .balanced:
            return preferredModel(
                named: [
                    "qwen3-vl:32b",
                    "qwen3-vl:8b",
                    "gemma3:12b",
                    "qwen2.5vl:7b",
                    "minicpm-v-4.5:latest",
                    "openbmb/minicpm-v4.5",
                    "llava:7b",
                ],
                in: stableModels
            ) ?? nearest(to: 8_000_000_000, in: stableModels)
        case .quick:
            return preferredModel(
                named: [
                    "qwen3-vl:8b",
                    "gemma3:12b",
                    "qwen3-vl:30b",
                    "qwen3-vl:32b",
                    "qwen2.5vl:7b",
                    "llava:7b",
                    "minicpm-v-4.5:latest",
                    "openbmb/minicpm-v4.5",
                ],
                in: stableModels
            ) ?? nearest(to: 5_000_000_000, in: stableModels)
        }
    }

    static func resolveUncensoredFallback(
        mode: RoutingMode,
        models: [ModelSummary],
        attachments: [MessageAttachment] = []
    ) -> ModelSummary? {
        if attachments.requiresVisionModel {
            return resolveUncensoredVisionFallback(mode: mode, models: models)
        }

        return resolveUncensoredTextFallback(mode: mode, models: models)
    }

    private static func resolveUncensoredTextFallback(
        mode: RoutingMode,
        models: [ModelSummary]
    ) -> ModelSummary? {
        let fallbackModels = uncensoredCompletionModels(from: models)
        guard !fallbackModels.isEmpty else {
            return nil
        }

        switch mode {
        case .expert:
            return preferredModel(
                named: [
                    "qwen3.5-35b-a3b-uncensored:q4_k_m",
                    "qwen3.5-35b-a3b-uncensored:latest",
                    "qwen3.5:35b-a3b-uncensored",
                    "dolphin-llama3:latest",
                    "dolphin-mistral:latest",
                ],
                in: fallbackModels
            ) ?? fallbackModels.max(by: { $0.size < $1.size })
        case .balanced:
            return preferredModel(
                named: [
                    "qwen3.5-35b-a3b-uncensored:q4_k_m",
                    "qwen3.5-35b-a3b-uncensored:latest",
                    "dolphin-llama3:latest",
                    "dolphin-mistral:latest",
                ],
                in: fallbackModels
            ) ?? nearest(to: 8_000_000_000, in: fallbackModels)
        case .quick:
            return preferredModel(
                named: [
                    "dolphin-llama3:latest",
                    "dolphin-mistral:latest",
                    "qwen3.5-35b-a3b-uncensored:q4_k_m",
                    "qwen3.5-35b-a3b-uncensored:latest",
                ],
                in: fallbackModels
            ) ?? nearest(to: 5_000_000_000, in: fallbackModels)
        }
    }

    private static func resolveUncensoredVisionFallback(
        mode: RoutingMode,
        models: [ModelSummary]
    ) -> ModelSummary? {
        let fallbackModels = uncensoredCompletionModels(from: models, requiringVision: true)
        guard !fallbackModels.isEmpty else {
            return nil
        }

        switch mode {
        case .expert:
            return preferredModel(
                named: [
                    "huihui_ai/qwen3-vl-abliterated:32b-instruct",
                    "huihui_ai/qwen3-vl-abliterated:latest",
                    "redule26/huihui_ai_qwen2.5-vl-7b-abliterated:latest",
                ],
                in: fallbackModels
            ) ?? fallbackModels.max(by: { $0.size < $1.size })
        case .balanced:
            return preferredModel(
                named: [
                    "huihui_ai/qwen3-vl-abliterated:32b-instruct",
                    "redule26/huihui_ai_qwen2.5-vl-7b-abliterated:latest",
                    "huihui_ai/qwen3-vl-abliterated:latest",
                ],
                in: fallbackModels
            ) ?? nearest(to: 8_000_000_000, in: fallbackModels)
        case .quick:
            return preferredModel(
                named: [
                    "redule26/huihui_ai_qwen2.5-vl-7b-abliterated:latest",
                    "huihui_ai/qwen3-vl-abliterated:32b-instruct",
                    "huihui_ai/qwen3-vl-abliterated:latest",
                ],
                in: fallbackModels
            ) ?? nearest(to: 5_000_000_000, in: fallbackModels)
        }
    }

    static func uncensoredCompletionModels(
        from models: [ModelSummary],
        requiringVision: Bool = false
    ) -> [ModelSummary] {
        models.filter { model in
            guard model.supportsCompletion, model.size >= minimumGeneralModelSize else {
                return false
            }
            if requiringVision && !model.supportsVision {
                return false
            }
            if !requiringVision && isDenied(model.name, requiringVision: false) {
                return false
            }
            if isDeniedGeneric(model.name) || isTooSmallByName(model.name) {
                return false
            }
            return isUncensored(model.name)
        }
    }

    static func stableCompletionModels(
        from models: [ModelSummary],
        requiringVision: Bool = false
    ) -> [ModelSummary] {
        models.filter { model in
            guard model.supportsCompletion, model.size >= minimumGeneralModelSize else {
                return false
            }
            if requiringVision && !model.supportsVision {
                return false
            }
            if isDenied(model.name, requiringVision: requiringVision) || isUncensored(model.name) || isTooSmallByName(model.name) {
                return false
            }
            return true
        }
    }

    private static func preferredModel(named names: [String], in models: [ModelSummary]) -> ModelSummary? {
        let modelsByLowercaseName = Dictionary(uniqueKeysWithValues: models.map { ($0.name.lowercased(), $0) })
        for name in names {
            if let model = modelsByLowercaseName[name.lowercased()] {
                return model
            }
        }
        return nil
    }

    private static func isDenied(_ name: String, requiringVision: Bool) -> Bool {
        let lowercased = name.lowercased()
        let deniedFragments = requiringVision ? deniedVisionFragments : deniedTextFragments
        return deniedFragments.contains { lowercased.contains($0) }
    }

    private static func isDeniedGeneric(_ name: String) -> Bool {
        let lowercased = name.lowercased()
        return deniedGenericFragments.contains { lowercased.contains($0) }
    }

    private static func isUncensored(_ name: String) -> Bool {
        let lowercased = name.lowercased()
        return uncensoredFragments.contains { lowercased.contains($0) }
    }

    private static func isTooSmallByName(_ name: String) -> Bool {
        let lowercased = name.lowercased()
        return tooSmallFragments.contains { lowercased.contains($0) }
    }

    private static func nearest(to target: Int64, in models: [ModelSummary]) -> ModelSummary? {
        models.min { lhs, rhs in
            let lhsDistance = abs(lhs.size - target)
            let rhsDistance = abs(rhs.size - target)
            if lhsDistance == rhsDistance {
                return lhs.size < rhs.size
            }
            return lhsDistance < rhsDistance
        }
    }

    private static let deniedGenericFragments: [String] = [
        "nomic-embed-text",
        "all-minilm",
        "bge-m3",
        "mxbai-embed-large",
        "embeddinggemma",
    ]

    private static let deniedTextFragments: [String] = deniedGenericFragments + [
        "moondream",
        "llava",
        "minicpm-v",
        "qwen3-vl",
        "qwen2.5vl",
        "qwen2.5-vl",
        "glm-ocr",
        "deepseek-ocr",
        "deepseek-r1",
    ]

    private static let deniedVisionFragments: [String] = deniedGenericFragments + [
        "deepseek-r1",
    ]

    private static let uncensoredFragments: [String] = [
        "uncensored",
        "abliterated",
        "dolphin-",
        "huihui_ai",
        "huihui-ai",
    ]

    private static let tooSmallFragments: [String] = [
        ":1b",
        ":2b",
        ":3b",
        ":4b",
        "-1b",
        "-2b",
        "-3b",
        "-4b",
        "_1b",
        "_2b",
        "_3b",
        "_4b",
    ]
}
