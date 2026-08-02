import SwiftUI

struct PeopleFirstHomeView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var intelligence: HomeIntelligenceResponse?
    @State private var plans: PlanStateResponse?
    @State private var isLoading = false
    @State private var visibleCount = 12
    @State private var loadIssue: String?

    private var greeting: String {
        if profile.profileType == .individual,
           let name = profile.individualProfiles?.first?.firstName,
           !name.isEmpty {
            return name
        }
        return profile.displayName
    }

    private var recommendations: [IntelligentProfile] {
        var seen = Set<UUID>()
        let latest = (intelligence?.allProfiles ?? []).sorted {
            PeopleFirstDate.parse($0.createdAt) > PeopleFirstDate.parse($1.createdAt)
        }
        return ((intelligence?.curatedProfiles ?? []) + latest)
            .filter { seen.insert($0.id).inserted }
            .prefix(12)
            .map { $0 }
    }

    private var feed: [PeopleFirstActivity] {
        var rows: [PeopleFirstActivity] = []
        let candidates = Dictionary(
            uniqueKeysWithValues: (intelligence?.allProfiles ?? []).map { ($0.id, $0) }
        )

        for member in store.directory?.profiles ?? [] where member.id != profile.id {
            let created = PeopleFirstDate.parse(member.createdAt ?? candidates[member.id]?.createdAt)
            let updated = PeopleFirstDate.parse(member.updatedAt ?? candidates[member.id]?.updatedAt)
            let latestPhoto = member.profileGalleryPhotos.max {
                PeopleFirstDate.parse($0.createdAt) < PeopleFirstDate.parse($1.createdAt)
            }
            let photoDate = PeopleFirstDate.parse(latestPhoto?.createdAt)

            if let latestPhoto, photoDate > created.addingTimeInterval(3600) {
                rows.append(PeopleFirstActivity(
                    id: "photo-\(latestPhoto.id.uuidString)",
                    kind: .photo,
                    member: member,
                    title: "a publié une nouvelle photo",
                    detail: member.locationZone ?? member.city,
                    imageURL: latestPhoto.previewUrl ?? member.socialPrimaryPhoto,
                    createdAt: photoDate,
                    visit: nil,
                    event: nil,
                    attendees: []
                ))
            } else if updated > created.addingTimeInterval(12 * 3600) {
                rows.append(PeopleFirstActivity(
                    id: "profile-\(member.id.uuidString)-\(member.updatedAt ?? "")",
                    kind: .profile,
                    member: member,
                    title: "a enrichi son profil",
                    detail: peopleFirstProfileDetail(member),
                    imageURL: member.socialPrimaryPhoto,
                    createdAt: updated,
                    visit: nil,
                    event: nil,
                    attendees: []
                ))
            } else {
                rows.append(PeopleFirstActivity(
                    id: "joined-\(member.id.uuidString)",
                    kind: .joined,
                    member: member,
                    title: member.profileType == .couple
                        ? "vient de rejoindre la communauté"
                        : "vient de rejoindre Velvet",
                    detail: [member.velvetDemographicAndAgeLabel, member.locationZone ?? member.city]
                        .compactMap { $0 }
                        .joined(separator: " · "),
                    imageURL: member.socialPrimaryPhoto,
                    createdAt: created,
                    visit: nil,
                    event: nil,
                    attendees: []
                ))
            }
        }

        let today = Calendar.current.startOfDay(for: Date())
        let groupedVisits = Dictionary(
            grouping: (plans?.venueVisits ?? []).filter {
                $0.profileId != profile.id
                    && ($0.visitDate.profileOutingDateValue ?? .distantFuture) >= today
            },
            by: { "\($0.venueId.uuidString)|\($0.visitDate)" }
        )

        for (key, visits) in groupedVisits {
            guard let visit = visits.first,
                  let memberID = visit.profileId,
                  let member = store.directory?.profiles.first(where: { $0.id == memberID })
            else { continue }
            var seen = Set<UUID>()
            let attendees = visits.compactMap { row -> MemberProfile? in
                guard let id = row.profileId, seen.insert(id).inserted else { return nil }
                return store.directory?.profiles.first(where: { $0.id == id })
            }
            rows.append(PeopleFirstActivity(
                id: "outing-\(key)",
                kind: .outing,
                member: member,
                title: member.attendanceThirdPersonLabel.lowercased(),
                detail: "\(visit.venueDirectory?.name ?? "Établissement Velvet") · \(visit.visitDate.profileOutingDateLabel)",
                imageURL: member.socialPrimaryPhoto,
                createdAt: visits
                    .map { PeopleFirstDate.parse($0.updatedAt ?? $0.createdAt) }
                    .max() ?? visit.visitDate.profileOutingDateValue ?? .distantPast,
                visit: visit,
                event: nil,
                attendees: attendees
            ))
        }

        for event in intelligence?.nearbyEvents ?? [] {
            let member = event.organizerProfileId.flatMap { id in
                store.directory?.profiles.first(where: { $0.id == id })
            }
            rows.append(PeopleFirstActivity(
                id: "event-\(event.id.uuidString)",
                kind: .event,
                member: member,
                title: event.isCapDAgde
                    ? "a annoncé un rendez-vous au Cap d’Agde"
                    : "a publié une nouvelle sortie",
                detail: [event.title, event.locationPublic, event.startsAt.peopleFirstDateLabel]
                    .compactMap { $0 }
                    .joined(separator: " · "),
                imageURL: member?.socialPrimaryPhoto,
                createdAt: PeopleFirstDate.parse(event.updatedAt ?? event.createdAt ?? event.startsAt),
                visit: nil,
                event: event,
                attendees: []
            ))
        }

        for notification in store.notificationFeed.notifications where
            notification.eventType == "reactions" && notification.entityType == "photo" {
            let member = notification.actorProfileId.flatMap { id in
                store.directory?.profiles.first(where: { $0.id == id })
            }
            let title: String
            switch notification.metadata?.reaction {
            case "adore": title = "a eu un coup de cœur pour votre photo"
            case "love": title = "a adoré votre photo"
            default: title = "a aimé votre photo"
            }
            rows.append(PeopleFirstActivity(
                id: "reaction-\(notification.id.uuidString)",
                kind: .reaction,
                member: member,
                title: title,
                detail: notification.body,
                imageURL: notification.entityPreviewUrl ?? member?.socialPrimaryPhoto,
                createdAt: PeopleFirstDate.parse(notification.createdAt),
                visit: nil,
                event: nil,
                attendees: []
            ))
        }

        var seen = Set<String>()
        return rows
            .sorted { $0.createdAt > $1.createdAt }
            .filter { seen.insert($0.id).inserted }
    }

    var body: some View {
        ZStack {
            VelvetBackground()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 26) {
                    header
                    discovery
                    timeline
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 36)
            }
            .refreshable { await load(reset: true) }

            if isLoading && intelligence == nil {
                ProgressView()
                    .tint(VelvetColor.champagneGold)
                    .padding(20)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            await load(reset: true)
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(45))
                guard !Task.isCancelled else { return }
                await refreshSilently()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("BONJOUR \(greeting.uppercased())")
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1.7)
                .foregroundStyle(VelvetColor.champagneGold)
            Text("Actualité")
                .font(VelvetTypography.title(size: 42))
                .foregroundStyle(VelvetColor.ivory)
            Text("Les personnes, leurs nouvelles photos et les sorties qui prennent vie autour de vous.")
                .font(VelvetTypography.body(size: 13))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineSpacing(3)

            if let loadIssue {
                Text(loadIssue)
                    .font(VelvetTypography.caption(size: 9))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
        }
    }

    private var discovery: some View {
        VStack(alignment: .leading, spacing: 13) {
            peopleFirstSectionHeader("À DÉCOUVRIR", "Les profils qui comptent")
            if recommendations.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "person.2",
                    title: "La sélection se prépare",
                    message: "Les nouveaux profils apparaîtront ici."
                )
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(recommendations) { candidate in
                            if let member = store.directory?.profiles.first(where: { $0.id == candidate.id }) {
                                NavigationLink {
                                    MemberDetailView(profile: member)
                                } label: {
                                    PeopleFirstRecommendationCard(candidate: candidate)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private var timeline: some View {
        VStack(alignment: .leading, spacing: 14) {
            peopleFirstSectionHeader("FIL COMMUNAUTAIRE", "Ce qui se passe maintenant")

            if feed.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "rectangle.stack.badge.person.crop",
                    title: "Le fil va prendre vie",
                    message: "Photos, profils, sorties et réactions apparaîtront ici."
                )
            } else {
                LazyVStack(spacing: 15) {
                    ForEach(Array(feed.prefix(visibleCount))) { item in
                        PeopleFirstActivityLink(item: item, currentProfile: profile)
                    }

                    if visibleCount < feed.count {
                        ProgressView()
                            .tint(VelvetColor.champagneGold)
                            .frame(maxWidth: .infinity)
                            .padding(18)
                            .onAppear {
                                visibleCount = min(feed.count, visibleCount + 10)
                            }
                    }
                }
            }
        }
    }

    private func peopleFirstSectionHeader(_ eyebrow: String, _ title: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(eyebrow)
                .font(VelvetTypography.caption(size: 8, weight: .semibold))
                .tracking(1.5)
                .foregroundStyle(VelvetColor.champagneGold)
            Text(title)
                .font(VelvetTypography.title(size: 28))
                .foregroundStyle(VelvetColor.ivory)
        }
    }

    private func peopleFirstProfileDetail(_ member: MemberProfile) -> String {
        let values = [
            member.practices?.first,
            member.valuesList?.first,
            member.locationZone ?? member.city
        ].compactMap { $0 }.filter { !$0.isEmpty }
        return values.isEmpty
            ? member.velvetDemographicAndAgeLabel
            : values.joined(separator: " · ")
    }

    @MainActor
    private func load(reset: Bool) async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        if reset { visibleCount = 12 }
        if store.directory == nil { await store.load() }
        do {
            intelligence = try await store.service.homeIntelligence()
            loadIssue = nil
        } catch {
            loadIssue = ErrorMessage.text(for: error)
        }
        plans = try? await store.service.plans()
        await store.refreshSocialState()
    }

    @MainActor
    private func refreshSilently() async {
        if let updated = try? await store.service.homeIntelligence() {
            intelligence = updated
        }
        if let updatedPlans = try? await store.service.plans() {
            plans = updatedPlans
        }
        await store.refreshSocialState()
    }
}

private enum PeopleFirstActivityKind {
    case joined
    case photo
    case profile
    case outing
    case event
    case reaction
}

private struct PeopleFirstActivity: Identifiable {
    let id: String
    let kind: PeopleFirstActivityKind
    let member: MemberProfile?
    let title: String
    let detail: String?
    let imageURL: URL?
    let createdAt: Date
    let visit: VenueVisit?
    let event: IntelligentEvent?
    let attendees: [MemberProfile]
}

private struct PeopleFirstActivityLink: View {
    let item: PeopleFirstActivity
    let currentProfile: MemberProfile

    @ViewBuilder
    var body: some View {
        if let event = item.event {
            NavigationLink {
                IntelligentEventDetailView(event: event)
            } label: {
                PeopleFirstActivityCard(item: item)
            }
            .buttonStyle(.plain)
        } else if let visit = item.visit,
                  let venue = visit.venueDirectory {
            NavigationLink {
                SocialVenueDetailView(venue: venue)
            } label: {
                PeopleFirstActivityCard(item: item)
            }
            .buttonStyle(.plain)
        } else if let member = item.member {
            NavigationLink {
                MemberDetailView(profile: member)
            } label: {
                PeopleFirstActivityCard(item: item)
            }
            .buttonStyle(.plain)
        } else {
            PeopleFirstActivityCard(item: item)
        }
    }
}

private struct PeopleFirstActivityCard: View {
    let item: PeopleFirstActivity

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            actorHeader

            if let detail = item.detail, !detail.isEmpty {
                Text(detail)
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineSpacing(3)
                    .padding(.horizontal, 2)
            }

            if let visit = item.visit {
                outingBody(visit)
            } else if let event = item.event {
                eventBody(event)
            } else if let imageURL = item.imageURL {
                VelvetRemoteImage(url: imageURL, symbol: item.member?.profileType == .couple ? "person.2.fill" : "person.fill")
                    .frame(maxWidth: .infinity)
                    .frame(height: 330)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
            }

            HStack {
                Text(item.member == nil ? "VOIR LA SORTIE" : "VOIR LE PROFIL")
                Spacer()
                Image(systemName: "arrow.up.right")
            }
            .font(VelvetTypography.caption(size: 8, weight: .semibold))
            .tracking(1.0)
            .foregroundStyle(VelvetColor.champagneGold)
            .padding(.top, 2)
        }
        .padding(15)
        .background(.ultraThinMaterial)
        .background(VelvetColor.panelRaised.opacity(0.70))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
        }
        .shadow(color: .black.opacity(0.18), radius: 18, y: 8)
    }

    private var actorHeader: some View {
        HStack(spacing: 11) {
            VelvetRemoteImage(
                url: item.member?.socialPrimaryPhoto,
                symbol: item.member?.profileType == .couple ? "person.2.fill" : "person.fill"
            )
            .frame(width: 60, height: 60)
            .clipShape(Circle())
            .overlay(Circle().stroke(VelvetColor.champagneGold.opacity(0.28), lineWidth: 0.9))

            VStack(alignment: .leading, spacing: 3) {
                Text(item.member?.displayName ?? "La communauté Velvet")
                    .font(VelvetTypography.body(size: 15, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                if let member = item.member {
                    Text([member.velvetDemographicAndAgeLabel, member.locationZone ?? member.city]
                        .compactMap { $0 }
                        .joined(separator: " · "))
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                        .lineLimit(1)
                }
                Text(item.title)
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            Spacer()
            Text(PeopleFirstDate.relative(item.createdAt))
                .font(VelvetTypography.caption(size: 8))
                .foregroundStyle(VelvetColor.textSecondary)
                .multilineTextAlignment(.trailing)
        }
    }

    private func outingBody(_ visit: VenueVisit) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 12) {
                Image(systemName: "building.2.fill")
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 46, height: 46)
                    .background(VelvetColor.champagneGold.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(visit.venueDirectory?.name ?? "Établissement Velvet")
                        .font(VelvetTypography.body(size: 14, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    Text(visit.visitDate.profileOutingDateLabel)
                        .font(VelvetTypography.caption(size: 10, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(VelvetColor.champagneGold)
            }

            if !item.attendees.isEmpty {
                Text("QUI Y SERA")
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(VelvetColor.textSecondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(item.attendees.prefix(8)) { member in
                            SocialMemberIdentityChip(profile: member)
                        }
                    }
                }
            }
        }
        .padding(13)
        .background(VelvetColor.velvetBlack.opacity(0.34))
        .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 19, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.15), lineWidth: 0.8)
        }
    }

    private func eventBody(_ event: IntelligentEvent) -> some View {
        HStack(spacing: 13) {
            Image(systemName: event.isCapDAgde ? "sun.max.fill" : "calendar.badge.plus")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 48, height: 48)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(2)
                Text([event.locationPublic, event.startsAt.peopleFirstDateLabel]
                    .compactMap { $0 }
                    .joined(separator: " · "))
                    .font(VelvetTypography.caption(size: 10))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.champagneGold)
        }
        .padding(13)
        .background(VelvetColor.velvetBlack.opacity(0.34))
        .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
    }
}

private struct PeopleFirstRecommendationCard: View {
    let candidate: IntelligentProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                VelvetRemoteImage(
                    url: candidate.photoUrl,
                    symbol: candidate.profileType == "couple" ? "person.2.fill" : "person.fill"
                )
                .frame(width: 174, height: 220)
                .clipped()

                Text("\(candidate.compatibilityScore)%")
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .padding(.horizontal, 9)
                    .frame(height: 28)
                    .background(.ultraThinMaterial)
                    .background(.black.opacity(0.32))
                    .clipShape(Capsule())
                    .padding(8)
            }
            .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))

            Text(candidate.displayName)
                .font(VelvetTypography.body(size: 14, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
                .lineLimit(1)
            Text([candidate.demographicLabel, candidate.ageLabel]
                .compactMap { $0 }
                .joined(separator: " · "))
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
                .lineLimit(1)
            Text(candidate.locationZone ?? "Zone privée")
                .font(VelvetTypography.caption(size: 9))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineLimit(1)
        }
        .frame(width: 174, alignment: .leading)
    }
}

private enum PeopleFirstDate {
    static func parse(_ value: String?) -> Date {
        guard let value else { return .distantPast }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value)
            ?? ISO8601DateFormatter().date(from: value)
            ?? value.profileOutingDateValue
            ?? .distantPast
    }

    static func relative(_ date: Date) -> String {
        guard date != .distantPast else { return "Récemment" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: .now)
    }
}

private extension String {
    var peopleFirstDateLabel: String {
        PeopleFirstDate.parse(self).formatted(
            .dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "fr_FR"))
        )
    }
}