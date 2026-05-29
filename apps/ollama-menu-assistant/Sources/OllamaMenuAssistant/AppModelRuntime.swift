import Foundation

extension AppModel {
    func recordRuntimeTrace(_ trace: RuntimeTrace) async {
        do {
            runtimeTraces = try await runtimeTraceStore.append(trace)
        } catch {
            runtimeTraces.insert(trace, at: 0)
            errorMessage = localized("保存运行时观测记录失败：\(error.localizedDescription)", "Failed to save runtime trace: \(error.localizedDescription)")
        }
    }

    func clearRuntimeTraces() {
        Task { @MainActor in
            do {
                try await runtimeTraceStore.clear()
                runtimeTraces = []
            } catch {
                errorMessage = localized("清空运行时观测记录失败：\(error.localizedDescription)", "Failed to clear runtime traces: \(error.localizedDescription)")
            }
        }
    }
}
