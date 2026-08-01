import SwiftUI

struct VelvetNavigationHubView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var showsPlanner = false
    @State private var plans: PlanStateResponse?

    var body: some View {
        ZStack {
            VelvetBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VelvetPageHeader(
                        "Tout Velvet au même endroit",
                        title: "Navigation",
                        subtitle: "Trouver la bonne personne, choisir un lieu, annoncer une sortie et savoir qui sera présent."
                    )

                    outingShortcut

                    navigationSection(
                        eyebrow: "RENCONTRES",
                        title: "Trouver les bons profils",
                        items: [
                            NavigationHubItem(
                                title: "Recherche avancée",
                                detail: "Affinités, âge, distance et pratiques",
                                symbol: "person.2.crop.square.stack",
                                destination: AnyView(PremiumDiscoveryGridView(currentProfile: profile))
                            ),
                            NavigationHubItem(
                                title: "Profils à proximité",
                                detail: "Explorer les membres autour de vous",
                                symbol: "location.circle",
                                destination: AnyView(PremiumDiscoveryGridView(currentProfile: profile))
                            )
                        ]
                    )

                    navigationSection(
                        eyebrow: "SORTIES & LIEUX",
                        title: "Sortir simplement",
                        items: [
                            NavigationHubItem(
                                title: "Clubs autour de moi",
                                detail: "Rechercher par nom, ville ou catégorie",
                                symbol: "building.2.crop.circle",
                                destination: AnyView(VelvetClubDirectoryView())
                            ),
                            NavigationHubItem(
                                title: "Qui sera présent ?",
                                detail: "Voir les sorties annoncées par date et lieu",
                                symbol: "person.3.sequence.fill",
                                destination: AnyView(CommunityAttendanceDirectoryView(currentProfile: profile))
                            ),
                            NavigationHubItem(
                                title: "Carte Velvet",
                                detail: "Profils, clubs et événements proches",
                                symbol: "map.fill",
                                destination: AnyView(MemberMapView())
                            ),
                            NavigationHubItem(
                                title: "Cap d’Agde",
                                detail: "Séjours et rendez-vous de la communauté",
                                symbol: "sun.max.fill",
                                destination: AnyView(IntelligentPlacesEventsView(initialSelection: 2))
                            )
                        ]
                    )

                    NavigationLink {
                        AgendaView()
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: "calendar")
                                .font(.system(size: 19, weight: .medium))
                                .foregroundStyle(VelvetColor.champagneGold)
                                .frame(width: 48, height: 48)
                                .background(VelvetColor.champagneGold.opacity(0.08))
                                .clipShape(Circle())

                            VStack(alignment: .leading, spacing: 4) {
                                Text("Mon agenda complet")
                                    .font(VelvetTypography.body(size: 15, weight: .semibold))
                                    .foregroundStyle(VelvetColor.ivory)
                                Text("Sorties, visites, événements et voyages")
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
                        .overlay {
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
                        }
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 34)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showsPlanner) {
            ProfileVenuePlanningSheet(profile: profile) { updated in
                plans = updated
            }
            .environmentObject(store)
        }
        .task {
            plans = try? await store.service.plans()
        }
    }

    private var outingShortcut: some View {
        Button { showsPlanner = true } label: {
            HStack(spacing: 15) {
                Image(systemName: "calendar.badge.plus")
                    .font(.system(size: 21, weight: .semibold))
                    .foregroundStyle(VelvetColor.velvetBlack)
                    .frame(width: 54, height: 54)
                    .background(VelvetColor.champagneGold)
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 5) {
                    Text(profile.attendanceFirstPersonLabel)
                        .font(VelvetTypography.title(size: 24))
                        .foregroundStyle(VelvetColor.ivory)
                    Text("Choisir un club et une date depuis votre profil")
                        .font(VelvetTypography.body(size: 11))
                        .foregroundStyle(VelvetColor.textSecondary)
                }

                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            .padding(17)
            .background {
                LinearGradient(
                    colors: [
                        VelvetColor.velvetBurgundy.opacity(0.48),
                        VelvetColor.panelRaised.opacity(0.86)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
            .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 25, style: .continuous)
                    .stroke(VelvetColor.champagneGold.opacity(0.30), lineWidth: 0.9)
            }
        }
        .buttonStyle(.plain)
    }

    private func navigationSection(
        eyebrow: String,
        title: String,
        items: [NavigationHubItem]
    ) -> some View {
        VStack(alignment: .leading, spacing: 13) {
            VStack(alignment: .leading, spacing: 3) {
                Text(eyebrow)
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(title)
                    .font(VelvetTypography.title(size: 25))
                    .foregroundStyle(VelvetColor.ivory)
            }

            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: 10),
                    GridItem(.flexible(), spacing: 10)
                ],
                spacing: 10
            ) {
                ForEach(items) { item in
                    NavigationLink {
                        item.destination
                    } label: {
                        NavigationHubCard(item: item)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct NavigationHubItem: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
    let symbol: String
    let destination: AnyView
}

private struct NavigationHubCard: View {
    let item: NavigationHubItem

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            Image(systemName: item.symbol)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 45, height: 45)
                .background(.ultraThinMaterial)
                .background(VelvetColor.champagneGold.opacity(0.06))
                .clipShape(Circle())
                .overlay(Circle().stroke(VelvetColor.champagneGold.opacity(0.17), lineWidth: 0.7))

            Text(item.title)
                .font(VelvetTypography.body(size: 14, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
                .multilineTextAlignment(.leading)
                .lineLimit(2)

            Text(item.detail)
                .font(VelvetTypography.caption(size: 10))
                .foregroundStyle(VelvetColor.textSecondary)
                .multilineTextAlignment(.leading)
                .lineLimit(3)

            Spacer(minLength: 0)

            HStack {
                Text("OUVRIR")
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.1)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.caption)
            }
            .foregroundStyle(VelvetColor.champagneGold)
        }
        .padding(15)
        .frame(maxWidth: .infinity, minHeight: 190, alignment: .topLeading)
        .background(.ultraThinMaterial)
        .background(VelvetColor.panelRaised.opacity(0.68))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
        }
    }
}

struct VelvetClubDirectoryView: View {
    @EnvironmentObject private var store: VelvetStore

    @State private var query = ""
    @State private var category = "all"

    private var allVenues: [Venue] {
        store.directory?.venueDirectory ?? []
    }

    private var venues: [Venue] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let filtered = allVenues.filter { venue in
            let searchable = [
                venue.name,
                venue.city ?? "",
                venue.kind ?? "",
                venue.categoryPrimary ?? "",
                (venue.categoryTags ?? []).joined(separator: " ")
            ].joined(separator: " ")

            let matchesQuery = normalized.isEmpty
                || searchable.localizedCaseInsensitiveContains(normalized)

            let categoryText = "\(venue.kind ?? "") \(venue.categoryPrimary ?? "") \((venue.categoryTags ?? []).joined(separator: " "))"
                .lowercased()
            let matchesCategory: Bool
            switch category {
            case "club":
                matchesCategory = categoryText.contains("club")
                    || categoryText.contains("libertin")
                    || categoryText.contains("échang")
            case "spa":
                matchesCategory = categoryText.contains("spa")
                    || categoryText.contains("sauna")
                    || categoryText.contains("wellness")
            case "bar":
                matchesCategory = categoryText.contains("bar")
                    || categoryText.contains("lounge")
                    || categoryText.contains("night")
            default:
                matchesCategory = true
            }
            return matchesQuery && matchesCategory
        }

        return filtered.sorted {
            let left = $0.distanceKm ?? .greatestFiniteMagnitude
            let right = $1.distanceKm ?? .greatestFiniteMagnitude
            return left == right
                ? $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
                : left < right
        }
    }

    var body: some View {
        ZStack {
            VelvetBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 17) {
                    VelvetPageHeader(
                        "Annuaire Velvet",
                        title: "Clubs autour de moi",
                        subtitle: "Recherche dans l’intégralité des établissements, sans limiter les résultats au rayon de l’accueil."
                    )

                    VelvetSearchField(prompt: "Nom, ville ou type d’établissement…", text: $query)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            filter("Tous", value: "all")
                            filter("Clubs", value: "club")
                            filter("Spas", value: "spa")
                            filter("Bars", value: "bar")
                        }
                    }

                    HStack {
                        Text("\(venues.count) établissement\(venues.count > 1 ? "s" : "")")
                            .font(VelvetTypography.caption(size: 10, weight: .semibold))
                            .foregroundStyle(VelvetColor.textSecondary)
                        Spacer()
                        Text("PROXIMITÉ")
                            .font(VelvetTypography.caption(size: 8, weight: .semibold))
                            .tracking(1.2)
                            .foregroundStyle(VelvetColor.champagneGold)
                    }

                    if allVenues.isEmpty {
                        VelvetEmptyState(
                            symbol: "arrow.clockwise.circle",
                            title: "Annuaire en cours de synchronisation",
                            message: "Tirez l’écran vers le bas pour recharger les établissements."
                        )
                    } else if venues.isEmpty {
                        VelvetEmptyState(
                            symbol: "building.2",
                            title: "Aucun résultat",
                            message: "Essaie un autre nom, une ville proche ou le filtre Tous."
                        )
                    } else {
                        LazyVStack(spacing: 11) {
                            ForEach(venues) { venue in
                                NavigationLink {
                                    VenueDetailView(venue: venue)
                                } label: {
                                    ClubDirectoryRow(venue: venue)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(20)
                .padding(.bottom, 30)
            }
            .refreshable { await store.load() }
        }
        .navigationTitle("Clubs")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if store.directory == nil { await store.load() }
        }
    }

    private func filter(_ title: String, value: String) -> some View {
        VelvetChip(title: title, selected: category == value) { category = value }
    }
}

private struct ClubDirectoryRow: View {
    let venue: Venue

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "building.2.fill")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 48, height: 48)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Text(venue.name)
                        .font(VelvetTypography.body(size: 14, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineLimit(1)
                    if venue.verificationStatus == "verified" {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.caption)
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                }

                Text([venue.categoryPrimary ?? venue.kind, venue.city]
                    .compactMap { $0 }
                    .joined(separator: " · "))
                    .font(VelvetTypography.caption(size: 10))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(1)
            }

            Spacer()

            if let distance = venue.distanceKm {
                Text("\(distance.formatted(.number.precision(.fractionLength(0...1)))) km")
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .padding(14)
        .background(VelvetColor.panelRaised.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 19, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
        }
    }
}

struct CommunityAttendanceDirectoryView: View {
    @EnvironmentObject private var store: VelvetStore
    let currentProfile: MemberProfile

    @State private var plans: PlanStateResponse?
    @State private var showsPlanner = false

    private struct AttendanceGroup: Identifiable {
        let venue: Venue
        let date: String
        let visits: [VenueVisit]

        var id: String { "\(venue.id.uuidString)-\(date)" }
    }

    private var groups: [AttendanceGroup] {
        let today = Calendar.current.startOfDay(for: Date())
        let valid = (plans?.venueVisits ?? []).filter { visit in
            guard let date = visit.visitDate.profileOutingDateValue else { return true }
            return date >= today
        }
        let grouped = Dictionary(grouping: valid) { visit in
            "\(visit.venueId.uuidString)-\(visit.visitDate)"
        }

        return grouped.values.compactMap { visits in
            guard let first = visits.first,
                  let venue = first.venueDirectory
                    ?? store.directory?.venueDirectory.first(where: { $0.id == first.venueId })
            else { return nil }
            return AttendanceGroup(venue: venue, date: first.visitDate, visits: visits)
        }
        .sorted {
            let left = $0.date.profileOutingDateValue ?? .distantFuture
            let right = $1.date.profileOutingDateValue ?? .distantFuture
            return left == right
                ? $0.venue.name.localizedCaseInsensitiveCompare($1.venue.name) == .orderedAscending
                : left < right
        }
    }

    var body: some View {
        ZStack {
            VelvetBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VelvetPageHeader(
                        "Agenda communautaire",
                        title: "Qui sera présent ?",
                        subtitle: "Les sorties rendues visibles par les membres sont regroupées par établissement et par date."
                    )

                    Button { showsPlanner = true } label: {
                        Label(currentProfile.attendanceFirstPersonLabel, systemImage: "calendar.badge.plus")
                            .font(VelvetTypography.body(size: 13, weight: .semibold))
                            .foregroundStyle(VelvetColor.velvetBlack)
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(VelvetColor.champagneGold)
                            .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
                    }
                    .buttonStyle(.plain)

                    if groups.isEmpty {
                        VelvetEmptyState(
                            symbol: "person.3.sequence",
                            title: "Aucune sortie annoncée",
                            message: "Les prochaines présences apparaîtront ici dès qu’un membre renseignera un club et une date."
                        )
                    } else {
                        LazyVStack(spacing: 13) {
                            ForEach(groups) { group in
                                attendanceCard(group)
                            }
                        }
                    }
                }
                .padding(20)
                .padding(.bottom, 30)
            }
            .refreshable { await load() }
        }
        .navigationTitle("Présences")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showsPlanner) {
            ProfileVenuePlanningSheet(profile: currentProfile) { updated in
                plans = updated
            }
            .environmentObject(store)
        }
        .task { await load() }
    }

    private func attendanceCard(_ group: AttendanceGroup) -> some View {
        VStack(alignment: .leading, spacing: 13) {
            NavigationLink {
                VenueDetailView(venue: group.venue)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "sparkles")
                        .foregroundStyle(VelvetColor.champagneGold)
                        .frame(width: 42, height: 42)
                        .background(VelvetColor.champagneGold.opacity(0.08))
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 3) {
                        Text(group.venue.name)
                            .font(VelvetTypography.title(size: 21))
                            .foregroundStyle(VelvetColor.ivory)
                            .lineLimit(1)
                        Text(group.date.profileOutingDateLabel)
                            .font(VelvetTypography.caption(size: 10, weight: .semibold))
                            .foregroundStyle(VelvetColor.champagneGold)
                    }

                    Spacer()
                    Text("\(group.visits.count)")
                        .font(VelvetTypography.title(size: 20))
                        .foregroundStyle(VelvetColor.textSecondary)
                }
            }
            .buttonStyle(.plain)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 9) {
                    ForEach(group.visits) { visit in
                        if let profileID = visit.profileId,
                           let member = store.directory?.profiles.first(where: { $0.id == profileID }) {
                            NavigationLink {
                                MemberDetailView(profile: member)
                            } label: {
                                attendee(member)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .padding(15)
        .background(.ultraThinMaterial)
        .background(VelvetColor.panelRaised.opacity(0.68))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.16), lineWidth: 0.8)
        }
    }

    private func attendee(_ member: MemberProfile) -> some View {
        HStack(spacing: 8) {
            VelvetRemoteImage(
                url: member.profileGalleryPhotos.first(where: { $0.isPrimary == true })?.previewUrl
                    ?? member.profileGalleryPhotos.first?.previewUrl,
                symbol: member.profileType == .couple ? "person.2.fill" : "person.fill"
            )
            .frame(width: 36, height: 36)
            .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(member.displayName)
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                Text(member.attendanceThirdPersonLabel)
                    .font(VelvetTypography.caption(size: 8))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 54)
        .background(VelvetColor.velvetBlack.opacity(0.38))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(VelvetColor.borderSubtle, lineWidth: 0.7))
    }

    @MainActor
    private func load() async {
        if store.directory == nil { await store.load() }
        plans = try? await store.service.plans()
    }
}
