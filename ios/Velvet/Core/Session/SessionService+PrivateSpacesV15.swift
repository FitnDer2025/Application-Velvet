import Foundation

private struct PrivateSpaceActionRequestV15: Encodable, Sendable {
    let action: String
    let spaceId: UUID?
    let eventId: UUID?
    let profileId: UUID?
    let title: String?
    let description: String?
    let message: String?
    let messageId: Int?
    let reason: String?
}

extension SessionService {
    func privateSpacesV15() async throws -> PrivateSpacesV15Envelope {
        try await APIClient().get("/api/members/spaces")
    }

    func privateSpaceV15(spaceID: UUID, afterMessageID: Int = 0) async throws -> PrivateSpaceDetailV15Envelope {
        try await APIClient().get(
            "/api/members/spaces",
            query: [
                URLQueryItem(name: "spaceId", value: spaceID.uuidString),
                URLQueryItem(name: "afterMessageId", value: String(max(0, afterMessageID)))
            ]
        )
    }

    func createCircleV15(title: String, description: String?) async throws -> UUID? {
        let response: PrivateSpaceActionV15Response = try await APIClient().post(
            "/api/members/spaces",
            body: PrivateSpaceActionRequestV15(
                action: "create_circle", spaceId: nil, eventId: nil, profileId: nil,
                title: title, description: description, message: nil, messageId: nil, reason: nil
            )
        )
        return response.spaceId
    }

    func inviteProfileToCircleV15(spaceID: UUID, profileID: UUID) async throws {
        let _: PrivateSpaceActionV15Response = try await APIClient().post(
            "/api/members/spaces",
            body: PrivateSpaceActionRequestV15(
                action: "invite_profile", spaceId: spaceID, eventId: nil, profileId: profileID,
                title: nil, description: nil, message: nil, messageId: nil, reason: nil
            )
        )
    }

    func acceptSpaceInviteV15(spaceID: UUID) async throws {
        let _: PrivateSpaceActionV15Response = try await APIClient().post(
            "/api/members/spaces",
            body: PrivateSpaceActionRequestV15(
                action: "accept_invite", spaceId: spaceID, eventId: nil, profileId: nil,
                title: nil, description: nil, message: nil, messageId: nil, reason: nil
            )
        )
    }

    func eventChatV15(eventID: UUID) async throws -> UUID? {
        let response: PrivateSpaceActionV15Response = try await APIClient().post(
            "/api/members/spaces",
            body: PrivateSpaceActionRequestV15(
                action: "event_chat", spaceId: nil, eventId: eventID, profileId: nil,
                title: nil, description: nil, message: nil, messageId: nil, reason: nil
            )
        )
        return response.spaceId
    }

    func sendSpaceMessageV15(spaceID: UUID, message: String) async throws -> Int? {
        let response: PrivateSpaceActionV15Response = try await APIClient().post(
            "/api/members/spaces",
            body: PrivateSpaceActionRequestV15(
                action: "send", spaceId: spaceID, eventId: nil, profileId: nil,
                title: nil, description: nil, message: message, messageId: nil, reason: nil
            )
        )
        return response.messageId
    }

    func leaveSpaceV15(spaceID: UUID) async throws {
        let _: PrivateSpaceActionV15Response = try await APIClient().post(
            "/api/members/spaces",
            body: PrivateSpaceActionRequestV15(
                action: "leave", spaceId: spaceID, eventId: nil, profileId: nil,
                title: nil, description: nil, message: nil, messageId: nil, reason: nil
            )
        )
    }

    func reportSpaceMessageV15(spaceID: UUID, messageID: Int, reason: String) async throws {
        let _: PrivateSpaceActionV15Response = try await APIClient().post(
            "/api/members/spaces",
            body: PrivateSpaceActionRequestV15(
                action: "report", spaceId: spaceID, eventId: nil, profileId: nil,
                title: nil, description: nil, message: nil, messageId: messageID, reason: reason
            )
        )
    }
}
