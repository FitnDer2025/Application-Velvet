import Foundation

struct PrivateSpacesV15Envelope: Decodable, Sendable {
    let spaces: [PrivateSpaceV15]
    let eventChatCandidates: [EventChatCandidateV15]?
}

struct PrivateSpaceV15: Decodable, Identifiable, Sendable, Equatable {
    let spaceId: UUID
    let kind: String
    let title: String
    let description: String?
    let eventId: UUID?
    let role: String
    let status: String
    let memberCount: Int
    let unreadCount: Int
    let lastMessageAt: String?
    let closesAt: String?

    var id: UUID { spaceId }
    var isInvitation: Bool { status == "invited" }
    var isEventChat: Bool { kind == "event" }
}

struct EventChatCandidateV15: Decodable, Identifiable, Sendable, Equatable {
    let eventId: UUID
    let title: String
    let startsAt: String
    let chatOpen: Bool
    var id: UUID { eventId }
}

struct PrivateSpaceDetailV15Envelope: Decodable, Sendable {
    let spaceId: UUID
    let messages: [PrivateSpaceMessageV15]
    let members: [PrivateSpaceMemberV15]
}

struct PrivateSpaceMessageV15: Decodable, Identifiable, Sendable, Equatable {
    let messageId: Int
    let body: String
    let createdAt: String
    let mine: Bool
    let senderProfileId: UUID?
    let senderDisplayName: String?
    var id: Int { messageId }
}

struct PrivateSpaceMemberV15: Decodable, Identifiable, Sendable, Equatable {
    let profileId: UUID?
    let displayName: String?
    let role: String
    let membershipStatus: String
    let mine: Bool
    var id: String { "\(profileId?.uuidString ?? displayName ?? "member")-\(role)-\(mine)" }
}

struct PrivateSpaceActionV15Response: Decodable, Sendable {
    let ok: Bool
    let spaceId: UUID?
    let messageId: Int?
}
