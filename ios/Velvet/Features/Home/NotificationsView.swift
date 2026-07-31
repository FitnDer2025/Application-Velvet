import SwiftUI

struct NotificationsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore

    @State private var activeConversation: Conversation?
    @State private var activeProfile: MemberProfile?
    @State private var showsEvents = false
    @State private var isOpening = false

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack(alignment: .bottom) {
                            VelvetPageHeader(
                                "Activité authentique",
                                title: "Notifications",
                                subtitle: "Messages, réactions, visites de profil, sorties et alertes de sécurité."
                            )
                            Spacer(minLength: 8)
                            if store.notificationFeed.unreadCount > 0 {
                                Text("\(store.notificationFeed.unreadCount)")
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .foregroundStyle(.white)
                                    .frame(minWidth: 34, minHeight: 34)
                                    .background(VelvetColor.burgundyLight)
                                    .clipShape(Circle())
                                    .accessibilityLabel("\(store.notificationFeed.unreadCount) notifications non lues")
                            }
                        }

                        if store.notificationFeed.unreadCount > 0 {
                            Button {
                                Task { await store.markNotificationsRead() }
                            } label: {
                                Label("Tout lire", systemImage: "checkmark.circle.fill")
                                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                                    .foregroundStyle(VelvetColor.velvetBlack)
                                    .frame(maxWidth: .infinity, minHeight: 44)
                                    .background(VelvetColor.champagneGold)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }

                        if store.notificationFeed.notifications.isEmpty {
                            VelvetEmptyState(
                                symbol: "bell",
                                title: "Aucune notification",
                                message: "Les messages, likes, visites de profil et alertes de capture apparaîtront ici."
                            )
                        } else {
                            LazyVStack(spacing: 10) {
                                ForEach(store.notificationFeed.notifications) { notification in
                                    Button {
                                        Task { await open(notification) }
                                    } label: {
                                        NotificationTile(
                                            notification: notification,
                                            actor: actorProfile(for: notification)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(isOpening)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                    .padding(.bottom, 30)
                }
                .refreshable { await store.refreshMessaging() }

                if isOpening {
                    ProgressView()
                        .tint(VelvetColor.champagneGold)
                        .padding(18)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
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
            .navigationDestination(
                isPresented: Binding(
                    get: { activeConversation != nil },
                    set: { if !$0 { activeConversation = nil } }
                )
            ) {
                if let activeConversation {
                    AppleConversationView(conversation: activeConversation)
                }
            }
            .navigationDestination(
                isPresented: Binding(
                    get: { activeProfile != nil },
                    set: { if !$0 { activeProfile = nil } }
                )
            ) {
                if let activeProfile {
                    MemberDetailView(profile: activeProfile)
                }
            }
            .navigationDestination(isPresented: $showsEvents) {
                PlacesEventsView(initialSelection: 0)
                    .environmentObject(store)
            }
        }
    }

    private func actorProfile(for notification: VelvetNotification) -> MemberProfile? {
        guard let id = notification.actorProfileId else { return nil }
        return store.directory?.profiles.first(where: { $0.id == id })
    }

    @MainActor
    private func open(_ notification: VelvetNotification) async {
        guard !isOpening else { return }
        isOpening = true
        defer { isOpening = false }

        if notification.readAt == nil {
            await store.markNotificationRead(id: notification.id)
        }

        switch notification.eventType {
        case "messages", "message":
            await store.refreshMessaging()
            if let conversationID = notification.entityId {
                if let conversation = store.directory?.conversations.first(where: { $0.id == conversationID }) {
                    activeConversation = conversation
                } else {
                    let actor = actorProfile(for: notification)
                    activeConversation = .direct(
                        id: conversationID,
                        title: actor?.displayName ?? sourceName(for: notification),
                        profileID: actor?.id,
                        photoURL: actor?.profileGalleryPhotos.first?.previewUrl
                    )
                }
            }

        case "events", "event", "registrations":
            showsEvents = true

        case "reactions", "likes", "profile_views", "views", "security":
            if let actor = actorProfile(for: notification) {
                activeProfile = actor
            }

        default:
            if let actor = actorProfile(for: notification) {
                activeProfile = actor
            }
        }
    }

    private func sourceName(for notification: VelvetNotification) -> String {
        actorProfile(for: notification)?.displayName ?? "Membre Velvet"
    }
}

private struct NotificationTile: View {
    let notification: VelvetNotification
    let actor: MemberProfile?

    private var icon: String {
        switch notification.eventType {
        case "messages", "message": "message.fill"
        case "reactions", "likes": "heart.fill"
        case "profile_views", "views": "eye.fill"
        case "events", "event", "registrations": "calendar.badge.clock"
        case "security": "shield.fill"
        default: "bell.fill"
        }
    }

    private var title: String {
        if notification.eventType == "messages",
           let actor,
           !notification.title.localizedCaseInsensitiveContains(actor.displayName) {
            return "\(actor.displayName) vous a écrit"
        }
        return notification.title
    }

    private var avatar: URL? {
        actor?.profileGalleryPhotos.first(where: { $0.isPrimary == true })?.previewUrl
            ?? actor?.profileGalleryPhotos.first?.previewUrl
    }

    var body: some View {
        HStack(alignment: .center, spacing: 13) {
            ZStack(alignment: .bottomTrailing) {
                if let actor {
                    VelvetRemoteImage(
                        url: avatar,
                        symbol: actor.profileType == .couple ? "person.2.fill" : "person.fill"
                    )
                } else {
                    ZStack {
                        VelvetColor.velvetBurgundy.opacity(0.22)
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(VelvetColor.champagneGold)
                    }
                }
            }
            .frame(width: 52, height: 52)
            .clipShape(Circle())
            .overlay(Circle().stroke(VelvetColor.champagneGold.opacity(0.22), lineWidth: 0.8))
            .overlay(alignment: .bottomTrailing) {
                Image(systemName: icon)
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(VelvetColor.velvetBlack)
                    .frame(width: 20, height: 20)
                    .background(VelvetColor.champagneGold)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(VelvetColor.velvetBlack, lineWidth: 1.5))
            }

            VStack(alignment: .leading, spacing: 5) {
                if let actor {
                    Text(actor.displayName.uppercased())
                        .font(VelvetTypography.caption(size: 8, weight: .bold))
                        .tracking(1.1)
                        .foregroundStyle(VelvetColor.champagneGold)
                }

                Text(title)
                    .font(VelvetTypography.body(size: 14, weight: notification.readAt == nil ? .bold : .semibold))
                    .foregroundStyle(VelvetColor.ivory)
                    .multilineTextAlignment(.leading)

                if let body = notification.body, !body.isEmpty {
                    Text(body)
                        .font(VelvetTypography.body(size: 12))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }

                Text(notification.createdAt.velvetDateLabel)
                    .font(VelvetTypography.caption(size: 9, weight: .semibold))
                    .foregroundStyle(VelvetColor.textSecondary)
            }

            Spacer(minLength: 6)

            VStack(spacing: 10) {
                if notification.readAt == nil {
                    Text("NOUVEAU")
                        .font(VelvetTypography.caption(size: 7, weight: .bold))
                        .tracking(0.8)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7)
                        .frame(height: 20)
                        .background(VelvetColor.burgundyLight)
                        .clipShape(Capsule())
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(VelvetColor.textSecondary)
            }
        }
        .padding(14)
        .background(
            notification.readAt == nil
                ? VelvetColor.velvetBurgundy.opacity(0.12)
                : VelvetColor.panelRaised.opacity(0.58)
        )
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(
                    notification.readAt == nil
                        ? VelvetColor.champagneGold.opacity(0.22)
                        : VelvetColor.borderSubtle,
                    lineWidth: 0.8
                )
        }
    }
}
