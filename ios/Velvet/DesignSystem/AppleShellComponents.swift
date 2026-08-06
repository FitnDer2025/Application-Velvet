import SwiftUI
import UIKit

@MainActor
final class ShellChromeState: ObservableObject {
    @Published var isImmersive = false {
        didSet {
            ZwitConversationDateHUD.setVisible(isImmersive)
        }
    }
}

@MainActor
private enum ZwitConversationDateHUD {
    private static weak var currentPill: UIView?

    static func setVisible(_ visible: Bool) {
        if !visible {
            currentPill?.removeFromSuperview()
            currentPill = nil
            return
        }

        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap(\.windows)
            .first(where: { $0.isKeyWindow }) else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                setVisible(true)
            }
            return
        }

        if let currentPill, currentPill.superview != nil {
            updateLabel(in: currentPill)
            return
        }

        let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialDark))
        blur.translatesAutoresizingMaskIntoConstraints = false
        blur.layer.cornerRadius = 16
        blur.layer.cornerCurve = .continuous
        blur.clipsToBounds = true
        blur.layer.borderWidth = 0.7
        blur.layer.borderColor = UIColor(red: 0.85, green: 0.74, blue: 0.47, alpha: 0.26).cgColor
        blur.isUserInteractionEnabled = false
        blur.accessibilityIdentifier = "zwit-conversation-date"

        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.font = .systemFont(ofSize: 11, weight: .bold)
        label.textColor = UIColor(red: 0.85, green: 0.74, blue: 0.47, alpha: 1)
        label.textAlignment = .center
        label.adjustsFontForContentSizeCategory = true
        label.tag = 7106
        blur.contentView.addSubview(label)

        window.addSubview(blur)
        NSLayoutConstraint.activate([
            blur.centerXAnchor.constraint(equalTo: window.centerXAnchor),
            blur.topAnchor.constraint(equalTo: window.safeAreaLayoutGuide.topAnchor, constant: 58),
            blur.heightAnchor.constraint(greaterThanOrEqualToConstant: 32),
            label.leadingAnchor.constraint(equalTo: blur.contentView.leadingAnchor, constant: 14),
            label.trailingAnchor.constraint(equalTo: blur.contentView.trailingAnchor, constant: -14),
            label.topAnchor.constraint(equalTo: blur.contentView.topAnchor, constant: 7),
            label.bottomAnchor.constraint(equalTo: blur.contentView.bottomAnchor, constant: -7)
        ])

        currentPill = blur
        updateLabel(in: blur)
        blur.alpha = 0
        UIView.animate(withDuration: 0.22) {
            blur.alpha = 1
        }
    }

    private static func updateLabel(in view: UIView) {
        guard let label = view.viewWithTag(7106) as? UILabel else { return }
        let date = Date()
        let fullDate = date.formatted(
            .dateTime.weekday(.wide).day().month(.wide).year()
        ).capitalized
        label.text = "Aujourd’hui · \(fullDate)"
        label.accessibilityLabel = "Messages d’aujourd’hui, \(fullDate)"
    }
}

struct CompactVelvetTopBar: View {
    let unreadCount: Int
    let notifications: () -> Void
    let menu: () -> Void

    var body: some View {
        HStack(spacing: 9) {
            VelvetMark(size: 25)
            Text("ZWIT")
                .font(VelvetTypography.brand(size: 14))
                .tracking(2.8)
                .foregroundStyle(VelvetColor.ivory)

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
        .frame(height: 46)
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
