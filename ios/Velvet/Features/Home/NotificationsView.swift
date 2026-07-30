import SwiftUI

struct NotificationsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                if store.notificationFeed.notifications.isEmpty {
                    ContentUnavailableView(
                        "Aucune notification",
                        systemImage: "bell.slash",
                        description: Text("Les nouvelles interactions apparaîtront ici.")
                    )
                    .foregroundStyle(VelvetColor.textSecondary)
                } else {
                    List(store.notificationFeed.notifications) { notification in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(notification.title)
                                .font(VelvetTypography.body(size: 15, weight: .semibold))
                                .foregroundStyle(VelvetColor.ivory)
                            if let body = notification.body {
                                Text(body)
                                    .font(VelvetTypography.caption())
                                    .foregroundStyle(VelvetColor.textSecondary)
                            }
                        }
                        .listRowBackground(Color.white.opacity(notification.readAt == nil ? 0.07 : 0.03))
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Notifications")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Fermer", action: dismiss.callAsFunction)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Tout lire") { Task { await store.markNotificationsRead() } }
                }
            }
        }
    }
}
