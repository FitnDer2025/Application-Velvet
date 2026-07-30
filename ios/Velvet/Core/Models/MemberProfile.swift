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

    var isAdmitted: Bool {
        admissionStatus == "approved"
    }
}

struct ProfileResponse: Decodable, Sendable {
    let profile: MemberProfile?
    let personalProfileComplete: Bool?
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
