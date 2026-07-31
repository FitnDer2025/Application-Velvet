import Foundation

struct MediaAsset: Codable, Identifiable, Sendable {
    let id: UUID
    let individualProfileId: UUID?
    let ownerUserId: UUID?
    let mediaRole: String?
    let isPrimary: Bool?
    let moderationStatus: String?
    let previewUrl: URL?
    let createdAt: String?
}

struct DirectoryResponse: Decodable, Sendable {
    let locked: Bool?
    let profiles: [MemberProfile]
    let establishments: [Establishment]
    let venueDirectory: [Venue]
    let events: [VelvetEvent]
    let conversations: [Conversation]
    let recommendations: [Recommendation]?
    let messageUnreadCount: Int?
    let currentUserId: UUID?
}

struct Recommendation: Codable, Identifiable, Sendable {
    let id: UUID
    let authorProfileId: UUID?
    let targetType: String?
    let targetId: UUID?
    let body: String?
    let rating: Int?
    let createdAt: String?
}

struct ProfileAlbum: Codable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let confidentiality: String?
    let expiresAt: String?
    let createdAt: String?
    let mediaAssets: [AlbumMediaAsset]?
}

struct AlbumMediaAsset: Codable, Identifiable, Sendable {
    let id: UUID
    let ownerUserId: UUID?
    let mediaType: String?
    let moderationStatus: String?
    let previewUrl: URL?
    let createdAt: String?
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
    let participantProfileId: UUID?
    let participantDisplayName: String?
    let participantPhotoUrl: URL?
    let lastMessageBody: String?
    let lastMessageAt: String?
    let unreadCount: Int?

    var title: String {
        if kind != "event", let participantDisplayName, !participantDisplayName.isEmpty {
            return participantDisplayName
        }
        if let subject, !subject.isEmpty { return subject }
        return kind == "event" ? "Salon Velvet" : "Membre Velvet"
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

struct MemberMapResponse: Decodable, Sendable {
    let center: MapCenter
    let members: [MemberMapMarker]
    let venues: [VenueMapMarker]
    let events: [EventMapMarker]
    let privacy: MapPrivacy?
}

struct MapCenter: Decodable, Sendable {
    let latitude: Double
    let longitude: Double
    let zoom: Double?
    let radiusKm: Double?
    let source: String?
}

struct MemberMapMarker: Decodable, Identifiable, Sendable {
    let id: UUID
    let type: String
    let profileType: String?
    let name: String
    let zone: String?
    let latitude: Double
    let longitude: Double
    let photoUrl: URL?
}

struct VenueMapMarker: Decodable, Identifiable, Sendable {
    let id: UUID
    let type: String
    let name: String
    let kind: String?
    let categoryPrimary: String?
    let city: String?
    let latitude: Double
    let longitude: Double
    let website: String?
    let verificationStatus: String?
}

struct EventMapMarker: Decodable, Identifiable, Sendable {
    let id: UUID
    let type: String
    let title: String
    let startsAt: String?
    let locationPublic: String?
    let latitude: Double
    let longitude: Double
}

struct MapPrivacy: Decodable, Sendable {
    let exactMemberCoordinatesExposed: Bool?
    let memberMarkerMeaning: String?
    let venueMarkerMeaning: String?
}

struct DiscoveryStateResponse: Decodable, Sendable {
    let presence: [PresenceSnapshot]
    let following: [UUID]?
    let access: MemberAccess?
    let persistenceAvailable: Bool?
    let presenceAvailable: Bool?
}

struct PresenceSnapshot: Decodable, Sendable {
    let profileId: UUID
    let presenceStatus: String
}
