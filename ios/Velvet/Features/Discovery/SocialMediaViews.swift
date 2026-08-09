import SwiftUI

struct ProfileAffinityBar: View {
    @EnvironmentObject private var store: VelvetStore
    let profileID: UUID

    private let choices: [(Int, String, String)] = [
        (-1, "❄️", "Pas pour moi"),
        (1, "🔥", "J’aime"),
        (2, "🔥🔥", "J’aime beaucoup"),
        (3, "🔥🔥🔥", "J’adore")
    ]

    private var selectedValue: Int? {
        store.profileReactionValue(for: profileID)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("TON RESSENTI")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text("Garde un repère personnel sur ce profil")
                        .font(VelvetTypography.body(size: 11))
                        .foregroundStyle(VelvetColor.textSecondary)
                }
                Spacer()
                if selectedValue != nil {
                    Button("Effacer") {
                        Task { await store.setProfileReaction(profileID: profileID, reaction: nil) }
                    }
                    .font(VelvetTypography.caption(size: 10, weight: .semibold))
                    .foregroundStyle(VelvetColor.textSecondary)
                }
            }

            HStack(spacing: 7) {
                ForEach(choices, id: \.0) { choice in
                    affinityButton(value: choice.0, symbol: choice.1, label: choice.2)
                }
            }
        }
        .padding(15)
        .background(.ultraThinMaterial)
        .background(VelvetColor.anthracite.opacity(0.60))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
        }
        .task { await store.refreshSocialState() }
    }

    private func affinityButton(value: Int, symbol: String, label: String) -> some View {
        Button {
            Task {
                await store.setProfileReaction(
                    profileID: profileID,
                    reaction: selectedValue == value ? nil : value
                )
            }
        } label: {
            VStack(spacing: 5) {
                Text(symbol)
                    .font(.system(size: value == 3 ? 14 : 18))
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                Text(label)
                    .font(VelvetTypography.caption(size: 8, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            .foregroundStyle(selectedValue == value ? VelvetColor.velvetBlack : VelvetColor.ivory)
            .frame(maxWidth: .infinity, minHeight: 60)
            .background(
                selectedValue == value
                    ? VelvetColor.champagneGold
                    : VelvetColor.ivory.opacity(0.04)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(
                        selectedValue == value ? VelvetColor.champagneGold : VelvetColor.borderSubtle,
                        lineWidth: 0.8
                    )
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

struct SocialProfileGallery: View {
    @EnvironmentObject private var store: VelvetStore
    let profile: MemberProfile
    let media: [MediaAsset]

    @State private var selectedIndex = 0
    @State private var showsViewer = false

    private var items: [SocialMediaItem] {
        media.compactMap { asset in
            guard let url = asset.previewUrl else { return nil }
            return SocialMediaItem(id: asset.id, url: url)
        }
    }

    var body: some View {
        VStack(spacing: 11) {
            ZStack(alignment: .bottomLeading) {
                gallery

                LinearGradient(
                    colors: [.clear, VelvetColor.velvetBlack.opacity(0.18), VelvetColor.velvetBlack.opacity(0.96)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .allowsHitTesting(false)

                VStack(alignment: .leading, spacing: 7) {
                    Text(profile.velvetDemographicAndAgeLabel.uppercased())
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.6)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text(profile.displayName)
                        .font(VelvetTypography.title(size: 40))
                        .foregroundStyle(VelvetColor.ivory)
                        .lineLimit(2)
                        .minimumScaleFactor(0.72)
                    Label(
                        profile.locationZone ?? profile.city ?? "Zone privée",
                        systemImage: "location"
                    )
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
                }
                .padding(20)

                if !items.isEmpty {
                    VStack {
                        HStack {
                            Spacer()
                            Button { showsViewer = true } label: {
                                Image(systemName: "arrow.up.left.and.arrow.down.right")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(VelvetColor.ivory)
                                    .frame(width: 42, height: 42)
                                    .background(.ultraThinMaterial)
                                    .background(.black.opacity(0.28))
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }
                        Spacer()
                        HStack {
                            Spacer()
                            Text("\(selectedIndex + 1) / \(items.count)")
                                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                                .foregroundStyle(VelvetColor.ivory)
                                .padding(.horizontal, 12)
                                .frame(height: 30)
                                .background(.ultraThinMaterial)
                                .background(.black.opacity(0.32))
                                .clipShape(Capsule())
                        }
                    }
                    .padding(15)
                }
            }
            .frame(height: 470)
            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.editorial, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: VelvetRadius.editorial, style: .continuous)
                    .stroke(.white.opacity(0.10), lineWidth: 1)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                guard !items.isEmpty else { return }
                showsViewer = true
            }

            if let item = items[safe: selectedIndex] {
                PhotoReactionBar(mediaID: item.id)
            }

            if items.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(items.enumerated()), id: \.offset) { pair in
                            thumbnail(index: pair.offset, item: pair.element)
                        }
                    }
                }
            }
        }
        .fullScreenCover(isPresented: $showsViewer) {
            InteractiveMediaViewer(items: items, selection: $selectedIndex)
                .environmentObject(store)
        }
        .task { await store.refreshSocialState() }
    }

    @ViewBuilder
    private var gallery: some View {
        if items.isEmpty {
            VelvetRemoteImage(url: nil, symbol: "person.crop.rectangle")
        } else {
            TabView(selection: $selectedIndex) {
                ForEach(Array(items.enumerated()), id: \.offset) { pair in
                    VelvetRemoteImage(url: pair.element.url)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .clipped()
                        .tag(pair.offset)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
    }

    private func thumbnail(index: Int, item: SocialMediaItem) -> some View {
        Button {
            withAnimation(.easeOut(duration: VelvetMotion.fast)) {
                selectedIndex = index
            }
        } label: {
            VelvetRemoteImage(url: item.url)
                .frame(width: selectedIndex == index ? 58 : 50, height: selectedIndex == index ? 72 : 64)
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .stroke(
                            selectedIndex == index ? VelvetColor.champagneGold : VelvetColor.borderSubtle,
                            lineWidth: selectedIndex == index ? 2 : 1
                        )
                }
        }
        .buttonStyle(.plain)
    }
}

struct InteractiveAlbumDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore
    let album: ProfileAlbum

    @State private var selectedIndex = 0
    @State private var showsViewer = false

    private var items: [SocialMediaItem] {
        (album.mediaAssets ?? []).compactMap { asset in
            guard let url = asset.previewUrl else { return nil }
            return SocialMediaItem(id: asset.id, url: url)
        }
    }

    private var presentation: VelvetAlbumPresentation {
        VelvetAlbumPresentation(
            id: album.id,
            title: album.name,
            subtitle: album.confidentiality == "public"
                ? "Album public du profil"
                : "Album privé ouvert pour ton compte",
            confidentiality: album.confidentiality ?? "private",
            expiresAt: album.expiresAt,
            urls: items.map(\.url)
        )
    }

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VelvetAlbumCoverCard(album: presentation)

                        VStack(alignment: .leading, spacing: 5) {
                            Text(album.confidentiality == "public" ? "ALBUM PUBLIC" : "ACCÈS PRIVÉ")
                                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                                .tracking(1.5)
                                .foregroundStyle(VelvetColor.champagneGold)
                            Text("\(items.count) photo\(items.count > 1 ? "s" : "")")
                                .font(VelvetTypography.title(size: 25))
                                .foregroundStyle(VelvetColor.ivory)
                        }

                        if items.isEmpty {
                            VelvetCompactEmptyState(
                                symbol: "photo.stack",
                                title: "Album encore vide",
                                message: "Les photos publiées dans cette collection apparaîtront ici."
                            )
                        } else {
                            LazyVGrid(
                                columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
                                spacing: 8
                            ) {
                                ForEach(Array(items.enumerated()), id: \.offset) { pair in
                                    albumThumbnail(index: pair.offset, item: pair.element)
                                }
                            }
                        }
                    }
                    .padding(18)
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
        }
        .fullScreenCover(isPresented: $showsViewer) {
            InteractiveMediaViewer(items: items, selection: $selectedIndex)
                .environmentObject(store)
        }
        .task { await store.refreshSocialState() }
    }

    private func albumThumbnail(index: Int, item: SocialMediaItem) -> some View {
        Button {
            selectedIndex = index
            showsViewer = true
        } label: {
            ZStack(alignment: .bottomTrailing) {
                VelvetRemoteImage(url: item.url)
                    .frame(maxWidth: .infinity)
                    .frame(height: 190)
                    .clipped()
                if let reaction = store.photoReaction(for: item.id) {
                    Text(reactionSymbol(reaction))
                        .font(.system(size: 16))
                        .frame(width: 32, height: 32)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                        .padding(8)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
            }
        }
        .buttonStyle(.plain)
    }

    private func reactionSymbol(_ reaction: String) -> String {
        switch reaction {
        case "like": "👍"
        case "love": "❤️"
        case "adore": "😍"
        default: ""
        }
    }
}

private struct InteractiveMediaViewer: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore
    let items: [SocialMediaItem]
    @Binding var selection: Int

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            TabView(selection: $selection) {
                ForEach(Array(items.enumerated()), id: \.offset) { pair in
                    VelvetRemoteImage(url: pair.element.url, contentMode: .fit)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(.vertical, 78)
                        .tag(pair.offset)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            VStack {
                HStack {
                    Text(items.isEmpty ? "PHOTO" : "\(selection + 1) SUR \(items.count)")
                        .font(VelvetTypography.caption(size: 10, weight: .semibold))
                        .tracking(1.5)
                        .foregroundStyle(.white.opacity(0.76))
                    Spacer()
                    Button(action: dismiss.callAsFunction) {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 42, height: 42)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 18)
                .padding(.top, 12)

                Spacer()

                if let item = items[safe: selection] {
                    PhotoReactionBar(mediaID: item.id)
                        .padding(.horizontal, 18)
                        .padding(.bottom, 20)
                }
            }
        }
        .statusBarHidden(true)
    }
}

private struct PhotoReactionBar: View {
    @EnvironmentObject private var store: VelvetStore
    let mediaID: UUID

    private let choices: [(String, String, String)] = [
        ("like", "hand.thumbsup.fill", "J’aime"),
        ("love", "heart.fill", "J’adore"),
        ("adore", "sparkles", "Coup de cœur")
    ]

    private var summary: PhotoReactionSummary? { store.photoReactions[mediaID] }

    var body: some View {
        HStack(spacing: 8) {
            ForEach(choices, id: \.0) { choice in
                reactionButton(value: choice.0, icon: choice.1, label: choice.2)
            }
        }
    }

    private func reactionButton(value: String, icon: String, label: String) -> some View {
        Button {
            Task {
                await store.setPhotoReaction(
                    mediaID: mediaID,
                    reaction: summary?.myReaction == value ? nil : value
                )
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                Text("\(count(for: value))")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
            }
            .foregroundStyle(
                summary?.myReaction == value ? VelvetColor.velvetBlack : VelvetColor.ivory
            )
            .frame(maxWidth: .infinity, minHeight: 40)
            .background(
                summary?.myReaction == value
                    ? VelvetColor.champagneGold
                    : VelvetColor.anthracite.opacity(0.84)
            )
            .clipShape(Capsule())
            .overlay {
                Capsule().stroke(
                    summary?.myReaction == value
                        ? VelvetColor.champagneGold
                        : VelvetColor.borderSubtle,
                    lineWidth: 0.8
                )
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func count(for value: String) -> Int {
        switch value {
        case "like": summary?.likeCount ?? 0
        case "love": summary?.loveCount ?? 0
        case "adore": summary?.adoreCount ?? 0
        default: 0
        }
    }
}

private struct SocialMediaItem: Identifiable {
    let id: UUID
    let url: URL
}

private extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
