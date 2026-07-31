import SwiftUI

struct PremiumHomeProfileCard: View {
    let profile: MemberProfile

    private var photo: URL? {
        profile.profileGalleryPhotos.first(where: { $0.isPrimary == true })?.previewUrl
            ?? profile.profileGalleryPhotos.first?.previewUrl
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            VelvetRemoteImage(
                url: photo,
                symbol: profile.profileType == .couple ? "person.2.fill" : "person.fill"
            )
            .frame(width: 270, height: 350)
            .clipped()

            LinearGradient(
                colors: [.clear, VelvetColor.velvetBlack.opacity(0.20), VelvetColor.velvetBlack.opacity(0.96)],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 7) {
                Text(profile.velvetDemographicAndAgeLabel.uppercased())
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(profile.displayName)
                    .font(VelvetTypography.title(size: 27))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(2)
                Label(profile.locationZone ?? profile.city ?? "Zone privée", systemImage: "location")
                    .font(VelvetTypography.body(size: 11))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            .padding(18)
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.10)) }
        .shadow(color: .black.opacity(0.30), radius: 24, y: 14)
    }
}

struct PremiumHomeEditorialCard: View {
    let eyebrow: String
    let title: String
    let detail: String
    let symbol: String

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [Color(hex: 0x3D1726), VelvetColor.panelRaised],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [VelvetColor.champagneGold.opacity(0.22), .clear],
                center: .topTrailing,
                startRadius: 8,
                endRadius: 260
            )

            Image(systemName: symbol)
                .font(.system(size: 86, weight: .ultraLight))
                .foregroundStyle(VelvetColor.champagneGold.opacity(0.12))
                .offset(x: 150, y: -105)

            VStack(alignment: .leading, spacing: 8) {
                Text(eyebrow)
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(VelvetColor.champagneGold)
                Text(title)
                    .font(VelvetTypography.title(size: 27))
                    .foregroundStyle(VelvetColor.ivory)
                    .lineLimit(3)
                Text(detail)
                    .font(VelvetTypography.body(size: 12, weight: .medium))
                    .foregroundStyle(VelvetColor.softBlush)
                    .lineLimit(2)
            }
            .padding(20)
        }
        .frame(width: 270, height: 350)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay { RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.10)) }
        .shadow(color: .black.opacity(0.30), radius: 24, y: 14)
    }
}
