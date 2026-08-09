import SwiftUI

struct ProfileSummaryView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var selectedSection = "overview"
    @State private var selectedPhoto = 0
    @State private var showsPrivacy = false
    @State private var showsMemberTools = false
    @State private var showsAlbumManager = false

    private var photos: [MediaAsset] {
        profile.approvedPhotos
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
                VStack(alignment: .leading, spacing: 22) {
                    profileHero
                    statusRow
                    sectionNavigation
                    selectedContent
                    accountActions
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 34)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showsPrivacy) {
            PrivacySettingsView()
        }
        .sheet(isPresented: $showsMemberTools) {
            NavigationStack {
                MemberToolsView()
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Fermer") { showsMemberTools = false }
                                .foregroundStyle(VelvetColor.champagneGold)
                        }
                    }
            }
        }
        .sheet(isPresented: $showsAlbumManager) {
            AlbumManagerView()
        }
    }

    private var profileHero: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottomLeading) {
                if photos.isEmpty {
                    heroPlaceholder
                        .frame(width: geometry.size.width, height: 430)
                } else {
                    TabView(selection: $selectedPhoto) {
                        ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
                            AsyncImage(url: photo.previewUrl) { image in
                                image
                                    .resizable()
                                    .scaledToFill()
                            } placeholder: {
                                heroPlaceholder
                            }
                            .frame(width: geometry.size.width, height: 430)
                            .clipped()
                            .tag(index)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .frame(width: geometry.size.width, height: 430)
                }

                LinearGradient(
                    colors: [.clear, VelvetColor.velvetBlack.opacity(0.96)],
                    startPoint: .center,
                    endPoint: .bottom
                )

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(profile.profileType == .couple ? "PROFIL COUPLE" : "PROFIL INDIVIDUEL")
                            .font(VelvetTypography.caption(size: 9, weight: .semibold))
                            .tracking(1.8)
                            .foregroundStyle(VelvetColor.champagneGold)
                        Spacer()
                        if photos.count > 1 {
                            Text("\(selectedPhoto + 1) / \(photos.count)")
                                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                                .foregroundStyle(VelvetColor.ivory)
                                .padding(.horizontal, 10)
                                .frame(height: 28)
                                .background(.black.opacity(0.48))
                                .clipShape(Capsule())
                        }
                    }

                    Text(profile.displayName)
                        .font(VelvetTypography.title(size: 40))
                        .minimumScaleFactor(0.72)
                        .lineLimit(2)
                        .foregroundStyle(VelvetColor.ivory)

                    HStack(spacing: 10) {
                        Label(
                            profile.locationZone ?? profile.city ?? "Zone privée",
                            systemImage: "location"
                        )
                        if let since = profile.relationshipSince, profile.profileType == .couple {
                            Text("· Ensemble depuis \(since)")
                        }
                    }
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
                }
                .padding(22)
            }
            .frame(width: geometry.size.width, height: 430)
            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.editorial, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: VelvetRadius.editorial, style: .continuous)
                    .stroke(VelvetColor.borderSubtle, lineWidth: 1)
            }
        }
        .frame(height: 430)
    }

    private var heroPlaceholder: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: 0x32141F), VelvetColor.anthracite],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [VelvetColor.champagneGold.opacity(0.14), .clear],
                center: .topTrailing,
                startRadius: 10,
                endRadius: 260
            )
            VelvetMark(size: 86)
        }
    }

    private var statusRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 9) {
                statusPill(
                    profile.isAdmitted ? "PROFIL ADMIS" : "ADMISSION EN ATTENTE",
                    icon: profile.isAdmitted ? "checkmark.seal.fill" : "hourglass",
                    color: profile.isAdmitted ? VelvetColor.success : VelvetColor.warning
                )
                if profile.verificationStatus == "verified" {
                    statusPill(
                        "IDENTITÉ VÉRIFIÉE",
                        icon: "checkmark.shield.fill",
                        color: VelvetColor.champagneGold
                    )
                }
                statusPill(
                    "\(photos.count) PHOTO\(photos.count > 1 ? "S" : "")",
                    icon: "photo",
                    color: VelvetColor.softBlush
                )
            }
        }
    }

    private var sectionNavigation: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                navigationChip(
                    profile.profileType == .couple ? "Le couple" : "Présentation",
                    value: "overview"
                )
                ForEach(profile.individualProfiles ?? []) { person in
                    navigationChip(
                        person.firstName ?? "Fiche personnelle",
                        value: "person-\(person.id.uuidString)"
                    )
                }
                navigationChip(
                    "Albums (\((profile.albums ?? []).count + (photos.isEmpty ? 0 : 1)))",
                    value: "albums"
                )
            }
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
        VStack(spacing: 15) {
            ProfileSectionCard(eyebrow: "En quelques mots", title: "Notre univers") {
                profileText(
                    profile.description,
                    fallback: "La présentation de ce profil reste à compléter.",
                    quote: true
                )
                ProfileTagCloud(values: profile.valuesList ?? [], emptyText: "Valeurs à compléter")
            }

            ProfileSectionCard(eyebrow: "Le récit", title: "Notre histoire") {
                profileText(profile.story, fallback: "Cette histoire reste à écrire.")
            }

            ProfileSectionCard(eyebrow: "Le chemin parcouru", title: "Notre parcours") {
                profileText(profile.journey, fallback: "Le parcours n’est pas encore renseigné.")
            }

            ProfileSectionCard(eyebrow: "Les rencontres souhaitées", title: "Ce que nous recherchons") {
                profileText(
                    profile.searchText,
                    fallback: "Les envies de rencontre ne sont pas encore précisées."
                )
            }

            ProfileSectionCard(eyebrow: "Nos envies", title: "Pratiques & expériences") {
                ProfileTagCloud(
                    values: profile.practices ?? [],
                    emptyText: "Pratiques à compléter"
                )
            }

            if !(profile.individualProfiles ?? []).isEmpty {
                ProfileSectionCard(eyebrow: "Les personnes", title: "Derrière ce profil") {
                    VStack(spacing: 10) {
                        ForEach(profile.individualProfiles ?? []) { person in
                            Button {
                                selectedSection = "person-\(person.id.uuidString)"
                            } label: {
                                HStack(spacing: 13) {
                                    Text(person.initials)
                                        .font(VelvetTypography.title(size: 18))
                                        .foregroundStyle(VelvetColor.champagneGold)
                                        .frame(width: 46, height: 46)
                                        .background(VelvetColor.velvetBurgundy.opacity(0.22))
                                        .clipShape(Circle())
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(person.firstName ?? "Fiche personnelle")
                                            .font(VelvetTypography.body(size: 14, weight: .semibold))
                                            .foregroundStyle(VelvetColor.ivory)
                                        Text(person.biography ?? "Découvrir cette personne")
                                            .font(VelvetTypography.body(size: 11))
                                            .foregroundStyle(VelvetColor.textSecondary)
                                            .lineLimit(2)
                                    }
                                    Spacer()
                                    Image(systemName: "arrow.right")
                                        .font(.caption)
                                        .foregroundStyle(VelvetColor.champagneGold)
                                }
                                .padding(12)
                                .background(VelvetColor.ivory.opacity(0.035))
                                .clipShape(
                                    RoundedRectangle(
                                        cornerRadius: VelvetRadius.medium,
                                        style: .continuous
                                    )
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            ProfileSectionCard(eyebrow: "Localisation publique", title: profile.locationZone ?? profile.city ?? "Zone privée") {
                Text("Zwit affiche uniquement la zone choisie et jamais l’adresse exacte.")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            ProfileSectionCard(eyebrow: "Lieux préférés", title: "Nos repères") {
                ProfileTagCloud(
                    values: profile.favoritePlaces ?? [],
                    emptyText: "Aucun lieu renseigné"
                )
            }

            ProfileSectionCard(eyebrow: "Disponibilités", title: "Quand nous rencontrer") {
                profileText(
                    profile.availabilityText,
                    fallback: "Disponibilités non renseignées."
                )
            }

            ProfileSectionCard(eyebrow: "La communauté", title: "Recommandations") {
                if recommendations.isEmpty {
                    Text("Aucune recommandation reçue pour le moment.")
                        .font(VelvetTypography.body(size: 13))
                        .foregroundStyle(VelvetColor.textSecondary)
                } else {
                    VStack(spacing: 10) {
                        ForEach(recommendations) { recommendation in
                            recommendationRow(recommendation)
                        }
                    }
                }
            }
        }
    }

    private func personContent(_ person: IndividualProfile) -> some View {
        VStack(spacing: 15) {
            ProfileSectionCard(eyebrow: "Portrait personnel", title: person.firstName ?? "Fiche personnelle") {
                profileText(
                    person.biography,
                    fallback: "La présentation personnelle reste à compléter.",
                    quote: true
                )
                factsGrid(person)
            }

            ProfileSectionCard(eyebrow: "Orientation et attirances", title: person.orientation ?? "Attirances") {
                ProfileTagCloud(
                    values: person.attractedTo ?? [],
                    emptyText: "Attirances non renseignées"
                )
            }

            ProfileSectionCard(eyebrow: "Envies personnelles", title: "Ce que \(person.firstName ?? "cette personne") souhaite vivre") {
                ProfileTagCloud(
                    values: person.desiredPractices ?? [],
                    emptyText: "Envies non renseignées"
                )
            }

            if profile.profileType == .couple {
                ProfileSectionCard(eyebrow: "Accords du couple", title: "Permissions du ou de la partenaire") {
                    ProfileTagCloud(
                        values: person.partnerPermissions ?? [],
                        emptyText: "Accords non renseignés"
                    )
                }
            }

            let personalPhotos = photos.filter { $0.individualProfileId == person.id }
            ProfileSectionCard(eyebrow: "Photos individuelles", title: "Galerie de \(person.firstName ?? "ce membre")") {
                if personalPhotos.isEmpty {
                    Text("Aucune photo individuelle publiée.")
                        .font(VelvetTypography.body(size: 13))
                        .foregroundStyle(VelvetColor.textSecondary)
                } else {
                    ProfilePhotoGrid(urls: personalPhotos.compactMap(\.previewUrl))
                }
            }
        }
    }

    private var albumsContent: some View {
        VStack(spacing: 15) {
            ProfileSectionCard(eyebrow: "Bibliothèque organisée", title: "Albums publics & privés") {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Les albums privés restent invisibles sans autorisation explicite.")
                        .font(VelvetTypography.body(size: 12))
                        .foregroundStyle(VelvetColor.textSecondary)
                    Button {
                        showsAlbumManager = true
                    } label: {
                        Label("Gérer mes albums", systemImage: "photo.stack")
                            .font(VelvetTypography.body(size: 13, weight: .semibold))
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                    .buttonStyle(.plain)
                }
            }

            if !photos.isEmpty {
                AlbumCard(
                    title: "Photos de profil",
                    subtitle: "Album système public",
                    confidentiality: "PUBLIC",
                    urls: photos.compactMap(\.previewUrl)
                )
            }

            ForEach(profile.albums ?? []) { album in
                AlbumCard(
                    title: album.name,
                    subtitle: album.confidentiality == "public" ? "Album public" : "Album privé",
                    confidentiality: album.confidentiality == "public" ? "PUBLIC" : "PRIVÉ",
                    urls: (album.mediaAssets ?? []).compactMap(\.previewUrl)
                )
            }

            if photos.isEmpty, (profile.albums ?? []).isEmpty {
                VelvetEmptyState(
                    symbol: "photo.on.rectangle.angled",
                    title: "Aucun album publié",
                    message: "Les photos et albums de ton profil apparaîtront ici."
                )
            }
        }
    }

    private var accountActions: some View {
        VStack(spacing: 12) {
            Button {
                showsMemberTools = true
            } label: {
                actionRow(
                    "Studio du profil",
                    detail: "Rédaction, organisateur et gestion du cycle",
                    icon: "wand.and.stars",
                    color: VelvetColor.softBlush
                )
            }
            .buttonStyle(.plain)

            Button {
                showsPrivacy = true
            } label: {
                actionRow(
                    "Paramètres & confidentialité",
                    detail: "Visibilité, notifications et compte",
                    icon: "slider.horizontal.3",
                    color: VelvetColor.champagneGold
                )
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
    }

    private func navigationChip(_ title: String, value: String) -> some View {
        VelvetChip(title: title, selected: selectedSection == value) {
            withAnimation(.easeOut(duration: VelvetMotion.fast)) {
                selectedSection = value
            }
        }
    }

    private func statusPill(_ title: String, icon: String, color: Color) -> some View {
        Label(title, systemImage: icon)
            .font(VelvetTypography.caption(size: 9, weight: .semibold))
            .tracking(0.8)
            .foregroundStyle(color)
            .padding(.horizontal, 12)
            .frame(height: 32)
            .background(color.opacity(0.09))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(color.opacity(0.22), lineWidth: 1))
    }

    private func profileText(
        _ value: String?,
        fallback: String,
        quote: Bool = false
    ) -> some View {
        Text(value?.isEmpty == false ? value! : fallback)
            .font(quote ? VelvetTypography.brand(size: 19) : VelvetTypography.body(size: 14))
            .foregroundStyle(quote ? VelvetColor.ivory : VelvetColor.textSecondary)
            .lineSpacing(5)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func factsGrid(_ person: IndividualProfile) -> some View {
        let facts = person.facts
        return LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 128), spacing: 9)],
            spacing: 9
        ) {
            ForEach(facts, id: \.0) { label, value in
                VStack(alignment: .leading, spacing: 4) {
                    Text(label.uppercased())
                        .font(VelvetTypography.caption(size: 8, weight: .semibold))
                        .tracking(0.9)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text(value)
                        .font(VelvetTypography.body(size: 13, weight: .medium))
                        .foregroundStyle(VelvetColor.ivory)
                }
                .frame(maxWidth: .infinity, minHeight: 62, alignment: .leading)
                .padding(12)
                .background(VelvetColor.ivory.opacity(0.035))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    private func recommendationRow(_ recommendation: Recommendation) -> some View {
        let author = store.directory?.profiles.first(where: {
            $0.id == recommendation.authorProfileId
        })?.displayName ?? "Membre Zwit"

        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(author)
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

    private func actionRow(
        _ title: String,
        detail: String,
        icon: String,
        color: Color
    ) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 40, height: 40)
                .background(color.opacity(0.08))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text(detail)
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
}

private struct ProfileSectionCard<Content: View>: View {
    let eyebrow: String
    let title: String
    private let content: Content

    init(
        eyebrow: String,
        title: String,
        @ViewBuilder content: () -> Content
    ) {
        self.eyebrow = eyebrow
        self.title = title
        self.content = content()
    }

    var body: some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: 13) {
                Text(eyebrow.uppercased())
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1.6)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(title)
                    .font(VelvetTypography.title(size: 24))
                    .foregroundStyle(VelvetColor.ivory)
                content
            }
        }
    }
}

private struct ProfileTagCloud: View {
    let values: [String]
    let emptyText: String

    var body: some View {
        if values.isEmpty {
            Text(emptyText)
                .font(VelvetTypography.body(size: 12))
                .foregroundStyle(VelvetColor.textSecondary)
        } else {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 106), spacing: 8)],
                alignment: .leading,
                spacing: 8
            ) {
                ForEach(values, id: \.self) { value in
                    Text(value)
                        .font(VelvetTypography.caption(size: 11, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                        .padding(.horizontal, 12)
                        .frame(minHeight: 34)
                        .frame(maxWidth: .infinity)
                        .background(VelvetColor.champagneGold.opacity(0.08))
                        .clipShape(Capsule())
                        .overlay {
                            Capsule()
                                .stroke(VelvetColor.champagneGold.opacity(0.20), lineWidth: 1)
                        }
                }
            }
        }
    }
}

private struct ProfilePhotoGrid: View {
    let urls: [URL]

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 9) {
            ForEach(Array(urls.enumerated()), id: \.offset) { _, url in
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    ZStack {
                        VelvetColor.panelRaised
                        ProgressView().tint(VelvetColor.champagneGold)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 180)
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }
}

private struct AlbumCard: View {
    let title: String
    let subtitle: String
    let confidentiality: String
    let urls: [URL]

    var body: some View {
        ProfileSectionCard(eyebrow: subtitle, title: title) {
            HStack {
                Text("\(urls.count) PHOTO\(urls.count > 1 ? "S" : "")")
                Spacer()
                Text(confidentiality)
            }
            .font(VelvetTypography.caption(size: 9, weight: .semibold))
            .tracking(1)
            .foregroundStyle(VelvetColor.champagneGold)

            if urls.isEmpty {
                Text("Aucun média visible dans cet album.")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
            } else {
                ProfilePhotoGrid(urls: urls)
            }
        }
    }
}

private extension IndividualProfile {
    var initials: String {
        guard let first = firstName?.first else { return "V" }
        return String(first).uppercased()
    }

    var facts: [(String, String)] {
        let currentYear = Calendar.current.component(.year, from: Date())
        var values: [(String, String?)] = [
            ("Identité", genderIdentity),
            ("Âge", birthYear.map { "\(currentYear - $0) ans" }),
            ("Taille", heightCm.map { "\($0) cm" }),
            ("Morphologie", morphology ?? bodyType),
            ("Cheveux", hairColor),
            ("Yeux", eyeColor),
            ("Orientation", orientation),
            ("Rythme", frequency)
        ]
        if professionPrivate != true {
            values.append(("Profession", profession))
        }
        return values.compactMap { label, value in
            guard let value, !value.isEmpty, value != "Information privée" else { return nil }
            return (label, value)
        }
    }
}
