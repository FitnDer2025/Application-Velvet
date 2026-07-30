import SwiftUI

struct MemberDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var conversationID: UUID?
    @State private var showsSafety = false
    @State private var isWorking = false

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: VelvetSpacing.xl) {
                    AsyncImage(url: profile.mediaAssets?.first(where: { $0.previewUrl != nil })?.previewUrl) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        ZStack {
                            VelvetColor.anthracite
                            Image(systemName: profile.profileType == .couple ? "person.2.fill" : "person.fill")
                                .font(.system(size: 52, weight: .ultraLight))
                                .foregroundStyle(VelvetColor.champagneGold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 360)
                    .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large))

                    VelvetSectionHeader(
                        profile.profileType.label,
                        title: profile.displayName,
                        subtitle: profile.locationZone ?? profile.city
                    )

                    Text(profile.description ?? profile.story ?? "Cette histoire reste à écrire.")
                        .font(VelvetTypography.body())
                        .foregroundStyle(VelvetColor.ivory)

                    if let values = profile.valuesList, !values.isEmpty {
                        FlowTags(values: values)
                    }

                    VelvetPrimaryButton("Écrire un message", isLoading: isWorking) {
                        Task { await startConversation() }
                    }

                    Button {
                        showsSafety = true
                    } label: {
                        Label("Sécurité, blocage et signalement", systemImage: "shield")
                            .frame(maxWidth: .infinity)
                    }
                    .foregroundStyle(VelvetColor.textSecondary)
                }
                .padding(VelvetSpacing.lg)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showsSafety) {
            SafetyActionsView(profile: profile)
                .environmentObject(store)
        }
        .navigationDestination(
            isPresented: Binding(
                get: { conversationID != nil },
                set: { if !$0 { conversationID = nil } }
            )
        ) {
            if let conversationID {
                ConversationView(conversationID: conversationID, title: profile.displayName)
            }
        }
    }

    @MainActor
    private func startConversation() async {
        isWorking = true
        defer { isWorking = false }
        do {
            conversationID = try await store.service.startConversation(profileID: profile.id)
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct FlowTags: View {
    let values: [String]
    var body: some View {
        VStack(alignment: .leading, spacing: VelvetSpacing.sm) {
            ForEach(values, id: \.self) { value in
                Text(value)
                    .font(VelvetTypography.caption(size: 12, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
                    .padding(.horizontal, VelvetSpacing.md)
                    .padding(.vertical, VelvetSpacing.xs)
                    .background(VelvetColor.champagneGold.opacity(0.10))
                    .clipShape(Capsule())
            }
        }
    }
}
