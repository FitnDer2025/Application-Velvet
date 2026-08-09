import AVFoundation
import Combine
import Foundation

@MainActor
final class ZwitVoiceRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published private(set) var isRecording = false
    @Published private(set) var durationSeconds = 0
    @Published private(set) var errorMessage: String?

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var startedAt: Date?
    private var outputURL: URL?

    private static let maxDuration: TimeInterval = 300

    func start() async -> Bool {
        guard !isRecording else { return true }
        errorMessage = nil
        let granted = await requestPermission()
        guard granted else {
            errorMessage = "Autorise le microphone pour envoyer un message vocal."
            return false
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .allowBluetooth])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("zwit-voice-\(UUID().uuidString)")
                .appendingPathExtension("m4a")
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44_100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
                AVEncoderBitRateKey: 96_000
            ]
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.delegate = self
            recorder.isMeteringEnabled = true
            recorder.prepareToRecord()
            guard recorder.record(forDuration: Self.maxDuration) else {
                throw CocoaError(.fileWriteUnknown)
            }
            self.recorder = recorder
            outputURL = url
            startedAt = .now
            durationSeconds = 0
            isRecording = true
            timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    self.durationSeconds = min(300, Int(Date().timeIntervalSince(self.startedAt ?? .now).rounded()))
                    if self.durationSeconds >= 300 { _ = self.stop() }
                }
            }
            return true
        } catch {
            cleanupAudioSession()
            errorMessage = "L’enregistrement vocal n’a pas pu démarrer."
            return false
        }
    }

    func stop() -> RecordedVoice? {
        guard isRecording, let recorder, let url = outputURL else { return nil }
        recorder.stop()
        timer?.invalidate()
        timer = nil
        isRecording = false
        let duration = max(1, min(300, Int(recorder.currentTime.rounded())))
        self.recorder = nil
        startedAt = nil
        outputURL = nil
        cleanupAudioSession()
        guard let data = try? Data(contentsOf: url), !data.isEmpty else {
            try? FileManager.default.removeItem(at: url)
            errorMessage = "Le message vocal est vide."
            return nil
        }
        try? FileManager.default.removeItem(at: url)
        return RecordedVoice(data: data, durationSeconds: duration, mimeType: "audio/mp4")
    }

    func cancel() {
        recorder?.stop()
        timer?.invalidate()
        timer = nil
        if let outputURL { try? FileManager.default.removeItem(at: outputURL) }
        recorder = nil
        outputURL = nil
        startedAt = nil
        durationSeconds = 0
        isRecording = false
        cleanupAudioSession()
    }

    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        guard isRecording else { return }
        if !flag {
            errorMessage = "Le message vocal n’a pas pu être finalisé."
            cancel()
        }
    }

    private func requestPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    private func cleanupAudioSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

struct RecordedVoice: Sendable {
    let data: Data
    let durationSeconds: Int
    let mimeType: String
}
