import SwiftUI

struct PremiumOwnProfileView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var selectedSection = "overview"
    @State private var selectedAlbum: VelvetAlbumPresentation?

    private var photos: [MediaAsset] { profile.approvedPhotos }

    private var albums: [VelvetAlbumPresentation] {
        (profile.albums ?? []).map { album in
            VelvetAlbumPresentation(
                id: album.id,
                title: album.name,
                subtitle: album.confidentiality == "public"
                    ? "Collection visible par les membres autorisés"
                    : "Collection privée sur autorisation explicite",
                confidentiality: album.confidentiality ?? "private",
                expiresAt: album.expiresAt,
                urls: (album.mediaAssets ?? []).compactMap(\.previewUrl)
            )
        }
    }

    private var recommendations: [Recommendation] {
        (store.directory?.recommendations ?? []).filter {
            $0.targetType == "profile" && $0.targetId == profile.id
        }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VelvetProfileGallery(
                        urls: photos.compactMap(\.previewUrl),
                        eyebrow: profile.velvetAudienceLabel,
                        title: profile.displayName,
                        subtitle: profile.locationZone ?? profile.city ?? "Zone privée"
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
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $selectedAlbum) { album in
            VelvetAlbumDetailView(album: album)
        }
    }

    private var statusRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                PremiumStatusPill(
                    title: profile.isAdmitted ? "PROFIL ADMIS" : "ADMISSION EN ATTENTE",
                    icon: profile.isAdmitted ? "checkmark.seal.fill" : "hourglass",
                    color: profile.isAdmitted ? VelvetColor.success : VelvetColor.warning
                )
                if profile.verificationStatus == "verified" {
                    PremiumStatusPill(
                        title: "IDENTITÉ VÉRIFIÉE",
                        icon: "checkmark.shield.fill",
                        color: VelvetColor.champagneGold
                    )
                }
                PremiumStatusPill(
                    title: "\(photos.count) PHOTO\(photos.count > 1 ? "S" : "")",
                    icon: "photo",
                    color: VelvetColor.softBlush
                )
            }
        }
    }

    private var sectionNavigation: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                PremiumProfileSegment(
                    title: profile.profileType == .couple ? "Le couple" : "Présentation",
                    selected: selectedSection == "overview"
                ) { selectedSection = "overview" }

                ForEach(profile.individualProfiles ?? []) { person in
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
                  let person = (profile.individualProfiles ?? []).first(where: {
                      selectedSection == "person-\($0.id.uuidString)"
                  }) {
            personContent(person)
        } else {
            overviewContent
        }
    }

    private var overviewContent: some View {
        VStack(spacing: 14) {
            PremiumProfileSection(eyebrow: "En quelques mots", title: "Notre univers") {
                PremiumProfileText(
                    value: profile.description,
                    fallback: "La présentation de ce profil reste à compléter.",
                    quote: true
                )
                PremiumProfileTags(values: profile.valuesList ?? [], emptyText: "Valeurs à compléter")
            }

            PremiumProfileSection(eyebrow: "Le récit", title: "Notre histoire") {
                PremiumProfileText(value: profile.story, fallback: "Cette histoire reste à écrire.")
            }

            PremiumProfileSection(eyebrow: "Le chemin parcouru", title: "Notre parcours") {
                PremiumProfileText(value: profile.journey, fallback: "Le parcours n’est pas encore renseigné.")
            }

            PremiumProfileSection(eyebrow: "Les rencontres souhaitées", title: "Ce que nous recherchons") {
                PremiumProfileText(value: profile.searchText, fallback: "Les envies de rencontre ne sont pas encore précisées.")
            }

            PremiumProfileSection(eyebrow: "Nos envies", title: "Pratiques & expériences") {
                PremiumProfileTags(values: profile.practices ?? [], emptyText: "Pratiques à compléter")
            }

            if !(profile.individualProfiles ?? []).isEmpty {
                PremiumProfileSection(eyebrow: "Les personnes", title: "Derrière ce profil") {
                    VStack(spacing: 10) {
                        ForEach(profile.individualProfiles ?? []) { person in
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
                title: profile.locationZone ?? profile.city ?? "Zone privée"
            ) {
                Text("Velvet affiche uniquement la zone choisie et jamais l’adresse exacte.")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            PremiumProfileSection(eyebrow: "Lieux préférés", title: "Nos repères") {
                PremiumProfileTags(values: profile.favoritePlaces ?? [], emptyText: "Aucun lieu renseigné")
            }

            PremiumProfileSection(eyebrow: "Disponibilités", title: "Quand nous rencontrer") {
                PremiumProfileText(value: profile.availabilityText, fallback: "Disponibilités non renseignées.")
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
                PremiumProfileTags(values: person.attractedTo ?? [], emptyText: "Attirances non renseignées")
            }

            PremiumProfileSection(
                eyebrow: "Envies personnelles",
                title: "Ce que \(person.firstName ?? "cette personne") souhaite vivre"
            ) {
                PremiumProfileTags(values: person.desiredPractices ?? [], emptyText: "Envies non renseignées")
            }

            if profile.profileType == .couple {
                PremiumProfileSection(
                    eyebrow: "Accords du couple",
                    title: "Permissions du ou de la partenaire"
                ) {
                    PremiumProfileTags(values: person.partnerPermissions ?? [], emptyText: "Accords non renseignés")
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
                    Text("COLLECTIONS")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text("Mes albums")
                        .font(VelvetTypography.title(size: 27))
                        .foregroundStyle(VelvetColor.ivory)
                }
                Spacer()
                Text("\(albums.count)")
                    .font(VelvetTypography.title(size: 26))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            if albums.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "photo.on.rectangle.angled",
                    title: "Aucun album publié",
                    message: "Les photos de profil restent dans le carrousel principal et ne sont plus dupliquées comme album."
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
}
