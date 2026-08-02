import SwiftUI

/// Point d’entrée partagé par l’accueil, Membres, Lieux, Maps et les notifications.
/// La fiche présente immédiatement l’identité du profil, puis sépare son univers
/// éditorial de son historique de sorties et de ses recommandations consenties.
struct MemberDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var plans: PlanStateResponse?
    @State private var selectedTab = "profile"

    private var history: ProfileViewHistory? {
        store.viewHistory(for: profile.id)
    }

    var body: some View {
        VStack(spacing: 0) {
            memberIdentityHeader
            profileTabs

            switch selectedTab {
            case "outings":
                MemberOutingsHistoryView(profile: profile, plans: plans)
            case "recommendations":
                ProfileRecommendationsView(profile: profile)
            default:
                PremiumMemberDetailView(profile: profile)
            }
        }
        .background(VelvetBackground())
        .navigationBarTitleDisplayMode(.inline)
        .task {
            plans = try? await store.service.plans()
        }
    }

    private var memberIdentityHeader: some View {
        HStack(spacing: 13) {
            VelvetRemoteImage(
                url: profile.socialPrimaryPhoto,
                symbol: profile.profileType == .couple ? "person.2.fill" : "person.fill"
            )
            .frame(width: 68, height: 68)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(VelvetColor.champagneGold.opacity(0.26), lineWidth: 0.9)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(profile.displayName)
                    .font(VelvetTypography.title(size: 25))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                Text([profile.velvetDemographicAndAgeLabel, profile.locationZone ?? profile.city]
                    .compactMap { $0 }
                    .joined(separator: " · "))
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .lineLimit(2)

                if let history {
                    Label(
                        "Déjà consulté · \(history.viewCount ?? 1) visite\((history.viewCount ?? 1) > 1 ? "s" : "")",
                        systemImage: "eye.fill"
                    )
                    .font(VelvetTypography.caption(size: 8))
                    .foregroundStyle(VelvetColor.textSecondary)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.78))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(VelvetColor.borderSubtle)
                .frame(height: 0.7)
        }
    }

    private var profileTabs: some View {
        HStack(spacing: 5) {
            tab("Profil", value: "profile", icon: "person.text.rectangle")
            tab("Soirées", value: "outings", icon: "calendar.badge.clock")
            tab("Avis", value: "recommendations", icon: "quote.bubble")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(VelvetColor.velvetBlack.opacity(0.92))
    }

    private func tab(_ title: String, value: String, icon: String) -> some View {
        Button {
            withAnimation(.easeOut(duration: VelvetMotion.fast)) {
                selectedTab = value
            }
        } label: {
            Label(title, systemImage: icon)
                .font(VelvetTypography.body(size: 11, weight: .semibold))
                .foregroundStyle(selectedTab == value ? VelvetColor.champagneGold : VelvetColor.textSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(
                    selectedTab == value
                        ? VelvetColor.champagneGold.opacity(0.09)
                        : Color.clear
                )
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .stroke(
                            selectedTab == value
                                ? VelvetColor.champagneGold.opacity(0.20)
                                : VelvetColor.borderSubtle,
                            lineWidth: 0.7
                        )
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selectedTab == value ? .isSelected : [])
    }
}
