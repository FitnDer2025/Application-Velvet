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
    @State private var loadIssue: String?

    private var albumMedia: [ManagedMediaItem] {
        (profile?.albums ?? [])
            .flatMap { album in
                (album.mediaAssets ?? []).map { media in
                    ManagedMediaItem(
                        id: media.id,
                        title: album.name,
                        subtitle: album.confidentiality == "public" ? "Album public" : "Album privé",
                        previewUrl: media.previewUrl,
                        mediaRole: "album",
                        moderationStatus: media.moderationStatus ?? "pending",
                        isProfileRequirement: false
                    )
                }
            }
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    private var publicProfileMedia: [ManagedMediaItem] {
        var merged: [UUID: ManagedMediaItem] = [:]

        // Première source : le profil complet. Elle permet de conserver l’affichage
        // même lorsque l’endpoint spécialisé Photos répond partiellement.
        for media in profile?.profileGalleryPhotos ?? [] {
            let role = media.mediaRole ?? "profile"
            merged[media.id] = ManagedMediaItem(
                id: media.id,
                title: role == "individual_portrait" ? "Portrait individuel" : "Photo du profil",
                subtitle: moderationLabel(media.moderationStatus ?? "pending"),
                previewUrl: media.previewUrl,
                mediaRole: role,
                moderationStatus: media.moderationStatus ?? "pending",
                isProfileRequirement: role == "couple_gallery" || role == "individual_gallery"
            )
        }

        // Deuxième source : la photothèque de gestion, plus précise sur la modération.
        for photo in profilePhotos {
            merged[photo.id] = ManagedMediaItem(
                id: photo.id,
                title: photo.mediaRole == "individual_portrait" ? "Portrait individuel" : "Photo du profil",
                subtitle: moderationLabel(photo.moderationStatus),
                previewUrl: photo.previewUrl,
                mediaRole: photo.mediaRole,
                moderationStatus: photo.moderationStatus,
                isProfileRequirement: photo.mediaRole == "couple_gallery" || photo.mediaRole == "individual_gallery"
            )
        }

        return merged.values.sorted { left, right in
            if left.isProfileRequirement != right.isProfileRequirement {
                return left.isProfileRequirement
            }
            return left.title.localizedCaseInsensitiveCompare(right.title) == .orderedAscending
        }
    }

    private var approvedProfilePhotoCount: Int {
        publicProfileMedia.filter {
            $0.isProfileRequirement && $0.moderationStatus == "approved"
        }.count
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
                            subtitle: "Retrouvez ici toutes les photos de votre profil et de vos albums, avec une suppression directe et sécurisée."
                        )

                        readinessBanner

                        if let loadIssue {
                            inlineNotice(loadIssue)
                        }

                        mediaSection(
                            title: "Photos du profil",
                            detail: mediaCountLabel(publicProfileMedia.count),
                            items: publicProfileMedia,
                            emptyTitle: "Aucune photo remontée",
                            emptyMessage: "Actualisez la photothèque. Vos photos déjà publiées doivent apparaître ici avec leur corbeille."
                        )

                        mediaSection(
                            title: "Albums publics et privés",
                            detail: mediaCountLabel(albumMedia.count),
                            items: albumMedia,
                            emptyTitle: "Aucun média d’album",
                            emptyMessage: "Les albums existants apparaîtront ici, y compris les collections privées."
                        )
                    }
                    .padding(20)
                }
                .refreshable { await load() }

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

    private var readinessBanner: some View {
        let ready = approvedProfilePhotoCount >= 3
        return VStack(alignment: .leading, spacing: 7) {
            Label(
                ready ? "Profil visible" : "Profil masqué",
                systemImage: ready ? "eye.fill" : "eye.slash.fill"
            )
            .font(VelvetTypography.body(size: 14, weight: .semibold))
            .foregroundStyle(ready ? VelvetColor.success : VelvetColor.warning)
            Text(warning ?? "\(approvedProfilePhotoCount) photo\(approvedProfilePhotoCount > 1 ? "s" : "") de profil validée\(approvedProfilePhotoCount > 1 ? "s" : "") sur 3 obligatoires.")
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

    private func inlineNotice(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "arrow.clockwise.circle")
                .foregroundStyle(VelvetColor.champagneGold)
            VStack(alignment: .leading, spacing: 5) {
                Text("Photothèque partiellement actualisée")
                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                Text(message)
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
                Button("Actualiser") { Task { await load() } }
                    .font(VelvetTypography.body(size: 11, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VelvetColor.champagneGold.opacity(0.055))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(VelvetColor.champagneGold.opacity(0.18)))
    }

    @ViewBuilder
    private func mediaSection(
        title: String,
        detail: String,
        items: [ManagedMediaItem],
        emptyTitle: String,
        emptyMessage: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .lastTextBaseline) {
                Text(title)
                    .font(VelvetTypography.title(size: 25))
                    .foregroundStyle(VelvetColor.ivory)
                Spacer()
                Text(detail.uppercased())
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }

            if items.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    VelvetCompactEmptyState(
                        symbol: "photo.on.rectangle.angled",
                        title: emptyTitle,
                        message: emptyMessage
                    )
                    Button {
                        Task { await load() }
                    } label: {
                        Label("Actualiser les médias", systemImage: "arrow.clockwise")
                            .font(VelvetTypography.body(size: 12, weight: .semibold))
                            .foregroundStyle(VelvetColor.champagneGold)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(VelvetColor.champagneGold.opacity(0.07))
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(VelvetColor.champagneGold.opacity(0.20)))
                    }
                    .buttonStyle(.plain)
                }
            } else {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
                    spacing: 14
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
        guard !isLoading else { return }
        isLoading = true
        loadIssue = nil
        defer { isLoading = false }

        async let profileRequest = try? await appState.session.profile()
        async let photosRequest = try? await appState.session.photos()
        let (profileResponse, photosResponse) = await (profileRequest, photosRequest)

        if let updatedProfile = profileResponse?.profile {
            profile = updatedProfile
        }
        if let updatedPhotos = photosResponse?.photos {
            profilePhotos = updatedPhotos
        }

        switch (profileResponse, photosResponse) {
        case (nil, nil):
            loadIssue = "Velvet n’a pas pu joindre la photothèque. Tirez l’écran vers le bas ou touchez Actualiser."
        case (nil, _):
            loadIssue = "Les photos sont disponibles, mais les albums n’ont pas encore été actualisés."
        case (_, nil):
            loadIssue = "Le profil et les albums sont disponibles. La liste détaillée des photos est en cours de resynchronisation."
        default:
            loadIssue = nil
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
            profilePhotos.removeAll { $0.id == media.id }
            await load()
        } catch {
            appState.alertMessage = ErrorMessage.text(for: error)
        }
    }

    private func moderationLabel(_ status: String) -> String {
        switch status {
        case "approved": "Validée et visible"
        case "rejected": "Refusée · à remplacer"
        case "review": "Contrôle Velvet en cours"
        default: "Validation en attente"
        }
    }

    private func mediaCountLabel(_ count: Int) -> String {
        "\(count) média\(count > 1 ? "s" : "")"
    }
}

private struct ManagedMediaItem: Identifiable {
    let id: UUID
    let title: String
    let subtitle: String
    let previewUrl: URL?
    let mediaRole: String
    let moderationStatus: String
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
                    .frame(height: 205)
                    .clipped()

                LinearGradient(
                    colors: [.clear, .black.opacity(0.30)],
                    startPoint: .center,
                    endPoint: .topTrailing
                )
                .allowsHitTesting(false)

                Button(role: .destructive, action: delete) {
                    Image(systemName: "trash.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(.ultraThinMaterial)
                        .background(Color.red.opacity(0.72))
                        .clipShape(Circle())
                        .overlay(Circle().stroke(.white.opacity(0.18), lineWidth: 0.8))
                }
                .buttonStyle(.plain)
                .padding(9)
                .accessibilityLabel("Supprimer \(item.title)")
            }
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(VelvetColor.borderSubtle, lineWidth: 0.8))

            Text(item.title)
                .font(VelvetTypography.body(size: 12, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
                .lineLimit(1)
            Text(item.subtitle)
                .font(VelvetTypography.caption(size: 9))
                .foregroundStyle(item.moderationStatus == "approved" ? VelvetColor.champagneGold : VelvetColor.textSecondary)
                .lineLimit(2)
        }
    }
}
