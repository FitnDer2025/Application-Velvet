import SwiftUI

struct DiscoveryView: View {
    @EnvironmentObject private var store: VelvetStore
    let currentProfile: MemberProfile
    @State private var query = ""
    @State private var type: MemberProfile.ProfileType?

    private var profiles: [MemberProfile] {
        (store.directory?.profiles ?? [])
            .filter { $0.id != currentProfile.id }
            .filter { type == nil || $0.profileType == type }
            .filter {
                query.isEmpty
                    || $0.displayName.localizedCaseInsensitiveContains(query)
                    || ($0.locationZone ?? $0.city ?? "").localizedCaseInsensitiveContains(query)
                    || ($0.searchText ?? "").localizedCaseInsensitiveContains(query)
            }
    }

    var body: some View {
        ZStack {
            VelvetBackground()
            if store.directory?.locked == true {
                LockedDirectoryView()
            } else if profiles.isEmpty, !store.isLoading {
                ContentUnavailableView.search(text: query)
                    .foregroundStyle(VelvetColor.textSecondary)
            } else {
                ScrollView {
                    LazyVStack(spacing: VelvetSpacing.md) {
                        Picker("Type de profil", selection: $type) {
                            Text("Tous").tag(Optional<MemberProfile.ProfileType>.none)
                            Text("Individuels").tag(Optional(MemberProfile.ProfileType.individual))
                            Text("Couples").tag(Optional(MemberProfile.ProfileType.couple))
                        }
                        .pickerStyle(.segmented)

                        ForEach(profiles) { profile in
                            NavigationLink {
                                MemberDetailView(profile: profile)
                            } label: {
                                MemberCard(profile: profile)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(VelvetSpacing.lg)
                }
            }
        }
        .navigationTitle("Découvrir")
        .searchable(text: $query, prompt: "Nom, ville, univers…")
        .refreshable { await store.load() }
    }
}

private struct MemberCard: View {
    let profile: MemberProfile

    var body: some View {
        VelvetCard {
            HStack(spacing: VelvetSpacing.md) {
                AsyncImage(url: profile.mediaAssets?.first(where: { $0.previewUrl != nil })?.previewUrl) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Image(systemName: profile.profileType == .couple ? "person.2.fill" : "person.fill")
                        .foregroundStyle(VelvetColor.champagneGold)
                }
                .frame(width: 72, height: 86)
                .background(VelvetColor.velvetBurgundy.opacity(0.18))
                .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium))

                VStack(alignment: .leading, spacing: VelvetSpacing.xxs) {
                    Text(profile.displayName)
                        .font(VelvetTypography.title(size: 21))
                        .foregroundStyle(VelvetColor.ivory)
                    Label(profile.locationZone ?? profile.city ?? "Zone privée", systemImage: "location")
                        .font(VelvetTypography.caption())
                        .foregroundStyle(VelvetColor.textSecondary)
                    if profile.verificationStatus == "verified" {
                        Label("Profil vérifié", systemImage: "checkmark.seal.fill")
                            .font(VelvetTypography.caption(size: 11))
                            .foregroundStyle(VelvetColor.success)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(VelvetColor.textSecondary)
            }
        }
    }
}

struct LockedDirectoryView: View {
    var body: some View {
        ContentUnavailableView(
            "Admission nécessaire",
            systemImage: "lock.shield",
            description: Text("La découverte est ouverte uniquement aux membres admis.")
        )
        .foregroundStyle(VelvetColor.textSecondary)
    }
}
