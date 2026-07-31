import SwiftUI

/// Point d’entrée historique conservé pour Maps, Recherche et les notifications.
/// La fiche complète est désormais portée par PremiumMemberDetailView afin de
/// garantir la même richesse fonctionnelle que la version Web.
struct MemberDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    private var history: ProfileViewHistory? {
        store.viewHistory(for: profile.id)
    }

    var body: some View {
        ZStack(alignment: .top) {
            PremiumMemberDetailView(profile: profile)

            if let history {
                HStack(spacing: 6) {
                    Image(systemName: "eye.fill")
                    Text("Déjà consulté \(history.viewCount ?? 1) fois")
                    Text("·")
                    Text("dernière visite \(history.lastViewedAt.memberDetailRelativeDate)")
                }
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
                .padding(.horizontal, 11)
                .frame(height: 30)
                .background(.ultraThinMaterial)
                .background(VelvetColor.velvetBlack.opacity(0.60))
                .clipShape(Capsule())
                .overlay(Capsule().stroke(VelvetColor.champagneGold.opacity(0.24), lineWidth: 0.8))
                .padding(.top, 8)
                .padding(.horizontal, 16)
                .accessibilityLabel("Profil consulté \(history.viewCount ?? 1) fois, dernière visite \(history.lastViewedAt.memberDetailRelativeDate)")
            }
        }
    }
}

private extension Optional where Wrapped == String {
    var memberDetailRelativeDate: String {
        guard let value = self else { return "inconnue" }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
        guard let date else { return "inconnue" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: .now)
    }
}
