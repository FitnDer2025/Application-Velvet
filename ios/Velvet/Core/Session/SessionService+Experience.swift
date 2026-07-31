import Foundation

private struct ExperiencePreferencesResponse: Codable, Sendable {
    let ok: Bool?
    let preferences: ExperiencePreferences
}

extension SessionService {
    func homeIntelligence() async throws -> HomeIntelligenceResponse {
        try await APIClient().get(
            "/api/members/home-intelligence",
            as: HomeIntelligenceResponse.self
        )
    }

    func saveExperiencePreferences(
        radiusKm: Int,
        profileSort: String,
        aiPersonalizationEnabled: Bool
    ) async throws -> ExperiencePreferences {
        struct Request: Encodable, Sendable {
            let discoveryRadiusKm: Int
            let profileSort: String
            let aiPersonalizationEnabled: Bool
        }
        return try await APIClient().post(
            "/api/members/experience-preferences",
            body: Request(
                discoveryRadiusKm: radiusKm,
                profileSort: profileSort,
                aiPersonalizationEnabled: aiPersonalizationEnabled
            ),
            as: ExperiencePreferencesResponse.self
        ).preferences
    }

    func deleteProfileMedia(id: UUID) async throws -> DeletedMediaResponse {
        try await APIClient().delete(
            "/api/members/photo-management",
            query: [URLQueryItem(name: "id", value: id.uuidString)],
            as: DeletedMediaResponse.self
        )
    }

    func removeConversation(id: UUID) async throws -> ConversationRemovalResponse {
        try await APIClient().delete(
            "/api/members/conversations",
            query: [URLQueryItem(name: "id", value: id.uuidString)],
            as: ConversationRemovalResponse.self
        )
    }

    func eventDetails(id: UUID) async throws -> EventDetailsResponse {
        try await APIClient().get(
            "/api/members/events",
            query: [URLQueryItem(name: "eventId", value: id.uuidString)],
            as: EventDetailsResponse.self
        )
    }

    func createEvent(
        title: String,
        description: String,
        startsAt: Date,
        endsAt: Date?,
        locationPublic: String,
        capacity: Int,
        audience: String,
        dressCode: String?,
        category: String,
        capZone: String?,
        capVenue: String?
    ) async throws -> CreatedEventResponse {
        struct Request: Encodable, Sendable {
            let title: String
            let description: String
            let startsAt: String
            let endsAt: String?
            let locationPublic: String
            let capacity: Int
            let audience: String
            let dressCode: String?
            let eventCategory: String
            let capZone: String?
            let capVenue: String?
            let registrationOpen = true
        }
        let formatter = ISO8601DateFormatter()
        return try await APIClient().post(
            "/api/members/events",
            body: Request(
                title: title,
                description: description,
                startsAt: formatter.string(from: startsAt),
                endsAt: endsAt.map(formatter.string(from:)),
                locationPublic: locationPublic,
                capacity: capacity,
                audience: audience,
                dressCode: dressCode,
                eventCategory: category,
                capZone: capZone,
                capVenue: capVenue
            ),
            as: CreatedEventResponse.self
        )
    }

    func deleteEvent(id: UUID) async throws {
        let _: AcknowledgementResponse = try await APIClient().delete(
            "/api/members/events",
            query: [URLQueryItem(name: "id", value: id.uuidString)],
            as: AcknowledgementResponse.self
        )
    }
}
