import SwiftUI

struct VelvetAlbumPresentation: Identifiable {
    let id: UUID
    let title: String
    let subtitle: String
    let confidentiality: String
    let expiresAt: String?
    let urls: [URL]

    var isPrivate: Bool {
        confidentiality.lowercased() != "public"
    }

    var confidentialityLabel: String {
        isPrivate ? "PRIVÉ" : "PUBLIC"
    }

    var confidentialityIcon: String {
        isPrivate ? "lock.fill" : "globe.europe.africa.fill"
    }
}

struct VelvetRemoteImage: View {
    let url: URL?
    var contentMode: ContentMode = .fill
    var symbol: String = "photo"

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
            switch phase {
            case let .success(image):
                image
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .transition(.opacity)
            case .failure:
                placeholder
            case .empty:
                ZStack {
                    placeholder
                    ProgressView()
                        .tint(VelvetColor.champagneGold)
                }
            @unknown default:
                placeholder
            }
        }
    }

    private var placeholder: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: 0x32141F), VelvetColor.anthracite],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [VelvetColor.champagneGold.opacity(0.17), .clear],
                center: .topTrailing,
                startRadius: 8,
                endRadius: 260
            )
            Image(systemName: symbol)
                .font(.system(size: 44, weight: .ultraLight))
                .foregroundStyle(VelvetColor.champagneGold.opacity(0.72))
        }
    }
}

struct VelvetProfileGallery: View {
    let urls: [URL]
    let eyebrow: String
    let title: String
    let subtitle: String

    @State private var selectedIndex = 0
    @State private var showsViewer = false

    var body: some View {
        VStack(spacing: 12) {
            ZStack(alignment: .bottomLeading) {
                galleryContent

                LinearGradient(
                    colors: [
                        .clear,
                        VelvetColor.velvetBlack.opacity(0.20),
                        VelvetColor.velvetBlack.opacity(0.97)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .allowsHitTesting(false)

                VStack(alignment: .leading, spacing: 8) {
                    Text(eyebrow.uppercased())
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.9)
                        .foregroundStyle(VelvetColor.champagneGold)

                    Text(title)
                        .font(VelvetTypography.title(size: 42))
                        .tracking(-1.1)
                        .minimumScaleFactor(0.72)
                        .lineLimit(2)
                        .foregroundStyle(VelvetColor.ivory)

                    Label(subtitle, systemImage: "location")
                        .font(VelvetTypography.body(size: 12))
                        .foregroundStyle(VelvetColor.textSecondary)
                }
                .padding(22)

                if !urls.isEmpty {
                    VStack {
                        HStack {
                            Spacer()
                            Button {
                                showsViewer = true
                            } label: {
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
                            Text("\(selectedIndex + 1) / \(urls.count)")
                                .font(VelvetTypography.caption(size: 10, weight: .semibold))
                                .foregroundStyle(VelvetColor.ivory)
                                .padding(.horizontal, 12)
                                .frame(height: 30)
                                .background(.ultraThinMaterial)
                                .background(.black.opacity(0.32))
                                .clipShape(Capsule())
                        }
                    }
                    .padding(16)
                }
            }
            .frame(height: 480)
            .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.editorial, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: VelvetRadius.editorial, style: .continuous)
                    .stroke(.white.opacity(0.10), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.42), radius: 34, y: 18)
            .contentShape(Rectangle())
            .onTapGesture {
                guard !urls.isEmpty else { return }
                showsViewer = true
            }

            if urls.count > 1 {
                thumbnailStrip
            }
        }
        .fullScreenCover(isPresented: $showsViewer) {
            VelvetFullScreenMediaViewer(urls: urls, selection: $selectedIndex)
        }
        .onChange(of: urls.count) { _, count in
            if count == 0 {
                selectedIndex = 0
            } else if selectedIndex >= count {
                selectedIndex = count - 1
            }
        }
    }

    @ViewBuilder
    private var galleryContent: some View {
        if urls.isEmpty {
            VelvetRemoteImage(url: nil, symbol: "person.crop.rectangle")
        } else {
            TabView(selection: $selectedIndex) {
                ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                    VelvetRemoteImage(url: url)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .clipped()
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
    }

    private var thumbnailStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 9) {
                ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                    Button {
                        withAnimation(.easeOut(duration: VelvetMotion.normal)) {
                            selectedIndex = index
                        }
                    } label: {
                        VelvetRemoteImage(url: url)
                            .frame(width: selectedIndex == index ? 58 : 50, height: selectedIndex == index ? 72 : 64)
                            .clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(
                                        selectedIndex == index
                                            ? VelvetColor.champagneGold
                                            : VelvetColor.borderSubtle,
                                        lineWidth: selectedIndex == index ? 2 : 1
                                    )
                            }
                            .opacity(selectedIndex == index ? 1 : 0.62)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 2)
        }
        .contentMargins(.horizontal, 1)
    }
}

struct VelvetFullScreenMediaViewer: View {
    @Environment(\.dismiss) private var dismiss
    let urls: [URL]
    @Binding var selection: Int

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if urls.isEmpty {
                VelvetRemoteImage(url: nil)
                    .ignoresSafeArea()
            } else {
                TabView(selection: $selection) {
                    ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                        VelvetRemoteImage(url: url, contentMode: .fit)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .padding(.vertical, 70)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }

            VStack(spacing: 0) {
                HStack {
                    Text(urls.isEmpty ? "GALERIE" : "\(selection + 1) SUR \(urls.count)")
                        .font(VelvetTypography.caption(size: 10, weight: .semibold))
                        .tracking(1.6)
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

                if urls.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                                Button {
                                    withAnimation(.easeOut(duration: VelvetMotion.normal)) {
                                        selection = index
                                    }
                                } label: {
                                    VelvetRemoteImage(url: url)
                                        .frame(width: 44, height: 56)
                                        .clipped()
                                        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                                        .overlay {
                                            RoundedRectangle(cornerRadius: 11, style: .continuous)
                                                .stroke(
                                                    selection == index
                                                        ? VelvetColor.champagneGold
                                                        : .white.opacity(0.15),
                                                    lineWidth: selection == index ? 2 : 1
                                                )
                                        }
                                        .opacity(selection == index ? 1 : 0.56)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 18)
                    }
                    .padding(.bottom, 18)
                }
            }
        }
        .statusBarHidden(true)
    }
}

struct VelvetAlbumCoverCard: View {
    let album: VelvetAlbumPresentation

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            VelvetRemoteImage(url: album.urls.first, symbol: "photo.stack")
                .frame(maxWidth: .infinity)
                .frame(height: 250)
                .clipped()

            LinearGradient(
                colors: [.clear, VelvetColor.velvetBlack.opacity(0.25), VelvetColor.velvetBlack.opacity(0.98)],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Label(album.confidentialityLabel, systemImage: album.confidentialityIcon)
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.2)
                        .foregroundStyle(
                            album.isPrivate
                                ? VelvetColor.softBlush
                                : VelvetColor.champagneGold
                        )
                    Spacer()
                    Text("\(album.urls.count) MÉDIA\(album.urls.count > 1 ? "S" : "")")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1)
                        .foregroundStyle(.white.opacity(0.74))
                }

                Text(album.title)
                    .font(VelvetTypography.title(size: 28))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(2)

                Text(album.subtitle)
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineLimit(2)
            }
            .padding(18)
        }
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(.white.opacity(0.10), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.32), radius: 24, y: 14)
    }
}

struct VelvetMediaGrid: View {
    let urls: [URL]
    var onSelect: (Int) -> Void = { _ in }

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
            spacing: 8
        ) {
            ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                Button {
                    onSelect(index)
                } label: {
                    VelvetRemoteImage(url: url)
                        .frame(maxWidth: .infinity)
                        .frame(height: index == 0 && urls.count.isMultiple(of: 2) == false ? 230 : 180)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
                        }
                }
                .buttonStyle(.plain)
                .gridCellColumns(index == 0 && urls.count.isMultiple(of: 2) == false ? 2 : 1)
            }
        }
    }
}

struct VelvetAlbumDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let album: VelvetAlbumPresentation

    @State private var selectedIndex = 0
    @State private var showsViewer = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()

                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        VelvetAlbumCoverCard(album: album)

                        VStack(alignment: .leading, spacing: 7) {
                            Text("COLLECTION")
                                .font(VelvetTypography.caption(size: 9, weight: .semibold))
                                .tracking(1.7)
                                .foregroundStyle(VelvetColor.champagneGold)
                            Text("\(album.urls.count) média\(album.urls.count > 1 ? "s" : "")")
                                .font(VelvetTypography.title(size: 26))
                                .foregroundStyle(VelvetColor.ivory)
                        }

                        if album.urls.isEmpty {
                            VelvetCompactEmptyState(
                                symbol: album.confidentialityIcon,
                                title: "Album encore vide",
                                message: "Les médias ajoutés à cette collection apparaîtront ici."
                            )
                        } else {
                            VelvetMediaGrid(urls: album.urls) { index in
                                selectedIndex = index
                                showsViewer = true
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
        }
        .fullScreenCover(isPresented: $showsViewer) {
            VelvetFullScreenMediaViewer(urls: album.urls, selection: $selectedIndex)
        }
    }
}

struct VelvetCompactEmptyState: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
        HStack(spacing: 15) {
            Image(systemName: symbol)
                .font(.system(size: 19, weight: .light))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 48, height: 48)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(VelvetTypography.title(size: 20))
                    .foregroundStyle(VelvetColor.ivory)
                Text(message)
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
                    .lineSpacing(3)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VelvetColor.ivory.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
        }
    }
}
