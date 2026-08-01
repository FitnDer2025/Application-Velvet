import SwiftUI

struct IntelligentPlacesEventsView: View {
    @EnvironmentObject private var store: VelvetStore
    @State private var selection: Int
    @State private var intelligence: HomeIntelligenceResponse?
    @State private var showsCreator = false
    @State private var clubQuery = ""
    @State private var clubKind = "all"
    @State private var frequentedOnly = false
    @State private var isLoading = false

    init(initialSelection: Int = 0) {
        _selection = State(initialValue: initialSelection)
    }

    private var events: [IntelligentEvent] {
        let source = intelligence?.nearbyEvents ?? []
        return selection == 2 ? source.filter(\.isCapDAgde) : source.filter { !$0.isCapDAgde }
    }

    private var clubs: [IntelligentClub] {
        (intelligence?.nearbyClubs ?? []).filter { club in
            let matchesQuery = clubQuery.isEmpty
                || club.name.localizedCaseInsensitiveContains(clubQuery)
                || (club.city ?? "").localizedCaseInsensitiveContains(clubQuery)
            let kind = "\(club.kind ?? "") \(club.categoryPrimary ?? "")".lowercased()
            let matchesKind = clubKind == "all" || kind.contains(clubKind)
            let matchesFrequented = !frequentedOnly || club.frequented
            return matchesQuery && matchesKind && matchesFrequented
        }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(alignment: .top) {
                        VelvetPageHeader(
                            "Agenda intelligent",
                            title: "Sorties & clubs",
                            subtitle: "Agendas ouverts dans votre rayon ou publiés par les clubs que vous fréquentez."
                        )
                        Spacer(minLength: 8)
                        Button { showsCreator = true } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(VelvetColor.velvetBlack)
                                .frame(width: 42, height: 42)
                                .background(VelvetColor.champagneGold)
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Créer une sortie")
                    }

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            VelvetChip(title: "Sorties", selected: selection == 0) { selection = 0 }
                            VelvetChip(title: "Clubs", selected: selection == 1) { selection = 1 }
                            VelvetChip(title: "Cap d’Agde", selected: selection == 2) { selection = 2 }
                            VelvetChip(title: "Mon agenda", selected: selection == 3) { selection = 3 }
                        }
                    }

                    content
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .refreshable { await load() }

            if isLoading {
                ProgressView()
                    .tint(VelvetColor.champagneGold)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .sheet(isPresented: $showsCreator, onDismiss: { Task { await load() } }) {
            EventCreationView(initialCategory: selection == 2 ? "cap_dagde" : "standard")
        }
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        switch selection {
        case 0, 2:
            eventsContent
        case 1:
            clubsContent
        default:
            AgendaView()
        }
    }

    @ViewBuilder
    private var eventsContent: some View {
        if events.isEmpty {
            VelvetEmptyState(
                symbol: selection == 2 ? "sun.max" : "calendar.badge.plus",
                title: selection == 2 ? "Aucun séjour au Cap publié" : "Aucune sortie proche",
                message: "Créez une sortie ou augmentez votre rayon dans les préférences de proximité."
            )
        } else {
            LazyVStack(spacing: 12) {
                ForEach(events) { event in
                    NavigationLink {
                        IntelligentEventDetailView(event: event)
                    } label: {
                        IntelligentEventRow(event: event)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var clubsContent: some View {
        VStack(alignment: .leading, spacing: 13) {
            VelvetSearchField(prompt: "Nom du club ou ville…", text: $clubQuery)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    clubFilter("Tous", value: "all")
                    clubFilter("Clubs", value: "club")
                    clubFilter("Spas", value: "spa")
                    clubFilter("Bars", value: "bar")
                    VelvetChip(title: "Fréquentés", selected: frequentedOnly) {
                        frequentedOnly.toggle()
                    }
                }
            }

            if clubs.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "building.2",
                    title: "Aucun club correspondant",
                    message: "Élargissez le rayon, la ville ou le type d’établissement."
                )
            } else {
                LazyVStack(spacing: 12) {
                    ForEach(clubs) { club in
                        if let venue = store.directory?.venueDirectory.first(where: { $0.id == club.id }) {
                            NavigationLink { VenueDetailView(venue: venue) } label: {
                                IntelligentClubRow(club: club)
                            }
                            .buttonStyle(.plain)
                        } else {
                            IntelligentClubRow(club: club)
                        }
                    }
                }
            }
        }
    }

    private func clubFilter(_ title: String, value: String) -> some View {
        VelvetChip(title: title, selected: clubKind == value) { clubKind = value }
    }

    @MainActor
    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            intelligence = try await store.service.homeIntelligence()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

struct IntelligentEventDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    let event: IntelligentEvent

    @State private var details: EventDetailsResponse?
    @State private var isWorking = false
    @State private var isLoading = true

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VelvetPageHeader(
                        event.isCapDAgde ? "Destination signature" : "Événement Velvet",
                        title: event.title,
                        subtitle: event.startsAt.velvetDateLabel
                    )

                    VelvetCard {
                        VStack(alignment: .leading, spacing: 13) {
                            Label(event.locationPublic ?? "Lieu privé", systemImage: "mappin.and.ellipse")
                                .foregroundStyle(VelvetColor.champagneGold)
                            if event.isCapDAgde {
                                Label(event.capZone ?? "Ensemble du village", systemImage: "sun.max.fill")
                                    .foregroundStyle(VelvetColor.softBlush)
                                if let venue = event.capVenue, !venue.isEmpty {
                                    Label(venue, systemImage: "building.2")
                                        .foregroundStyle(VelvetColor.ivory)
                                }
                            }
                            Text(event.description ?? "Les détails seront communiqués par l’organisateur.")
                                .font(VelvetTypography.body(size: 14))
                                .foregroundStyle(VelvetColor.textSecondary)
                                .lineSpacing(4)
                            HStack {
                                Label("\(details?.registrationCount ?? 0) participant\((details?.registrationCount ?? 0) > 1 ? "s" : "")", systemImage: "person.2.fill")
                                Spacer()
                                if let distance = event.distanceKm {
                                    Label("\(distance.formatted(.number.precision(.fractionLength(0...1)))) km", systemImage: "location")
                                }
                            }
                            .font(VelvetTypography.caption(size: 10, weight: .semibold))
                            .foregroundStyle(VelvetColor.champagneGold)
                        }
                    }

                    participationButton
                    participantsSection
                }
                .padding(20)
                .padding(.bottom, 30)
            }

            if isLoading {
                ProgressView().tint(VelvetColor.champagneGold)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    @ViewBuilder
    private var participationButton: some View {
        if details?.myRegistration != nil {
            VelvetPrimaryButton("Participation enregistrée", isDisabled: true) {}
        } else if event.registrationOpen == true {
            VelvetPrimaryButton("Je participe", isLoading: isWorking) {
                Task { await register() }
            }
        }
    }

    private var participantsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Participants visibles")
                .font(VelvetTypography.title(size: 26))
                .foregroundStyle(VelvetColor.ivory)
            Text("Seuls les membres ayant choisi d’apparaître sont affichés.")
                .font(VelvetTypography.body(size: 11))
                .foregroundStyle(VelvetColor.textSecondary)

            if details?.participants.isEmpty != false {
                VelvetCompactEmptyState(
                    symbol: "person.2",
                    title: "Aucun participant visible",
                    message: "Les profils apparaîtront après leur inscription et avec leur accord."
                )
            } else {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
                    spacing: 10
                ) {
                    ForEach(details?.participants ?? []) { participant in
                        NavigationLink {
                            MemberDetailView(profile: participant.profile)
                        } label: {
                            EventParticipantCard(profile: participant.profile)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    @MainActor
    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            details = try await store.service.eventDetails(id: event.id)
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func register() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await store.service.register(eventID: event.id)
            await load()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

struct EventCreationView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var category: String
    @State private var title = ""
    @State private var description = ""
    @State private var locationPublic = ""
    @State private var startsAt = Date().addingTimeInterval(24 * 3600)
    @State private var endsAt = Date().addingTimeInterval(28 * 3600)
    @State private var capacity = 20
    @State private var audience = "Membres Velvet admis"
    @State private var dressCode = ""
    @State private var capZone = "Ensemble du village"
    @State private var capVenue = ""
    @State private var isPublishing = false

    init(initialCategory: String = "standard") {
        _category = State(initialValue: initialCategory)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VelvetPageHeader(
                            "Publication membre",
                            title: category == "cap_dagde" ? "Séjour au Cap d’Agde" : "Créer une sortie",
                            subtitle: "Velvet contrôle automatiquement la cohérence et la sécurité avant publication."
                        )

                        Picker("Type", selection: $category) {
                            Text("Sortie").tag("standard")
                            Text("Cap d’Agde").tag("cap_dagde")
                        }
                        .pickerStyle(.segmented)

                        VelvetField(title: "Titre", prompt: "Nom de la sortie", text: $title, contentType: nil)
                        creationTextArea("Présentation", text: $description, prompt: "Décrivez l’ambiance, le programme et les conditions de participation…")
                        VelvetField(title: "Lieu public", prompt: "Ville, club ou zone générale", text: $locationPublic, contentType: nil)

                        DatePicker("Début", selection: $startsAt, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                            .tint(VelvetColor.champagneGold)
                        DatePicker("Fin", selection: $endsAt, in: startsAt..., displayedComponents: [.date, .hourAndMinute])
                            .tint(VelvetColor.champagneGold)
                        Stepper("Capacité : \(capacity)", value: $capacity, in: 2...500)

                        VelvetField(title: "Public", prompt: "Membres Velvet admis", text: $audience, contentType: nil)
                        VelvetField(title: "Dress code", prompt: "Facultatif", text: $dressCode, contentType: nil)

                        if category == "cap_dagde" {
                            Picker("Zone du village", selection: $capZone) {
                                ForEach(Self.capZones, id: \.self) { Text($0).tag($0) }
                            }
                            .pickerStyle(.menu)
                            .tint(VelvetColor.champagneGold)
                            VelvetField(title: "Résidence ou établissement", prompt: "Facultatif", text: $capVenue, contentType: nil)
                        }

                        Label(
                            "Velvet Intelligence peut publier automatiquement une annonce sûre. Les situations incertaines restent soumises à une validation humaine.",
                            systemImage: "checkmark.shield"
                        )
                        .font(VelvetTypography.caption(size: 11))
                        .foregroundStyle(VelvetColor.textSecondary)

                        VelvetPrimaryButton(
                            "Publier la sortie",
                            isLoading: isPublishing,
                            isDisabled: title.count < 4 || description.count < 20 || locationPublic.isEmpty
                        ) {
                            Task { await publish() }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Nouvelle sortie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Annuler", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
        }
    }

    private func creationTextArea(_ title: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title.uppercased())
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1.1)
                .foregroundStyle(VelvetColor.champagneGold)
            TextEditor(text: text)
                .frame(minHeight: 140)
                .padding(10)
                .scrollContentBackground(.hidden)
                .background(VelvetColor.ivory.opacity(0.04))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if text.wrappedValue.isEmpty {
                        Text(prompt)
                            .font(VelvetTypography.body(size: 13))
                            .foregroundStyle(VelvetColor.textSecondary)
                            .padding(16)
                            .allowsHitTesting(false)
                    }
                }
        }
    }

    @MainActor
    private func publish() async {
        isPublishing = true
        defer { isPublishing = false }
        do {
            let result = try await appState.session.createEvent(
                title: title,
                description: description,
                startsAt: startsAt,
                endsAt: endsAt,
                locationPublic: locationPublic,
                capacity: capacity,
                audience: audience,
                dressCode: dressCode.isEmpty ? nil : dressCode,
                category: category,
                capZone: category == "cap_dagde" ? capZone : nil,
                capVenue: category == "cap_dagde" && !capVenue.isEmpty ? capVenue : nil
            )
            appState.alertMessage = result.publicationStatus == "review"
                ? "La sortie est enregistrée et attend une validation humaine."
                : "La sortie est publiée dans Velvet."
            dismiss()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    private static let capZones = [
        "Ensemble du village", "Port Nature", "Héliopolis", "Port Ambonne",
        "Port Soleil", "Le Môle", "Plage naturiste"
    ]
}

private struct IntelligentEventRow: View {
    let event: IntelligentEvent

    var body: some View {
        HStack(spacing: 14) {
            VStack(spacing: 2) {
                Image(systemName: event.isCapDAgde ? "sun.max.fill" : "calendar")
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(event.startsAt.velvetDateLabel)
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(VelvetColor.ivory)
            }
            .frame(width: 64, height: 70)
            .background(VelvetColor.velvetBurgundy.opacity(0.20))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            VStack(alignment: .leading, spacing: 5) {
                Text(event.title)
                    .font(VelvetTypography.body(size: 15, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(2)
                Text(event.locationPublic ?? "Lieu privé")
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(1)
                if let distance = event.distanceKm {
                    Text("À \(distance.formatted(.number.precision(.fractionLength(0...1)))) km")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.champagneGold)
        }
        .padding(14)
        .background(VelvetColor.panelRaised.opacity(0.70))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(VelvetColor.borderSubtle, lineWidth: 0.8))
    }
}

private struct IntelligentClubRow: View {
    let club: IntelligentClub

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "building.2.fill")
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 48, height: 48)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(club.name)
                        .font(VelvetTypography.body(size: 15, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    if club.verificationStatus == "verified" {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                }
                Text([club.categoryPrimary ?? club.kind, club.city].compactMap { $0 }.joined(separator: " · "))
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(club.frequented
                     ? "Établissement fréquenté"
                     : club.distanceKm.map { "À \($0.formatted(.number.precision(.fractionLength(0...1)))) km" } ?? "Distance à confirmer")
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            Spacer()
        }
        .padding(15)
        .background(VelvetColor.panelRaised.opacity(0.70))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(VelvetColor.borderSubtle, lineWidth: 0.8))
    }
}

private struct EventParticipantCard: View {
    let profile: MemberProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            VelvetRemoteImage(url: profile.profileGalleryPhotos.first?.previewUrl, symbol: "person.fill")
                .frame(maxWidth: .infinity)
                .frame(height: 170)
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
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
