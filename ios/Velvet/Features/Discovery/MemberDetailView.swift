import SwiftUI

/// Point d’entrée historique conservé pour Maps, Recherche et les notifications.
/// La fiche complète est désormais portée par PremiumMemberDetailView afin de
/// garantir la même richesse fonctionnelle que la version Web.
struct MemberDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var plans: PlanStateResponse?

    private var history: ProfileViewHistory? {
        store.viewHistory(for: profile.id)
    }

    private var nextVenueVisit: VenueVisit? {
        (plans?.venueVisits ?? [])
            .filter { $0.profileId == profile.id }
            .filter {
                guard let date = $0.visitDate.profileOutingDateValue else { return true }
                return date >= Calendar.current.startOfDay(for: Date())
            }
            .sorted { ($0.visitDate.profileOutingDateValue ?? .distantFuture) < ($1.visitDate.profileOutingDateValue ?? .distantFuture) }
            .first
    }

    var body: some View {
        VStack(spacing: 0) {
            if history != nil || nextVenueVisit != nil {
                VStack(spacing: 8) {
                    if let history {
                        historyBadge(history)
                    }

                    if let nextVenueVisit {
                        MemberNextOutingBanner(profile: profile, visit: nextVenueVisit)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 4)
                .background(VelvetColor.velvetBlack.opacity(0.90))
            }

            PremiumMemberDetailView(profile: profile)
        }
        .task {
            plans = try? await store.service.plans()
        }
    }

    private func historyBadge(_ history: ProfileViewHistory) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "eye.fill")
            Text("Déjà consulté \(history.viewCount ?? 1) fois")
            Text("·")
            Text("dernière visite \(history.lastViewedAt.memberDetailRelativeDate)")
            Spacer(minLength: 0)
        }
        .font(.system(size: 9, weight: .semibold))
        .foregroundStyle(VelvetColor.champagneGold)
        .padding(.horizontal, 11)
        .frame(minHeight: 30)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.60))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(VelvetColor.champagneGold.opacity(0.24), lineWidth: 0.8))
        .accessibilityLabel("Profil consulté \(history.viewCount ?? 1) fois, dernière visite \(history.lastViewedAt.memberDetailRelativeDate)")
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
