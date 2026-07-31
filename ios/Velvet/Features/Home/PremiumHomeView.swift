import SwiftUI

struct PremiumHomeView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    private var profiles: [MemberProfile] {
        (store.directory?.profiles ?? []).filter { $0.id != profile.id }
    }

    private var events: [VelvetEvent] { store.directory?.events ?? [] }
    private var establishments: [Establishment] { store.directory?.establishments ?? [] }
    private var venues: [Venue] { store.directory?.venueDirectory ?? [] }
    private var placeCount: Int { establishments.count + venues.count }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 32) {
                    VelvetPageHeader(
                        "Votre espace privé",
                        title: "Bonjour \(profile.displayName)",
                        subtitle: "Une sélection calme et personnelle, pensée autour de ce qui mérite vraiment ton attention."
                    )
                    if !profile.isAdmitted { admissionBanner }
                    overviewCard
                    curatedSection
                    shortcuts
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 34)
            }
            .refreshable { await store.load() }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var overviewCard: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("EN UN COUP D’ŒIL")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.8)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text("Ton univers aujourd’hui")
                        .font(VelvetTypography.title(size: 27))
                        .foregroundStyle(VelvetColor.ivory)
                }
                Spacer()
                Image(systemName: "sparkles")
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 42, height: 42)
                    .background(VelvetColor.champagneGold.opacity(0.08))
                    .clipShape(Circle())
            }
            HStack(alignment: .top, spacing: 0) {
                metric(profiles.count, title: "Profils", detail: "à découvrir")
                divider
                metric(events.count, title: "Sorties", detail: "à venir")
                divider
                metric(placeCount, title: "Lieux", detail: "et pros")
            }
        }
        .padding(22)
        .background {
            ZStack {
                LinearGradient(
                    colors: [VelvetColor.panelRaised, VelvetColor.anthracite],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                RadialGradient(
                    colors: [VelvetColor.velvetBurgundy.opacity(0.28), .clear],
                    center: .topTrailing,
                    startRadius: 10,
                    endRadius: 280
                )
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 30).stroke(.white.opacity(0.09)) }
        .shadow(color: .black.opacity(0.34), radius: 30, y: 16)
    }

    private func metric(_ value: Int, title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("\(value)")
                .font(VelvetTypography.title(size: 35))
                .foregroundStyle(VelvetColor.ivory)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(VelvetTypography.body(size: 12, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
            Text(detail)
                .font(VelvetTypography.caption(size: 10))
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var divider: some View {
        Rectangle()
            .fill(VelvetColor.borderSubtle)
            .frame(width: 1, height: 72)
            .padding(.horizontal, 10)
    }

    private var curatedSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionHeader("Pour toi", detail: "Sélection Velvet")
            if profiles.isEmpty && events.isEmpty && establishments.isEmpty && venues.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "sparkles",
                    title: "Ton univers se prépare",
                    message: "Les nouvelles rencontres, sorties et adresses apparaîtront ici dès leur publication."
                )
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 14) {
                        ForEach(Array(profiles.prefix(2))) { candidate in
                            NavigationLink {
                                MemberDetailView(profile: candidate)
                            } label: {
                                PremiumHomeProfileCard(profile: candidate)
                            }
                            .buttonStyle(.plain)
                        }
                        if let event = events.first {
                            NavigationLink { PlacesEventsView(initialSelection: 0) } label: {
                                PremiumHomeEditorialCard(
                                    eyebrow: "PROCHAINE SORTIE",
                                    title: event.title,
                                    detail: event.startsAt.velvetDateLabel,
                                    symbol: "sparkles"
                                )
                            }
                            .buttonStyle(.plain)
                        }
                        if let place = establishments.first {
                            NavigationLink { PlacesEventsView(initialSelection: 1) } label: {
                                PremiumHomeEditorialCard(
                                    eyebrow: (place.kind ?? "ÉTABLISSEMENT").uppercased(),
                                    title: place.name,
                                    detail: place.city ?? "Adresse privée",
                                    symbol: "building.2"
                                )
                            }
                            .buttonStyle(.plain)
                        } else if let venue = venues.first {
                            NavigationLink { PlacesEventsView(initialSelection: 2) } label: {
                                PremiumHomeEditorialCard(
                                    eyebrow: (venue.categoryPrimary ?? venue.kind ?? "LIEU VELVET").uppercased(),
                                    title: venue.name,
                                    detail: venue.city ?? "Adresse privée",
                                    symbol: "mappin.and.ellipse"
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 2)
                }
                .contentMargins(.horizontal, 1)
            }
        }
    }

    private var shortcuts: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionHeader("À portée de main", detail: "Explorer")
            NavigationLink { PlacesEventsView(initialSelection: 0) } label: {
                shortcutRow(
                    "Sorties à venir",
                    detail: events.isEmpty ? "Découvrir l’agenda Velvet" : "\(events.count) rendez-vous publié\(events.count > 1 ? "s" : "")",
                    icon: "calendar",
                    color: VelvetColor.champagneGold
                )
            }
            .buttonStyle(.plain)
            NavigationLink { PlacesEventsView(initialSelection: 1) } label: {
                shortcutRow(
                    "Clubs & professionnels",
                    detail: placeCount == 0 ? "Explorer les adresses validées" : "\(placeCount) adresse\(placeCount > 1 ? "s" : "") à découvrir",
                    icon: "building.2",
                    color: VelvetColor.softBlush
                )
            }
            .buttonStyle(.plain)
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
                .tracking(1.3)
                .foregroundStyle(VelvetColor.champagneGold)
        }
    }

    private func shortcutRow(_ title: String, detail: String, icon: String, color: Color) -> some View {
        HStack(spacing: 15) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 46, height: 46)
                .background(color.opacity(0.08))
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
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .padding(16)
        .background(VelvetColor.ivory.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: VelvetRadius.large).stroke(VelvetColor.borderSubtle) }
    }

    private var admissionBanner: some View {
        HStack(spacing: 14) {
            Image(systemName: "hourglass")
                .foregroundStyle(VelvetColor.warning)
                .frame(width: 38, height: 38)
                .background(VelvetColor.warning.opacity(0.10))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text("Profil en cours d’admission")
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text("L’espace complet s’ouvrira après validation par Velvet.")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VelvetColor.warning.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: VelvetRadius.large).stroke(VelvetColor.warning.opacity(0.22)) }
    }
}
