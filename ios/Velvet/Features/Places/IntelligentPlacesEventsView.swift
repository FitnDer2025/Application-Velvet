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
    @State private var loadIssue: String?

    init(initialSelection: Int = 0) {
        _selection = State(initialValue: initialSelection)
    }

    private var events: [IntelligentEvent] {
        let source = intelligence?.nearbyEvents ?? []
        return selection == 2 ? source.filter(\.isCapDAgde) : source.filter { !$0.isCapDAgde }
    }

    private var capZones: [String] {
        Array(Set(events.compactMap(\.capZone).filter { !$0.isEmpty })).sorted()
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
                            selection == 2 ? "Destination signature" : "Agenda intelligent",
                            title: selection == 2 ? "Cap d’Agde" : "Sorties & clubs",
                            subtitle: selection == 2
                                ? "Séjours, rencontres et rendez-vous Velvet dans le village naturiste."
                                : "Agendas ouverts dans votre rayon ou publiés par les clubs que vous fréquentez."
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
                        .accessibilityLabel(selection == 2 ? "Publier un séjour au Cap d’Agde" : "Créer une sortie")
                    }

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            VelvetChip(title: "Sorties", selected: selection == 0) { selection = 0 }
                            VelvetChip(title: "Clubs", selected: selection == 1) { selection = 1 }
                            VelvetChip(title: "Cap d’Agde", selected: selection == 2) { selection = 2 }
                            VelvetChip(title: "Mon agenda", selected: selection == 3) { selection = 3 }
                        }
                    }

                    if let loadIssue {
                        inlineSyncNotice(loadIssue)
                    }

                    content
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 30)
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
        case 0:
            eventsContent
        case 1:
            clubsContent
        case 2:
            capDAgdeContent
        default:
            AgendaView()
        }
    }

    @ViewBuilder
    private var eventsContent: some View {
        if events.isEmpty {
            VelvetEmptyState(
                symbol: "calendar.badge.plus",
                title: "Aucune sortie proche",
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

    private var capDAgdeContent: some View {
        VStack(alignment: .leading, spacing: 22) {
            CapDAgdeHero(
                stayCount: events.count,
                zoneCount: capZones.count,
                create: { showsCreator = true }
            )

            if !capZones.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("ZONES ACTIVES")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(VelvetColor.champagneGold)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(capZones, id: \.self) { zone in
                                Label(zone, systemImage: "sun.max.fill")
                                    .font(VelvetTypography.body(size: 10, weight: .semibold))
                                    .foregroundStyle(VelvetColor.ivory)
                                    .padding(.horizontal, 12)
                                    .frame(height: 38)
                                    .background(.ultraThinMaterial)
                                    .background(VelvetColor.champagneGold.opacity(0.05))
                                    .clipShape(Capsule())
                                    .overlay(Capsule().stroke(VelvetColor.champagneGold.opacity(0.18)))
                            }
                        }
                    }
                }
            }

            HStack(alignment: .lastTextBaseline) {
                Text("Séjours à venir")
                    .font(VelvetTypography.title(size: 28))
                    .foregroundStyle(VelvetColor.ivory)
                Spacer()
                Text("\(events.count) PUBLICATION\(events.count > 1 ? "S" : "")")
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1.1)
                    .foregroundStyle(VelvetColor.champagneGold)
            }

            if events.isEmpty {
                CapDAgdeEmptyPanel(create: { showsCreator = true })
            } else {
                LazyVStack(spacing: 14) {
                    ForEach(events) { event in
                        NavigationLink {
                            IntelligentEventDetailView(event: event)
                        } label: {
                            CapDAgdeEventCard(event: event)
                        }
                        .buttonStyle(.plain)
                    }
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

    private func inlineSyncNotice(_ message: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "arrow.clockwise.circle")
                .foregroundStyle(VelvetColor.champagneGold)
            VStack(alignment: .leading, spacing: 3) {
                Text("Agenda en cours d’actualisation")
                    .font(VelvetTypography.body(size: 12, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text("Les espaces restent accessibles. Tirez l’écran vers le bas pour relancer la synchronisation.")
                    .font(VelvetTypography.caption(size: 10))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            Spacer()
            Button("Réessayer") { Task { await load() } }
                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
                .accessibilityHint(message)
        }
        .padding(14)
        .background(VelvetColor.champagneGold.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(VelvetColor.champagneGold.opacity(0.18)))
    }

    private func clubFilter(_ title: String, value: String) -> some View {
        VelvetChip(title: title, selected: clubKind == value) { clubKind = value }
    }

    @MainActor
    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        loadIssue = nil
        defer { isLoading = false }
        do {
            intelligence = try await store.service.homeIntelligence()
        } catch {
            loadIssue = ErrorMessage.text(for: error)
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
                    if event.isCapDAgde {
                        CapDAgdeDetailHero(event: event)
                    } else {
                        VelvetPageHeader(
                            "Événement Velvet",
                            title: event.title,
                            subtitle: event.startsAt.velvetDateLabel
                        )
                    }

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

private struct CapDAgdeHero: View {
    let stayCount: Int
    let zoneCount: Int
    let create: () -> Void

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [Color(hex: 0x4A1C2E), Color(hex: 0x21141A), VelvetColor.velvetBlack],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [VelvetColor.champagneGold.opacity(0.34), .clear],
                center: .topTrailing,
                startRadius: 10,
                endRadius: 320
            )
            Image(systemName: "sun.max.fill")
                .font(.system(size: 150, weight: .ultraLight))
                .foregroundStyle(VelvetColor.champagneGold.opacity(0.10))
                .offset(x: 185, y: -80)

            VStack(alignment: .leading, spacing: 16) {
                Label("DESTINATION VELVET", systemImage: "sparkles")
                    .font(VelvetTypography.caption(size: 9, weight: .bold))
                    .tracking(1.7)
                    .foregroundStyle(VelvetColor.champagneGold)

                Text("Votre saison au\nCap d’Agde")
                    .font(VelvetTypography.title(size: 37))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineSpacing(-1)

                Text("Repérez les séjours, les zones fréquentées et les membres présents, dans une expérience plus éditoriale et plus lisible.")
                    .font(VelvetTypography.body(size: 13))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 10) {
                    CapMetric(value: "\(stayCount)", label: "séjours")
                    CapMetric(value: "\(zoneCount)", label: "zones")
                    Spacer()
                }

                Button(action: create) {
                    Label("Publier mon séjour", systemImage: "plus")
                        .font(VelvetTypography.body(size: 13, weight: .semibold))
                        .foregroundStyle(VelvetColor.velvetBlack)
                        .padding(.horizontal, 17)
                        .frame(height: 46)
                        .background(VelvetColor.champagneGold)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(22)
        }
        .frame(minHeight: 390)
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 30).stroke(.white.opacity(0.10)))
        .shadow(color: .black.opacity(0.36), radius: 30, y: 16)
    }
}

private struct CapMetric: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(VelvetTypography.title(size: 25))
                .foregroundStyle(VelvetColor.ivory)
            Text(label.uppercased())
                .font(VelvetTypography.caption(size: 8, weight: .semibold))
                .tracking(1)
                .foregroundStyle(VelvetColor.champagneGold)
        }
        .padding(.horizontal, 13)
        .frame(height: 62)
        .background(.ultraThinMaterial)
        .background(VelvetColor.ivory.opacity(0.025))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.08)))
    }
}

private struct CapDAgdeEmptyPanel: View {
    let create: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "sun.horizon.fill")
                    .font(.system(size: 28, weight: .light))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 58, height: 58)
                    .background(VelvetColor.champagneGold.opacity(0.08))
                    .clipShape(Circle())
                Spacer()
                Text("SAISON À VENIR")
                    .font(VelvetTypography.caption(size: 9, weight: .bold))
                    .tracking(1.5)
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            Text("Soyez le premier à annoncer votre présence")
                .font(VelvetTypography.title(size: 27))
                .foregroundStyle(VelvetColor.ivory)
            Text("Même sans publication récente, cet espace reste utile : préparez votre séjour, indiquez votre zone et laissez les autres membres vous retrouver au bon moment.")
                .font(VelvetTypography.body(size: 13))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineSpacing(4)
            Button(action: create) {
                Label("Créer un séjour au Cap", systemImage: "plus.circle.fill")
                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            .buttonStyle(.plain)
        }
        .padding(20)
        .background {
            LinearGradient(
                colors: [VelvetColor.velvetBurgundy.opacity(0.28), VelvetColor.panelRaised.opacity(0.72)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26).stroke(VelvetColor.champagneGold.opacity(0.16)))
    }
}

private struct CapDAgdeEventCard: View {
    let event: IntelligentEvent

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [Color(hex: 0x3D1726), VelvetColor.panelRaised, VelvetColor.velvetBlack],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [VelvetColor.champagneGold.opacity(0.18), .clear],
                center: .topTrailing,
                startRadius: 5,
                endRadius: 260
            )
            Image(systemName: "sun.max.fill")
                .font(.system(size: 78, weight: .ultraLight))
                .foregroundStyle(VelvetColor.champagneGold.opacity(0.09))
                .offset(x: 260, y: -75)

            VStack(alignment: .leading, spacing: 11) {
                HStack {
                    Text(event.startsAt.velvetDateLabel.uppercased())
                        .font(VelvetTypography.caption(size: 9, weight: .bold))
                        .tracking(1.2)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundStyle(VelvetColor.champagneGold)
                }
                Text(event.title)
                    .font(VelvetTypography.title(size: 27))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(2)
                Text(event.description ?? "Séjour Velvet au Cap d’Agde")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(2)
                HStack(spacing: 12) {
                    Label(event.capZone ?? "Village naturiste", systemImage: "sun.max.fill")
                    if let venue = event.capVenue, !venue.isEmpty {
                        Label(venue, systemImage: "building.2")
                    }
                }
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .foregroundStyle(VelvetColor.softBlush)
                .lineLimit(1)
            }
            .padding(18)
        }
        .frame(minHeight: 215)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26).stroke(.white.opacity(0.09)))
        .shadow(color: .black.opacity(0.24), radius: 20, y: 10)
    }
}

private struct CapDAgdeDetailHero: View {
    let event: IntelligentEvent

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [Color(hex: 0x4A1C2E), Color(hex: 0x1E1217), VelvetColor.velvetBlack],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Image(systemName: "sun.max.fill")
                .font(.system(size: 130, weight: .ultraLight))
                .foregroundStyle(VelvetColor.champagneGold.opacity(0.10))
                .offset(x: 205, y: -70)
            VStack(alignment: .leading, spacing: 10) {
                Text("DESTINATION SIGNATURE")
                    .font(VelvetTypography.caption(size: 9, weight: .bold))
                    .tracking(1.6)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(event.title)
                    .font(VelvetTypography.title(size: 34))
                    .foregroundStyle(VelvetColor.ivory)
                Text(event.startsAt.velvetDateLabel)
                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                    .foregroundStyle(VelvetColor.softBlush)
                Label(event.capZone ?? "Village naturiste", systemImage: "sun.max.fill")
                    .font(VelvetTypography.body(size: 11, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            .padding(20)
        }
        .frame(minHeight: 290)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.10)))
        .shadow(color: .black.opacity(0.32), radius: 26, y: 14)
    }
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
