import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var appState: AppState
    @State private var email = ""
    @State private var password = ""
    @State private var configuration: AuthConfiguration?
    @State private var turnstileToken: String?
    @State private var configurationError = false

    private var needsTurnstile: Bool {
        configuration?.turnstileSiteKey?.isEmpty == false
    }

    private var canSubmit: Bool {
        email.contains("@")
            && !password.isEmpty
            && (!needsTurnstile || turnstileToken != nil)
            && !configurationError
    }

    var body: some View {
        ScrollView {
            VStack(spacing: VelvetSpacing.xl) {
                Spacer(minLength: VelvetSpacing.xl)

                VStack(spacing: VelvetSpacing.md) {
                    VelvetMark(size: 74)

                    Text("VELVET")
                        .font(VelvetTypography.brand(size: 28))
                        .tracking(8)
                        .foregroundStyle(VelvetColor.champagneGold)

                    Text("BETA PRIVÉE · 18+")
                        .font(VelvetTypography.caption(size: 11, weight: .semibold))
                        .tracking(2)
                        .foregroundStyle(VelvetColor.softBlush)
                }

                VelvetCard {
                    VStack(alignment: .leading, spacing: VelvetSpacing.lg) {
                        VelvetSectionHeader(
                            "Bienvenue",
                            title: "Retrouve ton univers.",
                            subtitle: "Un accès discret, sécurisé et réservé aux membres invités."
                        )

                        VStack(spacing: VelvetSpacing.md) {
                            VelvetField(
                                title: "E-mail",
                                prompt: "ton@email.fr",
                                text: $email,
                                contentType: .emailAddress,
                                keyboardType: .emailAddress
                            )

                            VelvetField(
                                title: "Mot de passe",
                                prompt: "Ton mot de passe",
                                text: $password,
                                contentType: .password,
                                isSecure: true
                            )
                        }

                        if let siteKey = configuration?.turnstileSiteKey, !siteKey.isEmpty {
                            TurnstileView(
                                siteKey: siteKey,
                                token: $turnstileToken
                            )
                            .frame(height: 76)
                            .clipShape(
                                RoundedRectangle(
                                    cornerRadius: VelvetRadius.medium,
                                    style: .continuous
                                )
                            )
                            .accessibilityLabel("Vérification humaine")
                        }

                        if configurationError {
                            Label(
                                "La sécurité de connexion est indisponible. Réessaie.",
                                systemImage: "exclamationmark.triangle"
                            )
                            .font(VelvetTypography.caption())
                            .foregroundStyle(VelvetColor.danger)
                        }

                        VelvetPrimaryButton(
                            "Se connecter",
                            isLoading: appState.isWorking,
                            isDisabled: !canSubmit
                        ) {
                            Task {
                                await appState.login(
                                    email: email,
                                    password: password,
                                    turnstileToken: turnstileToken
                                )
                            }
                        }
                    }
                }

                HStack(spacing: VelvetSpacing.sm) {
                    Link(
                        "Confidentialité",
                        destination: URL(string: "https://velvet-beta.sh96hv64dj.workers.dev/legal/privacy/")!
                    )
                    Text("·")
                    Link(
                        "Conditions",
                        destination: URL(string: "https://velvet-beta.sh96hv64dj.workers.dev/legal/terms/")!
                    )
                    Text("·")
                    Link(
                        "Sécurité",
                        destination: URL(string: "https://velvet-beta.sh96hv64dj.workers.dev/legal/safety/")!
                    )
                }
                .font(VelvetTypography.caption(size: 11))
                .foregroundStyle(VelvetColor.textSecondary)

                Spacer(minLength: VelvetSpacing.xl)
            }
            .padding(.horizontal, VelvetSpacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .task {
            do {
                configuration = try await appState.session.configuration()
            } catch {
                configurationError = true
            }
        }
    }
}
