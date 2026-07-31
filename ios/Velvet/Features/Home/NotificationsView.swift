import SwiftUI

enum VelvetNotificationDestination {
    case conversation(Conversation)
    case profile(MemberProfile)
    case events
}

private enum NotificationActivityTab: String, CaseIterable {
    case active = "Nouvelles"
    case archives = "Archives"
}

struct NotificationsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: VelvetStore

    let onDestination: (VelvetNotificationDestination) -> Void

    @State private var selectedTab: NotificationActivityTab = .active
    @State private var isOpening = false

    private var feed: NotificationFeed {
        selectedTab == .active ? store.notificationFeed : store.archivedNotificationFeed
    }

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        header
                        tabSelector

                        if selectedTab == .active, store.notificationFeed.unreadCount > 0 {
                            Button {
                                Task { await store.markNotificationsRead() }
                            } label: {
                                Label("Tout archiver", systemImage: "archivebox.fill")
                                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                                    .foregroundStyle(VelvetColor.velvetBlack)
                                    .frame(maxWidth: .infinity, minHeight: 44)
                                    .background(VelvetColor.champagneGold)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }

                        notificationList

                        if selectedTab == .active {
                            viewedProfilesSection
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 18)
                    .padding(.bottom, 34)
                }
                .refreshable { await refreshCurrentTab() }

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
                if selectedTab == .active, store.notificationFeed.unreadCount > 0 {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Tout archiver") {
                            Task { await store.markNotificationsRead() }
                        }
                        .font(VelvetTypography.caption(size: 11, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    }
                }
            }
            .toolbarBackground(VelvetColor.velvetBlack.opacity(0.92), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .task {
            await store.refreshArchivedNotifications()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                guard !Task.isCancelled else { return }
                await refreshCurrentTab()
            }
        }
        .onChange(of: selectedTab) { _, _ in
            Task { await refreshCurrentTab() }
        }
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VelvetPageHeader(
                "Votre activité",
                title: "Notifications",
                subtitle: "Messages, réactions, visites, sorties et alertes de sécurité, avec leur origine précise."
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
    }

    private var tabSelector: some View {
        HStack(spacing: 5) {
            ForEach(NotificationActivityTab.allCases, id: \.rawValue) { tab in
                Button {
                    withAnimation(.easeOut(duration: VelvetMotion.fast)) {
                        selectedTab = tab
                    }
                } label: {
                    HStack(spacing: 6) {
                        Text(tab.rawValue)
                        if tab == .active, store.notificationFeed.unreadCount > 0 {
                            Text("\(store.notificationFeed.unreadCount)")
                                .font(.system(size: 9, weight: .bold, design: .rounded))
                                .padding(.horizontal, 5)
                                .frame(height: 18)
                                .background(VelvetColor.burgundyLight)
                                .clipShape(Capsule())
                        }
                        if tab == .archives, (store.notificationFeed.archiveCount ?? 0) > 0 {
                            Text("\(store.notificationFeed.archiveCount ?? 0)")
                                .font(.system(size: 9, weight: .bold, design: .rounded))
                                .foregroundStyle(VelvetColor.textSecondary)
                        }
                    }
                    .font(VelvetTypography.body(size: 12, weight: .semibold))
                    .foregroundStyle(selectedTab == tab ? VelvetColor.velvetBlack : VelvetColor.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 38)
                    .background(selectedTab == tab ? VelvetColor.champagneGold : VelvetColor.ivory.opacity(0.045))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(VelvetColor.borderSubtle, lineWidth: 0.7))
    }

    @ViewBuilder
    private var notificationList: some View {
        if feed.notifications.isEmpty {
            VelvetEmptyState(
                symbol: selectedTab == .active ? "bell" : "archivebox",
                title: selectedTab == .active ? "Aucune nouvelle activité" : "Archives vides",
                message: selectedTab == .active
                    ? "Les messages, likes, visites de profil et alertes apparaîtront ici."
                    : "Les notifications consultées seront conservées ici."
            )
        } else {
            LazyVStack(spacing: 10) {
                ForEach(feed.notifications) { notification in
                    if selectedTab == .active {
                        Button {
                            Task { await open(notification) }
                        } label: {
                            NotificationTile(
                                notification: notification,
                                actor: actorProfile(for: notification),
                                archived: false
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(isOpening)
                    } else {
                        NotificationTile(
                            notification: notification,
                            actor: actorProfile(for: notification),
                            archived: true
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var viewedProfilesSection: some View {
        let viewed = store.viewedProfiles
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("VOS CONSULTATIONS")
                        .font(VelvetTypography.caption(size: 8, weight: .bold))
                        .tracking(1.2)
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text("Profils consultés")
                        .font(VelvetTypography.body(size: 17, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                }
                Spacer()
                Text("\(viewed.count)")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(VelvetColor.champagneGold)
            }

            if viewed.isEmpty {
                Text("Vos profils récemment consultés apparaîtront ici avec la date et le nombre de visites.")
                    .font(VelvetTypography.body(size: 12))
                    .foregroundStyle(VelvetColor.textSecondary)
            } else {
                ForEach(viewed.prefix(30), id: \.history.id) { item in
                    Button {
                        if let profile = item.profile {
                            onDestination(.profile(profile))
                        }
                    } label: {
                        HStack(spacing: 11) {
                            VelvetRemoteImage(
                                url: item.profile?.profileGalleryPhotos.first(where: { $0.isPrimary == true })?.previewUrl
                                    ?? item.profile?.profileGalleryPhotos.first?.previewUrl,
                                symbol: item.profile?.profileType == .couple ? "person.2.fill" : "person.fill"
                            )
                            .frame(width: 44, height: 44)
                            .clipShape(Circle())

                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.profile?.displayName ?? "Profil Velvet")
                                    .font(VelvetTypography.body(size: 13, weight: .semibold))
                                    .foregroundStyle(VelvetColor.ivory)
                                Text("\(item.history.viewCount ?? 1) consultation\((item.history.viewCount ?? 1) > 1 ? "s" : "") · dernière visite \(item.history.lastViewedAt.velvetRelativeDate)")
                                    .font(VelvetTypography.caption(size: 9))
                                    .foregroundStyle(VelvetColor.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(VelvetColor.textSecondary)
                        }
                        .padding(10)
                        .background(VelvetColor.ivory.opacity(0.035))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(item.profile == nil)
                }
            }
        }
        .padding(14)
        .background(VelvetColor.panelRaised.opacity(0.46))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.8)
        }
    }

    private func actorProfile(for notification: VelvetNotification) -> MemberProfile? {
        guard let id = notification.actorProfileId else { return nil }
        return store.directory?.profiles.first(where: { $0.id == id })
    }

    @MainActor
    private func refreshCurrentTab() async {
        if selectedTab == .active {
            await store.refreshMessaging()
        } else {
            await store.refreshArchivedNotifications()
        }
    }

    @MainActor
    private func open(_ notification: VelvetNotification) async {
        guard !isOpening else { return }
        isOpening = true
        defer { isOpening = false }

        await store.markNotificationRead(id: notification.id)

        switch notification.eventType {
        case "messages", "message":
            await store.refreshMessaging()
            guard let conversationID = notification.entityId else { return }
            if let conversation = store.directory?.conversations.first(where: { $0.id == conversationID }) {
                onDestination(.conversation(conversation))
            } else {
                let actor = actorProfile(for: notification)
                onDestination(.conversation(.direct(
                    id: conversationID,
                    title: notification.metadata?.senderIdentity
                        ?? actor?.displayName
                        ?? sourceName(for: notification),
                    profileID: actor?.id,
                    photoURL: actor?.profileGalleryPhotos.first?.previewUrl
                )))
            }

        case "events", "event", "registrations":
            onDestination(.events)

        case "reactions", "likes", "profile_views", "views", "security":
            if let actor = actorProfile(for: notification) {
                onDestination(.profile(actor))
            }

        default:
            if let actor = actorProfile(for: notification) {
                onDestination(.profile(actor))
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
    let archived: Bool

    private var icon: String {
        switch notification.eventType {
        case "messages", "message": "message.fill"
        case "reactions", "likes": "heart.fill"
        case "profile_views", "views": "eye.fill"
        case "events", "event", "registrations": "calendar.badge.clock"
        case "security", "screenshot", "screen_recording": "shield.fill"
        default: "bell.fill"
        }
    }

    private var title: String {
        if notification.eventType == "messages",
           let identity = notification.metadata?.senderIdentity,
           !identity.isEmpty {
            return "\(identity) vous a écrit"
        }
        return notification.title
    }

    private var avatar: URL? {
        notification.actorPreviewUrl
            ?? actor?.profileGalleryPhotos.first(where: { $0.isPrimary == true })?.previewUrl
            ?? actor?.profileGalleryPhotos.first?.previewUrl
    }

    private var reactionEmoji: String? {
        guard notification.eventType == "reactions" || notification.eventType == "likes" else { return nil }
        return ["like": "👍", "love": "❤️", "adore": "😍"][notification.metadata?.reaction ?? ""] ?? "❤️"
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            ZStack(alignment: .bottomTrailing) {
                if avatar != nil || actor != nil {
                    VelvetRemoteImage(
                        url: avatar,
                        symbol: actor?.profileType == .couple ? "person.2.fill" : "person.fill"
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
            .frame(width: 50, height: 50)
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

            VStack(alignment: .leading, spacing: 4) {
                if let actor {
                    Text(actor.displayName.uppercased())
                        .font(VelvetTypography.caption(size: 8, weight: .bold))
                        .tracking(1.0)
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

            Spacer(minLength: 4)

            if let preview = notification.entityPreviewUrl {
                ZStack(alignment: .bottomTrailing) {
                    VelvetRemoteImage(url: preview, symbol: "photo.fill")
                        .frame(width: 52, height: 52)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    if let reactionEmoji {
                        Text(reactionEmoji)
                            .font(.system(size: 13))
                            .frame(width: 23, height: 23)
                            .background(VelvetColor.velvetBlack)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(VelvetColor.champagneGold, lineWidth: 1.2))
                            .offset(x: 4, y: 4)
                    }
                }
            } else if !archived {
                VStack(spacing: 8) {
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
            } else {
                Image(systemName: "archivebox.fill")
                    .foregroundStyle(VelvetColor.textSecondary)
            }
        }
        .padding(13)
        .background(
            notification.readAt == nil && !archived
                ? VelvetColor.velvetBurgundy.opacity(0.12)
                : VelvetColor.panelRaised.opacity(0.58)
        )
        .clipShape(RoundedRectangle(cornerRadius: 21, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 21, style: .continuous)
                .stroke(
                    notification.readAt == nil && !archived
                        ? VelvetColor.champagneGold.opacity(0.22)
                        : VelvetColor.borderSubtle,
                    lineWidth: 0.8
                )
        }
    }
}

private extension Optional where Wrapped == String {
    var velvetRelativeDate: String {
        guard let value = self else { return "inconnue" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
        guard let date else { return "inconnue" }
        let relative = RelativeDateTimeFormatter()
        relative.unitsStyle = .full
        return relative.localizedString(for: date, relativeTo: .now)
    }
}
