import SwiftUI

struct PremiumProfileSummaryView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var store: VelvetStore
    let profile: MemberProfile

    @State var selectedSection = "overview"
    @State var showsPrivacy = false
    @State var showsMemberTools = false
    @State var showsAlbumManager = false
    @State var selectedAlbum: VelvetAlbumPresentation?

    var photos: [MediaAsset] {
        profile.approvedPhotos
    }

    var recommendations: [Recommendation] {
        (store.directory?.recommendations ?? []).filter {
            $0.targetType == "profile" && $0.targetId == profile.id
        }
    }

    var albumPresentations: [VelvetAlbumPresentation] {
        var result: [VelvetAlbumPresentation] = []
        if !photos.isEmpty {
            result.append(
                VelvetAlbumPresentation(
                    id: profile.id,
                    title: "Photos de profil",
                    subtitle: "Collection système visible sur ta fiche",
                    confidentiality: "public",
                    expiresAt: nil,
                    urls: photos.compactMap(\.previewUrl)
                )
            )
        }
        result.append(contentsOf: (profile.albums ?? []).map { album in
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
        })
        return result
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VelvetProfileGallery(
                        urls: photos.compactMap(\.previewUrl),
                        eyebrow: profile.profileType == .couple ? "Profil couple" : "Profil individuel",
                        title: profile.displayName,
                        subtitle: profile.locationZone ?? profile.city ?? "Zone privée"
                    )
                    statusRow
                    sectionNavigation
                    selectedContent
                    accountActions
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 34)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showsPrivacy) {
            PrivacySettingsView()
        }
        .sheet(isPresented: $showsMemberTools) {
            NavigationStack {
                MemberToolsView()
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Fermer") { showsMemberTools = false }
                                .foregroundStyle(VelvetColor.champagneGold)
                        }
                    }
            }
        }
        .sheet(isPresented: $showsAlbumManager) {
            PremiumAlbumManagerView()
        }
        .sheet(item: $selectedAlbum) { album in
            VelvetAlbumDetailView(album: album)
        }
    }
}
