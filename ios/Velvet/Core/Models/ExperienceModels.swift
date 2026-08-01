import Foundation

struct HomeIntelligenceResponse: Codable, Sendable {
    let generatedAt: String
    let preferences: HomeExperiencePreferences
    let curatedProfiles: [IntelligentProfile]
    let nearbyClubs: [IntelligentClub]
    let nearbyEvents: [IntelligentEvent]
    let followedActivities: [FollowedActivity]
    let allProfiles: [IntelligentProfile]
    let explanation: String?
}

struct HomeExperiencePreferences: Codable, Sendable {
    let radiusKm: Int
    let profileSort: String
    let aiPersonalizationEnabled: Bool
    let locationEnabled: Bool
}

struct IntelligentProfile: Codable, Identifiable, Sendable {
    let id: UUID
    let displayName: String
    let profileType: String?
    let audience: String
    let demographicLabel: String
    let ageLabel: String?
    let locationZone: String?
    let photoUrl: URL?
    let createdAt: String?
    let updatedAt: String?
    let practices: [String]
    let values: [String]
    let distanceKm: Double?
    let reaction: Int
    let recommendationCount: Int
    let compatibilityScore: Int

    var affinitySymbol: String? {
        switch reaction {
        case ..<0: "❄️"
        case 1: "🔥"
        case 2: "🔥🔥"
        case 3...: "🔥🔥🔥"
        default: nil
        }
    }
}

struct IntelligentClub: Codable, Identifiable, Sendable {
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
    let frequented: Bool
}

struct IntelligentEvent: Codable, Identifiable, Sendable {
    let id: UUID
    let ownerType: String?
    let establishmentId: UUID?
    let organizerProfileId: UUID?
    let title: String
    let description: String?
    let startsAt: String
    let endsAt: String?
    let capacity: Int?
    let locationPublic: String?
    let audience: String?
    let priceCents: Int?
    let currency: String?
    let registrationOpen: Bool?
    let dressCode: String?
    let eventCategory: String?
    let capZone: String?
    let capVenue: String?
    let createdAt: String?
    let updatedAt: String?
    let distanceKm: Double?
    let frequentedClub: Bool?

    var isCapDAgde: Bool { eventCategory == "cap_dagde" }
}

struct FollowedActivity: Codable, Identifiable, Sendable {
    let id: String
    let type: String
    let profileId: UUID?
    let eventId: UUID?
    let profileName: String?
    let title: String
    let detail: String?
    let createdAt: String?
    let previewUrl: URL?
}

struct EventDetailsResponse: Codable, Sendable {
    let event: IntelligentEvent
    let participants: [EventParticipant]
    let registrationCount: Int
    let myRegistration: EventRegistration?
    let canManage: Bool
}

struct EventParticipant: Codable, Identifiable, Sendable {
    var id: UUID { profile.id }
    let profile: MemberProfile
    let registration: EventRegistration?
}

struct EventRegistration: Codable, Identifiable, Sendable {
    let id: UUID
    let eventId: UUID?
    let userId: UUID?
    let places: Int?
    let status: String?
    let visibleToParticipants: Bool?
    let createdAt: String?
    let updatedAt: String?
}

struct CreatedEventResponse: Codable, Sendable {
    let ok: Bool
    let event: IntelligentEvent?
    let moderation: JSONDocument?
    let publicationStatus: String?
}

struct DeletedMediaResponse: Codable, Sendable {
    let ok: Bool
    let deletedMediaId: UUID
    let mediaScope: String
    let remainingPublicProfilePhotos: Int
    let profileVisible: Bool
    let warning: String?
}

struct ConversationRemovalResponse: Codable, Sendable {
    let ok: Bool
    let conversationId: UUID
    let hiddenAt: String?
}
