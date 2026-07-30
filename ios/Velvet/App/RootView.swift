import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appState: AppState

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
        }
        .animation(.easeInOut(duration: VelvetMotion.normal), value: appState.phase.id)
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
        .onOpenURL(perform: appState.handle)
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
