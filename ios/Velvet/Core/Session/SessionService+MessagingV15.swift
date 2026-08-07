import Foundation

extension SessionService {
    func conversationRequest(conversationID: UUID) async throws -> ZwitConversationRequestState? {
        let response: ZwitConversationRequestEnvelope = try await APIClient().get(
            "/api/members/conversation-request",
            query: [URLQueryItem(name: "conversationId", value: conversationID.uuidString)]
        )
        return response.request
    }

    func decideConversationRequest(
        conversationID: UUID,
        accept: Bool
    ) async throws -> ZwitConversationRequestState? {
        struct Request: Encodable, Sendable {
            let conversationId: UUID
            let decision: String
        }
        let response: ZwitConversationRequestDecisionResponse = try await APIClient().patch(
            "/api/members/conversation-request",
            body: Request(conversationId: conversationID, decision: accept ? "accept" : "decline")
        )
        return response.request
    }

    func sendVoiceMessage(
        conversationID: UUID,
        data: Data,
        durationSeconds: Int,
        mimeType: String = "audio/mp4"
    ) async throws -> ZwitVoiceMessage {
        let duration = max(1, min(300, durationSeconds))
        guard data.count <= 12 * 1024 * 1024 else {
            throw APIError.transport("Le message vocal dépasse 12 Mo.")
        }
        let fileExtension = mimeType.contains("mpeg") ? "mp3" : mimeType.contains("ogg") ? "ogg" : mimeType.contains("webm") ? "webm" : "m4a"
        let response: ZwitVoiceMessageResponse = try await APIClient().upload(
            "/api/members/voice-message",
            parts: [
                .field("conversationId", value: conversationID.uuidString),
                .field("durationSeconds", value: String(duration)),
                .file(
                    "voice",
                    fileName: "vocal-zwit-\(UUID().uuidString).\(fileExtension)",
                    mimeType: mimeType,
                    data: data
                )
            ]
        )
        return response.message
    }
}
