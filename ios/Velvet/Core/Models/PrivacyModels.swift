import Foundation

struct LocationResponse: Decodable, Sendable {
    struct LocationState: Decodable, Sendable {
        let enabled: Bool
        let precisionKm: Int
        let exactCoordinatesStored: Bool
    }
    let location: LocationState
    let nearbyVenues: [Venue]
}

struct AccountDeletionResponse: Decodable, Sendable {
    let ok: Bool
    let deleted: Bool
}
