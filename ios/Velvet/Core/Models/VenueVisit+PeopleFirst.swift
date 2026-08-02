import Foundation

extension Sequence where Element == VenueVisit {
    /// Spécialisation locale utilisée par les vues sociales afin que Swift
    /// connaisse explicitement le type des profils produits par une visite.
    func compactMap(
        _ transform: (VenueVisit) throws -> MemberProfile?
    ) rethrows -> [MemberProfile] {
        var profiles: [MemberProfile] = []
        for visit in self {
            if let profile = try transform(visit) {
                profiles.append(profile)
            }
        }
        return profiles
    }
}