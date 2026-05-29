import SwiftUI

struct RuntimeTracePanelView: View {
    let traces: [RuntimeTrace]
    let onClear: () -> Void
    let language: AppLanguage

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .center, spacing: 12) {
                Text(tr("本地 Agent Runtime 观测", "Local Agent Runtime traces"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppTheme.textPrimary)
                    .lineLimit(1)

                Spacer(minLength: 12)

                Button(action: onClear) {
                    Image(systemName: "trash")
                        .font(.system(size: DesignTokens.IconSize.small, weight: .semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(width: 30, height: 30)
                        .background(AppTheme.surfaceRaised)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .disabled(traces.isEmpty)
                .help(tr("清空记录", "Clear traces"))
                .accessibilityLabel(tr("清空运行时观测记录", "Clear runtime traces"))
            }

            if traces.isEmpty {
                emptyState
            } else {
                VStack(spacing: 12) {
                    ForEach(traces.prefix(30)) { trace in
                        RuntimeTraceRow(trace: trace, language: language)
                    }
                }
            }
        }
        .accessibilityIdentifier("settings.runtimeTraces")
    }

    private var emptyState: some View {
        HStack(spacing: 12) {
            Image(systemName: "chart.xyaxis.line")
                .font(.system(size: DesignTokens.IconSize.large, weight: .semibold))
                .foregroundStyle(AppTheme.textTertiary)
                .frame(width: 28)
            Text(tr("还没有运行时记录", "No runtime traces yet"))
                .font(.system(size: DesignTokens.FontSize.bodyLarge, weight: .semibold))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.vertical, 18)
    }

    private func tr(_ zh: String, _ en: String) -> String {
        LocalizedStrings(language: language)(zh, en)
    }
}

private struct RuntimeTraceRow: View {
    let trace: RuntimeTrace
    let language: AppLanguage

    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                isExpanded.toggle()
            } label: {
                HStack(alignment: .center, spacing: 12) {
                    Image(systemName: trace.errorMessage == nil ? "waveform.path.ecg" : "exclamationmark.triangle")
                        .font(.system(size: DesignTokens.IconSize.regular, weight: .semibold))
                        .foregroundStyle(trace.errorMessage == nil ? AppTheme.textSecondary : AppTheme.destructive)
                        .frame(width: 22)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(trace.task.primaryKind.rawValue) · \(trace.modelDecision.selectedDisplayName)")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(AppTheme.textPrimary)
                            .lineLimit(1)

                        Text(subtitle)
                            .font(.system(size: 12))
                            .foregroundStyle(AppTheme.textSecondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: DesignTokens.IconSize.tiny, weight: .semibold))
                        .foregroundStyle(AppTheme.textTertiary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 12) {
                    traceSection(title: tr("路由", "Routing")) {
                        traceLine(trace.modelDecision.reason)
                        ForEach(trace.modelDecision.scores.prefix(5), id: \.modelName) { score in
                            traceLine("\(score.modelName): \(String(format: "%.1f", score.score))")
                        }
                    }

                    if !trace.knowledgeHits.isEmpty {
                        traceSection(title: tr("知识库", "Knowledge")) {
                            ForEach(trace.knowledgeHits.prefix(5)) { hit in
                                traceLine("[\(hit.source)] \(hit.path)")
                            }
                        }
                    }

                    if !trace.invocations.isEmpty {
                        traceSection(title: tr("调用", "Invocations")) {
                            ForEach(trace.invocations.prefix(8)) { invocation in
                                traceLine("\(invocation.capabilityName) · \(invocation.status.rawValue): \(invocation.summary)")
                            }
                        }
                    }

                    if let fallbackModelName = trace.fallbackModelName {
                        traceSection(title: "Fallback") {
                            traceLine(fallbackModelName)
                        }
                    }

                    if let errorMessage = trace.errorMessage {
                        traceSection(title: tr("错误", "Error")) {
                            traceLine(errorMessage)
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 14)
            }
        }
        .background(AppTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(AppTheme.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var subtitle: String {
        let finishedAt = trace.finishedAt ?? trace.startedAt
        let duration = max(0, finishedAt.timeIntervalSince(trace.startedAt))
        let status = trace.errorMessage == nil ? tr("完成", "completed") : tr("失败", "failed")
        return "\(status) · \(String(format: "%.1fs", duration)) · \(trace.knowledgeHits.count) knowledge · \(trace.invocations.count) calls"
    }

    private func traceSection<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(AppTheme.textPrimary)
                .lineLimit(1)
            content()
        }
    }

    private func traceLine(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundStyle(AppTheme.textSecondary)
            .lineLimit(3)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func tr(_ zh: String, _ en: String) -> String {
        LocalizedStrings(language: language)(zh, en)
    }
}
