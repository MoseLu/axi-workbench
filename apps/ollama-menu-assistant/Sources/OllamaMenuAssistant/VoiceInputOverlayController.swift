import AppKit
import Combine
import SwiftUI

@MainActor
final class VoiceInputOverlayController: NSObject, NSWindowDelegate {
    private let appModel: AppModel
    private let window: NSPanel
    private var cancellables = Set<AnyCancellable>()

    init(appModel: AppModel) {
        self.appModel = appModel
        self.window = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 320, height: 154),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        super.init()

        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.hidesOnDeactivate = false
        window.ignoresMouseEvents = true
        window.delegate = self
        window.contentView = NSHostingView(rootView: VoiceInputOverlayView(appModel: appModel))

        appModel.$voiceInputStatus
            .receive(on: RunLoop.main)
            .sink { [weak self] status in
                self?.update(status)
            }
            .store(in: &cancellables)
        appModel.$voiceTranscript
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.refreshContent()
            }
            .store(in: &cancellables)
    }

    private func update(_ status: AppModel.VoiceInputStatus) {
        refreshContent()
        if case .idle = status {
            window.orderOut(nil)
        } else {
            positionAtTopCenter()
            window.orderFrontRegardless()
        }
    }

    private func refreshContent() {
        guard window.isVisible else { return }
        window.contentView = NSHostingView(rootView: VoiceInputOverlayView(appModel: appModel))
    }

    private func positionAtTopCenter() {
        guard let screen = NSScreen.main else { return }
        let visibleFrame = screen.visibleFrame
        let size = window.frame.size
        let origin = NSPoint(
            x: visibleFrame.midX - size.width / 2,
            y: visibleFrame.maxY - size.height - 14
        )
        window.setFrameOrigin(origin)
    }
}

private struct VoiceInputOverlayView: View {
    @ObservedObject var appModel: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(statusTitle)
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("中文本地语音识别")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.white.opacity(0.65))
                }
                Spacer()
                Image(systemName: "waveform")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(statusColor)
            }

            Text(appModel.voiceTranscript.isEmpty ? hint : appModel.voiceTranscript)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(appModel.voiceTranscript.isEmpty ? Color.white.opacity(0.45) : .white)
                .lineLimit(3)
                .frame(maxWidth: .infinity, alignment: .leading)

            Spacer(minLength: 0)
            HStack(spacing: 7) {
                Circle().fill(statusColor).frame(width: 7, height: 7)
                Text(footer)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.65))
                Spacer()
                Text("ANE / CoreML")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.42))
            }
        }
        .padding(16)
        .frame(width: 320, height: 154)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(red: 0.055, green: 0.10, blue: 0.17).opacity(0.98))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.white.opacity(0.18), lineWidth: 1)
        )
    }

    private var statusTitle: String {
        switch appModel.voiceInputStatus {
        case .idle: return "语音助手"
        case .loadingModel: return "正在加载中文模型"
        case .listening: return "正在听"
        case .processing: return "正在识别"
        case .executing: return "正在执行"
        case .error: return "识别失败"
        }
    }

    private var hint: String {
        switch appModel.voiceInputStatus {
        case .loadingModel: return "首次使用会准备本地模型…"
        case .executing: return "识别完成，正在执行…"
        default: return "识别到的语音会显示在这里"
        }
    }

    private var footer: String {
        switch appModel.voiceInputStatus {
        case .loadingModel: return "下载并编译 Paraformer-large-zh"
        case .processing: return "正在生成最终文本"
        case .executing: return "已提交给本地助手"
        case .error(let message): return message
        default: return "本地模型未联网"
        }
    }

    private var statusColor: Color {
        switch appModel.voiceInputStatus {
        case .error: return .red
        case .executing: return .green
        default: return .orange
        }
    }
}
