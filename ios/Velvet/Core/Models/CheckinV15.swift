import Foundation

struct ZwitCheckinResponse: Decodable, Sendable {
    let ok: Bool
    let checkin: ZwitCheckinResult
    let passportUpdated: Bool?
    let message: String?
}

struct ZwitCheckinResult: Decodable, Sendable {
    let eventId: UUID
    let establishmentId: UUID
    let eventTitle: String
    let checkedInAt: String?
}

enum ZwitCheckinDeepLink {
    static func token(from url: URL) -> String? {
        guard url.scheme?.lowercased() == "velvet",
              url.host?.lowercased() == "checkin",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let token = components.queryItems?.first(where: { $0.name == "token" })?.value?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              token.count >= 32,
              token.count <= 128 else {
            return nil
        }
        return token
    }
}
