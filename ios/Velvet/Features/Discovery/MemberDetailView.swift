import SwiftUI

struct MemberDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var conversationID: UUID?
    @State private var showsSafety = false
    @State private var isWorking = false

    private var photo: URL? {
        profile.mediaAssets?.first(where: { $0.isPrimary == true && $0.previewUrl != nil })?.previewUrl
            ?? profile.mediaAssets?.first(where: { $0.previewUrl != nil })?.previewUrl
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    hero

                    VStack(alignment: .leading, spacing: 9) {
                        Text(profile.profileType.label.uppercased())
                            .font(VelvetTypography.caption(size: 10, weight: .semibold))
                            .tracking(1.8)
                            .foregroundStyle(VelvetColor.champagneGold)
                        Text("Leur univers")
                            .font(VelvetTypography.title(size: 29))
                            .foregroundStyle(VelvetColor.ivory)
                        Text(profile.description ?? profile.story ?? "Cette histoire reste à écrire.")
                            .font(VelvetTypography.body(size: 15))
                            .foregroundStyle(VelvetColor.textSecondary)
                            .lineSpacing(5)
                    }

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
                            .font(VelvetTypography.body(size: 13, weight: .medium))
                            .frame(maxWidth: .infinity, minHeight: 46)
                    }
                    .foregroundStyle(VelvetColor.textSecondary)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(VelvetColor.velvetBlack.opacity(0.9), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
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

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: photo) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                ZStack {
                    LinearGradient(
                        colors: [Color(hex: 0x32141F), VelvetColor.anthracite],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    Image(systemName: profile.profileType == .couple ? "person.2.fill" : "person.fill")
                        .font(.system(size: 70, weight: .ultraLight))
                        .foregroundStyle(VelvetColor.champagneGold.opacity(0.75))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 430)
            .clipped()

            LinearGradient(
                colors: [.clear, VelvetColor.velvetBlack.opacity(0.92)],
                startPoint: .center,
                endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 7) {
                if profile.verificationStatus == "verified" {
                    Label("PROFIL VÉRIFIÉ", systemImage: "checkmark.seal.fill")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.3)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
                Text(profile.displayName)
                    .font(VelvetTypography.title(size: 38))
                    .foregroundStyle(VelvetColor.ivory)
                Label(profile.locationZone ?? profile.city ?? "Zone privée", systemImage: "location")
                    .font(VelvetTypography.body(size: 13))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            .padding(22)
        }
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.editorial, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.editorial, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
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
        VStack(alignment: .leading, spacing: 10) {
            Text("AFFINITÉS")
                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                .tracking(1.8)
                .foregroundStyle(VelvetColor.champagneGold)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(values, id: \.self) { value in
                        Text(value)
                            .font(VelvetTypography.caption(size: 12, weight: .semibold))
                            .foregroundStyle(VelvetColor.ivory)
                            .padding(.horizontal, 15)
                            .frame(height: 36)
                            .background(VelvetColor.champagneGold.opacity(0.08))
                            .clipShape(Capsule())
                            .overlay {
                                Capsule()
                                    .stroke(VelvetColor.champagneGold.opacity(0.22), lineWidth: 1)
                            }
                    }
                }
            }
        }
    }
}
