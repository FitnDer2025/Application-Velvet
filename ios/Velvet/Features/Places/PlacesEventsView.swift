import SwiftUI

struct PlacesEventsView: View {
    @EnvironmentObject private var store: VelvetStore
    @State private var selection = 0

    var body: some View {
        ZStack {
            VelvetBackground()
            VStack(spacing: 0) {
                Picker("Annuaire", selection: $selection) {
                    Text("Événements").tag(0)
                    Text("Clubs & pros").tag(1)
                    Text("Lieux").tag(2)
                }
                .pickerStyle(.segmented)
                .padding(VelvetSpacing.lg)

                if store.directory?.locked == true {
                    LockedDirectoryView()
                } else {
                    switch selection {
                    case 0: events
                    case 1: establishments
                    default: venues
                    }
                }
            }
        }
        .navigationTitle("Sorties")
        .refreshable { await store.load() }
    }

    private var events: some View {
        List(store.directory?.events ?? []) { event in
            NavigationLink {
                EventDetailView(event: event)
            } label: {
                VStack(alignment: .leading, spacing: 5) {
                    Text(event.title)
                        .font(VelvetTypography.body(size: 16, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    Label(event.locationPublic ?? "Lieu communiqué aux inscrit·es", systemImage: "mappin")
                        .font(VelvetTypography.caption())
                        .foregroundStyle(VelvetColor.textSecondary)
                    Text(event.startsAt.velvetDateLabel)
                        .font(VelvetTypography.caption(size: 11, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .listRowBackground(Color.white.opacity(0.035))
        }
        .scrollContentBackground(.hidden)
        .overlay {
            if store.directory?.events.isEmpty != false {
                ContentUnavailableView("Aucun événement publié", systemImage: "calendar")
            }
        }
    }

    private var establishments: some View {
        List(store.directory?.establishments ?? []) { place in
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(place.name)
                        .font(VelvetTypography.body(size: 16, weight: .semibold))
                    if place.verifiedAt != nil {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(VelvetColor.success)
                    }
                }
                Text([place.kind, place.city].compactMap { $0 }.joined(separator: " · "))
                    .font(VelvetTypography.caption())
                    .foregroundStyle(VelvetColor.textSecondary)
                if let description = place.description {
                    Text(description)
                        .font(VelvetTypography.caption(size: 12))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineLimit(3)
                }
            }
            .listRowBackground(Color.white.opacity(0.035))
        }
        .scrollContentBackground(.hidden)
    }

    private var venues: some View {
        List(store.directory?.venueDirectory ?? []) { venue in
            VStack(alignment: .leading, spacing: 5) {
                Text(venue.name)
                    .font(VelvetTypography.body(size: 16, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text([venue.categoryPrimary ?? venue.kind, venue.city].compactMap { $0 }.joined(separator: " · "))
                    .font(VelvetTypography.caption())
                    .foregroundStyle(VelvetColor.textSecondary)
                if let website = venue.website, let url = URL(string: website) {
                    Link("Voir le site", destination: url)
                        .font(VelvetTypography.caption(size: 12, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .listRowBackground(Color.white.opacity(0.035))
        }
        .scrollContentBackground(.hidden)
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
                VStack(alignment: .leading, spacing: VelvetSpacing.xl) {
                    VelvetSectionHeader(
                        "Événement Velvet",
                        title: event.title,
                        subtitle: event.startsAt.velvetDateLabel
                    )
                    Label(event.locationPublic ?? "Lieu privé", systemImage: "mappin.and.ellipse")
                        .foregroundStyle(VelvetColor.textSecondary)
                    Text(event.description ?? "Les détails seront communiqués par l’organisateur.")
                        .font(VelvetTypography.body())
                        .foregroundStyle(VelvetColor.ivory)
                    if let dressCode = event.dressCode, !dressCode.isEmpty {
                        Label(dressCode, systemImage: "tshirt")
                            .foregroundStyle(VelvetColor.champagneGold)
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
                .padding(VelvetSpacing.lg)
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

private extension String {
    var velvetDateLabel: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: self) else { return self }
        return date.formatted(
            Date.FormatStyle(date: .abbreviated, time: .shortened).locale(Locale(identifier: "fr_FR"))
        )
    }
}
