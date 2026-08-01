import SwiftUI

struct PremiumDiscoveryGridView: View {
    @EnvironmentObject private var store: VelvetStore
    let currentProfile: MemberProfile

    @State private var query = ""
    @State private var filters = PremiumDiscoveryFilters()
    @State private var showsFilters = false
    @State private var visibleCount = 9

    private var columns: [GridItem] {
        Array(
            repeating: GridItem(
                .flexible(minimum: 0, maximum: .infinity),
                spacing: 12,
                alignment: .top
            ),
            count: 3
        )
    }

    private var profiles: [MemberProfile] {
        let filtered = (store.directory?.profiles ?? [])
            .filter { $0.id != currentProfile.id }
            .filter(matchesFilters)
            .filter {
                query.isEmpty
                    || $0.displayName.localizedCaseInsensitiveContains(query)
                    || ($0.locationZone ?? $0.city ?? "").localizedCaseInsensitiveContains(query)
                    || ($0.searchText ?? "").localizedCaseInsensitiveContains(query)
            }
        return balancedProfiles(filtered)
    }

    private var visibleProfiles: ArraySlice<MemberProfile> {
        profiles.prefix(visibleCount)
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VelvetPageHeader(
                        "Recherche sur mesure",
                        title: "Recherche",
                        subtitle: "Une sélection élégante et lisible pour découvrir rapidement les univers Velvet."
                    )

                    VelvetSearchField(prompt: "Nom, ville, univers…", text: $query)

                    HStack(spacing: 10) {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                VelvetChip(title: "Tous", selected: filters.types.isEmpty) {
                                    filters.types.removeAll()
                                    visibleCount = 9
                                }
                                VelvetChip(title: "Couples", selected: filters.types == ["couple"]) {
                                    filters.types = filters.types == ["couple"] ? [] : ["couple"]
                                    visibleCount = 9
                                }
                                VelvetChip(title: "Femmes", selected: filters.types == ["woman"]) {
                                    filters.types = filters.types == ["woman"] ? [] : ["woman"]
                                    visibleCount = 9
                                }
                                VelvetChip(title: "Hommes", selected: filters.types == ["man"]) {
                                    filters.types = filters.types == ["man"] ? [] : ["man"]
                                    visibleCount = 9
                                }
                            }
                        }

                        Button {
                            showsFilters = true
                        } label: {
                            ZStack(alignment: .topTrailing) {
                                Image(systemName: "slider.horizontal.3")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(VelvetColor.velvetBlack)
                                    .frame(width: 40, height: 40)
                                    .background(VelvetColor.champagneGold)
                                    .clipShape(Circle())
                                if filters.activeCount > 0 {
                                    Text("\(filters.activeCount)")
                                        .font(.system(size: 8, weight: .bold))
                                        .foregroundStyle(.white)
                                        .frame(width: 17, height: 17)
                                        .background(VelvetColor.burgundyLight)
                                        .clipShape(Circle())
                                        .offset(x: 4, y: -4)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Filtres avancés")
                    }

                    HStack(alignment: .firstTextBaseline) {
                        Text("\(profiles.count) profil\(profiles.count > 1 ? "s" : "")")
                            .font(VelvetTypography.body(size: 13, weight: .semibold))
                            .foregroundStyle(VelvetColor.ivory)
                        Spacer()
                        Text("SÉLECTION VELVET")
                            .font(VelvetTypography.caption(size: 8, weight: .semibold))
                            .tracking(1.1)
                            .foregroundStyle(VelvetColor.champagneGold)
                    }

                    if store.directory?.locked == true {
                        VelvetEmptyState(
                            symbol: "lock.shield",
                            title: "Admission nécessaire",
                            message: "La recherche s’ouvre dès que ton profil est admis par Velvet."
                        )
                    } else if profiles.isEmpty, !store.isLoading {
                        VelvetEmptyState(
                            symbol: "magnifyingglass",
                            title: query.isEmpty ? "La sélection s’affine" : "Aucun profil correspondant",
                            message: query.isEmpty
                                ? "De nouveaux profils apparaîtront ici dès leur admission."
                                : "Essaie une autre ville, un autre nom ou élargis tes critères."
                        )
                    } else {
                        LazyVGrid(columns: columns, alignment: .center, spacing: 16) {
                            ForEach(visibleProfiles) { profile in
                                NavigationLink {
                                    MemberDetailView(profile: profile)
                                } label: {
                                    PremiumDiscoveryMemberCard(
                                        profile: profile,
                                        history: store.viewHistory(for: profile.id)
                                    )
                                }
                                .buttonStyle(.plain)
                                .frame(maxWidth: .infinity, alignment: .top)
                            }
                        }
                        .frame(maxWidth: .infinity)

                        if visibleCount < profiles.count {
                            Button {
                                withAnimation(.easeOut(duration: VelvetMotion.normal)) {
                                    visibleCount += 9
                                }
                            } label: {
                                Label("Afficher 9 profils de plus", systemImage: "square.grid.3x3")
                                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                                    .foregroundStyle(VelvetColor.champagneGold)
                                    .frame(maxWidth: .infinity, minHeight: 46)
                                    .background(VelvetColor.champagneGold.opacity(0.07))
                                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                                            .stroke(VelvetColor.champagneGold.opacity(0.20), lineWidth: 1)
                                    }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 28)
            }
            .refreshable { await store.load() }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showsFilters) {
            PremiumDiscoveryFiltersView(
                filters: $filters,
                locationReady: store.mapData?.center.source == "private_approximate_location",
                presenceReady: store.discoveryState.presenceAvailable == true
            )
        }
        .onChange(of: query) { _, _ in visibleCount = 9 }
        .onChange(of: filters) { _, _ in visibleCount = 9 }
    }

    private func balancedProfiles(_ source: [MemberProfile]) -> [MemberProfile] {
        var couples = source.filter { $0.profileType == .couple }
        var individuals = source.filter { $0.profileType != .couple }
        var result: [MemberProfile] = []
        result.reserveCapacity(source.count)

        while !couples.isEmpty || !individuals.isEmpty {
            if !couples.isEmpty {
                result.append(couples.removeFirst())
            }
            if !individuals.isEmpty {
                result.append(individuals.removeFirst())
            }
        }
        return result
    }

    private func matchesFilters(_ profile: MemberProfile) -> Bool {
        if !filters.types.isEmpty {
            let audience = profile.profileType == .couple
                ? "couple"
                : profile.discoveryAudience
            guard let audience, filters.types.contains(audience) else {
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
        if filters.maleAgeMin != 18 || filters.maleAgeMax != 99 {
            guard profile.matchesAge(
                group: "man",
                minimum: filters.maleAgeMin,
                maximum: filters.maleAgeMax
            ) else { return false }
        }
        if filters.femaleAgeMin != 18 || filters.femaleAgeMax != 99 {
            guard profile.matchesAge(
                group: "woman",
                minimum: filters.femaleAgeMin,
                maximum: filters.femaleAgeMax
            ) else { return false }
        }
        if !filters.practices.isEmpty {
            let values = Set(profile.practices ?? [])
            guard filters.practices.allSatisfy(values.contains) else { return false }
        }
        if !filters.morphologies.isEmpty {
            let values = Set((profile.individualProfiles ?? []).compactMap { $0.morphology ?? $0.bodyType })
            guard !filters.morphologies.isDisjoint(with: values) else { return false }
        }
        if filters.onlineOnly {
            let online = Set(
                store.discoveryState.presence
                    .filter { $0.presenceStatus == "online" }
                    .map(\.profileId)
            )
            guard online.contains(profile.id) else { return false }
        }
        if filters.withPhotos, profile.profileGalleryPhotos.isEmpty { return false }
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

private struct PremiumDiscoveryMemberCard: View {
    let profile: MemberProfile
    let history: ProfileViewHistory?

    private var photo: URL? {
        profile.profileGalleryPhotos.first(where: { $0.isPrimary == true })?.previewUrl
            ?? profile.profileGalleryPhotos.first?.previewUrl
    }

    private var visitLabel: String {
        guard let history else { return "À découvrir" }
        return "Vu \(history.viewCount ?? 1)×"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            imageArea
            informationArea
        }
        .frame(maxWidth: .infinity)
        .frame(height: 236, alignment: .top)
        .background {
            LinearGradient(
                colors: [
                    VelvetColor.panelRaised.opacity(0.98),
                    VelvetColor.anthracite.opacity(0.94)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 19, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.16), lineWidth: 0.8)
        }
        .shadow(color: .black.opacity(0.28), radius: 14, y: 8)
        .contentShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
    }

    private var imageArea: some View {
        ZStack {
            VelvetRemoteImage(
                url: photo,
                symbol: profile.profileType == .couple ? "person.2.fill" : "person.fill"
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()

            LinearGradient(
                colors: [
                    .clear,
                    VelvetColor.velvetBlack.opacity(0.14),
                    VelvetColor.velvetBlack.opacity(0.84)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .allowsHitTesting(false)

            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    if let history {
                        Label("\(history.viewCount ?? 1)", systemImage: "eye.fill")
                            .font(.system(size: 7, weight: .bold, design: .rounded))
                            .foregroundStyle(VelvetColor.champagneGold)
                            .padding(.horizontal, 7)
                            .frame(height: 21)
                            .background(.ultraThinMaterial)
                            .background(VelvetColor.velvetBlack.opacity(0.48))
                            .clipShape(Capsule())
                    }
                }

                Spacer()

                HStack {
                    Text(profile.premiumDiscoveryCategory.uppercased())
                        .font(.system(size: 6.5, weight: .bold, design: .rounded))
                        .tracking(0.55)
                        .foregroundStyle(VelvetColor.champagneGold)
                        .lineLimit(1)
                        .minimumScaleFactor(0.70)
                        .padding(.horizontal, 7)
                        .frame(height: 21)
                        .background(.ultraThinMaterial)
                        .background(VelvetColor.velvetBlack.opacity(0.42))
                        .clipShape(Capsule())
                    Spacer(minLength: 0)
                }
            }
            .padding(7)
            .allowsHitTesting(false)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 130)
        .clipped()
    }

    private var informationArea: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(profile.displayName)
                .font(VelvetTypography.body(size: 12, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
                .lineLimit(1)
                .minimumScaleFactor(0.72)

            Text(profile.velvetAgeLabel ?? profile.premiumDiscoveryCategory)
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .foregroundStyle(VelvetColor.champagneGold)
                .lineLimit(1)
                .minimumScaleFactor(0.72)

            Rectangle()
                .fill(VelvetColor.borderSubtle.opacity(0.72))
                .frame(height: 0.5)

            compactLine(
                symbol: "mappin.and.ellipse",
                text: profile.locationZone ?? profile.city ?? "Zone privée"
            )

            compactLine(
                symbol: history == nil ? "sparkles" : "clock",
                text: visitLabel
            )
        }
        .padding(.horizontal, 9)
        .padding(.top, 8)
        .padding(.bottom, 9)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func compactLine(symbol: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.system(size: 7.5, weight: .medium))
                .foregroundStyle(VelvetColor.champagneGold.opacity(0.78))
                .frame(width: 10)
            Text(text)
                .font(VelvetTypography.caption(size: 8))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.67)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private extension MemberProfile {
    var premiumDiscoveryCategory: String {
        if profileType == .couple {
            return "Couple"
        }

        let identities = (individualProfiles ?? [])
            .compactMap { $0.genderIdentity?.lowercased() }

        if identities.contains(where: {
            $0.contains("non-binaire")
                || $0.contains("nonbinary")
                || $0.contains("non-binary")
                || $0.contains("genderfluid")
                || $0.contains("queer")
        }) {
            return "Non-binaire"
        }

        if identities.contains(where: {
            $0.contains("femme") || $0.contains("woman") || $0.contains("female")
        }) {
            return "Femme seule"
        }

        if identities.contains(where: {
            $0.contains("homme")
                || $0 == "man"
                || ($0.contains("male") && !$0.contains("female"))
        }) {
            return "Homme seul"
        }

        let existing = velvetDemographicLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        if !existing.isEmpty,
           existing.localizedCaseInsensitiveContains("individuel") == false {
            return existing
        }
        return "Membre"
    }
}

private struct PremiumDiscoveryFilters: Equatable {
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
        types.count + seeking.count + practices.count + morphologies.count
            + (city.isEmpty ? 0 : 1) + (nearMe ? 1 : 0)
            + (maleAgeMin == 18 && maleAgeMax == 99 ? 0 : 1)
            + (femaleAgeMin == 18 && femaleAgeMax == 99 ? 0 : 1)
            + (onlineOnly ? 1 : 0) + (withPhotos ? 1 : 0)
            + (withRecommendation ? 1 : 0) + (createdToday ? 1 : 0)
    }

    mutating func reset() { self = PremiumDiscoveryFilters() }
}

private struct PremiumDiscoveryFiltersView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var filters: PremiumDiscoveryFilters
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
        "Pulpeuse / Curvy", "Ronde", "Généreuse", "Forte"
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VelvetPageHeader(
                            "Recherche avancée",
                            title: "Tes critères",
                            subtitle: "Tous les filtres utiles de la version Web, dans une feuille native plus compacte."
                        )

                        filterCard("Type de profil") {
                            choiceGrid(
                                [("couple", "Couples"), ("woman", "Femmes"), ("man", "Hommes")],
                                selection: $filters.types
                            )
                        }

                        filterCard("Attirances recherchées") {
                            choiceGrid(
                                [("Couples", "Couples"), ("Femmes", "Femmes"), ("Hommes", "Hommes")],
                                selection: $filters.seeking
                            )
                        }

                        filterCard("Localisation") {
                            VelvetSearchField(prompt: "Ville ou zone publique", text: $filters.city)
                            Toggle("À moins de 50 km", isOn: $filters.nearMe)
                                .disabled(!locationReady)
                        }

                        filterCard("Âges") {
                            ageRow("Homme", minimum: $filters.maleAgeMin, maximum: $filters.maleAgeMax)
                            ageRow("Femme", minimum: $filters.femaleAgeMin, maximum: $filters.femaleAgeMax)
                        }

                        filterCard("Pratiques") {
                            choiceGrid(practices.map { ($0, $0) }, selection: $filters.practices)
                        }

                        filterCard("Morphologies") {
                            choiceGrid(morphologies.map { ($0, $0) }, selection: $filters.morphologies)
                        }

                        filterCard("Divers") {
                            Toggle("Actuellement connecté", isOn: $filters.onlineOnly)
                                .disabled(!presenceReady)
                            Toggle("Avec photos publiques", isOn: $filters.withPhotos)
                            Toggle("Avec recommandation", isOn: $filters.withRecommendation)
                            Toggle("Profil créé aujourd’hui", isOn: $filters.createdToday)
                        }

                        Button {
                            filters.reset()
                        } label: {
                            Label("Réinitialiser les filtres", systemImage: "arrow.counterclockwise")
                                .font(VelvetTypography.body(size: 13, weight: .semibold))
                                .foregroundStyle(VelvetColor.textSecondary)
                                .frame(maxWidth: .infinity, minHeight: 46)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(20)
                    .padding(.bottom, 80)
                }
            }
            .safeAreaInset(edge: .bottom) {
                VelvetPrimaryButton("Afficher les résultats") { dismiss() }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 11)
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

    private func filterCard<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VelvetCard {
            VStack(alignment: .leading, spacing: 13) {
                Text(title)
                    .font(VelvetTypography.title(size: 20))
                    .foregroundStyle(VelvetColor.ivory)
                content()
                    .tint(VelvetColor.champagneGold)
                    .foregroundStyle(VelvetColor.ivory)
            }
        }
    }

    private func choiceGrid(
        _ values: [(String, String)],
        selection: Binding<Set<String>>
    ) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 112), spacing: 8)], spacing: 8) {
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
                Stepper("à \(maximum.wrappedValue)", value: maximum, in: 18...99)
            }
            .font(VelvetTypography.body(size: 12))
        }
    }
}
