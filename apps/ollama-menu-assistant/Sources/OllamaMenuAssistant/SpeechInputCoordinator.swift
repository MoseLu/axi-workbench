import AVFoundation
import Foundation
import Speech

@MainActor
final class SpeechInputCoordinator {
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var onText: ((String) -> Void)?
    private var onFinish: ((String?) -> Void)?
    private var didFinishCurrentSession = false

    func start(
        onText: @escaping (String) -> Void,
        onFinish: @escaping (String?) -> Void
    ) async throws {
        stop()

        guard let recognizer = makeRecognizer(), recognizer.isAvailable else {
            throw OllamaError.server(LocalizedStrings.current()("当前系统暂时不可用语音转写。", "Speech transcription is currently unavailable on this system."))
        }

        let speechStatus = await Self.requestSpeechAuthorization()
        guard speechStatus == .authorized else {
            throw OllamaError.server(LocalizedStrings.current()("请先在系统设置里允许语音识别权限。", "Allow Speech Recognition permission in System Settings first."))
        }

        let microphoneGranted = await Self.requestMicrophonePermission()
        guard microphoneGranted else {
            throw OllamaError.server(LocalizedStrings.current()("请先在系统设置里允许麦克风权限。", "Allow Microphone permission in System Settings first."))
        }

        self.onText = onText
        self.onFinish = onFinish
        self.didFinishCurrentSession = false

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1_024, format: format) { [weak request] buffer, _ in
            request?.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor [weak self] in
                guard let self else {
                    return
                }

                if let result {
                    self.onText?(result.bestTranscription.formattedString)
                    if result.isFinal {
                        self.finish(message: nil)
                        return
                    }
                }

                if let error {
                    self.finish(message: error.localizedDescription)
                }
            }
        }
    }

    func stop() {
        finish(message: nil)
    }

    private func finish(message: String?) {
        guard !didFinishCurrentSession else {
            return
        }
        didFinishCurrentSession = true

        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil

        onFinish?(message)
        onText = nil
        onFinish = nil
    }

    private func makeRecognizer() -> SFSpeechRecognizer? {
        if let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh_CN")) {
            return recognizer
        }
        return SFSpeechRecognizer(locale: .current)
    }

    // These system callbacks may arrive off the main queue, so keep them off the
    // coordinator's MainActor isolation and resume the awaiting task safely.
    private nonisolated static func requestSpeechAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { @Sendable status in
                continuation.resume(returning: status)
            }
        }
    }

    private nonisolated static func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVCaptureDevice.requestAccess(for: .audio) { @Sendable granted in
                continuation.resume(returning: granted)
            }
        }
    }
}
