import Foundation

extension SessionService {
    func eventBooking(id: UUID) async throws -> ZwitEventBookingResponse {
        try await APIClient().get(
            "/api/members/event-registrations",
            query: [URLQueryItem(name: "eventId", value: id.uuidString)],
            as: ZwitEventBookingResponse.self
        )
    }

    func reserveEvent(
        id: UUID,
        places: Int = 1,
        visibleToParticipants: Bool = true
    ) async throws -> ZwitEventBookingMutationResponse {
        struct Request: Encodable, Sendable {
            let eventId: UUID
            let places: Int
            let visibleToParticipants: Bool
        }
        return try await APIClient().post(
            "/api/members/event-registrations",
            body: Request(
                eventId: id,
                places: max(1, min(12, places)),
                visibleToParticipants: visibleToParticipants
            ),
            as: ZwitEventBookingMutationResponse.self
        )
    }

    func cancelEventBooking(id: UUID) async throws -> ZwitEventBookingMutationResponse {
        struct Request: Encodable, Sendable {
            let eventId: UUID
            let action = "cancel"
        }
        return try await APIClient().post(
            "/api/members/event-registrations",
            body: Request(eventId: id),
            as: ZwitEventBookingMutationResponse.self
        )
    }
}
