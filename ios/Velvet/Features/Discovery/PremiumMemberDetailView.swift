import SwiftUI

struct PremiumMemberDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    @EnvironmentObject private var screenshotProtection: ScreenshotProtectionService
    let profile: MemberProfile

    @State private var selectedSection = "overview"
    @State private var selectedAlbum: VelvetAlbumPresentation?
    @State private var activeConversation: Conversation?
    @State private var showsSafety = false
    @State private var showsAlbumAccess = false
    @State private var isWorking = false
    @State private var reaction: String?

    private var photos: [MediaAsset] { profile.approvedPhotos }

    private var primaryMedia: MediaAsset? {
        photos.first(where: { $0.isPrimary == true }) ?? photos.first
    }

    private var albums: [VelvetAlbumPresentation] {
        (profile.albums ?? []).map { album in
            VelvetAlbumPresentation(
                id: album.id,
                title: album.name,
                subtitle: album.confidentiality == "public"
                    ? "Collection publique du profil"
                    : "Collection privée ouverte pour ton compte",
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

                    HStack(spacing: 9) {
                        if profile.verificationStatus == "verified" {
                            PremiumStatusPill(
                                title: "PROFIL VÉRIFIÉ",
                                icon: "checkmark.seal.fill",
                                color: VelvetColor.success
                            )
                        }
                        PremiumStatusPill(
                            title: "\(photos.count) PHOTO\(photos.count > 1 ? "S" : "")",
                            icon: "photo",
                            color: VelvetColor.softBlush
                        )
                        Spacer()
                        reactionButtons
                    }

                    sectionNavigation
                    selectedContent
                    actionPanel
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 34)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(VelvetColor.velvetBlack.opacity(0.88), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .sheet(item: $selectedAlbum) { album in
            VelvetAlbumDetailView(album: album)
        }
        .sheet(isPresented: $showsSafety) {
            SafetyActionsView(profile: profile)
                .environmentObject(store)
        }
        .sheet(isPresented: $showsAlbumAccess) {
            ProfileAlbumAccessSheet(targetProfile: profile)
                .environmentObject(store)
        }
        .navigationDestination(
            isPresented: Binding(
                get: { activeConversation != nil },
                set: { if !$0 { activeConversation = nil } }
            )
        ) {
            if let activeConversation {
                AppleConversationView(conversation: activeConversation)
            }
        }
        .onAppear {
            screenshotProtection.protect(ownerProfileID: profile.id, mediaID: primaryMedia?.id)
        }
        .onDisappear {
            screenshotProtection.clear(ownerProfileID: profile.id)
        }
        .task {
            _ = try? await store.service.setEngagement(profileID: profile.id, action: "view")
        }
    }

    private var reactionButtons: some View {
        HStack(spacing: 6) {
            reactionButton("like", icon: "hand.thumbsup.fill")
            reactionButton("love", icon: "heart.fill")
            reactionButton("adore", icon: "sparkles")
        }
    }

    private func reactionButton(_ value: String, icon: String) -> some View {
        Button {
            Task { await setReaction(reaction == value ? nil : value) }
        } label: {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(reaction == value ? VelvetColor.velvetBlack : VelvetColor.champagneGold)
                .frame(width: 34, height: 34)
                .background(
                    reaction == value
                        ? VelvetColor.champagneGold
                        : VelvetColor.champagneGold.opacity(0.08)
                )
                .clipShape(Circle())
                .overlay(Circle().stroke(VelvetColor.champagneGold.opacity(0.18), lineWidth: 0.8))
        }
        .buttonStyle(.plain)
        .disabled(primaryMedia == nil)
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
            PremiumProfileSection(eyebrow: "En quelques mots", title: "Leur univers") {
                PremiumProfileText(
                    value: profile.description,
                    fallback: "Ce profil n’a pas encore publié sa présentation.",
                    quote: true
                )
                PremiumProfileTags(values: profile.valuesList ?? [], emptyText: "Valeurs non renseignées")
            }

            PremiumProfileSection(eyebrow: "Le récit", title: "Leur histoire") {
                PremiumProfileText(value: profile.story, fallback: "Histoire non renseignée.")
            }

            PremiumProfileSection(eyebrow: "Le chemin parcouru", title: "Leur parcours") {
                PremiumProfileText(value: profile.journey, fallback: "Parcours non renseigné.")
            }

            PremiumProfileSection(eyebrow: "Les rencontres souhaitées", title: "Ce qu’ils recherchent") {
                PremiumProfileText(value: profile.searchText, fallback: "Recherche non renseignée.")
            }

            PremiumProfileSection(eyebrow: "Leurs envies", title: "Pratiques & expériences") {
                PremiumProfileTags(values: profile.practices ?? [], emptyText: "Pratiques non renseignées")
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
                Text("Seule la zone choisie par ce membre est affichée.")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            PremiumProfileSection(eyebrow: "Lieux préférés", title: "Leurs repères") {
                PremiumProfileTags(values: profile.favoritePlaces ?? [], emptyText: "Aucun lieu renseigné")
            }

            PremiumProfileSection(eyebrow: "Disponibilités", title: "Quand les rencontrer") {
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
                    fallback: "Présentation personnelle non renseignée.",
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
                    Text("Aucune photo individuelle publique.")
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
                    Text("COLLECTIONS AUTORISÉES")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text("Albums du profil")
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
                    symbol: "lock.rectangle.stack",
                    title: "Aucun album accessible",
                    message: "Les photos publiques restent visibles dans le carrousel principal."
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

    private var actionPanel: some View {
        VStack(spacing: 10) {
            VelvetPrimaryButton("Écrire un message", isLoading: isWorking) {
                Task { await startConversation() }
            }

            Button {
                showsAlbumAccess = true
            } label: {
                Label("Partager un album privé", systemImage: "lock.open")
                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(VelvetColor.champagneGold.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(VelvetColor.champagneGold.opacity(0.20), lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)

            Button {
                showsSafety = true
            } label: {
                Label("Sécurité, blocage et signalement", systemImage: "shield")
                    .font(VelvetTypography.body(size: 12, weight: .medium))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
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
    private func startConversation() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let id = try await store.service.startConversation(profileID: profile.id)
            activeConversation = .direct(
                id: id,
                title: profile.displayName,
                profileID: profile.id,
                photoURL: primaryMedia?.previewUrl
            )
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func setReaction(_ value: String?) async {
        guard let mediaID = primaryMedia?.id else { return }
        do {
            _ = try await store.service.reactToPhoto(mediaID: mediaID, reaction: value)
            reaction = value
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct ProfileAlbumAccessSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore
    let targetProfile: MemberProfile

    @State private var albums: [ProfileAlbum] = []
    @State private var selected = Set<UUID>()
    @State private var duration = "4"
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VelvetPageHeader(
                            "Accès privé",
                            title: "Partager avec \(targetProfile.displayName)",
                            subtitle: "Choisis précisément les albums et la durée d’accès."
                        )

                        Picker("Durée", selection: $duration) {
                            Text("1 h").tag("1")
                            Text("4 h").tag("4")
                            Text("12 h").tag("12")
                            Text("24 h").tag("24")
                            Text("Permanent").tag("permanent")
                        }
                        .pickerStyle(.segmented)

                        ForEach(albums) { album in
                            Button {
                                if selected.contains(album.id) {
                                    selected.remove(album.id)
                                } else {
                                    selected.insert(album.id)
                                }
                            } label: {
                                HStack(spacing: 13) {
                                    Image(systemName: "lock.square")
                                        .foregroundStyle(VelvetColor.champagneGold)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(album.name)
                                            .font(VelvetTypography.body(size: 14, weight: .semibold))
                                            .foregroundStyle(VelvetColor.ivory)
                                        Text("\((album.mediaAssets ?? []).count) média(s)")
                                            .font(VelvetTypography.caption(size: 10))
                                            .foregroundStyle(VelvetColor.textSecondary)
                                    }
                                    Spacer()
                                    Image(systemName: selected.contains(album.id) ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(VelvetColor.champagneGold)
                                }
                                .padding(15)
                                .background(VelvetColor.panelRaised.opacity(0.78))
                                .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))
                            }
                            .buttonStyle(.plain)
                        }

                        if albums.isEmpty {
                            VelvetEmptyState(
                                symbol: "lock.rectangle.stack",
                                title: "Aucun album privé",
                                message: "Crée d’abord un album privé depuis ta fiche."
                            )
                        }

                        VelvetPrimaryButton(
                            "Autoriser l’accès",
                            isLoading: isWorking,
                            isDisabled: selected.isEmpty
                        ) {
                            Task { await grant() }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Albums privés")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .task {
                albums = ((try? await store.service.profile())?.profile?.albums ?? [])
                    .filter { $0.confidentiality != "public" }
            }
        }
    }

    @MainActor
    private func grant() async {
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await store.service.grantAlbumAccess(
                albumIDs: Array(selected),
                profileID: targetProfile.id,
                duration: duration
            )
            dismiss()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}
