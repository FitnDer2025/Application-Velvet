import SwiftUI

struct IntelligentHomeView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var intelligence: HomeIntelligenceResponse?
    @State private var intelligenceIssue: String?
    @State private var isLoading = false
    @State private var query = ""
    @State private var audience = "all"
    @State private var affinity = "all"
    @State private var ageRange = "18-99"
    @State private var localSort = "distance"
    @State private var showsExperienceSettings = false

    private var directoryProfiles: [MemberProfile] {
        (store.directory?.profiles ?? []).filter { $0.id != profile.id }
    }

    private var recentViews: [(history: ProfileViewHistory, profile: MemberProfile)] {
        store.viewedProfiles.compactMap { item in
            guard let member = item.profile else { return nil }
            return (item.history, member)
        }
    }

    private var filteredProfiles: [IntelligentProfile] {
        let ages = ageRange.split(separator: "-").compactMap { Int($0) }
        let minimumAge = ages.first ?? 18
        let maximumAge = ages.last ?? 99
        let rows = (intelligence?.allProfiles ?? []).filter { candidate in
            let matchesQuery = query.isEmpty
                || candidate.displayName.localizedCaseInsensitiveContains(query)
                || (candidate.locationZone ?? "").localizedCaseInsensitiveContains(query)
            let matchesAudience = audience == "all" || candidate.audience == audience
            let candidateAge = firstAge(candidate.ageLabel)
            let matchesAge = candidateAge.map { $0 >= minimumAge && $0 <= maximumAge } ?? true
            let matchesAffinity: Bool
            switch affinity {
            case "ice": matchesAffinity = candidate.reaction < 0
            case "liked": matchesAffinity = candidate.reaction > 0
            case "new": matchesAffinity = candidate.reaction == 0
            default: matchesAffinity = true
            }
            return matchesQuery && matchesAudience && matchesAge && matchesAffinity
        }
        return rows.sorted(by: profileOrder)
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header

                    if let issue = intelligenceIssue ?? store.loadIssue {
                        synchronizationNotice(issue)
                    }

                    recentlyViewedSection

                    if let intelligence {
                        curatedSection(intelligence)
                        nearbySection(intelligence)
                        followedSection(intelligence)
                        allProfilesSection
                    } else {
                        fallbackExperience
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 34)
            }
            .refreshable {
                await store.load()
                await store.refreshSocialState()
                await load(force: true)
            }

            if isLoading && intelligence == nil && directoryProfiles.isEmpty {
                ProgressView("Velvet prépare votre espace…")
                    .tint(VelvetColor.champagneGold)
                    .foregroundStyle(VelvetColor.textSecondary)
                    .padding(24)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showsExperienceSettings, onDismiss: { Task { await load(force: true) } }) {
            ExperienceSettingsView()
        }
        .task {
            await store.refreshSocialState()
            await load()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(alignment: .top) {
                VelvetPageHeader(
                    "Votre sélection intelligente",
                    title: "Bonjour \(profile.displayName)",
                    subtitle: "Proximité, compatibilité, profils suivis et lieux fréquentés, sans exposer votre position exacte."
                )
                Spacer(minLength: 8)
                Button { showsExperienceSettings = true } label: {
                    Image(systemName: "slider.horizontal.3")
                        .foregroundStyle(VelvetColor.champagneGold)
                        .frame(width: 42, height: 42)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(VelvetColor.borderSubtle, lineWidth: 0.8))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Réglages de proximité")
            }
            if let preferences = intelligence?.preferences {
                Label(
                    preferences.locationEnabled
                        ? "Rayon actuel : \(preferences.radiusKm) km"
                        : "Velvet fonctionne sans localisation · tri de secours actif",
                    systemImage: preferences.locationEnabled ? "location.fill" : "location.slash"
                )
                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
            }
        }
    }

    private func synchronizationNotice(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 13) {
            Image(systemName: "sparkles.rectangle.stack")
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 42, height: 42)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 5) {
                Text("Votre espace reste disponible")
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text("Une partie des recommandations se resynchronise. Vous pouvez continuer à consulter les profils, la carte, les sorties et votre historique.")
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Réessayer maintenant") {
                    Task {
                        await store.load()
                        await load(force: true)
                    }
                }
                .font(VelvetTypography.body(size: 11, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
                .accessibilityHint(message)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            LinearGradient(
                colors: [VelvetColor.velvetBurgundy.opacity(0.28), VelvetColor.panelRaised.opacity(0.58)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(VelvetColor.champagneGold.opacity(0.18)))
    }

    private var recentlyViewedSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Profils consultés", detail: recentViews.isEmpty ? "Historique" : "\(recentViews.count) récent\(recentViews.count > 1 ? "s" : "")")

            if recentViews.isEmpty {
                NavigationLink {
                    PremiumDiscoveryGridView(currentProfile: profile)
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "clock.arrow.circlepath")
                            .foregroundStyle(VelvetColor.champagneGold)
                            .frame(width: 46, height: 46)
                            .background(VelvetColor.champagneGold.opacity(0.08))
                            .clipShape(Circle())
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Votre historique apparaîtra ici")
                                .font(VelvetTypography.body(size: 14, weight: .semibold))
                                .foregroundStyle(VelvetColor.ivory)
                            Text("Ouvrez un profil depuis Recherche : vous pourrez ensuite le retrouver immédiatement sur l’accueil.")
                                .font(VelvetTypography.body(size: 11))
                                .foregroundStyle(VelvetColor.textSecondary)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                    .padding(16)
                    .background(VelvetColor.ivory.opacity(0.035))
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(VelvetColor.borderSubtle))
                }
                .buttonStyle(.plain)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(Array(recentViews.prefix(10)), id: \.history.id) { item in
                            NavigationLink {
                                MemberDetailView(profile: item.profile)
                            } label: {
                                RecentlyViewedProfileCard(
                                    profile: item.profile,
                                    history: item.history
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private var fallbackExperience: some View {
        VStack(alignment: .leading, spacing: 26) {
            VStack(alignment: .leading, spacing: 16) {
                sectionHeader("Continuer sur Velvet", detail: "Accès direct")
                HStack(spacing: 10) {
                    NavigationLink {
                        PremiumDiscoveryGridView(currentProfile: profile)
                    } label: {
                        FallbackShortcutCard(title: "Recherche", detail: "Tous les profils", icon: "magnifyingglass")
                    }
                    NavigationLink {
                        MemberMapView()
                    } label: {
                        FallbackShortcutCard(title: "Maps", detail: "Autour de vous", icon: "map.fill")
                    }
                    NavigationLink {
                        IntelligentPlacesEventsView(initialSelection: 0)
                    } label: {
                        FallbackShortcutCard(title: "Sorties", detail: "Agenda & Cap", icon: "calendar")
                    }
                }
                .buttonStyle(.plain)
            }

            if !directoryProfiles.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    sectionHeader("À découvrir", detail: "Profils disponibles")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 14) {
                            ForEach(directoryProfiles.prefix(8)) { member in
                                NavigationLink {
                                    MemberDetailView(profile: member)
                                } label: {
                                    PremiumHomeProfileCard(profile: member)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 14) {
                sectionHeader("À portée de main", detail: "Toujours accessible")
                NavigationLink {
                    IntelligentPlacesEventsView(initialSelection: 0)
                } label: {
                    IntelligentShortcutRow(
                        title: "Sorties & clubs",
                        detail: "Consultez l’agenda complet même pendant la mise à jour des recommandations.",
                        icon: "sparkles"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink {
                    PremiumDiscoveryGridView(currentProfile: profile)
                } label: {
                    IntelligentShortcutRow(
                        title: "Recherche avancée",
                        detail: "Types de profils, âge, pratiques, préférences et localisation.",
                        icon: "slider.horizontal.3"
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func curatedSection(_ data: HomeIntelligenceResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Pour vous", detail: "Velvet Intelligence")
            if data.curatedProfiles.isEmpty && data.nearbyClubs.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Votre sélection se construit")
                        .font(VelvetTypography.title(size: 24))
                        .foregroundStyle(VelvetColor.ivory)
                    Text("En attendant de nouvelles recommandations, votre historique et l’annuaire complet restent disponibles juste au-dessus et plus bas sur cette page.")
                        .font(VelvetTypography.body(size: 12))
                        .foregroundStyle(VelvetColor.textSecondary)
                    NavigationLink("Explorer tous les profils") {
                        PremiumDiscoveryGridView(currentProfile: profile)
                    }
                    .font(VelvetTypography.body(size: 12, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(VelvetColor.ivory.opacity(0.03))
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 22).stroke(VelvetColor.borderSubtle))
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(data.curatedProfiles.prefix(8)) { candidate in
                            profileLink(candidate, compact: false)
                        }
                        ForEach(data.nearbyClubs.prefix(5)) { club in
                            clubLink(club)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private func nearbySection(_ data: HomeIntelligenceResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("À portée de main", detail: "\(data.preferences.radiusKm) km")
            NavigationLink {
                IntelligentPlacesEventsView(initialSelection: 0)
            } label: {
                IntelligentShortcutRow(
                    title: "Sorties à venir",
                    detail: data.nearbyEvents.isEmpty
                        ? "Consulter tout l’agenda Velvet"
                        : "\(data.nearbyEvents.count) agenda\(data.nearbyEvents.count > 1 ? "s" : "") proche\(data.nearbyEvents.count > 1 ? "s" : "") ou fréquenté\(data.nearbyEvents.count > 1 ? "s" : "")",
                    icon: "calendar.badge.clock"
                )
            }
            .buttonStyle(.plain)

            if !data.nearbyEvents.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(data.nearbyEvents.prefix(6)) { event in
                            NavigationLink {
                                IntelligentEventDetailView(event: event)
                            } label: {
                                IntelligentEventCard(event: event)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            NavigationLink {
                IntelligentPlacesEventsView(initialSelection: 1)
            } label: {
                IntelligentShortcutRow(
                    title: "Clubs",
                    detail: data.nearbyClubs.isEmpty
                        ? "Explorer les clubs vérifiés"
                        : "\(data.nearbyClubs.count) club\(data.nearbyClubs.count > 1 ? "s" : "") proche\(data.nearbyClubs.count > 1 ? "s" : "") ou fréquenté\(data.nearbyClubs.count > 1 ? "s" : "")",
                    icon: "building.2.crop.circle"
                )
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func followedSection(_ data: HomeIntelligenceResponse) -> some View {
        if !data.followedActivities.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                sectionHeader("Profils suivis", detail: "Nouveautés")
                ForEach(data.followedActivities.prefix(8)) { activity in
                    followedActivityLink(activity, data: data)
                }
            }
        }
    }

    private var allProfilesSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Tous les profils", detail: "Classés par proximité")
            VelvetSearchField(prompt: "Nom, ville ou zone…", text: $query)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    filterChip("Tous", value: "all", selection: $audience)
                    filterChip("Couples", value: "couple", selection: $audience)
                    filterChip("Femmes", value: "woman", selection: $audience)
                    filterChip("Hommes", value: "man", selection: $audience)
                    filterChip("Trans & NB", value: "trans_nonbinary", selection: $audience)
                }
            }

            HStack(spacing: 9) {
                filterMenu("Âge", selection: $ageRange, choices: [
                    ("18-99", "Tous"), ("18-29", "18–29"), ("30-39", "30–39"),
                    ("40-49", "40–49"), ("50-59", "50–59"), ("60-99", "60+")
                ])
                filterMenu("Ressenti", selection: $affinity, choices: [
                    ("all", "Tous"), ("ice", "❄️"), ("liked", "🔥"), ("new", "Sans avis")
                ])
                filterMenu("Classer", selection: $localSort, choices: [
                    ("distance", "Proximité"), ("compatibility", "Compatibilité"),
                    ("recent", "Récents"), ("affinity", "Glaçon & flammes")
                ])
            }

            HStack {
                Text("\(filteredProfiles.count) profil\(filteredProfiles.count > 1 ? "s" : "")")
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.textSecondary)
                Spacer()
                NavigationLink("Filtres avancés") {
                    PremiumDiscoveryGridView(currentProfile: profile)
                }
                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
            }

            if filteredProfiles.isEmpty {
                NavigationLink {
                    PremiumDiscoveryGridView(currentProfile: profile)
                } label: {
                    IntelligentShortcutRow(
                        title: "Aucun profil pour ces critères",
                        detail: "Ouvrir Recherche pour élargir l’âge, le rayon ou le type de profil.",
                        icon: "person.2"
                    )
                }
                .buttonStyle(.plain)
            } else {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
                    spacing: 12
                ) {
                    ForEach(filteredProfiles) { candidate in
                        profileLink(candidate, compact: true)
                    }
                }
            }
        }
    }

    private func sectionHeader(_ title: String, detail: String) -> some View {
        HStack(alignment: .lastTextBaseline) {
            Text(title)
                .font(VelvetTypography.title(size: 27))
                .foregroundStyle(VelvetColor.ivory)
            Spacer()
            Text(detail.uppercased())
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1.1)
                .foregroundStyle(VelvetColor.champagneGold)
        }
    }

    @ViewBuilder
    private func profileLink(_ candidate: IntelligentProfile, compact: Bool) -> some View {
        if let member = store.directory?.profiles.first(where: { $0.id == candidate.id }) {
            NavigationLink {
                MemberDetailView(profile: member)
            } label: {
                IntelligentProfileCard(profile: candidate, compact: compact)
            }
            .buttonStyle(.plain)
        } else {
            IntelligentProfileCard(profile: candidate, compact: compact)
                .opacity(0.72)
        }
    }

    @ViewBuilder
    private func clubLink(_ club: IntelligentClub) -> some View {
        if let venue = store.directory?.venueDirectory.first(where: { $0.id == club.id }) {
            NavigationLink {
                VenueDetailView(venue: venue)
            } label: {
                IntelligentClubCard(club: club)
            }
            .buttonStyle(.plain)
        } else {
            IntelligentClubCard(club: club)
        }
    }

    @ViewBuilder
    private func followedActivityLink(_ activity: FollowedActivity, data: HomeIntelligenceResponse) -> some View {
        if let eventID = activity.eventId,
           let event = data.nearbyEvents.first(where: { $0.id == eventID }) {
            NavigationLink {
                IntelligentEventDetailView(event: event)
            } label: {
                FollowedActivityRow(activity: activity)
            }
            .buttonStyle(.plain)
        } else if let profileID = activity.profileId,
                  let member = store.directory?.profiles.first(where: { $0.id == profileID }) {
            NavigationLink {
                MemberDetailView(profile: member)
            } label: {
                FollowedActivityRow(activity: activity)
            }
            .buttonStyle(.plain)
        } else {
            FollowedActivityRow(activity: activity).opacity(0.72)
        }
    }

    private func filterChip(_ title: String, value: String, selection: Binding<String>) -> some View {
        VelvetChip(title: title, selected: selection.wrappedValue == value) {
            selection.wrappedValue = value
        }
    }

    private func filterMenu(
        _ title: String,
        selection: Binding<String>,
        choices: [(String, String)]
    ) -> some View {
        Menu {
            ForEach(choices, id: \.0) { value, label in
                Button(label) { selection.wrappedValue = value }
            }
        } label: {
            Label(title, systemImage: "chevron.down")
                .font(VelvetTypography.body(size: 10, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
                .padding(.horizontal, 10)
                .frame(height: 38)
                .background(VelvetColor.ivory.opacity(0.045))
                .clipShape(Capsule())
                .overlay(Capsule().stroke(VelvetColor.borderSubtle, lineWidth: 0.8))
        }
    }

    private func firstAge(_ label: String?) -> Int? {
        label?.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }.first
    }

    private func profileOrder(_ left: IntelligentProfile, _ right: IntelligentProfile) -> Bool {
        switch localSort {
        case "compatibility": return left.compatibilityScore > right.compatibilityScore
        case "recent": return experienceDate(left.createdAt) > experienceDate(right.createdAt)
        case "affinity":
            return left.reaction > right.reaction
                || (left.reaction == right.reaction && left.compatibilityScore > right.compatibilityScore)
        default:
            return (left.distanceKm ?? .greatestFiniteMagnitude)
                < (right.distanceKm ?? .greatestFiniteMagnitude)
        }
    }

    private func experienceDate(_ value: String?) -> Date {
        guard let value else { return .distantPast }
        if let date = ISO8601DateFormatter().date(from: value) { return date }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX"
        return formatter.date(from: value) ?? .distantPast
    }

    @MainActor
    private func load(force: Bool = false) async {
        guard !isLoading else { return }
        if intelligence != nil && !force { return }
        isLoading = true
        intelligenceIssue = nil
        defer { isLoading = false }
        do {
            intelligence = try await store.service.homeIntelligence()
            localSort = intelligence?.preferences.profileSort ?? "distance"
        } catch {
            intelligenceIssue = ErrorMessage.text(for: error)
        }
    }
}

private struct RecentlyViewedProfileCard: View {
    let profile: MemberProfile
    let history: ProfileViewHistory

    private var photo: URL? {
        profile.profileGalleryPhotos.first(where: { $0.isPrimary == true })?.previewUrl
            ?? profile.profileGalleryPhotos.first?.previewUrl
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            VelvetRemoteImage(
                url: photo,
                symbol: profile.profileType == .couple ? "person.2.fill" : "person.fill"
            )
            .frame(width: 176, height: 235)
            .clipped()

            LinearGradient(
                colors: [.clear, .black.opacity(0.18), .black.opacity(0.94)],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 5) {
                Text("CONSULTÉ \(max(1, history.viewCount ?? 1)) FOIS")
                    .font(VelvetTypography.caption(size: 8, weight: .bold))
                    .tracking(1.1)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(profile.displayName)
                    .font(VelvetTypography.title(size: 21))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                Text(lastViewedLabel)
                    .font(VelvetTypography.caption(size: 9))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            .padding(14)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(.white.opacity(0.10)))
        .shadow(color: .black.opacity(0.25), radius: 18, y: 10)
    }

    private var lastViewedLabel: String {
        guard let raw = history.lastViewedAt else { return "Consulté récemment" }
        let date = ISO8601DateFormatter().date(from: raw)
            ?? ISO8601DateFormatter.velvetFractional.date(from: raw)
        guard let date else { return "Consulté récemment" }
        return date.formatted(.relative(presentation: .named))
    }
}

private struct FallbackShortcutCard: View {
    let title: String
    let detail: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 42, height: 42)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(Circle())
            Text(title)
                .font(VelvetTypography.body(size: 13, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
            Text(detail)
                .font(VelvetTypography.caption(size: 9))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineLimit(2)
        }
        .padding(13)
        .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
        .background(VelvetColor.ivory.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(VelvetColor.borderSubtle))
    }
}

private struct IntelligentProfileCard: View {
    let profile: IntelligentProfile
    let compact: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                VelvetRemoteImage(url: profile.photoUrl, symbol: "person.crop.rectangle")
                    .frame(maxWidth: compact ? .infinity : 190)
                    .frame(height: compact ? 205 : 250)
                    .clipped()
                HStack(spacing: 5) {
                    if let affinity = profile.affinitySymbol { Text(affinity) }
                    Text("\(profile.compatibilityScore)%")
                        .foregroundStyle(VelvetColor.champagneGold)
                }
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .padding(.horizontal, 8)
                .frame(height: 28)
                .background(.ultraThinMaterial)
                .background(.black.opacity(0.28))
                .clipShape(Capsule())
                .padding(8)
            }
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(VelvetColor.borderSubtle, lineWidth: 0.8))

            Text(profile.displayName)
                .font(VelvetTypography.body(size: compact ? 13 : 15, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
                .lineLimit(1)
            Text([profile.demographicLabel, profile.ageLabel].compactMap { $0 }.joined(separator: " · "))
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
                .lineLimit(1)
            Text(distanceLabel)
                .font(VelvetTypography.caption(size: 9))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineLimit(1)
        }
        .frame(maxWidth: compact ? .infinity : 190, alignment: .leading)
    }

    private var distanceLabel: String {
        if let distance = profile.distanceKm {
            return "\(distance.formatted(.number.precision(.fractionLength(0...1)))) km · \(profile.locationZone ?? "Zone privée")"
        }
        return profile.locationZone ?? "Distance non disponible"
    }
}

private struct IntelligentClubCard: View {
    let club: IntelligentClub

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "building.2.fill")
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 54, height: 54)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(Circle())
            Text(club.name)
                .font(VelvetTypography.title(size: 22))
                .foregroundStyle(VelvetColor.ivory)
                .lineLimit(2)
            Text([club.categoryPrimary ?? club.kind, club.city].compactMap { $0 }.joined(separator: " · "))
                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
                .lineLimit(2)
            Text(club.frequented ? "Club que vous fréquentez" : distanceText)
                .font(VelvetTypography.body(size: 11))
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .padding(17)
        .frame(width: 210, height: 250, alignment: .topLeading)
        .background(.ultraThinMaterial)
        .background(VelvetColor.panelRaised.opacity(0.64))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(VelvetColor.borderSubtle, lineWidth: 0.8))
    }

    private var distanceText: String {
        club.distanceKm.map { "À \($0.formatted(.number.precision(.fractionLength(0...1)))) km" }
            ?? "Distance à confirmer"
    }
}

private struct IntelligentEventCard: View {
    let event: IntelligentEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(
                event.isCapDAgde ? "CAP D’AGDE" : "SORTIE",
                systemImage: event.isCapDAgde ? "sun.max.fill" : "calendar"
            )
            .font(VelvetTypography.caption(size: 9, weight: .bold))
            .foregroundStyle(VelvetColor.champagneGold)
            Text(event.title)
                .font(VelvetTypography.title(size: 22))
                .foregroundStyle(VelvetColor.ivory)
                .lineLimit(3)
            Text(event.startsAt.velvetDateLabel)
                .font(VelvetTypography.body(size: 12, weight: .semibold))
                .foregroundStyle(VelvetColor.softBlush)
            Text(event.distanceKm.map { "\($0.formatted(.number.precision(.fractionLength(0...1)))) km" }
                 ?? event.locationPublic ?? "Lieu privé")
                .font(VelvetTypography.caption(size: 10))
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .padding(16)
        .frame(width: 210, height: 190, alignment: .topLeading)
        .background(VelvetColor.panelRaised.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(VelvetColor.borderSubtle, lineWidth: 0.8))
    }
}

private struct IntelligentShortcutRow: View {
    let title: String
    let detail: String
    let icon: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 46, height: 46)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text(detail)
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .multilineTextAlignment(.leading)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.champagneGold)
        }
        .padding(15)
        .background(VelvetColor.ivory.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(VelvetColor.borderSubtle, lineWidth: 0.8))
    }
}

private struct FollowedActivityRow: View {
    let activity: FollowedActivity

    var body: some View {
        HStack(spacing: 13) {
            VelvetRemoteImage(
                url: activity.previewUrl,
                symbol: activity.type == "event" ? "calendar" : "person.fill"
            )
            .frame(width: 52, height: 52)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(activity.title)
                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .multilineTextAlignment(.leading)
                if let detail = activity.detail, !detail.isEmpty {
                    Text(detail)
                        .font(VelvetTypography.caption(size: 10))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .lineLimit(2)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.champagneGold)
        }
        .padding(12)
        .background(VelvetColor.ivory.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
    }
}

private extension ISO8601DateFormatter {
    static let velvetFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
