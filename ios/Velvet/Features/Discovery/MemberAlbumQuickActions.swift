import SwiftUI

struct MemberAlbumQuickActions: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile

    @State private var showsAlbumShare = false
    @State private var activeConversation: Conversation?
    @State private var isRequesting = false

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                quickAction(
                    title: "Demander un album",
                    subtitle: "Envoyer une demande privée",
                    symbol: "lock.badge.clock",
                    isLoading: isRequesting
                ) {
                    Task { await requestAlbumAccess() }
                }

                quickAction(
                    title: "Ouvrir mes albums",
                    subtitle: "Choisir les albums et la durée",
                    symbol: "lock.open",
                    isLoading: false
                ) {
                    showsAlbumShare = true
                }
            }

            Text("Les accès restent révocables et ne concernent que les albums sélectionnés.")
                .font(VelvetTypography.caption(size: 9))
                .foregroundStyle(VelvetColor.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .sheet(isPresented: $showsAlbumShare) {
            MemberAlbumShareSheet(targetProfile: profile)
                .environmentObject(store)
        }
        .navigationDestination(
            isPresented: Binding(
                get: { activeConversation != nil },
                set: { if !$0 { activeConversation = nil } }
            )
        ) {
            if let activeConversation {
                AppleConversationView(conversation: activeConversation)
            }
        }
    }

    private func quickAction(
        title: String,
        subtitle: String,
        symbol: String,
        isLoading: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    if isLoading {
                        ProgressView()
                            .tint(VelvetColor.champagneGold)
                    } else {
                        Image(systemName: symbol)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(VelvetColor.textSecondary)
                }

                Text(title)
                    .font(VelvetTypography.body(size: 12, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)

                Text(subtitle)
                    .font(VelvetTypography.caption(size: 9))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
            }
            .padding(13)
            .frame(maxWidth: .infinity, minHeight: 112, alignment: .leading)
            .background(.ultraThinMaterial)
            .background(VelvetColor.anthracite.opacity(0.68))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(VelvetColor.champagneGold.opacity(0.18), lineWidth: 0.8)
            }
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }

    @MainActor
    private func requestAlbumAccess() async {
        isRequesting = true
        defer { isRequesting = false }

        do {
            let conversationID = try await store.service.startConversation(profileID: profile.id)
            _ = try await store.service.sendMessage(
                "🔐 Votre profil nous plaît. Accepteriez-vous de nous ouvrir l’un de vos albums privés ?",
                conversationID: conversationID
            )
            activeConversation = .direct(
                id: conversationID,
                title: profile.displayName,
                profileID: profile.id,
                photoURL: profile.socialPrimaryPhoto
            )
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct MemberAlbumShareSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore
    let targetProfile: MemberProfile

    @State private var albums: [ProfileAlbum] = []
    @State private var selectedAlbumIDs = Set<UUID>()
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
                            subtitle: "Sélectionne les albums privés à ouvrir et choisis précisément la durée de l’autorisation."
                        )

                        durationPicker
                        albumSelection

                        VelvetPrimaryButton(
                            "Ouvrir les albums sélectionnés",
                            isLoading: isWorking,
                            isDisabled: selectedAlbumIDs.isEmpty
                        ) {
                            Task { await grantAccess() }
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
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .task { await loadAlbums() }
        }
    }

    private var durationPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("DURÉE D’ACCÈS")
                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                .tracking(1.4)
                .foregroundStyle(VelvetColor.champagneGold)

            Picker("Durée d’accès", selection: $duration) {
                Text("1 heure").tag("1")
                Text("4 heures").tag("4")
                Text("12 heures").tag("12")
                Text("24 heures").tag("24")
                Text("Permanent").tag("permanent")
            }
            .pickerStyle(.menu)
            .tint(VelvetColor.champagneGold)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .background(VelvetColor.panelRaised.opacity(0.78))
            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
            }
        }
    }

    @ViewBuilder
    private var albumSelection: some View {
        if albums.isEmpty {
            VelvetEmptyState(
                symbol: "lock.rectangle.stack",
                title: "Aucun album privé",
                message: "Crée d’abord un album privé depuis ta propre fiche."
            )
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Text("ALBUMS À PARTAGER")
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(VelvetColor.champagneGold)

                ForEach(albums) { album in
                    Button {
                        toggle(album.id)
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

                            Image(systemName: selectedAlbumIDs.contains(album.id) ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(VelvetColor.champagneGold)
                        }
                        .padding(15)
                        .background(VelvetColor.panelRaised.opacity(0.78))
                        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 15, style: .continuous)
                                .stroke(
                                    selectedAlbumIDs.contains(album.id)
                                        ? VelvetColor.champagneGold.opacity(0.38)
                                        : VelvetColor.borderSubtle,
                                    lineWidth: 0.8
                                )
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func toggle(_ id: UUID) {
        if selectedAlbumIDs.contains(id) {
            selectedAlbumIDs.remove(id)
        } else {
            selectedAlbumIDs.insert(id)
        }
    }

    @MainActor
    private func loadAlbums() async {
        albums = ((try? await store.service.profile())?.profile?.albums ?? [])
            .filter { $0.confidentiality != "public" }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    @MainActor
    private func grantAccess() async {
        isWorking = true
        defer { isWorking = false }

        do {
            _ = try await store.service.grantAlbumAccess(
                albumIDs: Array(selectedAlbumIDs),
                profileID: targetProfile.id,
                duration: duration
            )
            dismiss()
        } catch {
            store.errorMessage = ErrorMessage.text(for: error)
        }
    }
}
