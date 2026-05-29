import Foundation

struct ToolCallParser {
    static func parseFallbackToolCalls(in content: String) -> [AgentToolCall] {
        let snippets = candidateJSONSnippets(in: content)
        for snippet in snippets {
            if let calls = decodeCalls(from: snippet), !calls.isEmpty {
                return calls
            }
        }
        return []
    }

    private static func candidateJSONSnippets(in content: String) -> [String] {
        var snippets: [String] = []
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            snippets.append(trimmed)
        }

        snippets.append(contentsOf: matches(in: content, pattern: #"<tool_call>\s*([\s\S]*?)\s*</tool_call>"#))
        snippets.append(contentsOf: matches(in: content, pattern: #"```(?:json)?\s*([\s\S]*?)\s*```"#))

        if let firstBrace = content.firstIndex(of: "{"),
           let lastBrace = content.lastIndex(of: "}"),
           firstBrace < lastBrace {
            snippets.append(String(content[firstBrace...lastBrace]))
        }
        return snippets
    }

    private static func matches(in content: String, pattern: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return []
        }

        let nsRange = NSRange(content.startIndex..<content.endIndex, in: content)
        return regex.matches(in: content, range: nsRange).compactMap { match in
            guard match.numberOfRanges > 1,
                  let range = Range(match.range(at: 1), in: content) else {
                return nil
            }
            return String(content[range]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
    }

    private static func decodeCalls(from snippet: String) -> [AgentToolCall]? {
        guard let data = snippet.data(using: .utf8) else {
            return nil
        }

        let decoder = JSONDecoder()
        if let envelope = try? decoder.decode(ToolCallsEnvelope.self, from: data) {
            return envelope.calls.filter { !$0.name.isEmpty }
        }
        if let call = try? decoder.decode(AgentToolCall.self, from: data), !call.name.isEmpty {
            return [call]
        }
        if let calls = try? decoder.decode([AgentToolCall].self, from: data) {
            return calls.filter { !$0.name.isEmpty }
        }
        return nil
    }
}

private struct ToolCallsEnvelope: Decodable {
    let calls: [AgentToolCall]

    enum CodingKeys: String, CodingKey {
        case toolCalls = "tool_calls"
        case toolCall = "tool_call"
        case calls
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let calls = try container.decodeIfPresent([AgentToolCall].self, forKey: .toolCalls) {
            self.calls = calls
        } else if let call = try container.decodeIfPresent(AgentToolCall.self, forKey: .toolCall) {
            self.calls = [call]
        } else {
            self.calls = try container.decodeIfPresent([AgentToolCall].self, forKey: .calls) ?? []
        }
    }
}
