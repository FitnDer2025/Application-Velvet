import SwiftUI

struct PremiumOwnProfileOutingsView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var plans: PlanStateResponse?
    @State private var selectedTab = "profile"
    @State private var showsTonight = false

    var body: some View {
        VStack(spacing: 0) {
            ownIdentityHeader
            ownTabs

            switch selectedTab {
            case "passport":
                ZwitPassportView()
            case "outings":
                MemberOutingsHistoryView(profile: profile, plans: plans)
            case "publish":
                OwnOutingPublisherView(profile: profile) { updated in
                    Task { @MainActor in
                        if let updated {
                            plans = updated
                        } else {
                            plans = try? await store.service.plans()
                        }
                        selectedTab = "outings"
                    }
                }
            default:
                PremiumOwnProfileView(profile: profile)
            }
        }
        .background(VelvetBackground())
        .task {
            plans = try? await store.service.plans()
        }
        .sheet(isPresented: $showsTonight) {
            NavigationStack {
                ZwitTonightView()
            }
        }
    }

    private var ownIdentityHeader: some View {
        HStack(spacing: 13) {
            VelvetRemoteImage(
                url: profile.socialPrimaryPhoto,
                symbol: profile.profileType == .couple ? "person.2.fill" : "person.fill"
            )
            .frame(width: 66, height: 66)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(VelvetColor.champagneGold.opacity(0.25), lineWidth: 0.9)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("MON PROFIL")
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(profile.displayName)
                    .font(VelvetTypography.title(size: 25))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                Text([profile.velvetDemographicAndAgeLabel, profile.locationZone ?? profile.city]
                    .compactMap { $0 }
                    .joined(separator: " · "))
                    .font(VelvetTypography.caption(size: 10))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(2)
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

    private var ownTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 5) {
                tonightButton
                tab("Profil", value: "profile", icon: "person.text.rectangle")
                tab("Passeport", value: "passport", icon: "checkmark.shield")
                tab("Sorties", value: "outings", icon: "calendar.badge.clock")
                tab("Déclarer une sortie", value: "publish", icon: "plus.circle.fill")
            }
            .padding(.horizontal, 16)
        }
        .padding(.vertical, 8)
        .background(VelvetColor.velvetBlack.opacity(0.92))
    }

    private var tonightButton: some View {
        Button {
            showsTonight = true
        } label: {
            Label("Ce soir", systemImage: "moon.stars")
                .font(VelvetTypography.body(size: 11, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
                .padding(.horizontal, 13)
                .frame(height: 40)
                .background(VelvetColor.champagneGold.opacity(0.09))
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .stroke(VelvetColor.champagneGold.opacity(0.20), lineWidth: 0.7)
                }
        }
        .buttonStyle(.plain)
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
                .padding(.horizontal, 13)
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
