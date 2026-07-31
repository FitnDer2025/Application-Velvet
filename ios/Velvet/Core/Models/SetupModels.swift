import Foundation

struct PhotosResponse: Decodable, Sendable {
    let profile: MemberProfile?
    let photos: [ProfilePhoto]
}

struct ProfilePhoto: Decodable, Identifiable, Sendable {
    let id: UUID
    let mediaRole: String
    let moderationStatus: String
    let isPrimary: Bool?
    let previewUrl: URL?
    let rejectionReason: String?
}

struct PhotoUploadResponse: Decodable, Sendable {
    let ok: Bool
    let photo: ProfilePhoto
}

struct CoupleInvitationResponse: Decodable, Sendable {
    let invitation: CoupleInvitation?
}

struct CoupleInvitation: Decodable, Sendable {
    let id: UUID?
    let invitedEmail: String?
    let status: String?
    let partnerAccepted: Bool?
    let deliveryStatus: String?
}

struct CoupleInvitationCreated: Decodable, Sendable {
    let ok: Bool
    let invitedEmail: String
    let registrationUrl: URL?
}

struct VerificationResponse: Decodable, Sendable {
    struct Verification: Decodable, Sendable {
        let provider: String?
        let status: String
        let identityVerified: Bool
        let majorityVerified: Bool
        let verifiedAt: String?
    }

    let verification: Verification
    let profileVerificationStatus: String?
    let providerConfigured: Bool
    let documentsStoredByVelvet: Bool
}

struct VerificationStartResponse: Decodable, Sendable {
    let ok: Bool
    let startUrl: URL
    let expiresAt: String
    let provider: String
}
