import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var biometrics: BiometricLockService
    @EnvironmentObject private var screenshotProtection: ScreenshotProtectionService

    var body: some View {
        ZStack {
            VelvetBackground()

            switch appState.phase {
            case .launching:
                LaunchView()
                    .transition(.opacity)
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
        }
        .animation(.easeInOut(duration: VelvetMotion.normal), value: appState.phase.id)
        .animation(.easeOut(duration: 0.18), value: screenshotProtection.shouldObscureMedia)
        .alert(
            "Velvet",
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
        warningMessage = "La capture a été détectée. Le propriétaire de la photo a été prévenu par Velvet. Toute diffusion sans consentement peut entraîner la suspension du compte."
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
        Text("V")
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
    @State private var appeared = false

    var body: some View {
        VStack(spacing: VelvetSpacing.lg) {
            VelvetMark(size: 92)
                .scaleEffect(appeared ? 1 : 0.9)
                .opacity(appeared ? 1 : 0)

            VStack(spacing: VelvetSpacing.xs) {
                Text("VELVET")
                    .font(VelvetTypography.brand(size: 27))
                    .tracking(8)
                    .foregroundStyle(VelvetColor.champagneGold)

                Text("Là où les plus belles rencontres commencent.")
                    .font(VelvetTypography.body(size: 14))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.6)) {
                appeared = true
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Velvet. Là où les plus belles rencontres commencent.")
    }
}
