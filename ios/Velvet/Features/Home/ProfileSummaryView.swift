import SwiftUI

struct ProfileSummaryView: View {
    @EnvironmentObject private var appState: AppState
    let profile: MemberProfile
    @State private var showsPrivacy = false

    private var photo: URL? {
        profile.mediaAssets?.first(where: { $0.isPrimary == true && $0.previewUrl != nil })?.previewUrl
            ?? profile.mediaAssets?.first(where: { $0.previewUrl != nil })?.previewUrl
    }

    var body: some View {
        ZStack {
            VelvetBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    profileHero

                    HStack(spacing: 10) {
                        statusPill(
                            profile.isAdmitted ? "PROFIL ADMIS" : "ADMISSION EN ATTENTE",
                            icon: profile.isAdmitted ? "checkmark.seal.fill" : "hourglass",
                            color: profile.isAdmitted ? VelvetColor.success : VelvetColor.warning
                        )
                        if profile.verificationStatus == "verified" {
                            statusPill(
                                "VÉRIFIÉ",
                                icon: "checkmark.shield.fill",
                                color: VelvetColor.champagneGold
                            )
                        }
                    }

                    VelvetCard {
                        VStack(alignment: .leading, spacing: 11) {
                            Text("À PROPOS")
                                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                                .tracking(1.8)
                                .foregroundStyle(VelvetColor.champagneGold)
                            Text(profile.description ?? profile.story ?? "Ton histoire Velvet reste à compléter.")
                                .font(VelvetTypography.body(size: 14))
                                .foregroundStyle(VelvetColor.textSecondary)
                                .lineSpacing(4)
                        }
                    }

                    Button {
                        showsPrivacy = true
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: "slider.horizontal.3")
                                .foregroundStyle(VelvetColor.champagneGold)
                                .frame(width: 40, height: 40)
                                .background(VelvetColor.champagneGold.opacity(0.08))
                                .clipShape(Circle())
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Paramètres & confidentialité")
                                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                                    .foregroundStyle(VelvetColor.ivory)
                                Text("Visibilité, notifications et compte")
                                    .font(VelvetTypography.body(size: 11))
                                    .foregroundStyle(VelvetColor.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(VelvetColor.textSecondary)
                        }
                        .padding(15)
                        .background(VelvetColor.ivory.opacity(0.035))
                        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous)
                                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
                        }
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
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 32)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showsPrivacy) {
            PrivacySettingsView()
        }
    }

    private var profileHero: some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: photo) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                ZStack {
                    LinearGradient(
                        colors: [Color(hex: 0x32141F), VelvetColor.anthracite],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    VelvetMark(size: 82)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 390)
            .clipped()

            LinearGradient(
                colors: [.clear, VelvetColor.velvetBlack.opacity(0.95)],
                startPoint: .center,
                endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 7) {
                Text("MON PROFIL")
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1.8)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(profile.displayName)
                    .font(VelvetTypography.title(size: 38))
                    .foregroundStyle(VelvetColor.ivory)
                HStack(spacing: 10) {
                    Text(profile.profileType.label)
                    if let city = profile.city {
                        Text("·")
                        Label(city, systemImage: "location")
                    }
                }
                .font(VelvetTypography.body(size: 12))
                .foregroundStyle(VelvetColor.textSecondary)
            }
            .padding(22)
        }
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.editorial, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.editorial, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
        }
    }

    private func statusPill(_ title: String, icon: String, color: Color) -> some View {
        Label(title, systemImage: icon)
            .font(VelvetTypography.caption(size: 9, weight: .semibold))
            .tracking(1)
            .foregroundStyle(color)
            .padding(.horizontal, 12)
            .frame(height: 32)
            .background(color.opacity(0.09))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(color.opacity(0.22), lineWidth: 1))
    }
}
