import Foundation

final class SessionService: Sendable {
    private let api: APIClient

    init(api: APIClient = APIClient()) {
        self.api = api
    }

    func configuration() async throws -> AuthConfiguration {
        try await api.get("/api/auth/config", as: AuthConfiguration.self)
    }

    func restore() async throws -> Account {
        let response = try await api.get("/api/auth/status", as: AuthenticationStatusResponse.self)
        guard response.authenticated, let account = response.account else {
            throw APIError.unauthorized
        }
        return account
    }

    func login(
        email: String,
        password: String,
        turnstileToken: String?
    ) async throws -> Account {
        struct Request: Encodable, Sendable {
            let email: String
            let password: String
            let turnstileToken: String?
        }
        let response = try await api.post(
            "/api/auth/login",
            body: Request(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                password: password,
                turnstileToken: turnstileToken
            ),
            as: AuthenticationResponse.self
        )
        return response.account
    }

    func grantConsents() async throws -> Account {
        struct Request: Encodable, Sendable {
            let adult = true
            let terms = true
            let privacy = true
            let sensitiveProfile = true
        }
        let response = try await api.post(
            "/api/auth/consent",
            body: Request(),
            as: AuthenticationResponse.self
        )
        return response.account
    }

    func profile() async throws -> ProfileResponse {
        try await api.get("/api/members/profile", as: ProfileResponse.self)
    }

    func saveProfile(_ request: ProfileUpsertRequest) async throws -> SavedProfileResponse {
        try await api.post(
            "/api/members/profile",
            body: request,
            as: SavedProfileResponse.self
        )
    }

    func logout() async {
        try? await api.postWithoutResponse("/api/auth/logout", body: EmptyBody())
        guard let host = APIClient.configuredHost else { return }
        HTTPCookieStorage.shared.cookies?
            .filter { $0.domain.contains(host) }
            .forEach(HTTPCookieStorage.shared.deleteCookie)
    }
}

private extension APIClient {
    static var configuredHost: String? {
        guard
            let value = Bundle.main.object(forInfoDictionaryKey: "VelvetAPIBaseURL") as? String,
            let url = URL(string: value)
        else {
            return nil
        }
        return url.host
    }
}
