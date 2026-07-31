import SwiftUI

struct PremiumOwnProfileView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var liveProfile: MemberProfile?
    @State private var selectedSection = "overview"
    @State private var selectedAlbum: VelvetAlbumPresentation?
    @State private var isRefreshing = false

    private var currentProfile: MemberProfile { liveProfile ?? profile }
    private var photos: [MediaAsset] { currentProfile.profileGalleryPhotos }

    private var albums: [VelvetAlbumPresentation] {
        (currentProfile.albums ?? [])
            .sorted { left, right in
                if left.confidentiality == right.confidentiality {
                    return left.name.localizedCaseInsensitiveCompare(right.name) == .orderedAscending
                }
                return left.confidentiality != "public"
            }
            .map { album in
                VelvetAlbumPresentation(
                    id: album.id,
                    title: album.name,
                    subtitle: album.confidentiality == "public"
                        ? "Collection publique visible sur ta fiche"
                        : "Collection privée, accessible uniquement sur autorisation",
                    confidentiality: album.confidentiality ?? "private",
                    expiresAt: album.expiresAt,
                    urls: (album.mediaAssets ?? []).compactMap(\.previewUrl)
                )
            }
    }

    private var recommendations: [Recommendation] {
        (store.directory?.recommendations ?? []).filter {
            $0.targetType == "profile" && $0.targetId == currentProfile.id
        }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VelvetProfileGallery(
                        urls: photos.compactMap(\.previewUrl),
                        eyebrow: currentProfile.velvetDemographicAndAgeLabel,
                        title: currentProfile.displayName,
                        subtitle: currentProfile.locationZone ?? currentProfile.city ?? "Zone privée"
                    )

                    statusRow
                    sectionNavigation
                    selectedContent

                    Label(
                        "Studio du profil, Velvet IA, modification et paramètres sont accessibles depuis le menu en haut à droite.",
                        systemImage: "line.3.horizontal"
                    )
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .padding(.horizontal, 4)
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 30)
            }
            .refreshable { await reloadProfile() }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $selectedAlbum) { album in
            VelvetAlbumDetailView(album: album)
        }
        .task { await reloadProfile() }
    }

    private var statusRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                PremiumStatusPill(
                    title: currentProfile.isAdmitted ? "PROFIL ADMIS" : "ADMISSION EN ATTENTE",
                    icon: currentProfile.isAdmitted ? "checkmark.seal.fill" : "hourglass",
                    color: currentProfile.isAdmitted ? VelvetColor.success : VelvetColor.warning
                )
                if currentProfile.verificationStatus == "verified" {
                    PremiumStatusPill(
                        title: "IDENTITÉ VÉRIFIÉE",
                        icon: "checkmark.shield.fill",
                        color: VelvetColor.champagneGold
                    )
                }
                PremiumStatusPill(
                    title: "\(photos.count) PHOTO\(photos.count > 1 ? "S" : "") PUBLIQUE\(photos.count > 1 ? "S" : "")",
                    icon: "photo",
                    color: VelvetColor.softBlush
                )
                PremiumStatusPill(
                    title: "\(albums.count) ALBUM\(albums.count > 1 ? "S" : "")",
                    icon: "photo.stack",
                    color: VelvetColor.champagneGold
                )
            }
        }
    }

    private var sectionNavigation: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                PremiumProfileSegment(
                    title: currentProfile.profileType == .couple ? "Le couple" : "Présentation",
                    selected: selectedSection == "overview"
                ) { selectedSection = "overview" }

                ForEach(currentProfile.individualProfiles ?? []) { person in
                    let value = "person-\(person.id.uuidString)"
                    PremiumProfileSegment(
                        title: person.firstName ?? "Personne",
                        selected: selectedSection == value
                    ) { selectedSection = value }
                }

                PremiumProfileSegment(
                    title: "Albums · \(albums.count)",
                    selected: selectedSection == "albums"
                ) { selectedSection = "albums" }
            }
            .padding(.horizontal, 6)
            .background(.ultraThinMaterial)
            .background(VelvetColor.anthracite.opacity(0.58))
            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous))
        }
    }

    @ViewBuilder
    private var selectedContent: some View {
        if selectedSection == "albums" {
            albumsContent
        } else if selectedSection.hasPrefix("person-"),
                  let person = (currentProfile.individualProfiles ?? []).first(where: {
                      selectedSection == "person-\($0.id.uuidString)"
                  }) {
            personContent(person)
        } else {
            overviewContent
        }
    }

    private var overviewContent: some View {
        VStack(spacing: 14) {
            PremiumProfileSection(
                eyebrow: "En quelques mots",
                title: currentProfile.ownUniverseTitle
            ) {
                PremiumProfileText(
                    value: currentProfile.description,
                    fallback: "La présentation de ce profil reste à compléter.",
                    quote: true
                )
                PremiumProfileTags(
                    values: currentProfile.valuesList ?? [],
                    emptyText: "Valeurs à compléter"
                )
            }

            PremiumProfileSection(eyebrow: "Le récit", title: currentProfile.ownStoryTitle) {
                PremiumProfileText(
                    value: currentProfile.story,
                    fallback: "Cette histoire reste à écrire."
                )
            }

            PremiumProfileSection(
                eyebrow: "Le chemin parcouru",
                title: currentProfile.ownJourneyTitle
            ) {
                PremiumProfileText(
                    value: currentProfile.journey,
                    fallback: "Le parcours n’est pas encore renseigné."
                )
            }

            PremiumProfileSection(
                eyebrow: "Les rencontres souhaitées",
                title: currentProfile.ownSearchTitle
            ) {
                PremiumProfileText(
                    value: currentProfile.searchText,
                    fallback: "Les envies de rencontre ne sont pas encore précisées."
                )
            }

            PremiumProfileSection(
                eyebrow: currentProfile.ownDesiresEyebrow,
                title: "Pratiques & expériences"
            ) {
                PremiumProfileTags(
                    values: currentProfile.practices ?? [],
                    emptyText: "Pratiques à compléter"
                )
            }

            if !(currentProfile.individualProfiles ?? []).isEmpty {
                PremiumProfileSection(
                    eyebrow: currentProfile.isCoupleProfile ? "Les personnes" : "Ma fiche",
                    title: currentProfile.isCoupleProfile ? "Derrière ce profil" : "À propos de moi"
                ) {
                    VStack(spacing: 10) {
                        ForEach(currentProfile.individualProfiles ?? []) { person in
                            Button {
                                selectedSection = "person-\(person.id.uuidString)"
                            } label: {
                                PremiumProfilePersonRow(person: person)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            PremiumProfileSection(
                eyebrow: "Localisation publique",
                title: currentProfile.locationZone ?? currentProfile.city ?? "Zone privée"
            ) {
                Text("Velvet affiche uniquement la zone choisie et jamais l’adresse exacte.")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            PremiumProfileSection(
                eyebrow: "Lieux préférés",
                title: currentProfile.ownPlacesTitle
            ) {
                PremiumProfileTags(
                    values: currentProfile.favoritePlaces ?? [],
                    emptyText: "Aucun lieu renseigné"
                )
            }

            PremiumProfileSection(
                eyebrow: "Disponibilités",
                title: currentProfile.ownAvailabilityTitle
            ) {
                PremiumProfileText(
                    value: currentProfile.availabilityText,
                    fallback: "Disponibilités non renseignées."
                )
            }

            PremiumProfileSection(eyebrow: "La communauté", title: "Recommandations") {
                recommendationsContent
            }
        }
    }

    private func personContent(_ person: IndividualProfile) -> some View {
        VStack(spacing: 14) {
            PremiumProfileSection(
                eyebrow: "Portrait personnel",
                title: person.firstName ?? "Fiche personnelle"
            ) {
                PremiumProfileText(
                    value: person.biography,
                    fallback: "La présentation personnelle reste à compléter.",
                    quote: true
                )
                PremiumProfileFacts(person: person)
            }

            PremiumProfileSection(
                eyebrow: "Orientation et attirances",
                title: person.orientation ?? "Attirances"
            ) {
                PremiumProfileTags(
                    values: person.attractedTo ?? [],
                    emptyText: "Attirances non renseignées"
                )
            }

            PremiumProfileSection(
                eyebrow: "Envies personnelles",
                title: "Ce que \(person.firstName ?? "cette personne") souhaite vivre"
            ) {
                PremiumProfileTags(
                    values: person.desiredPractices ?? [],
                    emptyText: "Envies non renseignées"
                )
            }

            if currentProfile.profileType == .couple {
                PremiumProfileSection(
                    eyebrow: "Accords du couple",
                    title: "Permissions du ou de la partenaire"
                ) {
                    PremiumProfileTags(
                        values: person.partnerPermissions ?? [],
                        emptyText: "Accords non renseignés"
                    )
                }
            }

            let personPhotos = photos.filter { $0.individualProfileId == person.id }
            PremiumProfileSection(
                eyebrow: "Photos individuelles",
                title: "Galerie de \(person.firstName ?? "ce membre")"
            ) {
                if personPhotos.isEmpty {
                    Text("Aucune photo individuelle publiée.")
                        .font(VelvetTypography.body(size: 13))
                        .foregroundStyle(VelvetColor.textSecondary)
                } else {
                    VelvetMediaGrid(urls: personPhotos.compactMap(\.previewUrl))
                }
            }
        }
    }

    private var albumsContent: some View {
        VStack(spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text("COLLECTIONS PUBLIQUES ET PRIVÉES")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text("Mes albums")
                        .font(VelvetTypography.title(size: 27))
                        .foregroundStyle(VelvetColor.ivory)
                }
                Spacer()
                if isRefreshing {
                    ProgressView().tint(VelvetColor.champagneGold)
                } else {
                    Text("\(albums.count)")
                        .font(VelvetTypography.title(size: 26))
                        .foregroundStyle(VelvetColor.textSecondary)
                }
            }

            if albums.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "photo.on.rectangle.angled",
                    title: "Aucun album publié",
                    message: "Les photos publiques restent dans le carrousel principal. Tes albums privés apparaissent ici après leur création."
                )
            } else {
                ForEach(albums) { album in
                    Button {
                        selectedAlbum = album
                    } label: {
                        VelvetAlbumCoverCard(album: album)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private var recommendationsContent: some View {
        if recommendations.isEmpty {
            Text("Aucune recommandation reçue pour le moment.")
                .font(VelvetTypography.body(size: 13))
                .foregroundStyle(VelvetColor.textSecondary)
        } else {
            VStack(spacing: 10) {
                ForEach(recommendations) { recommendation in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(recommendationAuthor(recommendation))
                                .font(VelvetTypography.body(size: 13, weight: .semibold))
                                .foregroundStyle(VelvetColor.ivory)
                            Spacer()
                            if let rating = recommendation.rating {
                                Text("\(rating)/5")
                                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                                    .foregroundStyle(VelvetColor.champagneGold)
                            }
                        }
                        Text(recommendation.body ?? "")
                            .font(VelvetTypography.body(size: 12))
                            .foregroundStyle(VelvetColor.textSecondary)
                    }
                    .padding(13)
                    .background(VelvetColor.ivory.opacity(0.035))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
        }
    }

    private func recommendationAuthor(_ recommendation: Recommendation) -> String {
        store.directory?.profiles.first(where: {
            $0.id == recommendation.authorProfileId
        })?.displayName ?? "Membre Velvet"
    }

    @MainActor
    private func reloadProfile() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            if let updated = try await store.service.profile().profile {
                liveProfile = updated
                if selectedSection == "albums", albums.isEmpty {
                    selectedSection = "overview"
                }
            }
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}
