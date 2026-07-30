import SwiftUI

struct NotificationsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        VelvetPageHeader(
                            "Activité authentique",
                            title: "Notifications",
                            subtitle: "Chaque élément correspond à une action réellement enregistrée dans Velvet."
                        )

                        if store.notificationFeed.notifications.isEmpty {
                            VelvetEmptyState(
                                symbol: "bell",
                                title: "Aucune notification",
                                message: "Les messages, réactions et inscriptions apparaîtront ici lorsqu’une action réelle aura lieu."
                            )
                        } else {
                            LazyVStack(spacing: 12) {
                                ForEach(store.notificationFeed.notifications) { notification in
                                    NotificationTile(notification: notification)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 24)
                    .padding(.bottom, 30)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Fermer", action: dismiss.callAsFunction)
                        .foregroundStyle(VelvetColor.champagneGold)
                }
                if store.notificationFeed.unreadCount > 0 {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Tout lire") {
                            Task { await store.markNotificationsRead() }
                        }
                        .font(VelvetTypography.caption(size: 12, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    }
                }
            }
            .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
    }
}

private struct NotificationTile: View {
    let notification: VelvetNotification

    private var icon: String {
        switch notification.eventType {
        case "messages": "envelope.fill"
        case "likes": "heart.fill"
        case "events": "sparkles"
        case "security": "shield.fill"
        default: "bell.fill"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 15))
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 44, height: 44)
                .background(VelvetColor.velvetBurgundy.opacity(0.22))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 5) {
                Text(notification.title)
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                if let body = notification.body {
                    Text(body)
                        .font(VelvetTypography.body(size: 12))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .lineSpacing(3)
                }
                Text(notification.createdAt.velvetDateLabel)
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .foregroundStyle(VelvetColor.champagneGold)
            }

            Spacer()

            if notification.readAt == nil {
                Circle()
                    .fill(VelvetColor.burgundyLight)
                    .frame(width: 7, height: 7)
                    .padding(.top, 6)
            }
        }
        .padding(16)
        .background(
            notification.readAt == nil
                ? VelvetColor.velvetBurgundy.opacity(0.10)
                : VelvetColor.panelRaised.opacity(0.64)
        )
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.large, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
        }
    }
}
