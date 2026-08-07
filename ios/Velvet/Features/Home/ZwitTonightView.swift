import SwiftUI

struct ZwitTonightView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var state: TonightState?
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var hydrated = false
    @State private var errorMessage: String?

    @State private var intent = "meet"
    @State private var locationLabel = ""
    @State private var radiusKm = 50.0
    @State private var durationHours = 6
    @State private var venueModes = Set<String>()
    @State private var wantedProfileTypes = Set<String>()
    @State private var note = ""

    private let client = APIClient()

    var body: some View {
        ZStack {
            VelvetBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    hero
                    if let own = state?.own { activeStatus(own) }
                    composer
                    peopleSection
                    eventsSection
                    privacyNote
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 30)
            }
            .refreshable { await load(force: true) }

            if isLoading && state == nil {
                ProgressView("Préparation de Ce soir…")
                    .tint(VelvetColor.champagneGold)
                    .foregroundStyle(VelvetColor.textSecondary)
            }
        }
        .navigationTitle("Ce soir")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Fermer") { dismiss() }
                    .foregroundStyle(VelvetColor.champagneGold)
            }
        }
        .task { await load(force: false) }
        .alert(
            "Zwit",
            isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )
        ) {
            Button("Fermer", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("MAINTENANT · AUTOUR DE TOI")
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1.6)
                .foregroundStyle(VelvetColor.champagneGold)

            Text("Ce soir peut\ncommencer ici.")
                .font(VelvetTypography.title(size: 37))
                .foregroundStyle(VelvetColor.ivory)
                .lineSpacing(-2)

            Text("Dis ce dont tu as envie pendant quelques heures. Zwit rapproche les membres disponibles et les sorties qui peuvent réellement mener à une rencontre.")
                .font(VelvetTypography.body(size: 12))
                .foregroundStyle(VelvetColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBurgundy.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.15), lineWidth: 0.8)
        }
    }

    private func activeStatus(_ status: TonightStatus) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(VelvetColor.champagneGold)
                .frame(width: 8, height: 8)
                .shadow(color: VelvetColor.champagneGold.opacity(0.45), radius: 7)

            VStack(alignment: .leading, spacing: 3) {
                Text("Tu es visible · \(intentLabel(status.intent))")
                    .font(VelvetTypography.body(size: 12, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text("Jusqu’à \(status.expiresAt.formatted(date: .omitted, time: .shortened))")
                    .font(VelvetTypography.caption(size: 9))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            Spacer()

            Button("Arrêter") {
                Task { await endTonight() }
            }
            .font(VelvetTypography.body(size: 10, weight: .semibold))
            .foregroundStyle(VelvetColor.textSecondary)
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(VelvetColor.champagneGold.opacity(0.055))
        .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 17, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.18), lineWidth: 0.7)
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 15) {
            sectionTitle(state?.own == nil ? "Je suis disponible" : "Modifier mon envie", detail: "Le statut disparaît automatiquement et ne crée aucun historique public.")

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                intentButton("Sortir", value: "go_out", symbol: "sparkles")
                intentButton("Rencontrer", value: "meet", symbol: "person.2")
                intentButton("Discuter", value: "chat", symbol: "bubble.left.and.bubble.right")
                intentButton("Improviser", value: "spontaneous", symbol: "wand.and.stars")
            }

            fieldLabel("Zone publique")
            TextField("Ex. Lille et alentours", text: $locationLabel)
                .textInputAutocapitalization(.words)
                .padding(.horizontal, 13)
                .frame(height: 45)
                .background(VelvetColor.ivory.opacity(0.035))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay { RoundedRectangle(cornerRadius: 14).stroke(VelvetColor.borderSubtle, lineWidth: 0.7) }

            HStack {
                fieldLabel("Rayon")
                Spacer()
                Text("\(Int(radiusKm)) km")
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
            Slider(value: $radiusKm, in: 10...120, step: 10)
                .tint(VelvetColor.champagneGold)

            fieldLabel("Où ça pourrait se passer ?")
            chipFlow(items: [
                ("Club", "club"), ("Spa", "spa"), ("Bar", "bar"),
                ("Privé", "private"), ("Ouvert à tout", "open")
            ], selection: $venueModes)

            fieldLabel("Je souhaite surtout croiser")
            chipFlow(items: [("Couples", "couple"), ("Femmes", "woman"), ("Hommes", "man")], selection: $wantedProfileTypes)

            HStack {
                fieldLabel("Durée")
                Spacer()
                Picker("Durée", selection: $durationHours) {
                    ForEach([2, 4, 6, 8, 12], id: \.self) { Text("\($0) h").tag($0) }
                }
                .pickerStyle(.menu)
                .tint(VelvetColor.champagneGold)
            }

            fieldLabel("Petit mot")
            TextField("Une ambiance, une idée…", text: $note, axis: .vertical)
                .lineLimit(2...4)
                .padding(13)
                .background(VelvetColor.ivory.opacity(0.035))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay { RoundedRectangle(cornerRadius: 14).stroke(VelvetColor.borderSubtle, lineWidth: 0.7) }

            Button {
                Task { await save() }
            } label: {
                HStack {
                    Spacer()
                    if isSaving { ProgressView().tint(.black) }
                    Text(state?.own == nil ? "Me rendre visible" : "Actualiser Ce soir")
                    Spacer()
                }
                .font(VelvetTypography.body(size: 12, weight: .semibold))
                .foregroundStyle(Color.black.opacity(0.8))
                .frame(height: 47)
                .background(VelvetColor.champagneGold)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(isSaving)
        }
        .padding(17)
        .background(.ultraThinMaterial)
        .background(VelvetColor.anthracite.opacity(0.48))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 22).stroke(VelvetColor.borderSubtle, lineWidth: 0.7) }
    }

    private var peopleSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Disponibles maintenant", detail: "\(state?.people.count ?? 0) profil(s) visible(s)")
            if let people = state?.people, !people.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(people.prefix(12)) { item in
                            personCard(item)
                        }
                    }
                }
            } else {
                empty("Personne n’a encore activé Ce soir dans ta zone.")
            }
        }
        .padding(17)
        .background(VelvetColor.anthracite.opacity(0.34))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private var eventsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Sorties dans les prochaines heures", detail: "Les événements qui peuvent transformer l’envie en vraie soirée.")
            if let events = state?.events, !events.isEmpty {
                ForEach(events.prefix(6)) { event in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(event.startsAt.formatted(.dateTime.weekday(.abbreviated).hour().minute()))
                            .font(VelvetTypography.caption(size: 9, weight: .semibold))
                            .foregroundStyle(VelvetColor.champagneGold)
                        Text(event.title)
                            .font(VelvetTypography.body(size: 13, weight: .semibold))
                            .foregroundStyle(VelvetColor.ivory)
                        Text(event.locationPublic ?? event.dressCode ?? "Voir la fiche de la sortie")
                            .font(VelvetTypography.caption(size: 9))
                            .foregroundStyle(VelvetColor.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(13)
                    .background(VelvetColor.ivory.opacity(0.025))
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                }
            } else {
                empty("Aucune sortie publiée dans les prochaines heures.")
            }
        }
        .padding(17)
        .background(VelvetColor.anthracite.opacity(0.34))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private var privacyNote: some View {
        Label(state?.privacy ?? "Zwit ne publie jamais ta position GPS exacte.", systemImage: "lock")
            .font(VelvetTypography.caption(size: 9))
            .foregroundStyle(VelvetColor.textSecondary)
            .padding(.horizontal, 4)
    }

    private func personCard(_ item: TonightStatus) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            AsyncImage(url: item.profile?.primaryPhotoURL) { phase in
                if case let .success(image) = phase { image.resizable().scaledToFill() }
                else { VelvetColor.ivory.opacity(0.04).overlay(Image(systemName: "person.2").foregroundStyle(VelvetColor.textSecondary)) }
            }
            .frame(width: 210, height: 150)
            .clipped()

            VStack(alignment: .leading, spacing: 4) {
                Text(item.profile?.displayName ?? "Membre Zwit")
                    .font(VelvetTypography.body(size: 12, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(1)
                Text(item.locationLabel ?? item.profile?.locationZone ?? "Zone privée")
                    .font(VelvetTypography.caption(size: 9))
                    .foregroundStyle(VelvetColor.textSecondary)
                Text(intentLabel(item.intent).uppercased())
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1)
                    .foregroundStyle(VelvetColor.champagneGold)
                    .padding(.top, 4)
            }
            .padding(12)
        }
        .frame(width: 210)
        .background(VelvetColor.ivory.opacity(0.025))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 18).stroke(VelvetColor.borderSubtle, lineWidth: 0.7) }
    }

    private func sectionTitle(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(VelvetTypography.title(size: 21))
                .foregroundStyle(VelvetColor.ivory)
            Text(detail)
                .font(VelvetTypography.caption(size: 9))
                .foregroundStyle(VelvetColor.textSecondary)
        }
    }

    private func fieldLabel(_ title: String) -> some View {
        Text(title.uppercased())
            .font(VelvetTypography.caption(size: 8, weight: .semibold))
            .tracking(1.3)
            .foregroundStyle(VelvetColor.textSecondary)
    }

    private func intentButton(_ title: String, value: String, symbol: String) -> some View {
        Button {
            intent = value
        } label: {
            Label(title, systemImage: symbol)
                .font(VelvetTypography.body(size: 11, weight: .semibold))
                .foregroundStyle(intent == value ? VelvetColor.champagneGold : VelvetColor.textSecondary)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(intent == value ? VelvetColor.champagneGold.opacity(0.075) : VelvetColor.ivory.opacity(0.025))
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 15)
                        .stroke(intent == value ? VelvetColor.champagneGold.opacity(0.20) : VelvetColor.borderSubtle, lineWidth: 0.7)
                }
        }
        .buttonStyle(.plain)
    }

    private func chipFlow(items: [(String, String)], selection: Binding<Set<String>>) -> some View {
        HStack(spacing: 7) {
            ForEach(items, id: \.1) { title, value in
                let selected = selection.wrappedValue.contains(value)
                Button {
                    if selected { selection.wrappedValue.remove(value) }
                    else { selection.wrappedValue.insert(value) }
                } label: {
                    Text(title)
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .foregroundStyle(selected ? VelvetColor.champagneGold : VelvetColor.textSecondary)
                        .padding(.horizontal, 10)
                        .frame(height: 33)
                        .background(selected ? VelvetColor.champagneGold.opacity(0.07) : VelvetColor.ivory.opacity(0.025))
                        .clipShape(Capsule())
                        .overlay { Capsule().stroke(selected ? VelvetColor.champagneGold.opacity(0.18) : VelvetColor.borderSubtle, lineWidth: 0.7) }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func empty(_ message: String) -> some View {
        Text(message)
            .font(VelvetTypography.body(size: 11))
            .foregroundStyle(VelvetColor.textSecondary)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, 20)
    }

    @MainActor
    private func load(force: Bool) async {
        if isLoading || (!force && state != nil) { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let response: TonightResponse = try await client.get("/api/members/tonight")
            state = response.tonight
            if !hydrated {
                hydrate(response.tonight.own)
                hydrated = true
            }
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func save() async {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        let body = TonightRequest(
            intent: intent,
            locationLabel: locationLabel,
            radiusKm: Int(radiusKm),
            venueMode: Array(venueModes),
            wantedProfileTypes: Array(wantedProfileTypes),
            durationHours: durationHours,
            note: note
        )
        do {
            let response: TonightMutationResponse = try await client.post("/api/members/tonight", body: body)
            state = response.tonight
            hydrate(response.tonight.own)
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func endTonight() async {
        do {
            let response: TonightMutationResponse = try await client.delete("/api/members/tonight")
            state = response.tonight
            hydrated = false
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    private func hydrate(_ own: TonightStatus?) {
        guard let own else { return }
        intent = own.intent
        locationLabel = own.locationLabel ?? ""
        radiusKm = Double(own.radiusKm)
        venueModes = Set(own.venueMode)
        wantedProfileTypes = Set(own.wantedProfileTypes)
        note = own.note ?? ""
    }

    private func intentLabel(_ value: String) -> String {
        switch value {
        case "go_out": "Sortir"
        case "chat": "Discuter"
        case "spontaneous": "Improviser"
        default: "Rencontrer"
        }
    }
}

private struct TonightResponse: Decodable, Sendable { let tonight: TonightState }
private struct TonightMutationResponse: Decodable, Sendable { let ok: Bool; let tonight: TonightState }
private struct TonightRequest: Encodable, Sendable {
    let intent: String
    let locationLabel: String
    let radiusKm: Int
    let venueMode: [String]
    let wantedProfileTypes: [String]
    let durationHours: Int
    let note: String
}

private struct TonightState: Decodable, Sendable {
    let generatedAt: Date
    let expiresPolicyHours: Int
    let privacy: String
    let own: TonightStatus?
    let people: [TonightStatus]
    let events: [TonightEvent]
}

private struct TonightStatus: Decodable, Sendable, Identifiable {
    let profileId: UUID
    let intent: String
    let venueMode: [String]
    let wantedProfileTypes: [String]
    let radiusKm: Int
    let locationLabel: String?
    let note: String?
    let startsAt: Date
    let expiresAt: Date
    let updatedAt: Date
    let profile: TonightProfile?
    var id: UUID { profileId }
}

private struct TonightProfile: Decodable, Sendable {
    let id: UUID
    let profileType: String
    let displayName: String
    let locationZone: String?
    let verificationStatus: String?
    let mediaAssets: [TonightMedia]?

    var primaryPhotoURL: URL? {
        let media = (mediaAssets ?? [])
            .filter { $0.moderationStatus == "approved" && $0.previewUrl != nil }
            .sorted { ($0.isPrimary ?? false) && !($1.isPrimary ?? false) }
        guard let value = media.first?.previewUrl else { return nil }
        return URL(string: value)
    }
}

private struct TonightMedia: Decodable, Sendable {
    let id: UUID
    let isPrimary: Bool?
    let moderationStatus: String
    let previewUrl: String?
}

private struct TonightEvent: Decodable, Sendable, Identifiable {
    let id: UUID
    let title: String
    let startsAt: Date
    let endsAt: Date?
    let locationPublic: String?
    let dressCode: String?
}
