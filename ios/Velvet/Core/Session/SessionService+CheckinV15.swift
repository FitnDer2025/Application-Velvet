import Foundation

extension SessionService {
    func redeemCheckin(token: String) async throws -> ZwitCheckinResponse {
        struct Request: Encodable, Sendable { let token: String }
        return try await APIClient().post(
            "/api/members/check-in",
            body: Request(token: token),
            as: ZwitCheckinResponse.self
        )
    }
}
