import SwiftUI

@MainActor
struct ContextualRecommendationsV15Overlay: View {
    @State private var presented = false
    @State private var loading = false
    @State private var recommendations: [ContextualRecommendationV15] = []
    @State private var error: String?
    private let session = SessionService()

    var body: some View {
        VStack {
            HStack {
                Spacer()
                Button {
                    presented = true
                    Task { await load() }
                } label: {
                    Label("Pour vous", systemImage: "sparkles")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.velvetGold)
                        .padding(.horizontal, 12)
                        .frame(height: 35)
                        .background(.ultraThinMaterial, in: Capsule())
                        .overlay { Capsule().stroke(Color.velvetGold.opacity(0.18), lineWidth: 0.7) }
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14)
            .padding(.top, 7)
            Spacer()
        }
        .sheet(isPresented: $presented) {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("ZWIT INTELLIGENCE · CONTEXTE")
                                .font(.system(size: 9, weight: .black)).tracking(1.3).foregroundStyle(Color.velvetGold)
                            Text("Pour vous maintenant")
                                .font(.system(size: 31, weight: .medium, design: .serif))
                            Text("Pas de pourcentage magique : des suggestions expliquées par ce qui se passe réellement autour de vous.")
                                .font(.system(size: 11)).foregroundStyle(.secondary)
                        }
                        .padding(.bottom, 4)

                        if loading && recommendations.isEmpty {
                            ProgressView().frame(maxWidth: .infinity).padding(.vertical, 50)
                        } else if let error, recommendations.isEmpty {
                            ContentUnavailableView("Suggestions indisponibles", systemImage: "sparkles", description: Text(error))
                        } else {
                            ForEach(recommendations) { item in card(item) }
                        }

                        Text("Vos choix Plus comme ça / Masquer restent privés et servent uniquement à personnaliser vos prochaines suggestions.")
                            .font(.system(size: 9)).foregroundStyle(.secondary).padding(.top, 4)
                    }
                    .padding(18)
                }
                .background(Color.velvetBlack.ignoresSafeArea())
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Fermer") { presented = false }
                    }
                }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
    }

    private func card(_ item: ContextualRecommendationV15) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 11) {
                AsyncImage(url: item.imageUrl) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { Image(systemName: item.symbol).foregroundStyle(Color.velvetGold) }
                }
                .frame(width: 72, height: 82).background(Color.velvetBurgundy.opacity(0.22))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.eyebrow).font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(Color.velvetGold)
                    Text(item.title).font(.system(size: 15, weight: .semibold)).lineLimit(1)
                    if let subtitle = item.subtitle, !subtitle.isEmpty { Text(subtitle).font(.system(size: 10)).foregroundStyle(.secondary) }
                    Text(item.explanation).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(3)
                }
                Spacer(minLength: 0)
            }
            DisclosureGroup("Pourquoi maintenant ?") {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(item.reasons, id: \.self) { Text("• \($0)").font(.system(size: 10)).foregroundStyle(.secondary) }
                }.frame(maxWidth: .infinity, alignment: .leading).padding(.top, 5)
            }
            .font(.system(size: 10, weight: .semibold)).tint(Color.velvetGold)
            HStack(spacing: 8) {
                Button("Plus comme ça") { Task { await feedback(item, more: true) } }
                Button("Masquer") { Task { await feedback(item, more: false) } }
            }
            .buttonStyle(.bordered).tint(Color.velvetGold).font(.system(size: 9, weight: .semibold))
        }
        .padding(14)
        .background(Color.white.opacity(0.035), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 20).stroke(Color.white.opacity(0.07), lineWidth: 0.7) }
    }

    private func load() async {
        guard !loading else { return }
        loading = true; defer { loading = false }
        do { recommendations = try await session.contextualRecommendationsV15(); error = nil }
        catch { self.error = ErrorMessage.text(for: error) }
    }

    private func feedback(_ item: ContextualRecommendationV15, more: Bool) async {
        do {
            try await session.recommendationFeedbackV15(type: item.type, id: item.id, moreLikeThis: more)
            await load()
        } catch { error = ErrorMessage.text(for: error) }
    }
}
