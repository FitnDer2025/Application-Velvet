import SwiftUI

struct MemberOutingsHistoryView: View {
    @EnvironmentObject private var store: VelvetStore

    let profile: MemberProfile
    let plans: PlanStateResponse?

    private var ownProfile: Bool {
        store.profile?.id == profile.id
    }

    private var visits: [VenueVisit] {
        (plans?.venueVisits ?? [])
            .filter { $0.profileId == profile.id }
    }

    private var upcoming: [VenueVisit] {
        visits
            .filter {
                guard let date = $0.visitDate.profileOutingDateValue else { return true }
                return date >= Calendar.current.startOfDay(for: Date())
            }
            .sorted {
                ($0.visitDate.profileOutingDateValue ?? .distantFuture)
                    < ($1.visitDate.profileOutingDateValue ?? .distantFuture)
            }
    }

    private var history: [VenueVisit] {
        visits
            .filter {
                guard let date = $0.visitDate.profileOutingDateValue else { return false }
                return date < Calendar.current.startOfDay(for: Date())
            }
            .sorted {
                ($0.visitDate.profileOutingDateValue ?? .distantPast)
                    > ($1.visitDate.profileOutingDateValue ?? .distantPast)
            }
    }

    private var upcomingTitle: String {
        profile.profileType == .couple ? "On y sera" : "J’y serai"
    }

    private var historyTitle: String {
        profile.profileType == .couple ? "On y était" : "J’y étais"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VelvetPageHeader(
                    ownProfile ? "Mon agenda social" : "Agenda du profil",
                    title: "Soirées",
                    subtitle: "Les lieux déjà fréquentés et les prochaines sorties rendues visibles par ce profil."
                )

                outingSection(
                    eyebrow: "À VENIR",
                    title: upcomingTitle,
                    visits: upcoming,
                    empty: "Aucune sortie annoncée à venir."
                )

                outingSection(
                    eyebrow: "SOUVENIRS",
                    title: historyTitle,
                    visits: history,
                    empty: "Aucune sortie passée visible."
                )
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
            .padding(.bottom, 34)
        }
        .background(VelvetBackground())
    }

    private func outingSection(
        eyebrow: String,
        title: String,
        visits: [VenueVisit],
        empty: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .lastTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(eyebrow)
                        .font(VelvetTypography.caption(size: 8, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text(title)
                        .font(VelvetTypography.title(size: 28))
                        .foregroundStyle(VelvetColor.ivory)
                }
                Spacer()
                Text("\(visits.count)")
                    .font(VelvetTypography.title(size: 25))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            if visits.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "calendar.badge.clock",
                    title: empty,
                    message: ownProfile
                        ? "Utilisez l’onglet Déclarer une sortie pour informer la communauté."
                        : "Ce membre choisira lui-même les sorties visibles sur sa fiche."
                )
            } else {
                LazyVStack(spacing: 11) {
                    ForEach(visits) { visit in
                        outingCard(visit)
                    }
                }
            }
        }
    }

    private func outingCard(_ visit: VenueVisit) -> some View {
        let venue = visit.venueDirectory
            ?? store.directory?.venueDirectory.first(where: { $0.id == visit.venueId })
        let companions = (plans?.venueVisits ?? [])
            .filter { $0.venueId == visit.venueId && $0.visitDate == visit.visitDate }
            .compactMap { row in
                guard let id = row.profileId, id != profile.id else { return nil }
                return store.directory?.profiles.first(where: { $0.id == id })
            }

        return NavigationLink {
            if let venue {
                SocialVenueDetailView(venue: venue)
            } else {
                CommunityAttendanceDirectoryView(currentProfile: store.profile ?? profile)
            }
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 13) {
                    VStack(spacing: 1) {
                        Text(visit.visitDate.socialDay)
                            .font(VelvetTypography.title(size: 23))
                        Text(visit.visitDate.socialMonth.uppercased())
                            .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    }
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 54, height: 54)
                    .background(VelvetColor.champagneGold.opacity(0.09))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    VStack(alignment: .leading, spacing: 4) {
                        Text(venue?.name ?? "Établissement Zwit")
                            .font(VelvetTypography.body(size: 15, weight: .semibold))
                            .foregroundStyle(VelvetColor.ivory)
                            .lineLimit(1)
                        Text([venue?.categoryPrimary ?? venue?.kind, venue?.city]
                            .compactMap { $0 }
                            .joined(separator: " · "))
                            .font(VelvetTypography.caption(size: 10))
                            .foregroundStyle(VelvetColor.textSecondary)
                            .lineLimit(1)
                    }

                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(VelvetColor.champagneGold)
                }

                if !companions.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ÉGALEMENT PRÉSENTS")
                            .font(VelvetTypography.caption(size: 8, weight: .semibold))
                            .tracking(1.1)
                            .foregroundStyle(VelvetColor.textSecondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(companions.prefix(8)) { member in
                                    SocialMemberIdentityChip(profile: member)
                                }
                            }
                        }
                    }
                }
            }
            .padding(14)
            .background(.ultraThinMaterial)
            .background(VelvetColor.panelRaised.opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 21, style: .continuous)
                    .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
            }
        }
        .buttonStyle(.plain)
    }
}

struct PeopleFirstClubDirectoryView: View {
    @EnvironmentObject private var store: VelvetStore

    @State private var query = ""
    @State private var category = "all"
    @State private var plans: PlanStateResponse?

    private var venues: [Venue] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return (store.directory?.venueDirectory ?? [])
            .filter { venue in
                let source = [
                    venue.name,
                    venue.city ?? "",
                    venue.kind ?? "",
                    venue.categoryPrimary ?? "",
                    (venue.categoryTags ?? []).joined(separator: " "),
                    venue.addressPublic ?? ""
                ].joined(separator: " ")
                let matchesQuery = normalized.isEmpty
                    || source.localizedCaseInsensitiveContains(normalized)
                let lower = source.lowercased()
                let matchesCategory: Bool
                switch category {
                case "club": matchesCategory = lower.contains("club") || lower.contains("libertin")
                case "spa": matchesCategory = lower.contains("spa") || lower.contains("sauna")
                case "bar": matchesCategory = lower.contains("bar") || lower.contains("lounge")
                case "love": matchesCategory = lower.contains("love") || lower.contains("room")
                default: matchesCategory = true
                }
                return matchesQuery && matchesCategory
            }
            .sorted {
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
                VStack(alignment: .leading, spacing: 18) {
                    VelvetPageHeader(
                        "Lieux & sorties",
                        title: "Clubs et établissements",
                        subtitle: "Une recherche distincte des membres, avec les soirées et les profils qui ont annoncé leur présence."
                    )

                    VelvetSearchField(prompt: "Nom, ville, club, spa…", text: $query)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            filter("Tous", "all")
                            filter("Clubs", "club")
                            filter("Spas", "spa")
                            filter("Bars", "bar")
                            filter("Love rooms", "love")
                        }
                    }

                    HStack {
                        Text("\(venues.count) établissement\(venues.count > 1 ? "s" : "")")
                            .font(VelvetTypography.caption(size: 10, weight: .semibold))
                            .foregroundStyle(VelvetColor.textSecondary)
                        Spacer()
                        Text("LES LIEUX D’ABORD")
                            .font(VelvetTypography.caption(size: 8, weight: .semibold))
                            .tracking(1.1)
                            .foregroundStyle(VelvetColor.champagneGold)
                    }

                    if venues.isEmpty {
                        VelvetEmptyState(
                            symbol: "building.2",
                            title: "Aucun établissement correspondant",
                            message: "Essayez un autre nom, une ville ou un type différent."
                        )
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(venues) { venue in
                                NavigationLink {
                                    SocialVenueDetailView(venue: venue)
                                } label: {
                                    socialVenueRow(venue)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 20)
                .padding(.bottom, 34)
            }
            .refreshable { await load() }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { await load() }
    }

    private func filter(_ title: String, _ value: String) -> some View {
        VelvetChip(title: title, selected: category == value) { category = value }
    }

    private func socialVenueRow(_ venue: Venue) -> some View {
        let attendance = upcomingAttendance(venue)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 13) {
                Image(systemName: "building.2.fill")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 50, height: 50)
                    .background(VelvetColor.champagneGold.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(venue.name)
                        .font(VelvetTypography.body(size: 15, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineLimit(1)
                    Text([venue.categoryPrimary ?? venue.kind, venue.city]
                        .compactMap { $0 }
                        .joined(separator: " · "))
                        .font(VelvetTypography.caption(size: 10))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .lineLimit(1)
                    Text("\(attendance.count) profil\(attendance.count > 1 ? "s" : "") annoncé\(attendance.count > 1 ? "s" : "")")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(VelvetColor.champagneGold)
            }

            if !attendance.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(attendance.prefix(7)) { member in
                            SocialMemberIdentityChip(profile: member)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(.ultraThinMaterial)
        .background(VelvetColor.panelRaised.opacity(0.70))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
        }
    }

    private func upcomingAttendance(_ venue: Venue) -> [MemberProfile] {
        let today = Calendar.current.startOfDay(for: Date())
        var seen = Set<UUID>()
        return (plans?.venueVisits ?? [])
            .filter { $0.venueId == venue.id }
            .filter { ($0.visitDate.profileOutingDateValue ?? .distantFuture) >= today }
            .compactMap { visit in
                guard let id = visit.profileId,
                      seen.insert(id).inserted
                else { return nil }
                return store.directory?.profiles.first(where: { $0.id == id })
            }
    }

    @MainActor
    private func load() async {
        if store.directory == nil { await store.load() }
        plans = try? await store.service.plans()
    }
}

struct SocialVenueDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    let venue: Venue

    @State private var plans: PlanStateResponse?
    @State private var showsPlanner = false

    private var events: [VelvetEvent] {
        (store.directory?.events ?? [])
            .filter { event in
                let location = event.locationPublic ?? ""
                return location.localizedCaseInsensitiveContains(venue.name)
                    || (!((venue.city ?? "").isEmpty)
                        && location.localizedCaseInsensitiveContains(venue.city ?? ""))
            }
            .filter { SocialDate.parse($0.startsAt) >= Date() }
            .sorted { SocialDate.parse($0.startsAt) < SocialDate.parse($1.startsAt) }
    }

    private struct AttendanceDay: Identifiable {
        let day: String
        let profiles: [MemberProfile]
        var id: String { day }
    }

    private var attendance: [AttendanceDay] {
        let today = Calendar.current.startOfDay(for: Date())
        let rows = (plans?.venueVisits ?? [])
            .filter { $0.venueId == venue.id }
            .filter { ($0.visitDate.profileOutingDateValue ?? .distantFuture) >= today }
        let grouped = Dictionary(grouping: rows, by: \.visitDate)
        return grouped.map { day, visits in
            var seen = Set<UUID>()
            let profiles = visits.compactMap { visit in
                guard let id = visit.profileId,
                      seen.insert(id).inserted
                else { return nil }
                return store.directory?.profiles.first(where: { $0.id == id })
            }
            return AttendanceDay(day: day, profiles: profiles)
        }
        .sorted { $0.day < $1.day }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    venueHeader

                    sectionHeader("PROGRAMMATION", "Soirées organisées", count: events.count)
                    if events.isEmpty {
                        VelvetCompactEmptyState(
                            symbol: "calendar",
                            title: "Aucune soirée publiée",
                            message: "La programmation apparaîtra ici dès qu’elle sera annoncée."
                        )
                    } else {
                        LazyVStack(spacing: 10) {
                            ForEach(events) { event in
                                NavigationLink {
                                    if let intelligent = store.intelligentEvent(id: event.id) {
                                        IntelligentEventDetailView(event: intelligent)
                                    } else {
                                        AgendaView()
                                    }
                                } label: {
                                    eventRow(event)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    sectionHeader(
                        "COMMUNAUTÉ",
                        "Qui a prévu d’y aller ?",
                        count: attendance.reduce(0) { $0 + $1.profiles.count }
                    )
                    if attendance.isEmpty {
                        VelvetCompactEmptyState(
                            symbol: "person.3.sequence",
                            title: "Aucun membre déclaré",
                            message: "Les profils apparaîtront avec leur photo dès qu’ils annonceront leur présence."
                        )
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(attendance) { day in
                                attendanceDay(day)
                            }
                        }
                    }

                    VelvetPrimaryButton("Déclarer une sortie ici") {
                        showsPlanner = true
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 20)
                .padding(.bottom, 34)
            }
            .refreshable { await load() }
        }
        .navigationTitle(venue.name)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showsPlanner) {
            if let profile = store.profile {
                ProfileVenuePlanningSheet(profile: profile) { updated in
                    plans = updated
                }
                .environmentObject(store)
            }
        }
        .task { await load() }
    }

    private var venueHeader: some View {
        VStack(alignment: .leading, spacing: 15) {
            Image(systemName: "building.2.fill")
                .font(.system(size: 25, weight: .medium))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 66, height: 66)
                .background(.ultraThinMaterial)
                .background(VelvetColor.champagneGold.opacity(0.07))
                .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))

            Text("ÉTABLISSEMENT")
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1.6)
                .foregroundStyle(VelvetColor.champagneGold)
            Text(venue.name)
                .font(VelvetTypography.title(size: 39))
                .foregroundStyle(VelvetColor.ivory)
            Text([venue.categoryPrimary ?? venue.kind, venue.city, venue.addressPublic]
                .compactMap { $0 }
                .joined(separator: " · "))
                .font(VelvetTypography.body(size: 12))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineSpacing(3)
        }
        .padding(20)
        .background {
            LinearGradient(
                colors: [
                    VelvetColor.velvetBurgundy.opacity(0.42),
                    VelvetColor.panelRaised.opacity(0.78)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.20), lineWidth: 0.8)
        }
    }

    private func sectionHeader(_ eyebrow: String, _ title: String, count: Int) -> some View {
        HStack(alignment: .lastTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                Text(eyebrow)
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(title)
                    .font(VelvetTypography.title(size: 27))
                    .foregroundStyle(VelvetColor.ivory)
            }
            Spacer()
            Text("\(count)")
                .font(VelvetTypography.title(size: 24))
                .foregroundStyle(VelvetColor.textSecondary)
        }
    }

    private func eventRow(_ event: VelvetEvent) -> some View {
        HStack(spacing: 13) {
            VStack(spacing: 1) {
                Text(SocialDate.day(event.startsAt))
                    .font(VelvetTypography.title(size: 22))
                Text(SocialDate.month(event.startsAt).uppercased())
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
            }
            .foregroundStyle(VelvetColor.champagneGold)
            .frame(width: 54, height: 54)
            .background(VelvetColor.champagneGold.opacity(0.09))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(2)
                Text(event.locationPublic ?? venue.name)
                    .font(VelvetTypography.caption(size: 10))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(1)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.champagneGold)
        }
        .padding(13)
        .background(VelvetColor.panelRaised.opacity(0.68))
        .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 19, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
        }
    }

    private func attendanceDay(_ day: AttendanceDay) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(day.day.profileOutingDateLabel)
                .font(VelvetTypography.body(size: 13, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)

            LazyVGrid(
                columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
                spacing: 8
            ) {
                ForEach(day.profiles) { profile in
                    NavigationLink {
                        MemberDetailView(profile: profile)
                    } label: {
                        SocialMemberCard(profile: profile)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(14)
        .background(.ultraThinMaterial)
        .background(VelvetColor.panelRaised.opacity(0.65))
        .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 21, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
        }
    }

    @MainActor
    private func load() async {
        if store.directory == nil { await store.load() }
        plans = try? await store.service.plans()
    }
}

struct OwnOutingPublisherView: View {
    @EnvironmentObject private var store: VelvetStore

    let profile: MemberProfile
    let onPublished: (PlanStateResponse?) -> Void

    @State private var showsVenue = false
    @State private var showsEvent = false
    @State private var showsCap = false
    @State private var showsTravel = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VelvetPageHeader(
                    "Depuis votre profil",
                    title: "Déclarer une sortie",
                    subtitle: "Club, spa, Cap d’Agde, événement privé ou voyage : choisissez le parcours adapté."
                )

                publishCard(
                    icon: "building.2.fill",
                    title: "Club, spa ou établissement",
                    detail: "Choisir un lieu de l’annuaire et une date",
                    action: { showsVenue = true }
                )
                publishCard(
                    icon: "sparkles",
                    title: "Créer une sortie",
                    detail: "Soirée, repas, rendez-vous ou événement communautaire",
                    action: { showsEvent = true }
                )
                publishCard(
                    icon: "sun.max.fill",
                    title: "Cap d’Agde",
                    detail: "Séjour, zone du village et rendez-vous sur place",
                    action: { showsCap = true }
                )
                publishCard(
                    icon: "airplane",
                    title: "Voyage ou autre déplacement",
                    detail: "Destination, dates et informations utiles",
                    action: { showsTravel = true }
                )
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
            .padding(.bottom, 34)
        }
        .background(VelvetBackground())
        .sheet(isPresented: $showsVenue) {
            ProfileVenuePlanningSheet(profile: profile) { updated in
                onPublished(updated)
            }
            .environmentObject(store)
        }
        .sheet(isPresented: $showsEvent, onDismiss: { onPublished(nil) }) {
            EventCreationView(initialCategory: "standard")
        }
        .sheet(isPresented: $showsCap, onDismiss: { onPublished(nil) }) {
            EventCreationView(initialCategory: "cap_dagde")
        }
        .sheet(isPresented: $showsTravel) {
            TravelPlanCreationView { updated in
                onPublished(updated)
            }
            .environmentObject(store)
        }
    }

    private func publishCard(
        icon: String,
        title: String,
        detail: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 15) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 54, height: 54)
                    .background(.ultraThinMaterial)
                    .background(VelvetColor.champagneGold.opacity(0.07))
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                VStack(alignment: .leading, spacing: 5) {
                    Text(title)
                        .font(VelvetTypography.body(size: 15, weight: .semibold))
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
            .background(.ultraThinMaterial)
            .background(VelvetColor.panelRaised.opacity(0.70))
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct TravelPlanCreationView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore

    let onSave: (PlanStateResponse) -> Void

    @State private var title = ""
    @State private var location = ""
    @State private var startsOn = Date().addingTimeInterval(24 * 3600)
    @State private var endsOn = Date().addingTimeInterval(48 * 3600)
    @State private var notes = ""
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Destination") {
                    TextField("Titre de la sortie", text: $title)
                    TextField("Ville, région ou lieu", text: $location)
                }
                Section("Dates") {
                    DatePicker("Début", selection: $startsOn, in: Date()..., displayedComponents: .date)
                    DatePicker("Fin", selection: $endsOn, in: startsOn..., displayedComponents: .date)
                }
                Section("Informations utiles") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 120)
                }
                Section {
                    VelvetPrimaryButton("Publier la sortie", isLoading: isWorking) {
                        Task { await save() }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(VelvetBackground())
            .navigationTitle("Voyage ou déplacement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Annuler", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
        }
    }

    @MainActor
    private func save() async {
        guard title.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2,
              location.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
        else {
            store.errorMessage = "Indiquez un titre et une destination."
            return
        }
        isWorking = true
        defer { isWorking = false }
        do {
            let updated = try await store.service.addTravelPlan(
                title: title,
                location: location,
                startsOn: startsOn.socialISODate,
                endsOn: endsOn.socialISODate,
                notes: notes.isEmpty ? nil : notes
            )
            onSave(updated)
            dismiss()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

struct SocialMemberIdentityChip: View {
    let profile: MemberProfile

    var body: some View {
        HStack(spacing: 8) {
            VelvetRemoteImage(
                url: profile.socialPrimaryPhoto,
                symbol: profile.profileType == .couple ? "person.2.fill" : "person.fill"
            )
            .frame(width: 38, height: 38)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(profile.displayName)
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                Text(profile.velvetDemographicAndAgeLabel)
                    .font(VelvetTypography.caption(size: 8))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 8)
        .frame(height: 52)
        .background(VelvetColor.velvetBlack.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.7)
        }
    }
}

struct SocialMemberCard: View {
    let profile: MemberProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            VelvetRemoteImage(
                url: profile.socialPrimaryPhoto,
                symbol: profile.profileType == .couple ? "person.2.fill" : "person.fill"
            )
            .frame(maxWidth: .infinity)
            .frame(height: 145)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            Text(profile.displayName)
                .font(VelvetTypography.body(size: 12, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
                .lineLimit(1)
            Text(profile.velvetDemographicAndAgeLabel)
                .font(VelvetTypography.caption(size: 9))
                .foregroundStyle(VelvetColor.champagneGold)
                .lineLimit(1)
        }
    }
}

extension MemberProfile {
    var socialPrimaryPhoto: URL? {
        profileGalleryPhotos.first(where: { $0.isPrimary == true })?.previewUrl
            ?? profileGalleryPhotos.first?.previewUrl
    }
}

private enum SocialDate {
    static func parse(_ value: String?) -> Date {
        guard let value else { return .distantPast }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value)
            ?? ISO8601DateFormatter().date(from: value)
            ?? value.profileOutingDateValue
            ?? .distantPast
    }

    static func day(_ value: String?) -> String {
        parse(value).formatted(.dateTime.day(.twoDigits).locale(Locale(identifier: "fr_FR")))
    }

    static func month(_ value: String?) -> String {
        parse(value).formatted(.dateTime.month(.abbreviated).locale(Locale(identifier: "fr_FR")))
    }
}

private extension String {
    var socialDay: String {
        (profileOutingDateValue ?? .distantPast)
            .formatted(.dateTime.day(.twoDigits).locale(Locale(identifier: "fr_FR")))
    }

    var socialMonth: String {
        (profileOutingDateValue ?? .distantPast)
            .formatted(.dateTime.month(.abbreviated).locale(Locale(identifier: "fr_FR")))
    }
}

private extension Date {
    var socialISODate: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: self)
    }
}