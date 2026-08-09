import Foundation

extension SessionService {
    func contextualRecommendationsV15() async throws -> [ContextualRecommendationV15] {
        let response: ContextualRecommendationsV15Envelope = try await APIClient().get(
            "/api/members/contextual-recommendations"
        )
        return response.recommendations
    }

    func recommendationFeedbackV15(
        type: String,
        id: String,
        moreLikeThis: Bool
    ) async throws {
        let _: RecommendationFeedbackV15Response = try await APIClient().post(
            "/api/members/recommendation-feedback",
            body: RecommendationFeedbackV15Request(
                entityType: type,
                entityId: id,
                signal: moreLikeThis ? "more_like_this" : "dismiss"
            )
        )
    }
}
