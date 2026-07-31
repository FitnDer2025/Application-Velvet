import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    private var discoverableProfiles: [MemberProfile] {
        (store.directory?.profiles ?? []).filter { $0.id != profile.id }
    }

    var body: some View {
        ZStack {
            VelvetBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    VelvetPageHeader(
                        "Votre espace privé",
                        title: "Bonjour \(profile.displayName)",
                        subtitle: "Les nouvelles rencontres, sorties et attentions Velvet réunies au même endroit."
                    )

                    if !profile.isAdmitted {
                        admissionBanner
                    }

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 14) {
                            VelvetMetricCard(
                                value: discoverableProfiles.count,
                                label: "nouveaux profils à découvrir"
                            )
                            VelvetMetricCard(
                                value: store.directory?.events.count ?? 0,
                                label: "événements à venir"
                            )
                            VelvetMetricCard(
                                value: (store.directory?.establishments.count ?? 0)
                                    + (store.directory?.venueDirectory.count ?? 0),
                                label: "lieux et professionnels"
                            )
                        }
                    }
                    .contentMargins(.horizontal, 1)

                    VStack(alignment: .leading, spacing: 16) {
                        sectionTitle("L’actualité Velvet", detail: "Sélection du jour")

                        if let featured = discoverableProfiles.first {
                            NavigationLink {
                                MemberDetailView(profile: featured)
                            } label: {
                                EditorialProfileCard(profile: featured)
                            }
                            .buttonStyle(.plain)
                        } else if let event = store.directory?.events.first {
                            VelvetCard {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("PROCHAINE SORTIE")
                                        .font(VelvetTypography.caption(size: 10, weight: .semibold))
                                        .tracking(1.8)
                                        .foregroundStyle(VelvetColor.champagneGold)
                                    Text(event.title)
                                        .font(VelvetTypography.title(size: 25))
                                        .foregroundStyle(VelvetColor.ivory)
                                    Text(event.startsAt.velvetDateLabel)
                                        .font(VelvetTypography.body(size: 13))
                                        .foregroundStyle(VelvetColor.textSecondary)
                                }
                            }
                        } else {
                            VelvetEmptyState(
                                symbol: "sparkles",
                                title: "Ton fil se prépare",
                                message: "Les nouveaux profils, sorties et lieux apparaîtront ici dès leur publication."
                            )
                        }
                    }

                    Text("BETA PRIVÉE · DONNÉES RÉELLES DU BACKEND VELVET")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.4)
                        .foregroundStyle(VelvetColor.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 28)
            }
            .refreshable { await store.load() }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private func sectionTitle(_ title: String, detail: String) -> some View {
        HStack(alignment: .lastTextBaseline) {
            Text(title)
                .font(VelvetTypography.title(size: 25))
                .foregroundStyle(VelvetColor.ivory)
            Spacer()
            Text(detail.uppercased())
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1.3)
                .foregroundStyle(VelvetColor.champagneGold)
        }
    }

    private var admissionBanner: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "hourglass")
                .foregroundStyle(VelvetColor.warning)
                .frame(width: 34, height: 34)
                .background(VelvetColor.warning.opacity(0.10))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text("Profil en cours d’admission")
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text("L’espace complet s’ouvrira après validation par Velvet.")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VelvetColor.warning.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous)
                .stroke(VelvetColor.warning.opacity(0.24), lineWidth: 1)
        }
    }
}
