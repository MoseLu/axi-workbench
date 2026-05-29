import Foundation

struct ModelGateway: Sendable {
    func route(
        classification: TaskClassification,
        mode: RoutingMode,
        models: [ModelSummary],
        preferredExpertModelName: String,
        attachments: [MessageAttachment],
        stats: [String: ModelPerformanceStats] = [:]
    ) -> ModelRouteDecision {
        let candidates = candidateModels(
            classification: classification,
            models: models,
            attachments: attachments
        )

        let scored = candidates.map { model in
            score(
                model,
                classification: classification,
                mode: mode,
                preferredExpertModelName: preferredExpertModelName,
                stats: stats[model.name]
            )
        }
        .sorted { lhs, rhs in
            if lhs.score == rhs.score {
                return lhs.modelName < rhs.modelName
            }
            return lhs.score > rhs.score
        }

        let selectedName = scored.first?.modelName
            ?? RoutingModelResolver.resolve(
                mode: mode,
                models: models,
                preferredExpertModelName: preferredExpertModelName,
                attachments: attachments
            )?.name
            ?? preferredExpertModelName
        let selected = models.first(where: { $0.name == selectedName })
        let fallback = fallbackModel(
            mode: mode,
            models: models,
            selectedModelName: selectedName,
            attachments: attachments
        )

        return ModelRouteDecision(
            selectedModelName: selectedName,
            selectedDisplayName: selected?.displayName ?? ModelCatalogService.displayName(for: selectedName),
            mode: mode,
            scores: scored,
            fallbackModelName: fallback?.name,
            reason: scored.first?.reasons.joined(separator: ", ") ?? "fallback static routing"
        )
    }

    private func candidateModels(
        classification: TaskClassification,
        models: [ModelSummary],
        attachments: [MessageAttachment]
    ) -> [ModelSummary] {
        let requiresVision = classification.requiresVision || attachments.requiresVisionModel
        let candidates = models.filter { model in
            guard model.supportsCompletion else {
                return false
            }
            if requiresVision && !model.supportsVision {
                return false
            }
            if let contextLength = model.contextLength,
               contextLength > 0,
               classification.estimatedTokens > Int(Double(contextLength) * 0.95) {
                return false
            }
            return true
        }
        return candidates.isEmpty ? models.filter(\.supportsCompletion) : candidates
    }

    private func score(
        _ model: ModelSummary,
        classification: TaskClassification,
        mode: RoutingMode,
        preferredExpertModelName: String,
        stats: ModelPerformanceStats?
    ) -> ModelRouteScore {
        var score = 0.0
        var reasons: [String] = []

        let sizeBillions = min(35.0, max(1.0, Double(model.size) / 1_000_000_000.0))
        switch mode {
        case .quick:
            let targetDistance = abs(sizeBillions - 7.0)
            score += max(0, 24 - targetDistance * 2.5)
            reasons.append("quick size fit")
        case .balanced:
            let targetDistance = abs(sizeBillions - 12.0)
            score += max(0, 28 - targetDistance * 1.8)
            reasons.append("balanced size fit")
        case .expert:
            score += min(36, sizeBillions)
            reasons.append("expert quality bias")
        }

        if model.name.caseInsensitiveCompare(preferredExpertModelName) == .orderedSame {
            score += mode == .expert ? 18 : 6
            reasons.append("preferred model")
        }
        if model.name == "main:latest" {
            score += mode == .expert ? 10 : 3
            reasons.append("main alias")
        }
        if model.isLoaded {
            score += 9
            reasons.append("already loaded")
        }
        if classification.requiresVision {
            score += model.supportsVision ? 18 : -100
            reasons.append(model.supportsVision ? "vision capable" : "missing vision")
        }
        if classification.prefersTools {
            score += model.supportsTools ? 16 : -4
            reasons.append(model.supportsTools ? "native tools" : "fallback tools")
        }
        if classification.labels.contains(.coding) || classification.labels.contains(.codebaseSearch) {
            if containsAny(model.name, fragments: ["qwen", "coder", "deepseek", "main"]) {
                score += 10
                reasons.append("coding prior")
            }
        }
        if classification.labels.contains(.summarization),
           let contextLength = model.contextLength,
           contextLength >= 32_000 {
            score += 8
            reasons.append("long context")
        }
        if let contextLength = model.contextLength,
           contextLength >= classification.estimatedTokens {
            let headroom = min(12, Double(contextLength - classification.estimatedTokens) / 8_000.0)
            score += headroom
        }

        if let stats {
            score -= min(35, max(0, stats.failureRate) * 35)
            if let toolSuccess = stats.toolSuccessRate, classification.prefersTools {
                score += max(0, min(1, toolSuccess)) * 10
            }
            if let latency = stats.averageLatencySeconds, mode == .quick {
                score -= min(14, latency)
            }
            if stats.failureRate > 0 {
                reasons.append("failure rate \(String(format: "%.0f", stats.failureRate * 100))%")
            }
        }

        if containsAny(model.name, fragments: ["embed", "embedding", "nomic", "bge", "minilm"]) {
            score -= 100
            reasons.append("not a chat model")
        }
        if containsAny(model.name, fragments: ["1b", "2b", "3b"]) {
            score -= 20
            reasons.append("small model penalty")
        }

        return ModelRouteScore(modelName: model.name, score: score, reasons: reasons)
    }

    private func fallbackModel(
        mode: RoutingMode,
        models: [ModelSummary],
        selectedModelName: String,
        attachments: [MessageAttachment]
    ) -> ModelSummary? {
        RoutingModelResolver.resolveUncensoredFallback(
            mode: mode,
            models: models,
            attachments: attachments
        )
        .flatMap { $0.name == selectedModelName ? nil : $0 }
    }

    private func containsAny(_ value: String, fragments: [String]) -> Bool {
        let lowercased = value.lowercased()
        return fragments.contains { lowercased.contains($0) }
    }
}

enum TaskClassifier {
    static func classify(
        messages: [ChatMessage],
        project: ConversationProject?,
        permissionMode: ToolPermissionMode
    ) -> TaskClassification {
        let lastUserMessage = messages.last(where: { $0.role == .user })
        let query = lastUserMessage?.content.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let attachments = messages.flatMap(\.attachments)
        let lowercased = query.lowercased()
        var labels: [AgentTaskKind] = []

        if attachments.requiresVisionModel {
            labels.append(.vision)
        }
        if project != nil || containsAny(lowercased, fragments: codingFragments) {
            labels.append(.coding)
        }
        if project != nil || containsAny(lowercased, fragments: searchFragments) {
            labels.append(.codebaseSearch)
        }
        if project != nil || permissionMode != .default || containsAny(lowercased, fragments: toolFragments) {
            labels.append(.toolHeavy)
        }
        if containsAny(lowercased, fragments: summaryFragments) {
            labels.append(.summarization)
        }
        if query.count > 4_000 || messages.count > 12 {
            labels.append(.longContext)
        }

        if labels.isEmpty {
            labels = [.chat]
        }

        let primary = labels.first ?? .chat
        let estimatedTokens = messages.reduce(0) { partial, message in
            partial
                + ContextWindowEstimator.estimatedContentTokens(in: message.content)
                + 8
        }

        return TaskClassification(
            primaryKind: primary,
            labels: Array(Set(labels)).sorted { $0.rawValue < $1.rawValue },
            query: query,
            requiresVision: labels.contains(.vision),
            prefersTools: labels.contains(.toolHeavy) || labels.contains(.codebaseSearch),
            estimatedTokens: estimatedTokens
        )
    }

    private static func containsAny(_ value: String, fragments: [String]) -> Bool {
        fragments.contains { value.contains($0) }
    }

    private static let codingFragments = [
        "code", "swift", "bug", "test", "build", "compile", "refactor",
        "实现", "代码", "报错", "测试", "构建", "重构", "修复",
    ]
    private static let searchFragments = [
        "where", "find", "search", "inspect", "look at", "read file",
        "在哪", "查找", "搜索", "看看", "读取", "定位",
    ]
    private static let toolFragments = [
        "edit", "write", "run", "execute", "apply", "create", "delete",
        "编辑", "写入", "运行", "执行", "创建", "删除", "改",
    ]
    private static let summaryFragments = [
        "summarize", "summary", "explain", "overview",
        "总结", "摘要", "解释", "概览",
    ]
}
