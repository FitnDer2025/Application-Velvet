import SwiftUI

@MainActor
final class ShellChromeState: ObservableObject {
    @Published var isImmersive = false
}

struct CompactVelvetTopBar: View {
    let unreadCount: Int
    let notifications: () -> Void
    let menu: () -> Void

    var body: some View {
        HStack(spacing: 9) {
            VelvetMark(size: 48)
                .accessibilityLabel("Zwit")

            Spacer()

            topButton(symbol: "bell", label: "Notifications", action: notifications) {
                if unreadCount > 0 {
                    Text(unreadCount > 99 ? "99+" : "\(unreadCount)")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .padding(.horizontal, unreadCount > 9 ? 4 : 0)
                        .frame(minWidth: 17, minHeight: 17)
                        .background(VelvetColor.burgundyLight)
                        .clipShape(Capsule())
                        .offset(x: 7, y: -7)
                }
            }

            topButton(symbol: "line.3.horizontal", label: "Menu Zwit", action: menu) {
                EmptyView()
            }
        }
        .padding(.horizontal, 15)
        .frame(height: 58)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.58))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(VelvetColor.borderSubtle.opacity(0.72))
                .frame(height: 0.5)
        }
    }

    private func topButton<Badge: View>(
        symbol: String,
        label: String,
        action: @escaping () -> Void,
        @ViewBuilder badge: () -> Badge
    ) -> some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: symbol)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(VelvetColor.ivory)
                    .frame(width: 34, height: 34)
                    .background(.ultraThinMaterial)
                    .background(VelvetColor.ivory.opacity(0.025))
                    .clipShape(Circle())
                    .overlay(Circle().stroke(VelvetColor.borderSubtle, lineWidth: 0.7))
                badge()
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

extension MemberProfile {
    var velvetAudienceLabel: String {
        guard profileType != .couple else { return "Couple" }
        let value = (individualProfiles?.first?.genderIdentity ?? "").lowercased()
        if value.contains("femme") || value.contains("woman") || value.contains("female") {
            return "Femme seule"
        }
        if value.contains("homme") || value.contains("man") || value.contains("male") {
            return "Homme seul"
        }
        if value.contains("trans") {
            return "Profil trans"
        }
        if value.contains("non") || value.contains("fluid") || value.contains("queer") {
            return "Profil non-binaire"
        }
        return "Profil individuel"
    }
}

extension Conversation {
    static func direct(
        id: UUID,
        title: String,
        profileID: UUID? = nil,
        photoURL: URL? = nil
    ) -> Conversation {
        Conversation(
            id: id,
            kind: "direct",
            eventId: nil,
            subject: nil,
            createdAt: nil,
            updatedAt: nil,
            conversationMembers: nil,
            participantProfileId: profileID,
            participantDisplayName: title,
            participantPhotoUrl: photoURL,
            lastMessageBody: nil,
            lastMessageAt: nil,
            unreadCount: 0
        )
    }
}
