import SwiftUI

struct ForgotPasswordView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    let configuration: AuthConfiguration?

    @State private var email = ""
    @State private var token: String?
    @State private var isWorking = false
    @State private var sent = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                VelvetCard {
                    VStack(alignment: .leading, spacing: VelvetSpacing.lg) {
                        VelvetSectionHeader(
                            "Accès",
                            title: "Réinitialise ton mot de passe.",
                            subtitle: "La réponse reste volontairement neutre : Velvet ne révèle jamais si une adresse existe."
                        )
                        VelvetField(
                            title: "E-mail",
                            prompt: "ton@email.fr",
                            text: $email,
                            contentType: .emailAddress,
                            keyboardType: .emailAddress
                        )
                        if let siteKey = configuration?.turnstileSiteKey, !siteKey.isEmpty {
                            TurnstileView(siteKey: siteKey, token: $token)
                                .frame(height: 76)
                                .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))
                        }
                        if sent {
                            Label("Si le compte existe, l’e-mail est parti.", systemImage: "checkmark.circle")
                                .font(VelvetTypography.body(size: 14))
                                .foregroundStyle(VelvetColor.success)
                        }
                        VelvetPrimaryButton(
                            sent ? "Renvoyer l’e-mail" : "Recevoir le lien",
                            isLoading: isWorking,
                            isDisabled: !email.contains("@")
                                || (configuration?.turnstileSiteKey?.isEmpty == false && token == nil)
                        ) {
                            Task { await submit() }
                        }
                    }
                }
                .padding(VelvetSpacing.lg)
            }
            .navigationTitle("Mot de passe oublié")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                }
            }
        }
    }

    @MainActor
    private func submit() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await appState.session.requestPasswordRecovery(email: email, turnstileToken: token)
            sent = true
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}
