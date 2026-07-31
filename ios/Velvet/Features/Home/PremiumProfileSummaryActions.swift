import SwiftUI

extension PremiumProfileSummaryView {
    var accountActions: some View {
        VStack(spacing: 12) {
            Button {
                showsMemberTools = true
            } label: {
                PremiumProfileActionRow(
                    title: "Studio du profil",
                    detail: "Rédaction, organisateur et gestion du cycle",
                    icon: "wand.and.stars",
                    color: VelvetColor.softBlush
                )
            }
            .buttonStyle(.plain)

            Button {
                showsPrivacy = true
            } label: {
                PremiumProfileActionRow(
                    title: "Paramètres & confidentialité",
                    detail: "Visibilité, Face ID, notifications et compte",
                    icon: "slider.horizontal.3",
                    color: VelvetColor.champagneGold
                )
            }
            .buttonStyle(.plain)

            Button(role: .destructive) {
                Task { await appState.logout() }
            } label: {
                Label("Se déconnecter", systemImage: "rectangle.portrait.and.arrow.right")
                    .font(VelvetTypography.body(size: 13, weight: .medium))
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.plain)
            .foregroundStyle(VelvetColor.danger)
        }
    }
}
