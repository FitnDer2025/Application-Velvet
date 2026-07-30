import SwiftUI

struct ProfileSummaryView: View {
    @EnvironmentObject private var appState: AppState
    let profile: MemberProfile

    var body: some View {
        ZStack {
            VelvetBackground()

            ScrollView {
                VStack(spacing: VelvetSpacing.xl) {
                    VelvetMark(size: 76)

                    VStack(spacing: VelvetSpacing.xs) {
                        Text(profile.displayName)
                            .font(VelvetTypography.title())
                            .foregroundStyle(VelvetColor.ivory)

                        Text(profile.profileType.label)
                            .font(VelvetTypography.caption())
                            .foregroundStyle(VelvetColor.softBlush)

                        if let city = profile.city {
                            Label(city, systemImage: "location")
                                .font(VelvetTypography.body(size: 13))
                                .foregroundStyle(VelvetColor.textSecondary)
                        }
                    }

                    VelvetCard {
                        VStack(alignment: .leading, spacing: VelvetSpacing.md) {
                            Label(
                                profile.isAdmitted ? "Profil admis" : "Admission en attente",
                                systemImage: profile.isAdmitted ? "checkmark.seal.fill" : "hourglass"
                            )
                            .foregroundStyle(
                                profile.isAdmitted ? VelvetColor.success : VelvetColor.warning
                            )

                            if let description = profile.description, !description.isEmpty {
                                Text(description)
                                    .font(VelvetTypography.body(size: 14))
                                    .foregroundStyle(VelvetColor.textSecondary)
                            }
                        }
                    }

                    Button(role: .destructive) {
                        Task {
                            await appState.logout()
                        }
                    } label: {
                        Label("Se déconnecter", systemImage: "rectangle.portrait.and.arrow.right")
                            .font(VelvetTypography.body(size: 15, weight: .medium))
                            .frame(maxWidth: .infinity, minHeight: 50)
                    }
                    .buttonStyle(.bordered)
                    .tint(VelvetColor.danger)
                }
                .padding(VelvetSpacing.lg)
            }
        }
        .navigationTitle("Profil")
        .navigationBarTitleDisplayMode(.inline)
    }
}
