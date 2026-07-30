import SwiftUI

struct SignUpView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    let configuration: AuthConfiguration?

    @State private var inviteCode = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmation = ""
    @State private var turnstileToken: String?
    @State private var isWorking = false
    @State private var message: String?

    private var needsTurnstile: Bool {
        configuration?.turnstileSiteKey?.isEmpty == false
    }

    private var passwordIsValid: Bool {
        password.count >= (configuration?.passwordPolicy.minLength ?? 12)
            && password.range(of: #"[A-Z]"#, options: .regularExpression) != nil
            && password.range(of: #"[a-z]"#, options: .regularExpression) != nil
            && password.range(of: #"\d"#, options: .regularExpression) != nil
            && password.range(of: #"[^A-Za-z0-9]"#, options: .regularExpression) != nil
    }

    private var canSubmit: Bool {
        inviteCode.count >= 3 && email.contains("@") && passwordIsValid
            && confirmation == password && (!needsTurnstile || turnstileToken != nil)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VelvetCard {
                        VStack(alignment: .leading, spacing: VelvetSpacing.lg) {
                            VelvetSectionHeader(
                                "Invitation privée",
                                title: "Entre dans Velvet.",
                                subtitle: "Le code est personnel. Chaque membre accepte ensuite ses propres consentements."
                            )
                            VelvetField(
                                title: "Code d’invitation",
                                prompt: "Ton code",
                                text: $inviteCode,
                                contentType: .oneTimeCode
                            )
                            VelvetField(
                                title: "E-mail",
                                prompt: "ton@email.fr",
                                text: $email,
                                contentType: .emailAddress,
                                keyboardType: .emailAddress
                            )
                            VelvetField(
                                title: "Mot de passe",
                                prompt: "12 caractères minimum",
                                text: $password,
                                contentType: .newPassword,
                                isSecure: true
                            )
                            VelvetField(
                                title: "Confirmation",
                                prompt: "Répète le mot de passe",
                                text: $confirmation,
                                contentType: .newPassword,
                                isSecure: true
                            )
                            Text("12 caractères, une majuscule, une minuscule, un chiffre et un symbole.")
                                .font(VelvetTypography.caption(size: 11))
                                .foregroundStyle(passwordIsValid ? VelvetColor.success : VelvetColor.textSecondary)

                            if let siteKey = configuration?.turnstileSiteKey, !siteKey.isEmpty {
                                TurnstileView(siteKey: siteKey, token: $turnstileToken)
                                    .frame(height: 76)
                                    .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))
                            }

                            if let message {
                                Label(message, systemImage: "envelope.badge")
                                    .font(VelvetTypography.caption())
                                    .foregroundStyle(VelvetColor.success)
                            }

                            VelvetPrimaryButton(
                                "Créer mon compte",
                                isLoading: isWorking,
                                isDisabled: !canSubmit
                            ) {
                                Task { await submit() }
                            }
                        }
                    }
                    .padding(VelvetSpacing.lg)
                }
            }
            .navigationTitle("Inscription")
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
            let response = try await appState.session.signUp(
                email: email,
                password: password,
                inviteCode: inviteCode,
                turnstileToken: turnstileToken
            )
            if response.confirmationRequired {
                message = "Vérifie ton e-mail, puis reviens te connecter."
            } else {
                dismiss()
                await appState.restoreAfterSignUp()
            }
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}
