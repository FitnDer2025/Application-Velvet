import SwiftUI

struct ProfileMediaManagementView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var profile: MemberProfile?
    @State private var profilePhotos: [ProfilePhoto] = []
    @State private var mediaToDelete: ManagedMediaItem?
    @State private var isLoading = true
    @State private var isDeleting = false
    @State private var warning: String?

    private var albumMedia: [ManagedMediaItem] {
        (profile?.albums ?? []).flatMap { album in
            (album.mediaAssets ?? []).map { media in
                ManagedMediaItem(
                    id: media.id,
                    title: album.name,
                    subtitle: album.confidentiality == "public" ? "Album public" : "Album privé",
                    previewUrl: media.previewUrl,
                    scope: "album",
                    isProfileRequirement: false
                )
            }
        }
    }

    private var publicProfileMedia: [ManagedMediaItem] {
        profilePhotos.map { photo in
            ManagedMediaItem(
                id: photo.id,
                title: photo.mediaRole == "individual_portrait" ? "Portrait individuel" : "Photo du profil",
                subtitle: photo.moderationStatus == "approved" ? "Visible après admission" : "Validation : \(photo.moderationStatus)",
                previewUrl: photo.previewUrl,
                scope: "profile",
                isProfileRequirement: photo.mediaRole == "couple_gallery" || photo.mediaRole == "individual_gallery"
            )
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VelvetPageHeader(
                            "Gestion de vos médias",
                            title: "Photos & albums",
                            subtitle: "Supprimez vos photos de profil, publiques ou privées. Trois photos de profil validées restent obligatoires pour être visible."
                        )

                        readinessBanner

                        mediaSection(
                            title: "Photos du profil",
                            detail: "\(publicProfileMedia.count) média\(publicProfileMedia.count > 1 ? "s" : "")",
                            items: publicProfileMedia
                        )

                        mediaSection(
                            title: "Albums publics et privés",
                            detail: "\(albumMedia.count) média\(albumMedia.count > 1 ? "s" : "")",
                            items: albumMedia
                        )
                    }
                    .padding(20)
                }

                if isLoading || isDeleting {
                    ProgressView(isDeleting ? "Suppression…" : "Chargement…")
                        .tint(VelvetColor.champagneGold)
                        .padding(24)
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
            }
            .navigationTitle("Gérer les photos")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
            }
            .task { await load() }
            .confirmationDialog(
                "Supprimer cette photo ?",
                isPresented: Binding(
                    get: { mediaToDelete != nil },
                    set: { if !$0 { mediaToDelete = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Supprimer définitivement", role: .destructive) {
                    Task { await deleteSelectedMedia() }
                }
                Button("Annuler", role: .cancel) { mediaToDelete = nil }
            } message: {
                if mediaToDelete?.isProfileRequirement == true {
                    Text("Si moins de trois photos de profil validées restent disponibles, votre profil sera automatiquement masqué des autres membres jusqu’à son rétablissement.")
                } else {
                    Text("Le média sera supprimé de Velvet et ne sera plus accessible dans cet album.")
                }
            }
        }
    }

    @ViewBuilder
    private var readinessBanner: some View {
        let approved = profilePhotos.filter {
            ($0.mediaRole == "couple_gallery" || $0.mediaRole == "individual_gallery")
                && $0.moderationStatus == "approved"
        }.count
        let ready = approved >= 3
        VStack(alignment: .leading, spacing: 7) {
            Label(
                ready ? "Profil visible" : "Profil masqué",
                systemImage: ready ? "eye.fill" : "eye.slash.fill"
            )
            .font(VelvetTypography.body(size: 14, weight: .semibold))
            .foregroundStyle(ready ? VelvetColor.success : VelvetColor.warning)
            Text(warning ?? "\(approved) photo\(approved > 1 ? "s" : "") de profil validée\(approved > 1 ? "s" : "") sur 3 obligatoires.")
                .font(VelvetTypography.body(size: 12))
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background((ready ? VelvetColor.success : VelvetColor.warning).opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke((ready ? VelvetColor.success : VelvetColor.warning).opacity(0.22), lineWidth: 0.8)
        }
    }

    @ViewBuilder
    private func mediaSection(
        title: String,
        detail: String,
        items: [ManagedMediaItem]
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(VelvetTypography.title(size: 25))
                    .foregroundStyle(VelvetColor.ivory)
                Spacer()
                Text(detail.uppercased())
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }

            if items.isEmpty {
                VelvetCompactEmptyState(
                    symbol: "photo.on.rectangle.angled",
                    title: "Aucun média",
                    message: "Les médias ajoutés apparaîtront ici."
                )
            } else {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
                    spacing: 10
                ) {
                    ForEach(items) { item in
                        ManagedMediaCard(item: item) {
                            mediaToDelete = item
                        }
                    }
                }
            }
        }
    }

    @MainActor
    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let profileResponse = appState.session.profile()
            async let photosResponse = appState.session.photos()
            let (profileResult, photosResult) = try await (profileResponse, photosResponse)
            profile = profileResult.profile
            profilePhotos = photosResult.photos
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    @MainActor
    private func deleteSelectedMedia() async {
        guard let media = mediaToDelete else { return }
        isDeleting = true
        defer {
            isDeleting = false
            mediaToDelete = nil
        }
        do {
            let result = try await appState.session.deleteProfileMedia(id: media.id)
            warning = result.warning
            await load()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }
}

private struct ManagedMediaItem: Identifiable {
    let id: UUID
    let title: String
    let subtitle: String
    let previewUrl: URL?
    let scope: String
    let isProfileRequirement: Bool
}

private struct ManagedMediaCard: View {
    let item: ManagedMediaItem
    let delete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                VelvetRemoteImage(url: item.previewUrl)
                    .frame(maxWidth: .infinity)
                    .frame(height: 180)
                    .clipped()
                Button(role: .destructive, action: delete) {
                    Image(systemName: "trash.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(Color.red.opacity(0.84))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .padding(8)
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(VelvetColor.borderSubtle, lineWidth: 0.8))
            Text(item.title)
                .font(VelvetTypography.body(size: 12, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
                .lineLimit(1)
            Text(item.subtitle)
                .font(VelvetTypography.caption(size: 9))
                .foregroundStyle(VelvetColor.textSecondary)
                .lineLimit(2)
        }
    }
}
