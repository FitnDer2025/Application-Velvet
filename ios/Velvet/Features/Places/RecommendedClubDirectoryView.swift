import SwiftUI

struct RecommendedClubDirectoryView: View {
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
                        subtitle: "Les soirées, les présences annoncées et les recommandations validées par chaque établissement."
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
                        Text("LIEUX & AVIS VALIDÉS")
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
                                    RecommendedVenueDetailView(venue: venue)
                                } label: {
                                    venueRow(venue)
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

    private func venueRow(_ venue: Venue) -> some View {
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
                guard let id = visit.profileId, seen.insert(id).inserted else { return nil }
                return store.directory?.profiles.first(where: { $0.id == id })
            }
    }

    @MainActor
    private func load() async {
        if store.directory == nil { await store.load() }
        plans = try? await store.service.plans()
    }
}

struct RecommendedVenueDetailView: View {
    let venue: Venue
    @State private var selectedTab = "venue"

    var body: some View {
        VStack(spacing: 0) {
            tabs
            if selectedTab == "recommendations" {
                VenueRecommendationsView(venue: venue)
            } else {
                SocialVenueDetailView(venue: venue)
            }
        }
        .background(VelvetBackground())
        .navigationTitle(venue.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var tabs: some View {
        HStack(spacing: 5) {
            tab("Établissement", value: "venue", icon: "building.2")
            tab("Avis", value: "recommendations", icon: "quote.bubble")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(VelvetColor.velvetBlack.opacity(0.92))
        .overlay(alignment: .bottom) {
            Rectangle().fill(VelvetColor.borderSubtle).frame(height: 0.7)
        }
    }

    private func tab(_ title: String, value: String, icon: String) -> some View {
        Button {
            withAnimation(.easeOut(duration: VelvetMotion.fast)) {
                selectedTab = value
            }
        } label: {
            Label(title, systemImage: icon)
                .font(VelvetTypography.body(size: 11, weight: .semibold))
                .foregroundStyle(selectedTab == value ? VelvetColor.champagneGold : VelvetColor.textSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .background(selectedTab == value ? VelvetColor.champagneGold.opacity(0.09) : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .stroke(
                            selectedTab == value
                                ? VelvetColor.champagneGold.opacity(0.20)
                                : VelvetColor.borderSubtle,
                            lineWidth: 0.7
                        )
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selectedTab == value ? .isSelected : [])
    }
}
