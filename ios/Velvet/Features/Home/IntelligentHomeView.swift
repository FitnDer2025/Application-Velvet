import SwiftUI

struct IntelligentHomeView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var intelligence: HomeIntelligenceResponse?
    @State private var isLoading = false
    @State private var query = ""
    @State private var audience = "all"
    @State private var affinity = "all"
    @State private var minimumAge = 18
    @State private var maximumAge = 99
    @State private var localSort = "distance"
    @State private var showsExperienceSettings = false

    private var allProfiles: [IntelligentProfile] {
        let source = intelligence?.allProfiles ?? []
        let filtered = source.filter { candidate in
            let matchesQuery = query.isEmpty
                || candidate.displayName.localizedCaseInsensitiveContains(query)
                || (candidate.locationZone ?? "").localizedCaseInsensitiveContains(query)
            let matchesAudience = audience == "all" || candidate.audience == audience
            let age = firstAge(candidate.ageLabel)
            let matchesAge = age.map { $0 >= minimumAge && $0 <= maximumAge } ?? true
            let matchesAffinity: Bool
            switch affinity {
            case "ice": matchesAffinity = candidate.reaction < 0
            case "liked": matchesAffinity = candidate.reaction > 0
            case "new": matchesAffinity = candidate.reaction == 0
            default: matchesAffinity = true
            }
            return matchesQuery && matchesAudience && matchesAge && matchesAffinity
        }
        return filtered.sorted { left, right in
            switch localSort {
            case "compatibility": left.compatibilityScore > right.compatibilityScore
            case "recent": RealtimeMessageDate.date(left.createdAt) > RealtimeMessageDate.date(right.createdAt)
            case "affinity": left.reaction > right.reaction || (
                left.reaction == right.reaction && left.compatibilityScore > right.compatibilityScore
            )
            default:
                (left.distanceKm ?? .greatestFiniteMagnitude) < (right.distanceKm ?? .greatestFiniteMagnitude)
            }
        }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    if let intelligence {
                        intelligentSelection(intelligence)
                        nearbySection(intelligence)
                        followedSection(intelligence)
                        allProfilesSection
                    } else if isLoading {
                        ProgressView("Velvet affine votre sélection…")
                            .tint(VelvetColor.champagneGold)
                            .foregroundStyle(VelvetColor.textSecondary)
                            .frame(maxWidth: .infinity, minHeight: 240)
                    } else {
                        VelvetCompactEmptyState(
                            symbol: "sparkles",
                            title: "Velvet Intelligence se prépare",
                            message: "Active la localisation approximative pour classer profils, clubs et sorties par proximité."
                        )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 34)
            }
            .refreshable { await load() }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showsExperienceSettings, onDismiss: { Task { await load() } }) {
            ExperienceSettingsView()
        }
        .task { await load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(alignment: .top) {
                VelvetPageHeader(
                    "Votre sélection intelligente",
                    title: "Bonjour \(profile.displayName)",
                    subtitle: "Proximité, compatibilité, profils suivis et lieux que vous fréquentez — sans exposer votre position exacte."
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
                        : "Localisation désactivée · classement de secours",
                    systemImage: preferences.locationEnabled ? "location.fill" : "location.slash"
                )
                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
            }
        }
    }

    private func intelligentSelection(_ data: HomeIntelligenceResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader("Pour toi", detail: "Velvet Intelligence")
            if data.curatedProfiles.isEmpty && data.nearbyClubs.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "wand.and.stars",
                    title: "La sélection s’affine",
                    message: "Les profils compatibles, recommandations et clubs proches apparaîtront ici."
                )
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(data.curatedProfiles.prefix(8)) { candidate in
                            profileDestination(candidate) {
                                IntelligentProfileCard(profile: candidate, compact: false)
                            }
                        }
                        ForEach(data.nearbyClubs.prefix(5)) { club in
                            clubDestination(club) {
                                IntelligentClubCard(club: club)
                            }
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
                        ? "Aucune sortie ouverte dans votre rayon"
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
                    FollowedActivityRow(activity: activity) {
                        openFollowedActivity(activity)
                    }
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

            HStack(spacing: 10) {
                Menu {
                    Button("Tous les ressentis") { affinity = "all" }
                    Button("❄️ Pas pour moi") { affinity = "ice" }
                    Button("🔥 Profils aimés") { affinity = "liked" }
                    Button("Sans avis") { affinity = "new" }
                } label: {
                    filterMenuLabel("Ressenti")
                }
                Menu {
                    Button("Proximité") { localSort = "distance" }
                    Button("Compatibilité") { localSort = "compatibility" }
                    Button("Plus récents") { localSort = "recent" }
                    Button("Glaçon & flammes") { localSort = "affinity" }
                } label: {
                    filterMenuLabel("Classer")
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Âge : \(minimumAge) à \(maximumAge) ans")
                        .font(VelvetTypography.caption(size: 10, weight: .semibold))
                        .foregroundStyle(VelvetColor.textSecondary)
                    Spacer()
                    NavigationLink("Filtres avancés") {
                        PremiumDiscoveryGridView(currentProfile: profile)
                    }
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                }
                HStack {
                    Stepper("Min", value: $minimumAge, in: 18...maximumAge)
                    Stepper("Max", value: $maximumAge, in: minimumAge...99)
                }
                .labelsHidden()
            }

            if allProfiles.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "person.2.slash",
                    title: "Aucun profil pour ces critères",
                    message: "Élargis l’âge, le rayon ou le type de profil."
                )
            } else {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
                    spacing: 12
                ) {
                    ForEach(allProfiles) { candidate in
                        profileDestination(candidate) {
                            IntelligentProfileCard(profile: candidate, compact: true)
                        }
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
    private func profileDestination<Content: View>(
        _ candidate: IntelligentProfile,
        @ViewBuilder label: () -> Content
    ) -> some View {
        if let member = store.directory?.profiles.first(where: { $0.id == candidate.id }) {
            NavigationLink { MemberDetailView(profile: member) } label: { label() }
                .buttonStyle(.plain)
        } else {
            label().opacity(0.72)
        }
    }

    @ViewBuilder
    private func clubDestination<Content: View>(
        _ club: IntelligentClub,
        @ViewBuilder label: () -> Content
    ) -> some View {
        if let venue = store.directory?.venueDirectory.first(where: { $0.id == club.id }) {
            NavigationLink { VenueDetailView(venue: venue) } label: { label() }
                .buttonStyle(.plain)
        } else {
            label()
        }
    }

    private func filterChip(_ title: String, value: String, selection: Binding<String>) -> some View {
        VelvetChip(title: title, selected: selection.wrappedValue == value) {
            selection.wrappedValue = value
        }
    }

    private func filterMenuLabel(_ title: String) -> some View {
        Label(title, systemImage: "chevron.down")
            .font(VelvetTypography.body(size: 11, weight: .semibold))
            .foregroundStyle(VelvetColor.ivory)
            .padding(.horizontal, 12)
            .frame(height: 40)
            .background(VelvetColor.ivory.opacity(0.045))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(VelvetColor.borderSubtle, lineWidth: 0.8))
    }

    private func firstAge(_ label: String?) -> Int? {
        guard let label else { return nil }
        return label.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }.first
    }

    private func openFollowedActivity(_ activity: FollowedActivity) {
        // Les lignes utilisent les mêmes routes que les cartes profil et événement.
    }

    @MainActor
    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            intelligence = try await store.service.homeIntelligence()
            localSort = intelligence?.preferences.profileSort ?? "distance"
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct IntelligentProfileCard: View {
    let profile: IntelligentProfile
    let compact: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                VelvetRemoteImage(url: profile.photoUrl, symbol: "person.crop.rectangle")
                    .frame(width: compact ? nil : 190, height: compact ? 205 : 250)
                    .frame(maxWidth: compact ? .infinity : 190)
                    .clipped()
                HStack(spacing: 5) {
                    if let affinity = profile.affinitySymbol {
                        Text(affinity)
                    }
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
        .frame(width: compact ? nil : 190, alignment: .leading)
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
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 13) {
                VelvetRemoteImage(url: activity.previewUrl, symbol: activity.type == "event" ? "calendar" : "person.fill")
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
            }
            .padding(12)
            .background(VelvetColor.ivory.opacity(0.03))
            .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
