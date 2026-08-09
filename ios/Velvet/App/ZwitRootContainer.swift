import SwiftUI

/// Conteneur d’exécution de l’application.
/// Il reprend les états fonctionnels de RootView sans réafficher un second splash,
/// l’expérience d’ouverture étant désormais pilotée une seule fois depuis ZwitApp.
struct ZwitRootContainer: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var biometrics: BiometricLockService
    @EnvironmentObject private var screenshotProtection: ScreenshotProtectionService

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
                ZwitMediaCaptureShield()
                    .transition(.opacity)
                    .zIndex(40)
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

private struct ZwitMediaCaptureShield: View {
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
