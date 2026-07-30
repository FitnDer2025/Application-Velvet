import Foundation

struct Account: Codable, Sendable {
    enum Status: String, Codable, Sendable {
        case active
        case invited
        case pendingConsent = "pending_consent"
        case suspended
        case closed
        case unknown

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            self = Status(rawValue: value) ?? .unknown
        }
    }

    let userId: UUID?
    let email: String
    let status: Status
    let roles: [String]
}

struct AuthenticationResponse: Decodable, Sendable {
    let account: Account
}

struct AuthenticationStatusResponse: Decodable, Sendable {
    let authenticated: Bool
    let account: Account?
}

struct AuthConfiguration: Decodable, Sendable {
    struct PasswordPolicy: Decodable, Sendable {
        let minLength: Int
        let uppercase: Bool
        let lowercase: Bool
        let number: Bool
        let symbol: Bool
    }

    let turnstileSiteKey: String?
    let passwordPolicy: PasswordPolicy
}
