import Foundation

struct ContextualRecommendationsV15Envelope: Decodable, Sendable {
    let generatedAt: String?
    let philosophy: String?
    let recommendations: [ContextualRecommendationV15]
}

struct ContextualRecommendationV15: Decodable, Identifiable, Sendable, Equatable {
    let type: String
    let id: String
    let title: String
    let subtitle: String?
    let imageUrl: URL?
    let reasons: [String]
    let explanation: String

    var eyebrow: String {
        switch type {
        case "profile": return "UNE PERSONNE"
        case "event": return "UNE SORTIE"
        case "venue": return "UN LIEU"
        default: return "POUR VOUS"
        }
    }

    var symbol: String {
        switch type {
        case "profile": return "person.2.fill"
        case "event": return "sparkles"
        case "venue": return "mappin.and.ellipse"
        default: return "diamond.fill"
        }
    }
}

struct RecommendationFeedbackV15Request: Encodable, Sendable {
    let entityType: String
    let entityId: String
    let signal: String
}

struct RecommendationFeedbackV15Response: Decodable, Sendable {
    let ok: Bool
}
