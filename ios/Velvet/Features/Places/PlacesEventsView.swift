import SwiftUI

struct PlacesEventsView: View {
    @EnvironmentObject private var store: VelvetStore
    @State private var selection: Int

    init(initialSelection: Int = 0) {
        _selection = State(initialValue: initialSelection)
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VelvetPageHeader(
                        "Agenda réel",
                        title: "Sorties",
                        subtitle: "Les événements et établissements effectivement publiés dans Velvet."
                    )

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 9) {
                            VelvetChip(title: "Événements", selected: selection == 0) { selection = 0 }
                            VelvetChip(title: "Clubs & pros", selected: selection == 1) { selection = 1 }
                            VelvetChip(title: "Lieux", selected: selection == 2) { selection = 2 }
                            VelvetChip(title: "Mon agenda", selected: selection == 3) { selection = 3 }
                        }
                    }

                    if store.directory?.locked == true {
                        LockedDirectoryView()
                    } else {
                        content
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 30)
            }
            .refreshable { await store.load() }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }

    @ViewBuilder
    private var content: some View {
        switch selection {
        case 0:
            let events = store.directory?.events ?? []
            if events.isEmpty {
                VelvetEmptyState(
                    symbol: "sparkles",
                    title: "Aucune sortie publiée",
                    message: "Les prochaines soirées apparaîtront après leur publication par un organisateur validé."
                )
            } else {
                LazyVStack(spacing: 14) {
                    ForEach(events) { event in
                        NavigationLink {
                            EventDetailView(event: event)
                        } label: {
                            EventTile(event: event)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        case 1:
            let establishments = store.directory?.establishments ?? []
            if establishments.isEmpty {
                VelvetEmptyState(
                    symbol: "building.2",
                    title: "Aucun professionnel publié",
                    message: "Les clubs et professionnels validés apparaîtront dans cet espace."
                )
            } else {
                LazyVStack(spacing: 14) {
                    ForEach(establishments) { place in
                        PlaceTile(
                            name: place.name,
                            metadata: [place.kind, place.city].compactMap { $0 }.joined(separator: " · "),
                            detail: place.description,
                            verified: place.verifiedAt != nil
                        )
                    }
                }
            }
        case 2:
            let venues = store.directory?.venueDirectory ?? []
            if venues.isEmpty {
                VelvetEmptyState(
                    symbol: "mappin.and.ellipse",
                    title: "Aucun lieu référencé",
                    message: "Modifie ta zone ou reviens lorsque le répertoire aura été enrichi."
                )
            } else {
                LazyVStack(spacing: 14) {
                    ForEach(venues) { venue in
                        NavigationLink {
                            VenueDetailView(venue: venue)
                        } label: {
                            PlaceTile(
                                name: venue.name,
                                metadata: [venue.categoryPrimary ?? venue.kind, venue.city]
                                    .compactMap { $0 }
                                    .joined(separator: " · "),
                                detail: venue.verificationStatus == "verified"
                                    ? "Fiche professionnelle reliée à Velvet"
                                    : "Référencé par Velvet · informations à confirmer",
                                verified: venue.verificationStatus == "verified"
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        default:
            AgendaView()
        }
    }
}

private struct EventTile: View {
    let event: VelvetEvent

    private var date: Date? {
        ISO8601DateFormatter().date(from: event.startsAt)
    }

    var body: some View {
        HStack(spacing: 16) {
            VStack(spacing: 1) {
                Text(date?.formatted(.dateTime.day(.twoDigits)) ?? "—")
                    .font(VelvetTypography.title(size: 28))
                    .foregroundStyle(VelvetColor.ivory)
                Text(date?.formatted(.dateTime.month(.abbreviated).locale(Locale(identifier: "fr_FR"))).uppercased() ?? "")
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            .frame(width: 56, height: 68)
            .background(VelvetColor.velvetBurgundy.opacity(0.20))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            VStack(alignment: .leading, spacing: 6) {
                Text(event.startsAt.velvetDateLabel.uppercased())
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(event.title)
                    .font(VelvetTypography.body(size: 15, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text(event.locationPublic ?? "Lieu communiqué aux inscrit·es")
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(1)
            }

            Spacer()
            Image(systemName: "arrow.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.champagneGold)
        }
        .padding(15)
        .background(VelvetColor.panelRaised.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
        }
    }
}

private struct PlaceTile: View {
    let name: String
    let metadata: String
    let detail: String?
    let verified: Bool

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "building.2")
                .font(.system(size: 18, weight: .light))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 46, height: 46)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 5) {
                    Text(name)
                        .font(VelvetTypography.body(size: 15, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    if verified {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.caption)
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                }
                Text(metadata)
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                if let detail, !detail.isEmpty {
                    Text(detail)
                        .font(VelvetTypography.body(size: 11))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .lineLimit(2)
                }
            }
            Spacer()
        }
        .padding(16)
        .background(VelvetColor.panelRaised.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
        }
    }
}

private struct EventDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    let event: VelvetEvent
    @State private var isWorking = false
    @State private var registered = false

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    VelvetPageHeader(
                        "Événement Velvet",
                        title: event.title,
                        subtitle: event.startsAt.velvetDateLabel
                    )
                    VelvetCard {
                        VStack(alignment: .leading, spacing: 14) {
                            Label(event.locationPublic ?? "Lieu privé", systemImage: "mappin.and.ellipse")
                                .foregroundStyle(VelvetColor.champagneGold)
                            Text(event.description ?? "Les détails seront communiqués par l’organisateur.")
                                .font(VelvetTypography.body(size: 15))
                                .foregroundStyle(VelvetColor.textSecondary)
                                .lineSpacing(4)
                            if let dressCode = event.dressCode, !dressCode.isEmpty {
                                Label(dressCode, systemImage: "tshirt")
                                    .foregroundStyle(VelvetColor.ivory)
                            }
                        }
                    }
                    if event.registrationOpen == true {
                        VelvetPrimaryButton(
                            registered ? "Inscription confirmée" : "Je participe",
                            isLoading: isWorking,
                            isDisabled: registered
                        ) {
                            Task { await register() }
                        }
                    }
                }
                .padding(20)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    @MainActor
    private func register() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await store.service.register(eventID: event.id)
            registered = true
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

extension String {
    var velvetDateLabel: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: self) else { return self }
        return date.formatted(
            Date.FormatStyle(date: .abbreviated, time: .shortened).locale(Locale(identifier: "fr_FR"))
        )
    }
}
