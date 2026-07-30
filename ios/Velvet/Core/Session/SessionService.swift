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

    func signUp(
        email: String,
        password: String,
        inviteCode: String,
        turnstileToken: String?
    ) async throws -> SignUpResponse {
        struct Request: Encodable, Sendable {
            let email: String
            let password: String
            let inviteCode: String
            let turnstileToken: String?
        }
        return try await api.post(
            "/api/auth/signup",
            body: Request(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                password: password,
                inviteCode: inviteCode.trimmingCharacters(in: .whitespacesAndNewlines),
                turnstileToken: turnstileToken
            ),
            as: SignUpResponse.self
        )
    }

    func requestPasswordRecovery(email: String, turnstileToken: String?) async throws {
        struct Request: Encodable, Sendable {
            let email: String
            let turnstileToken: String?
            let redirectUrl = "velvet://recovery"
        }
        let _: RecoveryResponse = try await api.post(
            "/api/auth/recovery-request",
            body: Request(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
                turnstileToken: turnstileToken
            ),
            as: RecoveryResponse.self
        )
    }

    func updatePassword(_ password: String, tokens: RecoveryTokens) async throws {
        struct Request: Encodable, Sendable {
            let accessToken: String
            let refreshToken: String
            let password: String
        }
        let _: PasswordUpdateResponse = try await api.post(
            "/api/auth/password-update",
            body: Request(
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                password: password
            ),
            as: PasswordUpdateResponse.self
        )
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

    func directory() async throws -> DirectoryResponse {
        try await api.get("/api/members/directory", as: DirectoryResponse.self)
    }

    func memberMap() async throws -> MemberMapResponse {
        try await api.get("/api/members/map", as: MemberMapResponse.self)
    }

    func notifications() async throws -> NotificationFeed {
        try await api.get("/api/members/notifications", as: NotificationFeed.self)
    }

    func markAllNotificationsRead() async throws -> NotificationFeed {
        struct Request: Encodable, Sendable { let action = "read_all" }
        return try await api.post(
            "/api/members/notifications",
            body: Request(),
            as: NotificationFeed.self
        )
    }

    func messages(conversationID: UUID) async throws -> MessagesResponse {
        try await api.get(
            "/api/members/messages",
            query: [URLQueryItem(name: "conversationId", value: conversationID.uuidString)],
            as: MessagesResponse.self
        )
    }

    func sendMessage(_ body: String, conversationID: UUID) async throws -> DirectoryMessage {
        struct Request: Encodable, Sendable {
            let conversationId: UUID
            let body: String
        }
        let response = try await api.post(
            "/api/members/messages",
            body: Request(conversationId: conversationID, body: body),
            as: CreatedMessageResponse.self
        )
        return response.message
    }

    func startConversation(profileID: UUID) async throws -> UUID {
        struct Request: Encodable, Sendable { let profileId: UUID }
        struct Response: Decodable, Sendable { let conversationId: UUID }
        let response = try await api.post(
            "/api/members/conversations",
            body: Request(profileId: profileID),
            as: Response.self
        )
        return response.conversationId
    }

    func socialAction(
        profileID: UUID,
        action: String,
        enabled: Bool? = nil,
        category: String? = nil,
        description: String? = nil
    ) async throws -> SocialActionState {
        struct Request: Encodable, Sendable {
            let profileId: UUID
            let action: String
            let enabled: Bool?
            let category: String?
            let description: String?
        }
        return try await api.post(
            "/api/members/social-actions",
            body: Request(
                profileId: profileID,
                action: action,
                enabled: enabled,
                category: category,
                description: description
            ),
            as: SocialActionState.self
        )
    }

    func register(eventID: UUID, places: Int = 1) async throws {
        struct Request: Encodable, Sendable {
            let eventId: UUID
            let places: Int
            let visibleToParticipants = true
        }
        let _: EventRegistrationResponse = try await api.post(
            "/api/members/event-registrations",
            body: Request(eventId: eventID, places: places),
            as: EventRegistrationResponse.self
        )
    }

    func photos() async throws -> PhotosResponse {
        try await api.get("/api/members/photos", as: PhotosResponse.self)
    }

    func uploadPhoto(data: Data, mediaRole: String, individualProfileID: UUID? = nil) async throws -> ProfilePhoto {
        var parts: [MultipartPart] = [
            .field("mediaRole", value: mediaRole),
            .file("photo", fileName: "velvet-\(UUID().uuidString).jpg", mimeType: "image/jpeg", data: data)
        ]
        if let individualProfileID {
            parts.append(.field("individualProfileId", value: individualProfileID.uuidString))
        }
        let response = try await api.upload(
            "/api/members/photos",
            parts: parts,
            as: PhotoUploadResponse.self
        )
        return response.photo
    }

    func deletePhoto(id: UUID) async throws {
        struct Response: Decodable, Sendable { let ok: Bool }
        let _: Response = try await api.delete(
            "/api/members/photos",
            query: [URLQueryItem(name: "id", value: id.uuidString)],
            as: Response.self
        )
    }

    func coupleInvitation() async throws -> CoupleInvitation? {
        try await api.get(
            "/api/members/couple-invite",
            as: CoupleInvitationResponse.self
        ).invitation
    }

    func invitePartner(email: String) async throws -> CoupleInvitationCreated {
        struct Request: Encodable, Sendable { let email: String }
        return try await api.post(
            "/api/members/couple-invite",
            body: Request(email: email),
            as: CoupleInvitationCreated.self
        )
    }

    func verification() async throws -> VerificationResponse {
        try await api.get("/api/members/verification", as: VerificationResponse.self)
    }

    func startVerification() async throws -> URL {
        struct Request: Encodable, Sendable { let returnPath = "/membres/" }
        let response = try await api.post(
            "/api/members/verification",
            body: Request(),
            as: VerificationStartResponse.self
        )
        return response.startUrl
    }

    func saveLocation(latitude: Double, longitude: Double) async throws -> LocationResponse {
        struct Request: Encodable, Sendable {
            let latitude: Double
            let longitude: Double
            let consent = true
        }
        return try await api.post(
            "/api/members/location",
            body: Request(latitude: latitude, longitude: longitude),
            as: LocationResponse.self
        )
    }

    func disableLocation() async throws -> LocationResponse {
        try await api.delete("/api/members/location", as: LocationResponse.self)
    }

    func deleteAccount(confirmation: String) async throws {
        struct Request: Encodable, Sendable { let confirmation: String }
        let _: AccountDeletionResponse = try await api.post(
            "/api/members/account-deletion",
            body: Request(confirmation: confirmation),
            as: AccountDeletionResponse.self
        )
        guard let host = APIClient.configuredHost else { return }
        HTTPCookieStorage.shared.cookies?
            .filter { $0.domain.contains(host) }
            .forEach(HTTPCookieStorage.shared.deleteCookie)
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
