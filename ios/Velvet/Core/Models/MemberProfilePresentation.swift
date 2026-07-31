import Foundation

extension MemberProfile {
    var velvetAgeLabel: String? {
        let currentYear = Calendar.current.component(.year, from: Date())
        let ages = (individualProfiles ?? [])
            .compactMap(\.birthYear)
            .map { currentYear - $0 }
            .filter { $0 >= 18 && $0 <= 120 }

        guard !ages.isEmpty else { return nil }
        if profileType == .couple {
            return ages.map(String.init).joined(separator: " · ") + " ans"
        }
        return "\(ages[0]) ans"
    }

    var velvetDemographicLabel: String {
        guard profileType != .couple else { return "Couple" }
        let value = (individualProfiles?.first?.genderIdentity ?? "").lowercased()

        if value.contains("trans") {
            if value.contains("femme") { return "Femme trans" }
            if value.contains("homme") { return "Homme trans" }
            return "Profil trans"
        }
        if value.contains("non binaire") || value.contains("non-binaire")
            || value.contains("fluid") || value.contains("queer") {
            return "Profil non-binaire"
        }
        if value.contains("femme") || value.contains("woman") || value.contains("female") {
            return "Femme seule"
        }
        if value.contains("homme") || value.contains("man") || value.contains("male") {
            return "Homme seul"
        }
        return "Profil individuel"
    }

    var velvetDemographicAndAgeLabel: String {
        if let velvetAgeLabel {
            return "\(velvetDemographicLabel) · \(velvetAgeLabel)"
        }
        return velvetDemographicLabel
    }

    /// La relation `media_assets` peut également contenir les médias d’albums.
    /// Le carrousel principal ne conserve que les photos publiques de la fiche.
    var profileGalleryPhotos: [MediaAsset] {
        approvedPhotos.filter { media in
            let role = (media.mediaRole ?? "").lowercased()
            return !role.contains("album") && !role.contains("private")
        }
    }

    var isCoupleProfile: Bool { profileType == .couple }

    var ownUniverseTitle: String { isCoupleProfile ? "Notre univers" : "Mon univers" }
    var ownStoryTitle: String { isCoupleProfile ? "Notre histoire" : "Mon histoire" }
    var ownJourneyTitle: String { isCoupleProfile ? "Notre parcours" : "Mon parcours" }
    var ownSearchTitle: String { isCoupleProfile ? "Ce que nous recherchons" : "Ce que je recherche" }
    var ownDesiresEyebrow: String { isCoupleProfile ? "Nos envies" : "Mes envies" }
    var ownPlacesTitle: String { isCoupleProfile ? "Nos repères" : "Mes repères" }
    var ownAvailabilityTitle: String { isCoupleProfile ? "Quand nous rencontrer" : "Quand me rencontrer" }

    var memberUniverseTitle: String { isCoupleProfile ? "Leur univers" : "Son univers" }
    var memberStoryTitle: String { isCoupleProfile ? "Leur histoire" : "Son histoire" }
    var memberJourneyTitle: String { isCoupleProfile ? "Leur parcours" : "Son parcours" }
    var memberSearchTitle: String { isCoupleProfile ? "Ce qu’ils recherchent" : "Ce que cette personne recherche" }
    var memberDesiresEyebrow: String { isCoupleProfile ? "Leurs envies" : "Ses envies" }
    var memberPlacesTitle: String { isCoupleProfile ? "Leurs repères" : "Ses repères" }
    var memberAvailabilityTitle: String { isCoupleProfile ? "Quand les rencontrer" : "Quand rencontrer ce membre" }
}
