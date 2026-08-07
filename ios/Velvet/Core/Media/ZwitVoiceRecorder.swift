import AVFoundation
import Foundation

@MainActor
final class ZwitVoiceRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    struct Recording: Sendable {
        let data: Data
        let durationSeconds: Int
        let mimeType: String
    }

    @Published private(set) var isRecording = false
    @Published private(set) var durationSeconds = 0
    @Published private(set) var errorMessage: String?

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var recordingURL: URL?

    deinit {
        timer?.invalidate()
        recorder?.stop()
    }

    func start() async -> Bool {
        errorMessage = nil
        guard !isRecording else { return true }

        let granted = await microphonePermission()
        guard granted else {
            errorMessage = "Autorise le microphone dans Réglages pour envoyer un message vocal."
            return false
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker, .allowBluetoothHFP])
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
            guard recorder.record() else {
                throw NSError(domain: "ZwitVoiceRecorder", code: 1, userInfo: [NSLocalizedDescriptionKey: "L’enregistrement n’a pas pu démarrer."])
            }

            self.recorder = recorder
            recordingURL = url
            durationSeconds = 0
            isRecording = true
            startTimer()
            return true
        } catch {
            errorMessage = "Le microphone n’a pas pu démarrer."
            cleanup(deleteFile: true)
            return false
        }
    }

    func stop() -> Recording? {
        guard isRecording, let recorder, let url = recordingURL else { return nil }
        recorder.stop()
        timer?.invalidate()
        timer = nil
        isRecording = false

        let duration = max(1, Int(ceil(recorder.currentTime)))
        do {
            let data = try Data(contentsOf: url)
            try? FileManager.default.removeItem(at: url)
            self.recorder = nil
            recordingURL = nil
            durationSeconds = 0
            deactivateSession()
            guard !data.isEmpty else {
                errorMessage = "Le message vocal est vide."
                return nil
            }
            return Recording(data: data, durationSeconds: duration, mimeType: "audio/mp4")
        } catch {
            errorMessage = "Le message vocal n’a pas pu être préparé."
            cleanup(deleteFile: true)
            return nil
        }
    }

    func cancel() {
        recorder?.stop()
        cleanup(deleteFile: true)
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                let seconds = Int(self.recorder?.currentTime ?? 0)
                self.durationSeconds = min(300, max(0, seconds))
                if seconds >= 300 {
                    self.errorMessage = "Un message vocal est limité à 5 minutes."
                    self.cancel()
                }
            }
        }
    }

    private func microphonePermission() async -> Bool {
        switch AVAudioApplication.shared.recordPermission {
        case .granted:
            return true
        case .denied:
            return false
        case .undetermined:
            return await withCheckedContinuation { continuation in
                AVAudioApplication.requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
        @unknown default:
            return false
        }
    }

    private func cleanup(deleteFile: Bool) {
        timer?.invalidate()
        timer = nil
        recorder = nil
        isRecording = false
        durationSeconds = 0
        if deleteFile, let recordingURL {
            try? FileManager.default.removeItem(at: recordingURL)
        }
        recordingURL = nil
        deactivateSession()
    }

    private func deactivateSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    nonisolated func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        Task { @MainActor [weak self] in
            self?.errorMessage = "L’enregistrement vocal a été interrompu."
            self?.cleanup(deleteFile: true)
        }
    }
}
