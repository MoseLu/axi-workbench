import Foundation

enum ResponseRefusalDetector {
    static func shouldUseFallback(for content: String) -> Bool {
        let normalized = normalize(content)
        guard !normalized.isEmpty else {
            return true
        }

        if directRefusalPhrases.contains(where: { normalized.contains($0) }) {
            return true
        }

        if hasApologyOrBoundary(in: normalized), hasRefusalContext(in: normalized) {
            return true
        }

        if normalized.count <= 120, shortEvasivePhrases.contains(where: { normalized.contains($0) }) {
            return true
        }

        return false
    }

    private static func normalize(_ content: String) -> String {
        content
            .lowercased()
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func hasApologyOrBoundary(in content: String) -> Bool {
        apologyOrBoundaryPhrases.contains(where: { content.contains($0) })
    }

    private static func hasRefusalContext(in content: String) -> Bool {
        refusalContextPhrases.contains(where: { content.contains($0) })
    }

    private static let directRefusalPhrases: [String] = [
        "我不能",
        "我无法",
        "不能协助",
        "无法协助",
        "不能帮助",
        "无法帮助",
        "不能提供",
        "无法提供",
        "不能回答",
        "无法回答",
        "不能满足",
        "无法满足",
        "不方便提供",
        "拒绝回答",
        "i can't assist",
        "i cannot assist",
        "can't help with",
        "cannot help with",
        "i can't help",
        "i cannot help",
        "i can't provide",
        "i cannot provide",
        "i'm unable to",
        "i am unable to",
        "i won't provide",
        "i will not provide",
        "i can't comply",
        "i cannot comply",
        "must refuse",
    ]

    private static let apologyOrBoundaryPhrases: [String] = [
        "抱歉",
        "对不起",
        "很遗憾",
        "sorry",
        "i apologize",
        "i'm sorry",
        "as an ai",
        "作为ai",
        "作为一个ai",
        "作为人工智能",
    ]

    private static let refusalContextPhrases: [String] = [
        "不能",
        "无法",
        "不可以",
        "不会",
        "拒绝",
        "政策",
        "安全",
        "合规",
        "违法",
        "有害",
        "can't",
        "cannot",
        "unable",
        "won't",
        "will not",
        "policy",
        "safety",
        "harmful",
        "illegal",
    ]

    private static let shortEvasivePhrases: [String] = [
        "这个问题我不能回答",
        "这个请求我无法处理",
        "无法完成该请求",
        "不能完成该请求",
        "i can't answer that",
        "i cannot answer that",
        "i can't fulfill this request",
        "i cannot fulfill this request",
    ]
}
