import SwiftUI

struct PasswordResetView: View {
    @EnvironmentObject private var appState: AppState
    let tokens: RecoveryTokens

    @State private var password = ""
    @State private var confirmation = ""

    var body: some View {
        ZStack {
            VelvetBackground()
            VelvetCard {
                VStack(alignment: .leading, spacing: VelvetSpacing.lg) {
                    VelvetSectionHeader(
                        "Lien vérifié",
                        title: "Choisis un nouveau mot de passe.",
                        subtitle: "Au moins 12 caractères avec majuscule, minuscule, chiffre et symbole."
                    )
                    VelvetField(
                        title: "Nouveau mot de passe",
                        prompt: "Ton nouveau mot de passe",
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
                    VelvetPrimaryButton(
                        "Mettre à jour",
                        isLoading: appState.isWorking,
                        isDisabled: password.count < 12 || password != confirmation
                    ) {
                        Task { await appState.updatePassword(password, tokens: tokens) }
                    }
                }
            }
            .padding(VelvetSpacing.lg)
        }
    }
}
