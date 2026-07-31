import PhotosUI
import SwiftUI

struct PremiumAlbumManagerView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var albums: [ProfileAlbum] = []
    @State private var name = ""
    @State private var confidentiality = "private"
    @State private var selectedAlbum: ProfileAlbum?
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        VelvetPageHeader(
                            "Bibliothèque privée",
                            title: "Mes collections",
                            subtitle: "Organise tes médias comme des collections privées, avec une couverture et un niveau d’accès clair."
                        )

                        creatorCard

                        if albums.isEmpty && !isWorking {
                            VelvetCompactEmptyState(
                                symbol: "photo.stack",
                                title: "Ta bibliothèque est vide",
                                message: "Crée une première collection publique ou privée pour commencer."
                            )
                        } else {
                            VStack(spacing: 15) {
                                ForEach(albums) { album in
                                    Button {
                                        selectedAlbum = album
                                    } label: {
                                        VelvetAlbumCoverCard(album: presentation(for: album))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .padding(20)
                    .padding(.bottom, 30)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .task { await load() }
            .sheet(item: $selectedAlbum) { album in
                PremiumManagedAlbumDetailView(album: album) {
                    await load()
                }
            }
        }
    }

    private var creatorCard: some View {
        PremiumProfileSection(eyebrow: "Nouvelle collection", title: "Créer un album") {
            VelvetField(
                title: "Nom de l’album",
                prompt: "Moments choisis",
                text: $name,
                contentType: nil
            )

            Picker("Confidentialité", selection: $confidentiality) {
                Text("Privé").tag("private")
                Text("Public").tag("public")
            }
            .pickerStyle(.segmented)

            Text(
                confidentiality == "public"
                    ? "Visible selon les règles de ton profil."
                    : "Invisible sans autorisation explicite de ta part."
            )
            .font(VelvetTypography.body(size: 11))
            .foregroundStyle(VelvetColor.textSecondary)

            VelvetPrimaryButton(
                "Créer la collection",
                isLoading: isWorking,
                isDisabled: name.trimmingCharacters(in: .whitespacesAndNewlines).count < 2
            ) {
                Task { await create() }
            }
        }
    }

    private func presentation(for album: ProfileAlbum) -> VelvetAlbumPresentation {
        VelvetAlbumPresentation(
            id: album.id,
            title: album.name,
            subtitle: album.confidentiality == "public"
                ? "Collection visible par les membres autorisés"
                : "Collection privée sur autorisation explicite",
            confidentiality: album.confidentiality ?? "private",
            expiresAt: album.expiresAt,
            urls: (album.mediaAssets ?? []).compactMap(\.previewUrl)
        )
    }

    @MainActor
    private func load() async {
        do {
            albums = try await appState.session.profile().profile?.albums ?? []
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func create() async {
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await appState.session.createAlbum(
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                confidentiality: confidentiality
            )
            name = ""
            await load()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct PremiumManagedAlbumDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    let initialAlbum: ProfileAlbum
    let onChanged: () async -> Void

    @State private var album: ProfileAlbum
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var selectedIndex = 0
    @State private var showsViewer = false
    @State private var isWorking = false

    init(album: ProfileAlbum, onChanged: @escaping () async -> Void) {
        initialAlbum = album
        self.onChanged = onChanged
        _album = State(initialValue: album)
    }

    private var urls: [URL] {
        (album.mediaAssets ?? []).compactMap(\.previewUrl)
    }

    private var presentation: VelvetAlbumPresentation {
        VelvetAlbumPresentation(
            id: album.id,
            title: album.name,
            subtitle: album.confidentiality == "public"
                ? "Collection visible par les membres autorisés"
                : "Collection privée sur autorisation explicite",
            confidentiality: album.confidentiality ?? "private",
            expiresAt: album.expiresAt,
            urls: urls
        )
    }

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VelvetAlbumCoverCard(album: presentation)

                        HStack {
                            VStack(alignment: .leading, spacing: 5) {
                                Text("MÉDIAS")
                                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                                    .tracking(1.6)
                                    .foregroundStyle(VelvetColor.champagneGold)
                                Text("\(urls.count) élément\(urls.count > 1 ? "s" : "")")
                                    .font(VelvetTypography.title(size: 25))
                                    .foregroundStyle(VelvetColor.ivory)
                            }
                            Spacer()
                            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                                Label("Ajouter", systemImage: "plus")
                                    .font(VelvetTypography.caption(size: 11, weight: .semibold))
                                    .foregroundStyle(VelvetColor.velvetBlack)
                                    .padding(.horizontal, 14)
                                    .frame(height: 40)
                                    .background(VelvetColor.champagneGold)
                                    .clipShape(Capsule())
                            }
                            .disabled(isWorking)
                        }

                        if urls.isEmpty {
                            VelvetCompactEmptyState(
                                symbol: "photo.badge.plus",
                                title: "Collection encore vide",
                                message: "Ajoute une première photo pour créer la couverture de cet album."
                            )
                        } else {
                            LazyVGrid(
                                columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
                                spacing: 8
                            ) {
                                ForEach(Array((album.mediaAssets ?? []).enumerated()), id: \.element.id) { index, media in
                                    Button {
                                        selectedIndex = index
                                        showsViewer = true
                                    } label: {
                                        VelvetRemoteImage(url: media.previewUrl)
                                            .frame(maxWidth: .infinity)
                                            .frame(height: 180)
                                            .clipped()
                                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                                            .overlay { RoundedRectangle(cornerRadius: 18).stroke(VelvetColor.borderSubtle) }
                                    }
                                    .buttonStyle(.plain)
                                    .contextMenu {
                                        Button("Supprimer", role: .destructive) {
                                            Task { await delete(media.id) }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(20)
                    .padding(.bottom, 30)
                }
            }
            .overlay {
                if isWorking {
                    ZStack {
                        Color.black.opacity(0.32).ignoresSafeArea()
                        ProgressView().tint(VelvetColor.champagneGold)
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .onChange(of: selectedPhoto) { _, item in
                guard let item else { return }
                Task { await upload(item) }
            }
        }
        .fullScreenCover(isPresented: $showsViewer) {
            VelvetFullScreenMediaViewer(urls: urls, selection: $selectedIndex)
        }
    }

    @MainActor
    private func reload() async {
        do {
            if let updated = try await appState.session.profile().profile?.albums?.first(where: { $0.id == initialAlbum.id }) {
                album = updated
            }
            await onChanged()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func upload(_ item: PhotosPickerItem) async {
        isWorking = true
        defer {
            isWorking = false
            selectedPhoto = nil
        }
        do {
            guard let source = try await item.loadTransferable(type: Data.self) else { return }
            let data = try ImageCompressor.jpegData(from: source)
            _ = try await appState.session.uploadAlbumMedia(data: data, albumID: album.id)
            await reload()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func delete(_ id: UUID) async {
        isWorking = true
        defer { isWorking = false }
        do {
            _ = try await appState.session.deleteAlbumMedia(id: id)
            await reload()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}
