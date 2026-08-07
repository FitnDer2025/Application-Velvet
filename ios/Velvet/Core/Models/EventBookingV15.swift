import Foundation

struct ZwitEventBookingResponse: Decodable, Sendable {
    let event: ZwitEventBookingEvent?
    let booking: ZwitEventBookingState?
    let myRegistration: ZwitEventBookingRegistration?
    let participants: [ZwitEventBookingParticipant]
    let participantProfilesVisible: Bool?
    let privacy: String?
}

struct ZwitEventBookingEvent: Decodable, Sendable {
    let id: UUID
    let title: String
    let startsAt: String
    let endsAt: String?
    let capacity: Int?
    let registrationOpen: Bool?
    let registrationMode: String?
    let registrationClosesAt: String?
    let maxPlacesPerRegistration: Int?
    let guestListEnabled: Bool?
}

struct ZwitEventBookingState: Decodable, Sendable {
    let capacity: Int?
    let occupiedPlaces: Int?
    let pendingPlaces: Int?
    let waitlistedPlaces: Int?
    let placesRemaining: Int?
    let registrationOpen: Bool?
    let registrationMode: String?
    let registrationClosesAt: String?
    let maxPlacesPerRegistration: Int?
    let guestListEnabled: Bool?

    var isFull: Bool {
        guard capacity != nil, let placesRemaining else { return false }
        return placesRemaining <= 0
    }
}

struct ZwitEventBookingRegistration: Decodable, Identifiable, Sendable {
    let id: UUID
    let places: Int?
    let status: String?
    let visibleToParticipants: Bool?
    let createdAt: String?
    let updatedAt: String?

    var statusLabel: String {
        switch status {
        case "confirmed": "Réservation confirmée"
        case "pending": "En attente de validation"
        case "waitlisted": "Liste d’attente"
        case "checked_in": "Présence confirmée"
        default: "Participation enregistrée"
        }
    }
}

struct ZwitEventBookingParticipant: Decodable, Identifiable, Sendable {
    var id: UUID { profileId }
    let profileId: UUID
    let displayName: String
    let profileType: String?
    let locationZone: String?
    let photoUrl: URL?
}

struct ZwitEventBookingMutationResponse: Decodable, Sendable {
    let ok: Bool
    let status: String?
    let registration: ZwitEventBookingRegistration?
    let promotedCount: Int?
}
