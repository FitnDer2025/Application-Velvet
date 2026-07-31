import PhotosUI
import SwiftUI

struct AlbumManagerView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var albums: [ProfileAlbum] = []
    @State private var name = ""
    @State private var confidentiality = "private"
    @State private var selectedAlbumID: UUID?
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VelvetPageHeader(
                            "Bibliothèque",
                            title: "Mes albums",
                            subtitle: "Crée, organise et partage tes médias sans quitter l’application."
                        )

                        VelvetCard {
                            VStack(alignment: .leading, spacing: 14) {
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
                                VelvetPrimaryButton(
                                    "Créer l’album",
                                    isLoading: isWorking,
                                    isDisabled: name.trimmingCharacters(in: .whitespacesAndNewlines).count < 2
                                ) {
                                    Task { await create() }
                                }
                            }
                        }

                        ForEach(albums) { album in
                            VelvetCard {
                                VStack(alignment: .leading, spacing: 13) {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(album.name)
                                                .font(VelvetTypography.title(size: 21))
                                                .foregroundStyle(VelvetColor.ivory)
                                            Label(
                                                album.confidentiality == "public"
                                                    ? "Public"
                                                    : "Privé sur autorisation",
                                                systemImage: album.confidentiality == "public"
                                                    ? "globe.europe.africa"
                                                    : "lock"
                                            )
                                            .font(VelvetTypography.caption(size: 10))
                                            .foregroundStyle(VelvetColor.champagneGold)
                                        }
                                        Spacer()
                                        PhotosPicker(selection: $selectedPhoto, matching: .images) {
                                            Image(systemName: "photo.badge.plus")
                                                .foregroundStyle(VelvetColor.velvetBlack)
                                                .frame(width: 38, height: 38)
                                                .background(VelvetColor.champagneGold)
                                                .clipShape(Circle())
                                        }
                                        .simultaneousGesture(
                                            TapGesture().onEnded { selectedAlbumID = album.id }
                                        )
                                    }

                                    if let media = album.mediaAssets, !media.isEmpty {
                                        ScrollView(.horizontal, showsIndicators: false) {
                                            HStack(spacing: 9) {
                                                ForEach(media) { item in
                                                    AsyncImage(url: item.previewUrl) { image in
                                                        image.resizable().scaledToFill()
                                                    } placeholder: {
                                                        ProgressView()
                                                            .tint(VelvetColor.champagneGold)
                                                    }
                                                    .frame(width: 94, height: 116)
                                                    .clipShape(
                                                        RoundedRectangle(
                                                            cornerRadius: VelvetRadius.medium
                                                        )
                                                    )
                                                    .contextMenu {
                                                        Button("Supprimer", role: .destructive) {
                                                            Task { await delete(item.id) }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        Text("Aucun média dans cet album.")
                                            .font(VelvetTypography.body(size: 12))
                                            .foregroundStyle(VelvetColor.textSecondary)
                                    }
                                }
                            }
                        }
                    }
                    .padding(20)
                    .padding(.bottom, 30)
                }
            }
            .navigationTitle("Albums")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                }
            }
            .task { await load() }
            .onChange(of: selectedPhoto) { _, item in
                guard let item, let albumID = selectedAlbumID else { return }
                Task { await upload(item, albumID: albumID) }
            }
        }
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
                name: name,
                confidentiality: confidentiality
            )
            name = ""
            await load()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func upload(_ item: PhotosPickerItem, albumID: UUID) async {
        isWorking = true
        defer {
            isWorking = false
            selectedPhoto = nil
            selectedAlbumID = nil
        }
        do {
            guard let source = try await item.loadTransferable(type: Data.self) else {
                return
            }
            let data = try ImageCompressor.jpegData(from: source)
            _ = try await appState.session.uploadAlbumMedia(
                data: data,
                albumID: albumID
            )
            await load()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func delete(_ id: UUID) async {
        do {
            _ = try await appState.session.deleteAlbumMedia(id: id)
            await load()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}

