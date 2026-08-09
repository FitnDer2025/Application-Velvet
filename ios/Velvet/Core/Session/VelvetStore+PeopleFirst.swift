import Foundation

extension VelvetStore {
    var profile: MemberProfile? {
        if let id = engagementState.currentProfileId {
            return directory?.profiles.first(where: { $0.id == id })
        }
        return nil
    }

    func intelligentEvent(id: UUID) -> IntelligentEvent? {
        guard let event = directory?.events.first(where: { $0.id == id }) else { return nil }
        return IntelligentEvent(
            id: event.id,
            ownerType: nil,
            establishmentId: nil,
            organizerProfileId: nil,
            title: event.title,
            description: event.description,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            capacity: event.capacity,
            locationPublic: event.locationPublic,
            audience: nil,
            priceCents: event.priceCents,
            currency: event.currency,
            registrationOpen: event.registrationOpen,
            dressCode: event.dressCode,
            eventCategory: nil,
            capZone: nil,
            capVenue: nil,
            createdAt: nil,
            updatedAt: nil,
            distanceKm: nil,
            frequentedClub: nil
        )
    }
}