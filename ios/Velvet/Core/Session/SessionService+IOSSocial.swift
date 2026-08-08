import Foundation

private struct PhotoReactionMutationResponse: Decodable, Sendable {
    let ok: Bool
    let summary: PhotoReactionSummary?
}

private struct MessageActionResponse: Decodable, Sendable {
    let ok: Bool
}

extension SessionService {
    func engagementState() async throws -> EngagementResponse {
        try await APIClient().get(
            "/api/members/engagement",
            as: EngagementResponse.self
        )
    }

    func setProfileReactionState(
        profileID: UUID,
        reaction: Int?
    ) async throws -> EngagementResponse {
        struct Request: Encodable, Sendable {
            let profileId: UUID
            let action = "reaction"
            let reaction: Int?
        }
        return try await APIClient().post(
            "/api/members/engagement",
            body: Request(profileId: profileID, reaction: reaction),
            as: EngagementResponse.self
        )
    }

    func photoReactionFeed() async throws -> PhotoReactionFeed {
        try await APIClient().get(
            "/api/members/photo-reactions",
            as: PhotoReactionFeed.self
        )
    }

    func setPhotoReaction(
        mediaID: UUID,
        reaction: String?
    ) async throws -> PhotoReactionSummary? {
        struct Request: Encodable, Sendable {
            let mediaId: UUID
            let reaction: String?
        }
        return try await APIClient().post(
            "/api/members/photo-reactions",
            body: Request(mediaId: mediaID, reaction: reaction),
            as: PhotoReactionMutationResponse.self
        ).summary
    }

    func markNotificationRead(id: UUID) async throws -> NotificationFeed {
        struct Request: Encodable, Sendable {
            let action = "read"
            let notificationId: UUID
        }
        return try await APIClient().post(
            "/api/members/notifications",
            body: Request(notificationId: id),
            as: NotificationFeed.self
        )
    }

    func archivedNotifications() async throws -> NotificationFeed {
        try await APIClient().get(
            "/api/members/notifications?archived=1",
            as: NotificationFeed.self
        )
    }

    func consumeNotifications(entityType: String, entityID: UUID) async throws -> NotificationFeed {
        struct Request: Encodable, Sendable {
            let action = "consume_entity"
            let entityType: String
            let entityId: UUID
        }
        return try await APIClient().post(
            "/api/members/notifications",
            body: Request(entityType: entityType, entityId: entityID),
            as: NotificationFeed.self
        )
    }

    func setConversationTyping(
        conversationID: UUID,
        active: Bool
    ) async throws {
        struct Request: Encodable, Sendable {
            let action = "typing"
            let conversationId: UUID
            let active: Bool
        }
        _ = try await APIClient().post(
            "/api/members/messages",
            body: Request(conversationId: conversationID, active: active),
            as: MessageActionResponse.self
        )
    }

    func setMessageReaction(
        conversationID: UUID,
        messageID: UUID,
        reaction: String?
    ) async throws {
        struct Request: Encodable, Sendable {
            let action = "reaction"
            let conversationId: UUID
            let messageId: UUID
            let reaction: String?
        }
        _ = try await APIClient().post(
            "/api/members/messages",
            body: Request(
                conversationId: conversationID,
                messageId: messageID,
                reaction: reaction
            ),
            as: MessageActionResponse.self
        )
    }

    func markConversationDelivered(conversationID: UUID) async throws {
        struct Request: Encodable, Sendable {
            let action = "delivered"
            let conversationId: UUID
        }
        _ = try await APIClient().post(
            "/api/members/messages",
            body: Request(conversationId: conversationID),
            as: MessageActionResponse.self
        )
    }

    func markConversationRead(conversationID: UUID) async throws {
        struct Request: Encodable, Sendable {
            let action = "read"
            let conversationId: UUID
        }
        _ = try await APIClient().post(
            "/api/members/messages",
            body: Request(conversationId: conversationID),
            as: MessageActionResponse.self
        )
    }

    func sendMessage(
        _ body: String,
        conversationID: UUID,
        attachments: [OutgoingMessageAttachment]
    ) async throws -> DirectoryMessage {
        if attachments.isEmpty {
            return try await sendMessage(body, conversationID: conversationID)
        }

        var parts: [MultipartPart] = [
            .field("conversationId", value: conversationID.uuidString),
            .field("body", value: body)
        ]
        parts.append(contentsOf: attachments.prefix(4).map { attachment in
            .file(
                "attachments",
                fileName: attachment.fileName,
                mimeType: attachment.mimeType,
                data: attachment.data
            )
        })

        let response = try await APIClient().upload(
            "/api/members/message-media",
            parts: parts,
            as: CreatedMessageResponse.self
        )
        return response.message
    }
}
