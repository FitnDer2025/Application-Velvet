import SwiftUI

struct MemberDetailView: View {
    @EnvironmentObject private var store: VelvetStore
    @EnvironmentObject private var screenshotProtection: ScreenshotProtectionService
    let profile: MemberProfile

    @State private var conversationID: UUID?
    @State private var showsSafety = false
    @State private var showsAlbumAccess = false
    @State private var isWorking = false
    @State private var reaction: String?

    private var primaryMedia: MediaAsset? {
        profile.mediaAssets?.first(where: { $0.isPrimary == true && $0.previewUrl != nil })
            ?? profile.mediaAssets?.first(where: { $0.previewUrl != nil })
    }

    private var photo: URL? {
        primaryMedia?.previewUrl
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    hero
                    reactionBar

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
                        showsAlbumAccess = true
                    } label: {
                        Label("Partager un album privé", systemImage: "lock.open")
                            .font(VelvetTypography.body(size: 13, weight: .semibold))
                            .frame(maxWidth: .infinity, minHeight: 46)
                    }
                    .foregroundStyle(VelvetColor.champagneGold)
                    .buttonStyle(.plain)
                    .overlay {
                        RoundedRectangle(cornerRadius: VelvetRadius.medium)
                            .stroke(VelvetColor.champagneGold.opacity(0.28), lineWidth: 1)
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
        .sheet(isPresented: $showsAlbumAccess) {
            AlbumAccessSheet(targetProfile: profile)
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
        .onAppear {
            screenshotProtection.protect(
                ownerProfileID: profile.id,
                mediaID: primaryMedia?.id
            )
        }
        .onDisappear {
            screenshotProtection.clear(ownerProfileID: profile.id)
        }
        .task {
            _ = try? await store.service.setEngagement(
                profileID: profile.id,
                action: "view"
            )
        }
    }

    private var reactionBar: some View {
        HStack(spacing: 10) {
            Text("RÉACTION")
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1.3)
                .foregroundStyle(VelvetColor.textSecondary)
            Spacer()
            reactionButton("like", icon: "hand.thumbsup.fill")
            reactionButton("love", icon: "heart.fill")
            reactionButton("adore", icon: "sparkles")
        }
        .padding(.horizontal, 4)
    }

    private func reactionButton(_ value: String, icon: String) -> some View {
        Button {
            Task { await setReaction(reaction == value ? nil : value) }
        } label: {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(reaction == value ? VelvetColor.velvetBlack : VelvetColor.champagneGold)
                .frame(width: 38, height: 38)
                .background(
                    reaction == value
                        ? VelvetColor.champagneGold
                        : VelvetColor.champagneGold.opacity(0.08)
                )
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(primaryMedia == nil)
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

            VStack {
                Spacer()
                HStack {
                    Spacer()
                    VelvetPhotoWatermark()
                }
            }
            .padding(18)

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

    @MainActor
    private func setReaction(_ value: String?) async {
        guard let mediaID = primaryMedia?.id else { return }
        do {
            _ = try await store.service.reactToPhoto(
                mediaID: mediaID,
                reaction: value
            )
            reaction = value
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct AlbumAccessSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore
    let targetProfile: MemberProfile

    @State private var albums: [ProfileAlbum] = []
    @State private var selected = Set<UUID>()
    @State private var duration = "4"
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VelvetPageHeader(
                            "Accès privé",
                            title: "Partager avec \(targetProfile.displayName)",
                            subtitle: "Choisis précisément les albums et la durée. Tu peux retirer l’accès à tout moment."
                        )

                        Picker("Durée", selection: $duration) {
                            Text("1 h").tag("1")
                            Text("4 h").tag("4")
                            Text("12 h").tag("12")
                            Text("24 h").tag("24")
                            Text("Permanent").tag("permanent")
                        }
                        .pickerStyle(.segmented)

                        ForEach(albums) { album in
                            Button {
                                if selected.contains(album.id) {
                                    selected.remove(album.id)
                                } else {
                                    selected.insert(album.id)
                                }
                            } label: {
                                HStack(spacing: 13) {
                                    Image(systemName: "lock.square")
                                        .foregroundStyle(VelvetColor.champagneGold)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(album.name)
                                            .font(VelvetTypography.body(size: 14, weight: .semibold))
                                            .foregroundStyle(VelvetColor.ivory)
                                        Text("\((album.mediaAssets ?? []).count) média(s)")
                                            .font(VelvetTypography.caption(size: 10))
                                            .foregroundStyle(VelvetColor.textSecondary)
                                    }
                                    Spacer()
                                    Image(
                                        systemName: selected.contains(album.id)
                                            ? "checkmark.circle.fill"
                                            : "circle"
                                    )
                                    .foregroundStyle(VelvetColor.champagneGold)
                                }
                                .padding(15)
                                .background(VelvetColor.panelRaised.opacity(0.78))
                                .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))
                            }
                            .buttonStyle(.plain)
                        }

                        if albums.isEmpty {
                            VelvetEmptyState(
                                symbol: "lock.rectangle.stack",
                                title: "Aucun album privé",
                                message: "Crée un album privé depuis ta fiche avant de le partager."
                            )
                        }

                        VelvetPrimaryButton(
                            "Autoriser l’accès",
                            isLoading: isWorking,
                            isDisabled: selected.isEmpty
                        ) {
                            Task { await grant() }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Albums privés")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                }
            }
            .task {
                albums = ((try? await store.service.profile())?.profile?.albums ?? [])
                    .filter { $0.confidentiality != "public" }
            }
        }
    }

    @MainActor
    private func grant() async {
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await store.service.grantAlbumAccess(
                albumIDs: Array(selected),
                profileID: targetProfile.id,
                duration: duration
            )
            dismiss()
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
