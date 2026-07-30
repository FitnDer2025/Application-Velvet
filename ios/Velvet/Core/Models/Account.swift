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

struct SignUpResponse: Decodable, Sendable {
    let ok: Bool
    let confirmationRequired: Bool
    let message: String
}

struct RecoveryResponse: Decodable, Sendable {
    let ok: Bool
    let message: String
}

struct PasswordUpdateResponse: Decodable, Sendable {
    let ok: Bool
    let message: String
}

struct RecoveryTokens: Sendable {
    let accessToken: String
    let refreshToken: String

    init?(url: URL) {
        guard url.scheme == "velvet", url.host == "recovery" else { return nil }
        let fragment = URLComponents(string: "https://velvet.invalid?\(url.fragment ?? "")")
        let items = fragment?.queryItems ?? []
        guard
            let accessToken = items.first(where: { $0.name == "access_token" })?.value,
            let refreshToken = items.first(where: { $0.name == "refresh_token" })?.value,
            !accessToken.isEmpty,
            !refreshToken.isEmpty
        else { return nil }
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }
}
