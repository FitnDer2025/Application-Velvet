import Foundation

struct ZwitConversationRequestEnvelope: Decodable, Sendable {
    let request: ZwitConversationRequestState?
}

struct ZwitConversationRequestDecisionResponse: Decodable, Sendable {
    let ok: Bool
    let request: ZwitConversationRequestState?
}

struct ZwitConversationRequestState: Decodable, Sendable, Equatable {
    let status: String
    let role: String
    let canSend: Bool
    let introMessagesSent: Int
    let followUpAt: String?

    var isAccepted: Bool { status == "accepted" || role == "legacy" }
    var isIncoming: Bool { status == "pending" && role == "recipient" }
    var isDeclined: Bool { status == "declined" }

    var statusTitle: String {
        if isAccepted { return "Conversation ouverte" }
        if isIncoming { return "Nouvelle demande" }
        if isDeclined { return "Demande déclinée" }
        if introMessagesSent == 0 { return "Premier contact" }
        if canSend { return "Relance unique disponible" }
        return "En attente d’une réponse"
    }
}

struct ZwitVoiceMessageResponse: Decodable, Sendable {
    let ok: Bool
    let message: ZwitVoiceMessage
}

struct ZwitVoiceMessage: Decodable, Sendable {
    let id: UUID?
    let conversationId: UUID?
    let createdAt: String?
    let attachments: [ZwitVoiceAttachment]
}

struct ZwitVoiceAttachment: Decodable, Sendable {
    let id: UUID?
    let mimeType: String?
    let originalName: String?
    let sizeBytes: Int?
    let kind: String?
    let durationSeconds: Int?
    let previewUrl: URL?
}
