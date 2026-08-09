import SwiftUI

struct ConsentView: View {
    @EnvironmentObject private var appState: AppState
    @State private var adult = false
    @State private var terms = false
    @State private var privacy = false
    @State private var sensitiveProfile = false

    private var isComplete: Bool {
        adult && terms && privacy && sensitiveProfile
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: VelvetSpacing.xl) {
                VelvetMark(size: 62)

                VelvetSectionHeader(
                    "Consentement",
                    title: "Tes choix restent les tiens.",
                    subtitle: "Avant l’accès, Zwit enregistre chaque validation séparément. Tu pourras exercer tes droits depuis les paramètres."
                )

                VelvetCard {
                    VStack(spacing: VelvetSpacing.md) {
                        ConsentRow(
                            isOn: $adult,
                            title: "Je déclare avoir 18 ans ou plus.",
                            systemImage: "18.circle"
                        )
                        Divider().overlay(.white.opacity(0.08))
                        ConsentRow(
                            isOn: $terms,
                            title: "J’accepte les conditions de la BETA.",
                            systemImage: "doc.text"
                        )
                        Divider().overlay(.white.opacity(0.08))
                        ConsentRow(
                            isOn: $privacy,
                            title: "J’ai lu l’information de confidentialité.",
                            systemImage: "hand.raised"
                        )
                        Divider().overlay(.white.opacity(0.08))
                        ConsentRow(
                            isOn: $sensitiveProfile,
                            title: "Je consens explicitement au traitement des données sensibles que je choisirai de publier sur mon profil.",
                            systemImage: "lock.shield"
                        )
                    }
                }

                VelvetPrimaryButton(
                    "Activer mon accès",
                    isLoading: appState.isWorking,
                    isDisabled: !isComplete
                ) {
                    Task {
                        await appState.grantConsents()
                    }
                }

                HStack(spacing: VelvetSpacing.md) {
                    Link(
                        "Lire les conditions",
                        destination: URL(string: "https://velvet-beta.sh96hv64dj.workers.dev/legal/terms/")!
                    )
                    Link(
                        "Confidentialité",
                        destination: URL(string: "https://velvet-beta.sh96hv64dj.workers.dev/legal/privacy/")!
                    )
                }
                .font(VelvetTypography.caption())
                .foregroundStyle(VelvetColor.softBlush)
            }
            .padding(VelvetSpacing.lg)
        }
    }
}

private struct ConsentRow: View {
    @Binding var isOn: Bool
    let title: String
    let systemImage: String

    var body: some View {
        Toggle(isOn: $isOn) {
            HStack(alignment: .top, spacing: VelvetSpacing.sm) {
                Image(systemName: systemImage)
                    .frame(width: 24, height: 24)
                    .foregroundStyle(VelvetColor.champagneGold)

                Text(title)
                    .font(VelvetTypography.body(size: 14))
                    .foregroundStyle(VelvetColor.ivory)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(VelvetColor.velvetBurgundy)
        .frame(minHeight: 44)
    }
}
