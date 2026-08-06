import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var biometrics: BiometricLockService
    @EnvironmentObject private var screenshotProtection: ScreenshotProtectionService
    @State private var showsBrandOpening = true

    var body: some View {
        ZStack {
            VelvetBackground()

            switch appState.phase {
            case .launching:
                Color.clear
            case .signedOut:
                LoginView()
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            case .consentRequired:
                ConsentView()
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            case .onboarding:
                OnboardingFlowView()
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            case let .profileSetup(profile):
                ProfileSetupView(profile: profile)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            case let .home(profile):
                MainShellView(profile: profile)
                    .transition(.opacity)
            case let .passwordReset(tokens):
                PasswordResetView(tokens: tokens)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
            }

            if requiresPrivateUnlock && biometrics.isEnabled && !biometrics.isUnlocked {
                BiometricLockView()
                    .environmentObject(biometrics)
                    .transition(.opacity)
                    .zIndex(20)
            }

            if screenshotProtection.shouldObscureMedia {
                MediaCaptureShield()
                    .transition(.opacity)
                    .zIndex(40)
            }
            if showsBrandOpening {
                LaunchView {
                    withAnimation(.easeOut(duration: 0.62)) {
                        showsBrandOpening = false
                    }
                }
                .transition(.opacity)
                .zIndex(100)
            }
        }
        .animation(.easeInOut(duration: VelvetMotion.normal), value: appState.phase.id)
        .animation(.easeOut(duration: 0.18), value: screenshotProtection.shouldObscureMedia)
        .alert(
            "Zwit",
            isPresented: Binding(
                get: { appState.alertMessage != nil },
                set: { if !$0 { appState.alertMessage = nil } }
            )
        ) {
            Button("Fermer", role: .cancel) {
                appState.alertMessage = nil
            }
        } message: {
            Text(appState.alertMessage ?? "")
        }
        .alert(
            "Protection des photos",
            isPresented: Binding(
                get: { screenshotProtection.warningMessage != nil },
                set: { if !$0 { screenshotProtection.warningMessage = nil } }
            )
        ) {
            Button("J’ai compris", role: .cancel) {
                screenshotProtection.warningMessage = nil
            }
        } message: {
            Text(screenshotProtection.warningMessage ?? "")
        }
        .onOpenURL(perform: appState.handle)
    }

    private var requiresPrivateUnlock: Bool {
        switch appState.phase {
        case .home, .profileSetup, .onboarding, .consentRequired:
            true
        case .launching, .signedOut, .passwordReset:
            false
        }
    }
}

@MainActor
final class ScreenshotProtectionService: ObservableObject {
    @Published private(set) var isScreenCaptured = UIScreen.main.isCaptured
    @Published var warningMessage: String?

    private let api = APIClient()
    private var ownerProfileID: UUID?
    private var mediaID: UUID?
    private var screenshotObserver: NSObjectProtocol?
    private var captureObserver: NSObjectProtocol?
    private var lastRecordingReportAt: Date?

    var shouldObscureMedia: Bool {
        isScreenCaptured && ownerProfileID != nil
    }

    init() {
        screenshotObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.userDidTakeScreenshotNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.didTakeScreenshot() }
        }
        captureObserver = NotificationCenter.default.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.captureStateChanged() }
        }
    }

    deinit {
        if let screenshotObserver { NotificationCenter.default.removeObserver(screenshotObserver) }
        if let captureObserver { NotificationCenter.default.removeObserver(captureObserver) }
    }

    func protect(ownerProfileID: UUID, mediaID: UUID?) {
        self.ownerProfileID = ownerProfileID
        self.mediaID = mediaID
        captureStateChanged()
    }

    func clear(ownerProfileID: UUID) {
        guard self.ownerProfileID == ownerProfileID else { return }
        self.ownerProfileID = nil
        mediaID = nil
        isScreenCaptured = UIScreen.main.isCaptured
    }

    private func didTakeScreenshot() {
        guard ownerProfileID != nil else { return }
        warningMessage = "La capture a été détectée. Le propriétaire de la photo a été prévenu par Zwit. Toute diffusion sans consentement peut entraîner la suspension du compte."
        Task { await report(eventType: "screenshot") }
    }

    private func captureStateChanged() {
        isScreenCaptured = UIScreen.main.isCaptured
        guard isScreenCaptured, ownerProfileID != nil else { return }
        let now = Date()
        if let lastRecordingReportAt, now.timeIntervalSince(lastRecordingReportAt) < 30 { return }
        lastRecordingReportAt = now
        warningMessage = "L’enregistrement d’écran est bloqué sur cette photo. Son propriétaire a été prévenu."
        Task { await report(eventType: "screen_recording") }
    }

    private func report(eventType: String) async {
        guard let ownerProfileID else { return }
        struct Request: Encodable, Sendable {
            let ownerProfileId: UUID
            let mediaId: UUID?
            let eventType: String
        }
        struct Response: Decodable, Sendable {
            let ok: Bool
            let ownerNotified: Bool?
            let warning: String?
        }
        do {
            let response = try await api.post(
                "/api/members/media-security-events",
                body: Request(
                    ownerProfileId: ownerProfileID,
                    mediaId: mediaID,
                    eventType: eventType
                ),
                as: Response.self
            )
            if let warning = response.warning, !warning.isEmpty {
                warningMessage = warning
            }
        } catch {
            // La protection locale reste active même si la notification réseau échoue.
        }
    }
}

struct VelvetPhotoWatermark: View {
    var body: some View {
        Text("Z")
            .font(VelvetTypography.brand(size: 24))
            .foregroundStyle(Color.white.opacity(0.20))
            .shadow(color: .black.opacity(0.55), radius: 4, y: 2)
            .accessibilityHidden(true)
            .allowsHitTesting(false)
    }
}

private struct MediaCaptureShield: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 16) {
                VelvetMark(size: 74)
                Text("PHOTO PROTÉGÉE")
                    .font(VelvetTypography.caption(size: 11, weight: .semibold))
                    .tracking(2.2)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text("L’enregistrement d’écran est désactivé dans cet espace privé.")
                    .font(VelvetTypography.body(size: 14))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(VelvetColor.textSecondary)
                    .padding(.horizontal, 42)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Photo protégée. Enregistrement d’écran désactivé.")
    }
}

private struct LaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let onComplete: () -> Void

    @State private var wordIndex = 0
    @State private var wordVisible = false
    @State private var mistVisible = false
    @State private var mistDrift = false
    @State private var logoVisible = false

    private let whispers = [
        ("Chut", "FRANÇAIS"),
        ("Silencio", "ESPAÑOL"),
        ("Silenzio", "ITALIANO"),
        ("嘘…", "中文")
    ]

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.black, VelvetColor.velvetBurgundy.opacity(0.38), Color.black],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            Circle()
                .fill(VelvetColor.champagneGold.opacity(0.08))
                .frame(width: 540, height: 540)
                .blur(radius: 70)
                .scaleEffect(logoVisible ? 1.08 : 0.78)
                .opacity(logoVisible ? 0.75 : 0.28)

            VStack(spacing: 14) {
                Text(whispers[wordIndex].1)
                    .font(.system(size: 10, weight: .bold))
                    .tracking(3.2)
                    .foregroundStyle(VelvetColor.champagneGold.opacity(0.72))
                Text(whispers[wordIndex].0)
                    .font(VelvetTypography.brand(size: wordIndex == 3 ? 76 : 82))
                    .foregroundStyle(VelvetColor.ivory)
            }
            .id(wordIndex)
            .opacity(wordVisible ? 1 : 0)
            .blur(radius: wordVisible ? 0 : 18)
            .scaleEffect(wordVisible ? 1 : 0.92)
            .offset(y: wordVisible ? 0 : 14)

            ZwitMistLayer(isVisible: mistVisible, drifts: mistDrift)

            VStack(spacing: 10) {
                Image("VelvetMark")
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
                    .frame(width: 270, height: 270)
                    .clipShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
                    .shadow(color: .black.opacity(0.68), radius: 44, y: 24)
                Text("CHUT.")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(4.8)
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            .opacity(logoVisible ? 1 : 0)
            .blur(radius: logoVisible ? 0 : 24)
            .scaleEffect(logoVisible ? 1 : 0.84)
        }
        .ignoresSafeArea()
        .task { await runSequence() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Zwit. Chut. Une expérience discrète et confidentielle.")
    }

    @MainActor
    private func runSequence() async {
        if reduceMotion {
            logoVisible = true
            try? await Task.sleep(for: .milliseconds(1250))
            onComplete()
            return
        }

        for index in whispers.indices {
            wordIndex = index
            withAnimation(.easeOut(duration: 0.38)) {
                wordVisible = true
            }
            try? await Task.sleep(for: .milliseconds(610))
            withAnimation(.easeIn(duration: 0.30)) {
                wordVisible = false
            }
            try? await Task.sleep(for: .milliseconds(190))
        }

        withAnimation(.easeInOut(duration: 0.95)) {
            mistVisible = true
            mistDrift = true
        }
        try? await Task.sleep(for: .milliseconds(720))
        withAnimation(.spring(response: 0.92, dampingFraction: 0.82)) {
            logoVisible = true
        }
        try? await Task.sleep(for: .milliseconds(1650))
        onComplete()
    }
}

private struct ZwitMistLayer: View {
    let isVisible: Bool
    let drifts: Bool

    var body: some View {
        ZStack {
            ForEach(0..<8, id: \.self) { index in
                Ellipse()
                    .fill(Color.white.opacity(index.isMultiple(of: 2) ? 0.13 : 0.08))
                    .frame(
                        width: CGFloat(330 + index * 38),
                        height: CGFloat(128 + (index % 3) * 34)
                    )
                    .blur(radius: CGFloat(42 + index * 3))
                    .offset(
                        x: drifts ? CGFloat((index - 4) * -31) : CGFloat((index - 4) * 48),
                        y: CGFloat((index % 4 - 2) * 48)
                    )
                    .scaleEffect(isVisible ? 1.18 : 0.38)
                    .animation(
                        .easeInOut(duration: 1.15 + Double(index) * 0.08)
                            .delay(Double(index) * 0.035),
                        value: drifts
                    )
            }
        }
        .opacity(isVisible ? 1 : 0)
        .allowsHitTesting(false)
    }
}
