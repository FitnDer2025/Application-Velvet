import Foundation

struct MemberProfile: Codable, Identifiable, Sendable {
    enum ProfileType: String, Codable, CaseIterable, Identifiable, Sendable {
        case individual
        case couple

        var id: String { rawValue }

        var label: String {
            switch self {
            case .individual: "Profil individuel"
            case .couple: "Profil couple"
            }
        }
    }

    let id: UUID
    let profileType: ProfileType
    let displayName: String
    let city: String?
    let locationZone: String?
    let description: String?
    let admissionStatus: String?
    let verificationStatus: String?
    let createdAt: String?
    let updatedAt: String?
    let story: String?
    let searchText: String?
    let practices: [String]?
    let valuesList: [String]?
    let relationshipSince: Int?
    let journey: String?
    let favoritePlaces: [String]?
    let availabilityText: String?
    let individualProfiles: [IndividualProfile]?
    let mediaAssets: [MediaAsset]?
    let albums: [ProfileAlbum]?

    var isAdmitted: Bool {
        admissionStatus == "approved"
    }
}

struct IndividualProfile: Codable, Identifiable, Sendable {
    let id: UUID
    let firstName: String?
    let genderIdentity: String?
    let birthYear: Int?
    let heightCm: Int?
    let weightKg: Int?
    let morphology: String?
    let bodyType: String?
    let hairColor: String?
    let eyeColor: String?
    let childrenStatus: String?
    let profession: String?
    let professionPrivate: Bool?
    let orientation: String?
    let frequency: String?
    let biography: String?
    let attractedTo: [String]?
    let desiredPractices: [String]?
    let partnerPermissions: [String]?
    let linkedUserId: UUID?
    let memberSlot: String?
}

struct ProfileResponse: Decodable, Sendable {
    let profile: MemberProfile?
    let personalProfileComplete: Bool?
    let access: MemberAccess?
}

struct MemberAccess: Decodable, Sendable {
    let migrationPending: Bool?
    let features: [String: FeatureValue]?
}

enum FeatureValue: Codable, Sendable {
    case bool(Bool)
    case int(Int)
    case string(String)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Int.self) { self = .int(value) }
        else { self = .string(try container.decode(String.self)) }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case let .bool(value): try container.encode(value)
        case let .int(value): try container.encode(value)
        case let .string(value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

struct SavedProfileResponse: Decodable, Sendable {
    let ok: Bool
    let profile: MemberProfile
}

struct ProfileUpsertRequest: Encodable, Sendable {
    struct Person: Encodable, Sendable {
        let firstName: String
        let genderIdentity: String
        let birthYear: Int
        let professionPrivate: Bool
        let childrenStatus: String
    }

    let profileType: MemberProfile.ProfileType
    let displayName: String
    let city: String
    let description: String
    let story: String
    let searchText: String
    let practices: [String]
    let valuesList: [String]
    let favoritePlaces: [String]
    let person: Person
}
