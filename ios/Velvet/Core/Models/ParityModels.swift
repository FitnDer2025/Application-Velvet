import Foundation

enum JSONValue: Codable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            self = .array(try container.decode([JSONValue].self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case let .string(value): try container.encode(value)
        case let .number(value): try container.encode(value)
        case let .bool(value): try container.encode(value)
        case let .object(value): try container.encode(value)
        case let .array(value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

typealias JSONDocument = [String: JSONValue]

struct MemberSettingsResponse: Codable, Sendable {
    let ok: Bool?
    let privacy: PrivacyAudienceSettings
    let notifications: NotificationPreferences
    let location: LocationPreferences
    let experience: ExperiencePreferences
    let verification: VerificationPreferences
    let profileVerificationStatus: String?
    let verificationProviderConfigured: Bool?
    let exactLocationStored: Bool?
    let identityDocumentsStoredByVelvet: Bool?
    let verificationBlocksAccess: Bool?
}

struct PrivacyAudienceSettings: Codable, Sendable {
    let profileId: UUID?
    let discoverableBy: [String]
    let contactableBy: [String]
}

struct NotificationPreferences: Codable, Sendable {
    let userId: UUID?
    let notifyFrom: [String]
    let eventTypes: NotificationEventPreferences
    let inAppEnabled: Bool
    let browserEnabled: Bool
    let emailEnabled: Bool
    let quietHoursStart: String?
    let quietHoursEnd: String?
}

struct NotificationEventPreferences: Codable, Sendable {
    var messages: Bool
    var likes: Bool
    var albumAccess: Bool
    var profileViews: Bool
    var events: Bool
    var recommendations: Bool
    var security: Bool
}

struct LocationPreferences: Codable, Sendable {
    let userId: UUID?
    let enabled: Bool
    let precisionKm: Int
}

struct ExperiencePreferences: Codable, Sendable {
    let userId: UUID?
    let discoveryRadiusKm: Int
    let profileSort: String
    let aiPersonalizationEnabled: Bool
    let updatedAt: String?
}

struct VerificationPreferences: Codable, Sendable {
    let userId: UUID?
    let provider: String?
    let status: String
    let identityVerified: Bool
    let majorityVerified: Bool
}

struct MemberSettingsRequest: Encodable, Sendable {
    let discoverableBy: [String]
    let contactableBy: [String]
    let notifyFrom: [String]
    let eventTypes: NotificationEventPreferences
    let inAppEnabled: Bool
    let browserEnabled: Bool
    let emailEnabled: Bool
    let quietHoursStart: String?
    let quietHoursEnd: String?
    let discoveryRadiusKm: Int
    let profileSort: String
    let aiPersonalizationEnabled: Bool
}

struct OrganizerRequestState: Codable, Identifiable, Sendable {
    let id: UUID
    let status: String
    let message: String?
    let createdAt: String?
    let reviewedAt: String?
}

struct OrganizerRequestResponse: Codable, Sendable {
    let ok: Bool?
    let request: OrganizerRequestState?
}

struct ProfileCopyResponse: Codable, Sendable {
    let ok: Bool
    let text: String
    let model: String?
    let purpose: String?
}

struct PlanStateResponse: Codable, Sendable {
    let ok: Bool?
    let venueVisits: [VenueVisit]
    let travelPlans: [TravelPlan]
    let eventPlans: [JSONValue]
}

struct VenueVisit: Codable, Identifiable, Sendable {
    let id: UUID
    let profileId: UUID?
    let venueId: UUID
    let visitDate: String
    let venueDirectory: Venue?
}

struct TravelPlan: Codable, Identifiable, Sendable {
    let id: UUID
    let profileId: UUID?
    let title: String
    let locationLabel: String
    let startsOn: String
    let endsOn: String
    let destinationType: String?
    let capZone: String?
    let capVenue: String?
    let notes: String?
}
