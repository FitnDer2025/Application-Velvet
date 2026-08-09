import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var biometrics: BiometricLockService
    @EnvironmentObject private var screenshotProtection: ScreenshotProtectionService
    @State private var showBrandOpening = true

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

            if showBrandOpening {
                ZwitOpeningView()
                    .transition(.opacity)
                    .zIndex(100)
            }
        }
        .task {
            guard showBrandOpening else { return }
            try? await Task.sleep(nanoseconds: 11_800_000_000)
            withAnimation(.easeInOut(duration: 0.9)) {
                showBrandOpening = false
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
        Image("ZwitOfficialLogo")
            .resizable()
            .scaledToFit()
            .frame(width: 46, height: 46)
            .opacity(0.22)
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
                Image("ZwitOfficialLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 118, height: 118)
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

private struct ZwitOpeningView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var currentWordIndex: Int?
    @State private var wordOpacity = 0.0
    @State private var fogVisible = false
    @State private var logoVisible = false

    private let words = ["Chut", "Silencio", "Silenzio", "嘘"]

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.ignoresSafeArea()

                Image("ZwitOfficialLogo")
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()
                    .blur(radius: 34)
                    .scaleEffect(1.14)
                    .brightness(-0.38)
                    .saturation(0.82)
                    .opacity(logoVisible ? 0.58 : 0)

                RadialGradient(
                    colors: [
                        VelvetColor.champagneGold.opacity(logoVisible ? 0.09 : 0.04),
                        VelvetColor.velvetBurgundy.opacity(0.18),
                        Color.black.opacity(0.94)
                    ],
                    center: .center,
                    startRadius: 10,
                    endRadius: max(proxy.size.width, proxy.size.height) * 0.78
                )
                .ignoresSafeArea()

                if let currentWordIndex {
                    Text(words[currentWordIndex])
                        .font(VelvetTypography.brand(size: currentWordIndex == 3 ? 82 : 72))
                        .tracking(2.5)
                        .foregroundStyle(VelvetColor.ivory)
                        .shadow(color: VelvetColor.champagneGold.opacity(0.28), radius: 28)
                        .opacity(wordOpacity)
                        .blur(radius: wordOpacity < 0.22 ? 12 : 0)
                        .scaleEffect(0.94 + (wordOpacity * 0.06))
                }

                ZStack {
                    fogCircle(size: proxy.size.width * 0.92)
                        .offset(x: -proxy.size.width * 0.28, y: -proxy.size.height * 0.16)
                    fogCircle(size: proxy.size.width * 0.86)
                        .offset(x: proxy.size.width * 0.30, y: -proxy.size.height * 0.10)
                    fogCircle(size: proxy.size.width * 0.96)
                        .offset(x: -proxy.size.width * 0.16, y: proxy.size.height * 0.28)
                    fogCircle(size: proxy.size.width * 0.88)
                        .offset(x: proxy.size.width * 0.26, y: proxy.size.height * 0.30)
                }
                .opacity(fogVisible ? 0.82 : 0)
                .scaleEffect(fogVisible ? 1.18 : 0.72)
                .allowsHitTesting(false)

                Image("ZwitOfficialLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: min(proxy.size.width * 0.96, 760))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 34)
                    .opacity(logoVisible ? 1 : 0)
                    .blur(radius: logoVisible ? 0 : 22)
                    .scaleEffect(logoVisible ? 1 : 0.92)
                    .shadow(color: .black.opacity(0.78), radius: 46, y: 22)

                Text("Un secret se partage. Jamais il ne s’impose.")
                    .font(VelvetTypography.caption(size: 11, weight: .medium))
                    .tracking(1.2)
                    .foregroundStyle(VelvetColor.textSecondary)
                    .opacity(logoVisible ? 0.82 : 0)
                    .position(x: proxy.size.width / 2, y: proxy.size.height - 42)
            }
            .ignoresSafeArea()
        }
        .task { await runSequence() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Zwit. Chut. Une expérience discrète et confidentielle.")
    }

    private func fogCircle(size: CGFloat) -> some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        VelvetColor.ivory.opacity(0.56),
                        VelvetColor.champagneGold.opacity(0.20),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: size * 0.5
                )
            )
            .frame(width: size, height: size)
            .blur(radius: 42)
    }

    @MainActor
    private func runSequence() async {
        if reduceMotion {
            currentWordIndex = 0
            wordOpacity = 1
            try? await Task.sleep(nanoseconds: 900_000_000)
            fogVisible = true
            try? await Task.sleep(nanoseconds: 500_000_000)
            logoVisible = true
            return
        }

        for index in words.indices {
            currentWordIndex = index
            withAnimation(.easeInOut(duration: 0.70)) { wordOpacity = 1 }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            withAnimation(.easeInOut(duration: 0.78)) { wordOpacity = 0 }
            try? await Task.sleep(nanoseconds: 700_000_000)
        }

        withAnimation(.easeInOut(duration: 1.35)) { fogVisible = true }
        try? await Task.sleep(nanoseconds: 1_100_000_000)
        withAnimation(.easeInOut(duration: 1.65)) { logoVisible = true }
    }
}
