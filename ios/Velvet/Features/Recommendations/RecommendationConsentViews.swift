import SwiftUI

struct ConsentRecommendation: Codable, Identifiable, Sendable {
    let id: UUID
    let authorProfileId: UUID
    let targetType: String
    let targetId: UUID
    let body: String
    let rating: Int?
    let status: String
    let decidedAt: String?
    let createdAt: String
    let updatedAt: String
}

struct ConsentRecommendationFeed: Codable, Sendable {
    let published: [ConsentRecommendation]
    let sent: [ConsentRecommendation]
    let received: [ConsentRecommendation]
    let currentProfileId: UUID
}

private struct ConsentRecommendationMutationResponse: Codable, Sendable {
    let ok: Bool
    let recommendation: ConsentRecommendation?
}

final class RecommendationConsentService: Sendable {
    private let api = APIClient()

    func feed(targetType: String? = nil, targetID: UUID? = nil) async throws -> ConsentRecommendationFeed {
        var query: [URLQueryItem] = []
        if let targetType { query.append(URLQueryItem(name: "targetType", value: targetType)) }
        if let targetID { query.append(URLQueryItem(name: "targetId", value: targetID.uuidString)) }
        return try await api.get(
            "/api/members/recommendations-consent",
            query: query,
            as: ConsentRecommendationFeed.self
        )
    }

    func create(
        targetType: String,
        targetID: UUID,
        body: String,
        rating: Int?
    ) async throws -> ConsentRecommendation? {
        struct Request: Encodable, Sendable {
            let targetType: String
            let targetId: UUID
            let body: String
            let rating: Int?
        }
        let response = try await api.post(
            "/api/members/recommendations-consent",
            body: Request(
                targetType: targetType,
                targetId: targetID,
                body: body,
                rating: rating
            ),
            as: ConsentRecommendationMutationResponse.self
        )
        return response.recommendation
    }

    func decide(id: UUID, decision: String) async throws -> ConsentRecommendation? {
        struct Request: Encodable, Sendable {
            let recommendationId: UUID
            let decision: String
        }
        let response = try await api.patch(
            "/api/members/recommendations-consent",
            body: Request(recommendationId: id, decision: decision),
            as: ConsentRecommendationMutationResponse.self
        )
        return response.recommendation
    }
}

struct ProfileRecommendationsView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var feed: ConsentRecommendationFeed?
    @State private var showsComposer = false
    @State private var isLoading = false

    var body: some View {
        RecommendationTargetContent(
            title: "Recommandations",
            subtitle: "Seuls les témoignages acceptés par ce profil sont visibles publiquement.",
            recommendations: feed?.published ?? [],
            authorName: authorName,
            isLoading: isLoading,
            actionTitle: "Recommander ce profil"
        ) {
            showsComposer = true
        }
        .sheet(isPresented: $showsComposer) {
            RecommendationComposerSheet(
                targetType: "profile",
                targetID: profile.id,
                targetName: profile.displayName
            ) {
                Task { await load() }
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func authorName(_ recommendation: ConsentRecommendation) -> String {
        store.directory?.profiles.first(where: { $0.id == recommendation.authorProfileId })?.displayName
            ?? "Membre Velvet"
    }

    @MainActor
    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            feed = try await RecommendationConsentService().feed(
                targetType: "profile",
                targetID: profile.id
            )
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

struct VenueRecommendationsView: View {
    @EnvironmentObject private var store: VelvetStore
    let venue: Venue

    @State private var feed: ConsentRecommendationFeed?
    @State private var showsComposer = false
    @State private var isLoading = false

    var body: some View {
        RecommendationTargetContent(
            title: "Avis de la communauté",
            subtitle: "La recommandation devient publique uniquement après validation par l’établissement ou son gestionnaire.",
            recommendations: feed?.published ?? [],
            authorName: authorName,
            isLoading: isLoading,
            actionTitle: "Recommander cet établissement"
        ) {
            showsComposer = true
        }
        .sheet(isPresented: $showsComposer) {
            RecommendationComposerSheet(
                targetType: "venue",
                targetID: venue.id,
                targetName: venue.name
            ) {
                Task { await load() }
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func authorName(_ recommendation: ConsentRecommendation) -> String {
        store.directory?.profiles.first(where: { $0.id == recommendation.authorProfileId })?.displayName
            ?? "Membre Velvet"
    }

    @MainActor
    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            feed = try await RecommendationConsentService().feed(
                targetType: "venue",
                targetID: venue.id
            )
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

struct RecommendationInboxView: View {
    @EnvironmentObject private var store: VelvetStore

    @State private var feed: ConsentRecommendationFeed?
    @State private var isLoading = false
    @State private var workingID: UUID?

    private var pending: [ConsentRecommendation] { feed?.received ?? [] }
    private var published: [ConsentRecommendation] {
        (feed?.published ?? []).filter { $0.targetType == "profile" && $0.targetId == feed?.currentProfileId }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VelvetPageHeader(
                    "Consentement de publication",
                    title: "Recommandations",
                    subtitle: "Chaque recommandation reste privée jusqu’à votre accord explicite."
                )

                sectionTitle("À VALIDER", "Demandes privées", pending.count)
                if pending.isEmpty {
                    VelvetCompactEmptyState(
                        symbol: "checkmark.shield",
                        title: "Aucune demande en attente",
                        message: "Les futures recommandations apparaîtront ici avant toute diffusion publique."
                    )
                } else {
                    LazyVStack(spacing: 12) {
                        ForEach(pending) { recommendation in
                            pendingCard(recommendation)
                        }
                    }
                }

                sectionTitle("PUBLIÉES", "Visibles sur votre fiche", published.count)
                if published.isEmpty {
                    VelvetCompactEmptyState(
                        symbol: "quote.bubble",
                        title: "Aucune recommandation publique",
                        message: "Vous gardez le contrôle total sur les témoignages affichés."
                    )
                } else {
                    LazyVStack(spacing: 10) {
                        ForEach(published) { recommendation in
                            RecommendationCardView(
                                recommendation: recommendation,
                                authorName: authorName(recommendation)
                            )
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
            .padding(.bottom, 34)
        }
        .background(VelvetBackground())
        .task { await load() }
        .refreshable { await load() }
    }

    private func sectionTitle(_ eyebrow: String, _ title: String, _ count: Int) -> some View {
        HStack(alignment: .lastTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                Text(eyebrow)
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(title)
                    .font(VelvetTypography.title(size: 27))
                    .foregroundStyle(VelvetColor.ivory)
            }
            Spacer()
            Text("\(count)")
                .font(VelvetTypography.title(size: 24))
                .foregroundStyle(VelvetColor.textSecondary)
        }
    }

    private func pendingCard(_ recommendation: ConsentRecommendation) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            RecommendationCardView(
                recommendation: recommendation,
                authorName: authorName(recommendation)
            )

            HStack(spacing: 9) {
                Button {
                    Task { await decide(recommendation, decision: "decline") }
                } label: {
                    Label("Garder privée", systemImage: "lock.fill")
                        .font(VelvetTypography.body(size: 11, weight: .semibold))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .background(VelvetColor.ivory.opacity(0.04))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(workingID != nil)

                Button {
                    Task { await decide(recommendation, decision: "accept") }
                } label: {
                    Group {
                        if workingID == recommendation.id {
                            ProgressView().tint(VelvetColor.velvetBlack)
                        } else {
                            Label("Publier", systemImage: "checkmark.seal.fill")
                        }
                    }
                    .font(VelvetTypography.body(size: 11, weight: .semibold))
                    .foregroundStyle(VelvetColor.velvetBlack)
                    .frame(maxWidth: .infinity, minHeight: 42)
                    .background(VelvetColor.champagneGold)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(workingID != nil)
            }
        }
        .padding(12)
        .background(VelvetColor.panelRaised.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(VelvetColor.champagneGold.opacity(0.16), lineWidth: 0.8)
        }
    }

    private func authorName(_ recommendation: ConsentRecommendation) -> String {
        store.directory?.profiles.first(where: { $0.id == recommendation.authorProfileId })?.displayName
            ?? "Membre Velvet"
    }

    @MainActor
    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            feed = try await RecommendationConsentService().feed()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func decide(_ recommendation: ConsentRecommendation, decision: String) async {
        guard workingID == nil else { return }
        workingID = recommendation.id
        defer { workingID = nil }
        do {
            _ = try await RecommendationConsentService().decide(
                id: recommendation.id,
                decision: decision
            )
            await load()
            await store.load()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct RecommendationTargetContent: View {
    let title: String
    let subtitle: String
    let recommendations: [ConsentRecommendation]
    let authorName: (ConsentRecommendation) -> String
    let isLoading: Bool
    let actionTitle: String
    let action: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VelvetPageHeader(
                    "Témoignages validés",
                    title: title,
                    subtitle: subtitle
                )

                if isLoading && recommendations.isEmpty {
                    ProgressView()
                        .tint(VelvetColor.champagneGold)
                        .frame(maxWidth: .infinity, minHeight: 130)
                } else if recommendations.isEmpty {
                    VelvetCompactEmptyState(
                        symbol: "quote.bubble",
                        title: "Aucune recommandation publique",
                        message: "Les témoignages apparaissent seulement après validation du destinataire."
                    )
                } else {
                    LazyVStack(spacing: 10) {
                        ForEach(recommendations) { recommendation in
                            RecommendationCardView(
                                recommendation: recommendation,
                                authorName: authorName(recommendation)
                            )
                        }
                    }
                }

                VelvetPrimaryButton(actionTitle) { action() }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
            .padding(.bottom, 34)
        }
        .background(VelvetBackground())
    }
}

private struct RecommendationCardView: View {
    let recommendation: ConsentRecommendation
    let authorName: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(authorName)
                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Spacer()
                if let rating = recommendation.rating {
                    Label("\(rating)/5", systemImage: "star.fill")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            Text(recommendation.body)
                .font(VelvetTypography.body(size: 12))
                .foregroundStyle(VelvetColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VelvetColor.ivory.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct RecommendationComposerSheet: View {
    @Environment(\.dismiss) private var dismiss

    let targetType: String
    let targetID: UUID
    let targetName: String
    let onSaved: () -> Void

    @State private var text = ""
    @State private var rating = 5
    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VelvetPageHeader(
                            "Recommandation privée",
                            title: "Recommander \(targetName)",
                            subtitle: "Votre texte ne sera publié qu’après l’accord explicite du destinataire."
                        )

                        VStack(alignment: .leading, spacing: 8) {
                            Text("VOTRE TÉMOIGNAGE")
                                .font(VelvetTypography.caption(size: 8, weight: .semibold))
                                .tracking(1.4)
                                .foregroundStyle(VelvetColor.champagneGold)
                            TextEditor(text: $text)
                                .font(VelvetTypography.body(size: 14))
                                .foregroundStyle(VelvetColor.ivory)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 150)
                                .padding(10)
                                .background(VelvetColor.panelRaised.opacity(0.82))
                                .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 17, style: .continuous)
                                        .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
                                }
                            Text("\(text.count)/1200")
                                .font(VelvetTypography.caption(size: 9))
                                .foregroundStyle(VelvetColor.textSecondary)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                        }

                        VStack(alignment: .leading, spacing: 9) {
                            Text("NOTE")
                                .font(VelvetTypography.caption(size: 8, weight: .semibold))
                                .tracking(1.4)
                                .foregroundStyle(VelvetColor.champagneGold)
                            HStack(spacing: 8) {
                                ForEach(1...5, id: \.self) { value in
                                    Button {
                                        rating = value
                                    } label: {
                                        Image(systemName: value <= rating ? "star.fill" : "star")
                                            .font(.system(size: 22, weight: .medium))
                                            .foregroundStyle(VelvetColor.champagneGold)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        Label(
                            "Privée jusqu’à validation : le membre ou le gestionnaire de l’établissement choisira Publier ou Garder privée.",
                            systemImage: "lock.shield.fill"
                        )
                        .font(VelvetTypography.body(size: 11))
                        .foregroundStyle(VelvetColor.textSecondary)

                        VelvetPrimaryButton("Envoyer la recommandation", isLoading: isWorking) {
                            Task { await save() }
                        }
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).count < 10)
                    }
                    .padding(18)
                    .padding(.bottom, 28)
                }
            }
            .navigationTitle("Recommander")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .alert(
                "Velvet",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } }
                )
            ) {
                Button("Fermer", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    @MainActor
    private func save() async {
        guard !isWorking else { return }
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await RecommendationConsentService().create(
                targetType: targetType,
                targetID: targetID,
                body: text,
                rating: rating
            )
            onSaved()
            dismiss()
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }
}
