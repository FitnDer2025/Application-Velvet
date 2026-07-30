import Foundation

struct MediaAsset: Codable, Identifiable, Sendable {
    let id: UUID
    let mediaRole: String?
    let isPrimary: Bool?
    let moderationStatus: String?
    let previewUrl: URL?
}

struct DirectoryResponse: Decodable, Sendable {
    let locked: Bool?
    let profiles: [MemberProfile]
    let establishments: [Establishment]
    let venueDirectory: [Venue]
    let events: [VelvetEvent]
    let conversations: [Conversation]
    let currentUserId: UUID?
}

struct Establishment: Codable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let kind: String?
    let description: String?
    let city: String?
    let addressPublic: String?
    let phonePublic: String?
    let emailPublic: String?
    let amenities: [String]?
    let verifiedAt: String?
}

struct Venue: Codable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let kind: String?
    let categoryPrimary: String?
    let categoryTags: [String]?
    let city: String?
    let countryCode: String?
    let addressPublic: String?
    let website: String?
    let verificationStatus: String?
    let distanceKm: Double?
}

struct VelvetEvent: Codable, Identifiable, Sendable {
    let id: UUID
    let title: String
    let description: String?
    let startsAt: String
    let endsAt: String?
    let capacity: Int?
    let locationPublic: String?
    let priceCents: Int?
    let currency: String?
    let registrationOpen: Bool?
    let dressCode: String?
}

struct Conversation: Codable, Identifiable, Sendable {
    let id: UUID
    let kind: String?
    let eventId: UUID?
    let subject: String?
    let createdAt: String?
    let updatedAt: String?
    let conversationMembers: [ConversationMember]?

    var title: String {
        if let subject, !subject.isEmpty { return subject }
        return kind == "event" ? "Salon Velvet" : "Conversation privée"
    }
}

struct ConversationMember: Codable, Sendable {
    let displayIdentity: String?
    let userId: UUID?
    let lastReadAt: String?
}

struct DirectoryMessage: Codable, Identifiable, Sendable {
    let id: UUID
    let conversationId: UUID
    let senderUserId: UUID?
    let senderIdentity: String?
    let body: String?
    let createdAt: String
    let editedAt: String?
    let attachments: [MessageAttachment]?
}

struct MessageAttachment: Codable, Identifiable, Sendable {
    let id: UUID
    let mediaType: String?
    let mimeType: String?
    let originalName: String?
    let sizeBytes: Int?
    let previewUrl: URL?
}

struct MessagesResponse: Decodable, Sendable {
    let messages: [DirectoryMessage]
    let currentUserId: UUID?
}

struct CreatedMessageResponse: Decodable, Sendable {
    let ok: Bool
    let message: DirectoryMessage
}

struct NotificationFeed: Decodable, Sendable {
    let notifications: [VelvetNotification]
    let unreadCount: Int
}

struct VelvetNotification: Codable, Identifiable, Sendable {
    let id: UUID
    let eventType: String
    let entityType: String?
    let entityId: UUID?
    let title: String
    let body: String?
    let readAt: String?
    let createdAt: String
}

struct SocialActionState: Decodable, Sendable {
    let favorite: Bool
    let blocked: Bool
}

struct EventRegistrationResponse: Decodable, Sendable {
    let ok: Bool
    let status: String?
}
