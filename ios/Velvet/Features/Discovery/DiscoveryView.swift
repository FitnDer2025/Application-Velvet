import SwiftUI

struct DiscoveryView: View {
    @EnvironmentObject private var store: VelvetStore
    let currentProfile: MemberProfile
    @State private var query = ""
    @State private var filters = DiscoveryFilters()
    @State private var showsFilters = false

    private var profiles: [MemberProfile] {
        (store.directory?.profiles ?? [])
            .filter { $0.id != currentProfile.id }
            .filter(matchesFilters)
            .filter {
                query.isEmpty
                    || $0.displayName.localizedCaseInsensitiveContains(query)
                    || ($0.locationZone ?? $0.city ?? "").localizedCaseInsensitiveContains(query)
                    || ($0.searchText ?? "").localizedCaseInsensitiveContains(query)
            }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VelvetPageHeader(
                        "Recherche sur mesure",
                        title: "Recherche",
                        subtitle: "Découvre les univers qui te ressemblent, dans le respect de la visibilité choisie par chaque membre."
                    )

                    VelvetSearchField(prompt: "Nom, ville, univers…", text: $query)

                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(profiles.count)")
                                .font(VelvetTypography.title(size: 26))
                                .foregroundStyle(VelvetColor.ivory)
                            Text("PROFIL\(profiles.count > 1 ? "S" : "") CORRESPONDANT\(profiles.count > 1 ? "S" : "")")
                                .font(VelvetTypography.caption(size: 8, weight: .semibold))
                                .tracking(1.1)
                                .foregroundStyle(VelvetColor.textSecondary)
                        }
                        Spacer()
                        Button {
                            showsFilters = true
                        } label: {
                            Label(
                                filters.activeCount > 0 ? "Filtres · \(filters.activeCount)" : "Filtres",
                                systemImage: "slider.horizontal.3"
                            )
                            .font(VelvetTypography.caption(size: 12, weight: .semibold))
                            .foregroundStyle(VelvetColor.velvetBlack)
                            .padding(.horizontal, 15)
                            .frame(height: 40)
                            .background(VelvetColor.champagneGold)
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 9) {
                            VelvetChip(title: "Tous", selected: filters.types.isEmpty) {
                                filters.types.removeAll()
                            }
                            VelvetChip(title: "Couples", selected: filters.types == ["couple"]) {
                                filters.types = filters.types == ["couple"] ? [] : ["couple"]
                            }
                            VelvetChip(title: "Femmes", selected: filters.types == ["woman"]) {
                                filters.types = filters.types == ["woman"] ? [] : ["woman"]
                            }
                            VelvetChip(title: "Hommes", selected: filters.types == ["man"]) {
                                filters.types = filters.types == ["man"] ? [] : ["man"]
                            }
                        }
                    }

                    if store.directory?.locked == true {
                        VelvetEmptyState(
                            symbol: "lock.shield",
                            title: "Admission nécessaire",
                            message: "La recherche s’ouvre dès que ton profil est admis par Zwit."
                        )
                    } else if profiles.isEmpty, !store.isLoading {
                        VelvetEmptyState(
                            symbol: "magnifyingglass",
                            title: query.isEmpty ? "La sélection s’affine" : "Aucun profil correspondant",
                            message: query.isEmpty
                                ? "De nouveaux profils apparaîtront ici dès qu’ils seront admis et visibles."
                                : "Essaie une autre ville, un autre nom ou élargis le type de profil."
                        )
                    } else {
                        LazyVStack(spacing: 18) {
                            ForEach(profiles) { profile in
                                NavigationLink {
                                    MemberDetailView(profile: profile)
                                } label: {
                                    EditorialProfileCard(profile: profile)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 28)
            }
            .refreshable { await store.load() }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showsFilters) {
            DiscoveryFiltersView(
                filters: $filters,
                locationReady: store.mapData?.center.source == "private_approximate_location",
                presenceReady: store.discoveryState.presenceAvailable == true
            )
        }
    }

    private func matchesFilters(_ profile: MemberProfile) -> Bool {
        if !filters.types.isEmpty {
            guard let audience = profile.discoveryAudience, filters.types.contains(audience) else {
                return false
            }
        }
        if !filters.seeking.isEmpty {
            let seeking = Set((profile.individualProfiles ?? []).flatMap { $0.attractedTo ?? [] })
            guard filters.seeking.allSatisfy(seeking.contains) else { return false }
        }
        if !filters.city.isEmpty {
            guard (profile.locationZone ?? profile.city ?? "")
                .localizedCaseInsensitiveContains(filters.city)
            else { return false }
        }
        if filters.nearMe {
            guard let distance = distanceFromCurrentZone(to: profile), distance <= 50 else {
                return false
            }
        }
        guard profile.matchesAge(
            group: "man",
            minimum: filters.maleAgeMin,
            maximum: filters.maleAgeMax
        ) else { return false }
        guard profile.matchesAge(
            group: "woman",
            minimum: filters.femaleAgeMin,
            maximum: filters.femaleAgeMax
        ) else { return false }
        if !filters.practices.isEmpty {
            let profilePractices = Set(profile.practices ?? [])
            guard filters.practices.allSatisfy({ profilePractices.contains($0) }) else {
                return false
            }
        }
        if !filters.morphologies.isEmpty {
            let values = Set(
                (profile.individualProfiles ?? []).compactMap { $0.morphology ?? $0.bodyType }
            )
            guard !filters.morphologies.isDisjoint(with: values) else { return false }
        }
        if filters.onlineOnly {
            let onlineIDs = Set(
                store.discoveryState.presence
                    .filter { $0.presenceStatus == "online" }
                    .map(\.profileId)
            )
            guard onlineIDs.contains(profile.id) else { return false }
        }
        if filters.withPhotos, profile.approvedPhotos.isEmpty { return false }
        if filters.withRecommendation {
            guard store.directory?.recommendations?.contains(where: {
                $0.targetType == "profile" && $0.targetId == profile.id
            }) == true else { return false }
        }
        if filters.createdToday {
            guard let value = profile.createdAt,
                  let date = ISO8601DateFormatter().date(from: value),
                  Calendar.current.isDateInToday(date)
            else { return false }
        }
        return true
    }

    private func distanceFromCurrentZone(to profile: MemberProfile) -> Double? {
        guard
            let data = store.mapData,
            data.center.source == "private_approximate_location",
            let marker = data.members.first(where: { $0.id == profile.id })
        else { return nil }
        let earthRadius = 6_371.0
        let lat1 = data.center.latitude * .pi / 180
        let lat2 = marker.latitude * .pi / 180
        let latitudeDelta = (marker.latitude - data.center.latitude) * .pi / 180
        let longitudeDelta = (marker.longitude - data.center.longitude) * .pi / 180
        let value = sin(latitudeDelta / 2) * sin(latitudeDelta / 2)
            + cos(lat1) * cos(lat2)
            * sin(longitudeDelta / 2) * sin(longitudeDelta / 2)
        return earthRadius * 2 * atan2(sqrt(value), sqrt(1 - value))
    }
}

private struct DiscoveryFilters: Equatable {
    var types: Set<String> = []
    var seeking: Set<String> = []
    var city = ""
    var nearMe = false
    var maleAgeMin = 18
    var maleAgeMax = 99
    var femaleAgeMin = 18
    var femaleAgeMax = 99
    var practices: Set<String> = []
    var morphologies: Set<String> = []
    var onlineOnly = false
    var withPhotos = false
    var withRecommendation = false
    var createdToday = false

    var activeCount: Int {
        types.count
            + seeking.count
            + practices.count
            + morphologies.count
            + (city.isEmpty ? 0 : 1)
            + (nearMe ? 1 : 0)
            + (maleAgeMin == 18 && maleAgeMax == 99 ? 0 : 1)
            + (femaleAgeMin == 18 && femaleAgeMax == 99 ? 0 : 1)
            + (onlineOnly ? 1 : 0)
            + (withPhotos ? 1 : 0)
            + (withRecommendation ? 1 : 0)
            + (createdToday ? 1 : 0)
    }

    mutating func reset() {
        self = DiscoveryFilters()
    }
}

private struct DiscoveryFiltersView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var filters: DiscoveryFilters
    let locationReady: Bool
    let presenceReady: Bool

    private let practices = [
        "Rencontres en couple", "Côte-à-côtisme", "Mélangisme", "Échangisme",
        "Triolisme", "Sensualité et massages", "Voyeurisme", "Exhibitionnisme",
        "Jeux de rôle", "BDSM soft", "BDSM", "Soirées privées", "Clubs et spas",
        "À découvrir ensemble", "À discuter selon le feeling"
    ]

    private let morphologies = [
        "Mince", "Svelte", "Athlétique", "Sportive", "Standard", "Musclée",
        "Pulpeuse / Curvy", "Ronde", "Généreuse", "Forte", "Information privée"
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VelvetPageHeader(
                            "Recherche avancée",
                            title: "Tes critères",
                            subtitle: "Combine plusieurs choix dans chaque groupe pour affiner réellement les profils."
                        )

                        filterSection("Nous recherchons", subtitle: "Plusieurs choix") {
                            choiceGrid(
                                [("couple", "Couples"), ("woman", "Femmes"), ("man", "Hommes")],
                                selection: $filters.types
                            )
                        }

                        filterSection("Qui recherchent", subtitle: "Attirances déclarées") {
                            choiceGrid(
                                [("Couples", "Couples"), ("Femmes", "Femmes"), ("Hommes", "Hommes")],
                                selection: $filters.seeking
                            )
                        }

                        filterSection("Localisation", subtitle: "Zone publique") {
                            VelvetSearchField(prompt: "Ville ou zone publique", text: $filters.city)
                            Toggle("Près de chez moi · 50 km", isOn: $filters.nearMe)
                                .disabled(!locationReady)
                                .tint(VelvetColor.champagneGold)
                                .foregroundStyle(VelvetColor.ivory)
                            if !locationReady {
                                Text("Active ta zone approximative dans Maps pour utiliser la proximité.")
                                    .font(VelvetTypography.body(size: 11))
                                    .foregroundStyle(VelvetColor.textSecondary)
                            }
                        }

                        filterSection("Âges", subtitle: "18 à 99 ans") {
                            ageRow(
                                "Pour l’homme",
                                minimum: $filters.maleAgeMin,
                                maximum: $filters.maleAgeMax
                            )
                            ageRow(
                                "Pour la femme",
                                minimum: $filters.femaleAgeMin,
                                maximum: $filters.femaleAgeMax
                            )
                        }

                        filterSection("Pratiques", subtitle: "Choix cumulables") {
                            choiceGrid(
                                practices.map { ($0, $0) },
                                selection: $filters.practices
                            )
                        }

                        filterSection("Physique", subtitle: "Plusieurs choix") {
                            choiceGrid(
                                morphologies.map { ($0, $0) },
                                selection: $filters.morphologies
                            )
                        }

                        filterSection("Divers", subtitle: nil) {
                            Toggle("Actuellement connecté", isOn: $filters.onlineOnly)
                                .disabled(!presenceReady)
                            Toggle("Avec photos publiques", isOn: $filters.withPhotos)
                            Toggle("Avec recommandation", isOn: $filters.withRecommendation)
                            Toggle("Profil créé aujourd’hui", isOn: $filters.createdToday)
                        }
                        .tint(VelvetColor.champagneGold)
                        .foregroundStyle(VelvetColor.ivory)

                        Button {
                            filters.reset()
                        } label: {
                            Label("Effacer tous les filtres", systemImage: "arrow.counterclockwise")
                                .font(VelvetTypography.body(size: 13, weight: .semibold))
                                .frame(maxWidth: .infinity, minHeight: 46)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(VelvetColor.textSecondary)
                    }
                    .padding(20)
                    .padding(.bottom, 80)
                }
            }
            .safeAreaInset(edge: .bottom) {
                VelvetPrimaryButton("Afficher les résultats") { dismiss() }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(.ultraThinMaterial)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
    }

    private func filterSection<Content: View>(
        _ title: String,
        subtitle: String?,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title)
                        .font(VelvetTypography.title(size: 21))
                        .foregroundStyle(VelvetColor.ivory)
                    Spacer()
                    if let subtitle {
                        Text(subtitle.uppercased())
                            .font(VelvetTypography.caption(size: 8, weight: .semibold))
                            .tracking(0.9)
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                }
                content()
            }
        }
    }

    private func choiceGrid(
        _ values: [(String, String)],
        selection: Binding<Set<String>>
    ) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 116), spacing: 8)], spacing: 8) {
            ForEach(values, id: \.0) { value, label in
                VelvetChip(title: label, selected: selection.wrappedValue.contains(value)) {
                    if selection.wrappedValue.contains(value) {
                        selection.wrappedValue.remove(value)
                    } else {
                        selection.wrappedValue.insert(value)
                    }
                }
            }
        }
    }

    private func ageRow(
        _ title: String,
        minimum: Binding<Int>,
        maximum: Binding<Int>
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1)
                .foregroundStyle(VelvetColor.champagneGold)
            HStack {
                Stepper("De \(minimum.wrappedValue)", value: minimum, in: 18...99)
                Stepper("À \(maximum.wrappedValue)", value: maximum, in: 18...99)
            }
            .font(VelvetTypography.body(size: 12))
            .foregroundStyle(VelvetColor.ivory)
        }
    }
}

extension MemberProfile {
    var discoveryAudience: String? {
        if profileType == .couple { return "couple" }
        let identity = individualProfiles?.first?.genderIdentity?.lowercased() ?? ""
        if identity.contains("femme") { return "woman" }
        if identity.contains("homme") { return "man" }
        return nil
    }

    var approvedPhotos: [MediaAsset] {
        (mediaAssets ?? []).filter {
            $0.previewUrl != nil && ($0.moderationStatus == nil || $0.moderationStatus == "approved")
        }
    }

    func matchesAge(group: String, minimum: Int, maximum: Int) -> Bool {
        guard minimum > 18 || maximum < 99 else { return true }
        let lower = min(minimum, maximum)
        let upper = max(minimum, maximum)
        let currentYear = Calendar.current.component(.year, from: Date())
        let ages = (individualProfiles ?? []).compactMap { person -> Int? in
            let identity = person.genderIdentity?.lowercased() ?? ""
            let matches = group == "woman"
                ? identity.contains("femme")
                : identity.contains("homme")
            guard matches, let birthYear = person.birthYear else { return nil }
            return currentYear - birthYear
        }
        return ages.contains { lower...upper ~= $0 }
    }
}

struct EditorialProfileCard: View {
    let profile: MemberProfile

    private var primaryPhoto: URL? {
        profile.mediaAssets?
            .first(where: { $0.isPrimary == true && $0.previewUrl != nil })?
            .previewUrl
            ?? profile.mediaAssets?.first(where: { $0.previewUrl != nil })?.previewUrl
    }

    private var ages: String? {
        let years = (profile.individualProfiles ?? []).compactMap(\.birthYear).map {
            Calendar.current.component(.year, from: Date()) - $0
        }
        guard !years.isEmpty else { return nil }
        return years.map(String.init).joined(separator: " · ") + " ans"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 9) {
                Image(systemName: profile.profileType == .couple ? "person.2.fill" : "person.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 28, height: 28)
                    .background(VelvetColor.velvetBurgundy.opacity(0.24))
                    .clipShape(Circle())

                Text(profile.displayName)
                    .font(VelvetTypography.body(size: 15, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)

                Spacer()

                Circle()
                    .fill(VelvetColor.success)
                    .frame(width: 8, height: 8)
                    .shadow(color: VelvetColor.success.opacity(0.6), radius: 5)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)

            AsyncImage(url: primaryPhoto) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                ZStack {
                    LinearGradient(
                        colors: [
                            Color(hex: 0x32141F),
                            VelvetColor.anthracite
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    RadialGradient(
                        colors: [
                            VelvetColor.champagneGold.opacity(0.14),
                            .clear
                        ],
                        center: .topTrailing,
                        startRadius: 8,
                        endRadius: 170
                    )
                    Image(systemName: profile.profileType == .couple ? "person.2.fill" : "person.fill")
                        .font(.system(size: 58, weight: .ultraLight))
                        .foregroundStyle(VelvetColor.champagneGold.opacity(0.78))
                }
            }
            .aspectRatio(4 / 5, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .padding(.horizontal, 7)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(profile.profileType.label.uppercased())
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.3)
                        .foregroundStyle(VelvetColor.champagneGold)
                    if let ages {
                        Text("· \(ages)")
                            .font(VelvetTypography.caption(size: 10))
                            .foregroundStyle(VelvetColor.textSecondary)
                    }
                }

                Label(profile.locationZone ?? profile.city ?? "Zone privée", systemImage: "location")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)

                if let summary = profile.description ?? profile.story, !summary.isEmpty {
                    Text(summary)
                        .font(VelvetTypography.body(size: 13))
                        .foregroundStyle(VelvetColor.ivory.opacity(0.88))
                        .lineLimit(3)
                        .lineSpacing(3)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
        .background(
            LinearGradient(
                colors: [
                    VelvetColor.ivory.opacity(0.045),
                    VelvetColor.ivory.opacity(0.008)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .background(VelvetColor.anthracite.opacity(0.82))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(VelvetColor.ivory.opacity(0.095), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.24), radius: 25, y: 14)
    }
}

struct LockedDirectoryView: View {
    var body: some View {
        VelvetEmptyState(
            symbol: "lock.shield",
            title: "Admission nécessaire",
            message: "Cet espace est réservé aux membres admis."
        )
    }
}
