import SwiftUI

struct DiscoveryView: View {
    @EnvironmentObject private var store: VelvetStore
    let currentProfile: MemberProfile
    @State private var query = ""
    @State private var type: MemberProfile.ProfileType?

    private var profiles: [MemberProfile] {
        (store.directory?.profiles ?? [])
            .filter { $0.id != currentProfile.id }
            .filter { type == nil || $0.profileType == type }
            .filter {
                query.isEmpty
                    || $0.displayName.localizedCaseInsensitiveContains(query)
                    || ($0.locationZone ?? $0.city ?? "").localizedCaseInsensitiveContains(query)
                    || ($0.searchText ?? "").localizedCaseInsensitiveContains(query)
            }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VelvetPageHeader(
                        "Recherche sur mesure",
                        title: "Recherche",
                        subtitle: "Découvre les univers qui te ressemblent, dans le respect de la visibilité choisie par chaque membre."
                    )

                    VelvetSearchField(prompt: "Nom, ville, univers…", text: $query)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 9) {
                            VelvetChip(title: "Tous", selected: type == nil) { type = nil }
                            VelvetChip(title: "Couples", selected: type == .couple) { type = .couple }
                            VelvetChip(title: "Individuels", selected: type == .individual) {
                                type = .individual
                            }
                        }
                    }

                    if store.directory?.locked == true {
                        VelvetEmptyState(
                            symbol: "lock.shield",
                            title: "Admission nécessaire",
                            message: "La recherche s’ouvre dès que ton profil est admis par Velvet."
                        )
                    } else if profiles.isEmpty, !store.isLoading {
                        VelvetEmptyState(
                            symbol: "magnifyingglass",
                            title: query.isEmpty ? "La sélection s’affine" : "Aucun profil correspondant",
                            message: query.isEmpty
                                ? "De nouveaux profils apparaîtront ici dès qu’ils seront admis et visibles."
                                : "Essaie une autre ville, un autre nom ou élargis le type de profil."
                        )
                    } else {
                        LazyVStack(spacing: 18) {
                            ForEach(profiles) { profile in
                                NavigationLink {
                                    MemberDetailView(profile: profile)
                                } label: {
                                    EditorialProfileCard(profile: profile)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 28)
            }
            .refreshable { await store.load() }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

struct EditorialProfileCard: View {
    let profile: MemberProfile

    private var primaryPhoto: URL? {
        profile.mediaAssets?
            .first(where: { $0.isPrimary == true && $0.previewUrl != nil })?
            .previewUrl
            ?? profile.mediaAssets?.first(where: { $0.previewUrl != nil })?.previewUrl
    }

    private var ages: String? {
        let years = (profile.individualProfiles ?? []).compactMap(\.birthYear).map {
            Calendar.current.component(.year, from: Date()) - $0
        }
        guard !years.isEmpty else { return nil }
        return years.map(String.init).joined(separator: " · ") + " ans"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 9) {
                Image(systemName: profile.profileType == .couple ? "person.2.fill" : "person.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 28, height: 28)
                    .background(VelvetColor.velvetBurgundy.opacity(0.24))
                    .clipShape(Circle())

                Text(profile.displayName)
                    .font(VelvetTypography.body(size: 15, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)

                Spacer()

                Circle()
                    .fill(VelvetColor.success)
                    .frame(width: 8, height: 8)
                    .shadow(color: VelvetColor.success.opacity(0.6), radius: 5)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)

            AsyncImage(url: primaryPhoto) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                ZStack {
                    LinearGradient(
                        colors: [
                            Color(hex: 0x32141F),
                            VelvetColor.anthracite
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    RadialGradient(
                        colors: [
                            VelvetColor.champagneGold.opacity(0.14),
                            .clear
                        ],
                        center: .topTrailing,
                        startRadius: 8,
                        endRadius: 170
                    )
                    Image(systemName: profile.profileType == .couple ? "person.2.fill" : "person.fill")
                        .font(.system(size: 58, weight: .ultraLight))
                        .foregroundStyle(VelvetColor.champagneGold.opacity(0.78))
                }
            }
            .aspectRatio(4 / 5, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .padding(.horizontal, 7)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(profile.profileType.label.uppercased())
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.3)
                        .foregroundStyle(VelvetColor.champagneGold)
                    if let ages {
                        Text("· \(ages)")
                            .font(VelvetTypography.caption(size: 10))
                            .foregroundStyle(VelvetColor.textSecondary)
                    }
                }

                Label(profile.locationZone ?? profile.city ?? "Zone privée", systemImage: "location")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)

                if let summary = profile.description ?? profile.story, !summary.isEmpty {
                    Text(summary)
                        .font(VelvetTypography.body(size: 13))
                        .foregroundStyle(VelvetColor.ivory.opacity(0.88))
                        .lineLimit(3)
                        .lineSpacing(3)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
        .background(
            LinearGradient(
                colors: [
                    VelvetColor.ivory.opacity(0.045),
                    VelvetColor.ivory.opacity(0.008)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .background(VelvetColor.anthracite.opacity(0.82))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(VelvetColor.ivory.opacity(0.095), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.24), radius: 25, y: 14)
    }
}

struct LockedDirectoryView: View {
    var body: some View {
        VelvetEmptyState(
            symbol: "lock.shield",
            title: "Admission nécessaire",
            message: "Cet espace est réservé aux membres admis."
        )
    }
}
