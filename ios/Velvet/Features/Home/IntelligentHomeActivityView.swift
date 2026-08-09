import SwiftUI

struct IntelligentHomeActivityView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var intelligence: HomeIntelligenceResponse?
    @State private var plans: PlanStateResponse?
    @State private var isLoading = false
    @State private var loadIssue: String?

    private var greetingName: String {
        if profile.profileType == .individual,
           let firstName = profile.individualProfiles?.first?.firstName,
           !firstName.isEmpty {
            return firstName
        }
        return profile.displayName
    }

    private var recommendedProfiles: [IntelligentProfile] {
        let curated = intelligence?.curatedProfiles ?? []
        let latest = (intelligence?.allProfiles ?? []).sorted {
            CommunityDate.parse($0.createdAt) > CommunityDate.parse($1.createdAt)
        }
        var seen = Set<UUID>()
        return (curated + latest)
            .filter { seen.insert($0.id).inserted }
            .prefix(10)
            .map { $0 }
    }

    private var eligibleProfileIDs: Set<UUID> {
        let radius = Double(intelligence?.preferences.radiusKm ?? 50)
        return Set((intelligence?.allProfiles ?? [])
            .filter { candidate in
                candidate.reaction >= 0
                    && (candidate.distanceKm == nil || candidate.distanceKm! <= radius * 1.5)
            }
            .map(\.id))
    }

    private var feedItems: [CommunityActivityItem] {
        var items: [CommunityActivityItem] = []
        let currentProfileID = profile.id
        let candidateByID = Dictionary(
            uniqueKeysWithValues: (intelligence?.allProfiles ?? []).map { ($0.id, $0) }
        )

        for member in store.directory?.profiles ?? [] {
            guard member.id != currentProfileID, eligibleProfileIDs.contains(member.id) else { continue }
            let candidate = candidateByID[member.id]
            let createdAt = CommunityDate.parse(member.createdAt ?? candidate?.createdAt)
            let updatedAt = CommunityDate.parse(member.updatedAt ?? candidate?.updatedAt)
            let latestPhoto = member.profileGalleryPhotos.max {
                CommunityDate.parse($0.createdAt) < CommunityDate.parse($1.createdAt)
            }
            let photoDate = CommunityDate.parse(latestPhoto?.createdAt)

            if let latestPhoto,
               photoDate > createdAt.addingTimeInterval(60 * 60) {
                items.append(CommunityActivityItem(
                    id: "photo-\(latestPhoto.id.uuidString)",
                    kind: .photo,
                    member: member,
                    actorName: member.displayName,
                    actorImageURL: primaryPhoto(member),
                    mediaURL: latestPhoto.previewUrl,
                    title: "a publié une nouvelle photo",
                    detail: member.locationZone ?? member.city,
                    createdAt: photoDate,
                    visit: nil,
                    reaction: nil
                ))
            } else if updatedAt > createdAt.addingTimeInterval(12 * 60 * 60) {
                items.append(CommunityActivityItem(
                    id: "profile-update-\(member.id.uuidString)-\(member.updatedAt ?? "")",
                    kind: .profileUpdate,
                    member: member,
                    actorName: member.displayName,
                    actorImageURL: primaryPhoto(member),
                    mediaURL: nil,
                    title: "a enrichi son profil",
                    detail: profileUpdateDetail(member),
                    createdAt: updatedAt,
                    visit: nil,
                    reaction: nil
                ))
            } else {
                items.append(CommunityActivityItem(
                    id: "profile-created-\(member.id.uuidString)",
                    kind: .newProfile,
                    member: member,
                    actorName: member.displayName,
                    actorImageURL: primaryPhoto(member),
                    mediaURL: primaryPhoto(member),
                    title: member.profileType == .couple
                        ? "vient de rejoindre la communauté"
                        : "vient de rejoindre Zwit",
                    detail: [member.velvetDemographicAndAgeLabel, member.locationZone ?? member.city]
                        .compactMap { $0 }
                        .joined(separator: " · "),
                    createdAt: createdAt,
                    visit: nil,
                    reaction: nil
                ))
            }
        }

        let today = Calendar.current.startOfDay(for: Date())
        for visit in plans?.venueVisits ?? [] {
            guard let profileID = visit.profileId,
                  profileID != currentProfileID,
                  eligibleProfileIDs.contains(profileID),
                  let member = store.directory?.profiles.first(where: { $0.id == profileID })
            else { continue }

            if let date = visit.visitDate.profileOutingDateValue, date < today { continue }
            items.append(CommunityActivityItem(
                id: "outing-\(visit.id.uuidString)",
                kind: .outing,
                member: member,
                actorName: member.displayName,
                actorImageURL: primaryPhoto(member),
                mediaURL: nil,
                title: member.attendanceThirdPersonLabel.lowercased(),
                detail: "\(visit.venueDirectory?.name ?? "Établissement Zwit") · \(visit.visitDate.profileOutingDateLabel)",
                createdAt: CommunityDate.parse(visit.updatedAt ?? visit.createdAt),
                visit: visit,
                reaction: nil
            ))
        }

        for notification in store.notificationFeed.notifications where
            notification.eventType == "reactions" && notification.entityType == "photo" {
            let actor = notification.actorProfileId.flatMap { actorID in
                store.directory?.profiles.first(where: { $0.id == actorID })
            }
            items.append(CommunityActivityItem(
                id: "reaction-\(notification.id.uuidString)",
                kind: .photoReaction,
                member: actor,
                actorName: notification.metadata?.actorName ?? actor?.displayName ?? "Un membre Zwit",
                actorImageURL: notification.actorPreviewUrl ?? actor.flatMap(primaryPhoto),
                mediaURL: notification.entityPreviewUrl,
                title: reactionTitle(notification.metadata?.reaction),
                detail: notification.body,
                createdAt: CommunityDate.parse(notification.createdAt),
                visit: nil,
                reaction: notification.metadata?.reaction
            ))
        }

        for activity in intelligence?.followedActivities ?? [] {
            guard !items.contains(where: { $0.id == "followed-\(activity.id)" }) else { continue }
            let member = activity.profileId.flatMap { profileID in
                store.directory?.profiles.first(where: { $0.id == profileID })
            }
            items.append(CommunityActivityItem(
                id: "followed-\(activity.id)",
                kind: activity.type == "recommendation" ? .recommendation : .community,
                member: member,
                actorName: activity.profileName ?? member?.displayName ?? "La communauté Zwit",
                actorImageURL: activity.previewUrl ?? member.flatMap(primaryPhoto),
                mediaURL: activity.type == "photo" ? activity.previewUrl : nil,
                title: activityTitle(activity),
                detail: activity.detail,
                createdAt: CommunityDate.parse(activity.createdAt),
                visit: nil,
                reaction: nil
            ))
        }

        var seen = Set<String>()
        return items
            .sorted { $0.createdAt > $1.createdAt }
            .filter { seen.insert($0.id).inserted }
            .prefix(40)
            .map { $0 }
    }

    var body: some View {
        ZStack {
            VelvetBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    communityHeader
                    recommendationsSection
                    communityFeed
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 34)
            }
            .refreshable { await load() }

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
            await load()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(45))
                guard !Task.isCancelled else { return }
                await refreshSilently()
            }
        }
    }

    private var communityHeader: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("BONJOUR \(greetingName.uppercased())")
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1.7)
                .foregroundStyle(VelvetColor.champagneGold)

            Text("Votre communauté")
                .font(VelvetTypography.title(size: 38))
                .foregroundStyle(VelvetColor.ivory)

            Text("Les profils qui vous correspondent et ce qui se passe réellement autour de vous.")
                .font(VelvetTypography.body(size: 13))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineSpacing(3)

            if let preferences = intelligence?.preferences {
                Label(
                    preferences.locationEnabled
                        ? "Actualité personnalisée dans un rayon de \(preferences.radiusKm) km"
                        : "Actualité personnalisée selon vos affinités",
                    systemImage: preferences.locationEnabled ? "location.fill" : "sparkles"
                )
                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
                .padding(.horizontal, 11)
                .frame(height: 34)
                .background(VelvetColor.champagneGold.opacity(0.07))
                .clipShape(Capsule())
            }

            if let loadIssue {
                Text(loadIssue)
                    .font(VelvetTypography.caption(size: 9))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(2)
            }
        }
    }

    private var recommendationsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(
                "À découvrir",
                detail: "Sélection Zwit Intelligence"
            )

            if recommendedProfiles.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "person.2",
                    title: "La sélection se prépare",
                    message: "Les nouveaux profils et recommandations personnalisées apparaîtront ici."
                )
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(recommendedProfiles) { candidate in
                            recommendationLink(candidate)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private var communityFeed: some View {
        VStack(alignment: .leading, spacing: 14) {
            sectionHeader(
                "Actualité",
                detail: "Autour de vous"
            )

            if feedItems.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "rectangle.stack.badge.person.crop",
                    title: "L’actualité va prendre vie",
                    message: "Nouvelles photos, sorties, mises à jour de profils et réactions apparaîtront ici."
                )
            } else {
                LazyVStack(spacing: 14) {
                    ForEach(feedItems) { item in
                        activityLink(item)
                    }
                }
            }
        }
    }

    private func sectionHeader(_ title: String, detail: String) -> some View {
        HStack(alignment: .lastTextBaseline) {
            Text(title)
                .font(VelvetTypography.title(size: 28))
                .foregroundStyle(VelvetColor.ivory)
            Spacer()
            Text(detail.uppercased())
                .font(VelvetTypography.caption(size: 8, weight: .semibold))
                .tracking(1.05)
                .foregroundStyle(VelvetColor.champagneGold)
                .multilineTextAlignment(.trailing)
        }
    }

    @ViewBuilder
    private func recommendationLink(_ candidate: IntelligentProfile) -> some View {
        if let member = store.directory?.profiles.first(where: { $0.id == candidate.id }) {
            NavigationLink {
                MemberDetailView(profile: member)
            } label: {
                CommunityRecommendationCard(candidate: candidate)
            }
            .buttonStyle(.plain)
        } else {
            CommunityRecommendationCard(candidate: candidate)
                .opacity(0.70)
        }
    }

    @ViewBuilder
    private func activityLink(_ item: CommunityActivityItem) -> some View {
        if item.kind == .outing {
            NavigationLink {
                CommunityAttendanceDirectoryView(currentProfile: profile)
            } label: {
                CommunityActivityCard(item: item)
            }
            .buttonStyle(.plain)
        } else if let member = item.member {
            NavigationLink {
                MemberDetailView(profile: member)
            } label: {
                CommunityActivityCard(item: item)
            }
            .buttonStyle(.plain)
        } else {
            CommunityActivityCard(item: item)
        }
    }

    private func primaryPhoto(_ member: MemberProfile) -> URL? {
        member.profileGalleryPhotos.first(where: { $0.isPrimary == true })?.previewUrl
            ?? member.profileGalleryPhotos.first?.previewUrl
    }

    private func profileUpdateDetail(_ member: MemberProfile) -> String {
        let values = [
            member.practices?.first,
            member.valuesList?.first,
            member.locationZone ?? member.city
        ].compactMap { $0 }.filter { !$0.isEmpty }
        return values.isEmpty
            ? "De nouvelles informations sont disponibles sur sa fiche."
            : values.joined(separator: " · ")
    }

    private func reactionTitle(_ reaction: String?) -> String {
        switch reaction {
        case "love": "a adoré votre photo"
        case "adore": "a eu un coup de cœur pour votre photo"
        default: "a aimé votre photo"
        }
    }

    private func activityTitle(_ activity: FollowedActivity) -> String {
        switch activity.type {
        case "photo": "a publié une nouvelle photo"
        case "event": "a publié une nouvelle sortie"
        case "recommendation": "a partagé une recommandation"
        default: activity.title
        }
    }

    @MainActor
    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        loadIssue = nil
        defer { isLoading = false }

        if store.directory == nil { await store.load() }
        do {
            intelligence = try await store.service.homeIntelligence()
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

private enum CommunityActivityKind {
    case newProfile
    case photo
    case profileUpdate
    case outing
    case photoReaction
    case recommendation
    case community
}

private struct CommunityActivityItem: Identifiable {
    let id: String
    let kind: CommunityActivityKind
    let member: MemberProfile?
    let actorName: String
    let actorImageURL: URL?
    let mediaURL: URL?
    let title: String
    let detail: String?
    let createdAt: Date
    let visit: VenueVisit?
    let reaction: String?
}

private struct CommunityRecommendationCard: View {
    let candidate: IntelligentProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                VelvetRemoteImage(url: candidate.photoUrl, symbol: candidate.profileType == "couple" ? "person.2.fill" : "person.fill")
                    .frame(width: 178, height: 220)
                    .clipped()

                Text("\(candidate.compatibilityScore)%")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .padding(.horizontal, 9)
                    .frame(height: 29)
                    .background(.ultraThinMaterial)
                    .background(.black.opacity(0.30))
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

            Text(distanceLabel)
                .font(VelvetTypography.caption(size: 9))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineLimit(1)
        }
        .frame(width: 178, alignment: .leading)
    }

    private var distanceLabel: String {
        if let distance = candidate.distanceKm {
            return "\(distance.formatted(.number.precision(.fractionLength(0...1)))) km · \(candidate.locationZone ?? "Zone privée")"
        }
        return candidate.locationZone ?? "À découvrir"
    }
}

private struct CommunityActivityCard: View {
    let item: CommunityActivityItem

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 11) {
                VelvetRemoteImage(
                    url: item.actorImageURL,
                    symbol: item.member?.profileType == .couple ? "person.2.fill" : "person.fill"
                )
                .frame(width: 47, height: 47)
                .clipShape(Circle())
                .overlay(Circle().stroke(VelvetColor.champagneGold.opacity(0.22), lineWidth: 0.8))

                VStack(alignment: .leading, spacing: 3) {
                    Text(item.actorName)
                        .font(VelvetTypography.body(size: 13, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    Text(item.title)
                        .font(VelvetTypography.body(size: 11))
                        .foregroundStyle(VelvetColor.textSecondary)
                }

                Spacer()

                Text(CommunityDate.relative(item.createdAt))
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .multilineTextAlignment(.trailing)
            }

            if let mediaURL = item.mediaURL {
                ZStack(alignment: .bottomTrailing) {
                    VelvetRemoteImage(url: mediaURL, symbol: "photo")
                        .frame(maxWidth: .infinity)
                        .frame(height: 315)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

                    if item.kind == .photoReaction {
                        Label(reactionLabel, systemImage: reactionSymbol)
                            .font(VelvetTypography.caption(size: 10, weight: .semibold))
                            .foregroundStyle(VelvetColor.ivory)
                            .padding(.horizontal, 11)
                            .frame(height: 35)
                            .background(.ultraThinMaterial)
                            .background(VelvetColor.velvetBurgundy.opacity(0.55))
                            .clipShape(Capsule())
                            .padding(12)
                    }
                }
            }

            if let visit = item.visit {
                HStack(spacing: 12) {
                    Image(systemName: "calendar.badge.clock")
                        .foregroundStyle(VelvetColor.champagneGold)
                        .frame(width: 42, height: 42)
                        .background(VelvetColor.champagneGold.opacity(0.08))
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 3) {
                        Text(visit.venueDirectory?.name ?? "Établissement Zwit")
                            .font(VelvetTypography.body(size: 13, weight: .semibold))
                            .foregroundStyle(VelvetColor.ivory)
                            .lineLimit(1)
                        Text(visit.visitDate.profileOutingDateLabel)
                            .font(VelvetTypography.caption(size: 9, weight: .semibold))
                            .foregroundStyle(VelvetColor.champagneGold)
                    }

                    Spacer()
                    Text("VOIR QUI Y SERA")
                        .font(VelvetTypography.caption(size: 7, weight: .semibold))
                        .tracking(0.8)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
                .padding(12)
                .background(VelvetColor.champagneGold.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
            } else if let detail = item.detail, !detail.isEmpty {
                Text(detail)
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineSpacing(3)
                    .lineLimit(3)
            }
        }
        .padding(15)
        .background(.ultraThinMaterial)
        .background(VelvetColor.panelRaised.opacity(0.66))
        .clipShape(RoundedRectangle(cornerRadius: 23, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 23, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
        }
    }

    private var reactionLabel: String {
        switch item.reaction {
        case "love": "Adore"
        case "adore": "Coup de cœur"
        default: "J’aime"
        }
    }

    private var reactionSymbol: String {
        switch item.reaction {
        case "love": "heart.fill"
        case "adore": "sparkles"
        default: "hand.thumbsup.fill"
        }
    }
}

private enum CommunityDate {
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
        formatter.locale = Locale(identifier: "fr_FR")
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: .now)
    }
}
