import SwiftUI

struct HomeView: View {
    let profile: MemberProfile

    var body: some View {
        ZStack {
            VelvetBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: VelvetSpacing.xl) {
                    hero

                    if !profile.isAdmitted {
                        admissionBanner
                    }

                    VelvetSectionHeader(
                        "Aujourd’hui",
                        title: "Ton univers Velvet",
                        subtitle: "Une vue claire de ce qui mérite ton attention."
                    )

                    VStack(spacing: VelvetSpacing.md) {
                        HomeActionCard(
                            icon: "person.crop.rectangle.stack",
                            title: "Découvrir avec intention",
                            detail: "Des profils cohérents avec tes choix, jamais un classement de popularité.",
                            accent: VelvetColor.softBlush
                        )
                        HomeActionCard(
                            icon: "calendar.badge.plus",
                            title: "Préparer une belle sortie",
                            detail: "Événements, clubs et présences confirmées réunis au même endroit.",
                            accent: VelvetColor.champagneGold
                        )
                        HomeActionCard(
                            icon: "lock.shield",
                            title: "Garder le contrôle",
                            detail: "Tes consentements, tes albums et ta visibilité restent révocables.",
                            accent: VelvetColor.success
                        )
                    }

                    Text("BETA PRIVÉE · Les données affichées proviennent du backend Velvet.")
                        .font(VelvetTypography.caption(size: 10))
                        .tracking(1.2)
                        .foregroundStyle(VelvetColor.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, VelvetSpacing.lg)
                }
                .padding(VelvetSpacing.lg)
            }
        }
        .navigationTitle("Accueil")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                VelvetMark(size: 34)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Image(systemName: "bell")
                    .foregroundStyle(VelvetColor.ivory)
                    .frame(width: 44, height: 44)
                    .accessibilityLabel("Notifications")
            }
        }
    }

    private var hero: some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: VelvetSpacing.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: VelvetSpacing.xs) {
                        Text("BONJOUR")
                            .font(VelvetTypography.caption(size: 10, weight: .semibold))
                            .tracking(2)
                            .foregroundStyle(VelvetColor.softBlush)

                        Text(profile.displayName)
                            .font(VelvetTypography.title(size: 34))
                            .foregroundStyle(VelvetColor.ivory)

                        if let city = profile.city, !city.isEmpty {
                            Label(city, systemImage: "location")
                                .font(VelvetTypography.body(size: 13))
                                .foregroundStyle(VelvetColor.textSecondary)
                        }
                    }

                    Spacer()

                    Image(systemName: profile.profileType == .couple ? "person.2.fill" : "person.fill")
                        .font(.system(size: 20, weight: .light))
                        .foregroundStyle(VelvetColor.champagneGold)
                        .frame(width: 46, height: 46)
                        .background(VelvetColor.champagneGold.opacity(0.10))
                        .clipShape(Circle())
                }

                Rectangle()
                    .fill(.white.opacity(0.08))
                    .frame(height: 1)

                Text("Là où les plus belles rencontres commencent.")
                    .font(VelvetTypography.brand(size: 17))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
        }
    }

    private var admissionBanner: some View {
        HStack(alignment: .top, spacing: VelvetSpacing.md) {
            Image(systemName: "hourglass")
                .foregroundStyle(VelvetColor.warning)
                .frame(width: 28, height: 28)

            VStack(alignment: .leading, spacing: VelvetSpacing.xxs) {
                Text("Profil en cours d’admission")
                    .font(VelvetTypography.body(size: 15, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text("Complète les photographies demandées depuis le Web pendant que le parcours natif est finalisé.")
                    .font(VelvetTypography.caption(size: 12, weight: .regular))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
        }
        .padding(VelvetSpacing.md)
        .background(VelvetColor.warning.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous)
                .stroke(VelvetColor.warning.opacity(0.25), lineWidth: 1)
        }
    }
}

private struct HomeActionCard: View {
    let icon: String
    let title: String
    let detail: String
    let accent: Color

    var body: some View {
        HStack(spacing: VelvetSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .light))
                .foregroundStyle(accent)
                .frame(width: 48, height: 48)
                .background(accent.opacity(0.10))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: VelvetSpacing.xxs) {
                Text(title)
                    .font(VelvetTypography.body(size: 15, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text(detail)
                    .font(VelvetTypography.caption(size: 12, weight: .regular))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .padding(VelvetSpacing.md)
        .background(.white.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(.white.opacity(0.07), lineWidth: 1)
        }
    }
}
