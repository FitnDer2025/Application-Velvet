import SwiftUI

struct MainShellView: View {
    private enum Tab: String, CaseIterable {
        case home
        case discover
        case maps
        case messages
        case profile

        var label: String {
            switch self {
            case .home: "Accueil"
            case .discover: "Recherche"
            case .maps: "Maps"
            case .messages: "Messages"
            case .profile: "Profil"
            }
        }

        var icon: String {
            switch self {
            case .home: "house"
            case .discover: "magnifyingglass"
            case .maps: "map"
            case .messages: "bubble.left.and.bubble.right"
            case .profile: "person.crop.circle"
            }
        }

        var selectedIcon: String {
            switch self {
            case .home: "house.fill"
            case .discover: "magnifyingglass.circle.fill"
            case .maps: "map.fill"
            case .messages: "bubble.left.and.bubble.right.fill"
            case .profile: "person.crop.circle.fill"
            }
        }
    }

    private enum MenuRoute {
        case directory
        case agenda
        case notifications

        var placesSelection: Int? {
            switch self {
            case .directory: 1
            case .agenda: 3
            case .notifications: nil
            }
        }
    }

    let profile: MemberProfile
    @StateObject private var store = VelvetStore()
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedTab: Tab = .home
    @State private var showsNotifications = false
    @State private var showsMenu = false
    @State private var showsPlacesEvents = false
    @State private var pendingMenuRoute: MenuRoute?
    @State private var placesSelection = 0

    var body: some View {
        ZStack {
            VelvetBackground()

            VStack(spacing: 0) {
                VelvetTopBar(
                    unreadCount: store.notificationFeed.unreadCount,
                    notifications: { showsNotifications = true },
                    menu: { showsMenu = true }
                )

                selectedContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                bottomNavigation
            }
        }
        .environmentObject(store)
        .task {
            await store.load()
            if let route = NotificationService.consumePendingRoute() {
                openNotificationRoute(route)
            }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(20))
                guard !Task.isCancelled, scenePhase == .active else { continue }
                await store.refreshMessaging()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await store.refreshMessaging() }
        }
        .sheet(isPresented: $showsNotifications) {
            NotificationsView()
                .environmentObject(store)
        }
        .sheet(isPresented: $showsMenu, onDismiss: openPendingMenuRoute) {
            NavigationStack {
                VelvetMenuView(
                    openPlaces: {
                        pendingMenuRoute = .directory
                        showsMenu = false
                    },
                    openNotifications: {
                        pendingMenuRoute = .notifications
                        showsMenu = false
                    },
                    openAgenda: {
                        pendingMenuRoute = .agenda
                        showsMenu = false
                    }
                )
                .environmentObject(store)
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showsPlacesEvents) {
            NavigationStack {
                PlacesEventsView(initialSelection: placesSelection)
                    .environmentObject(store)
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Fermer") { showsPlacesEvents = false }
                                .foregroundStyle(VelvetColor.champagneGold)
                        }
                    }
            }
        }
        .alert(
            "Velvet",
            isPresented: Binding(
                get: { store.errorMessage != nil },
                set: { if !$0 { store.errorMessage = nil } }
            )
        ) {
            Button("Fermer", role: .cancel) { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "")
        }
        .onReceive(
            NotificationCenter.default.publisher(for: .velvetNotificationRoute)
        ) { notification in
            guard let route = notification.object as? String else { return }
            _ = NotificationService.consumePendingRoute()
            openNotificationRoute(route)
        }
    }

    @ViewBuilder
    private var selectedContent: some View {
        switch selectedTab {
        case .home:
            NavigationStack { PremiumHomeView(profile: profile) }
        case .discover:
            NavigationStack { DiscoveryView(currentProfile: profile) }
        case .maps:
            NavigationStack { MemberMapView() }
        case .messages:
            NavigationStack { ConversationsView() }
        case .profile:
            NavigationStack { PremiumProfileSummaryView(profile: profile) }
        }
    }

    private var bottomNavigation: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.rawValue) { tab in
                Button {
                    withAnimation(.easeOut(duration: VelvetMotion.fast)) {
                        selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 5) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: selectedTab == tab ? tab.selectedIcon : tab.icon)
                                .font(.system(size: 17, weight: .medium))
                                .frame(width: 26, height: 20)

                            if tab == .messages, store.unreadMessageCount > 0 {
                                Text(store.unreadMessageCount > 99 ? "99+" : "\(store.unreadMessageCount)")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, store.unreadMessageCount > 9 ? 4 : 0)
                                    .frame(minWidth: 17, minHeight: 17)
                                    .background(VelvetColor.danger)
                                    .clipShape(Capsule())
                                    .offset(x: 9, y: -8)
                                    .accessibilityLabel("\(store.unreadMessageCount) messages non lus")
                            }
                        }
                        Text(tab.label)
                            .font(.system(size: 9, weight: .semibold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(
                        selectedTab == tab
                            ? VelvetColor.champagneGold
                            : VelvetColor.textSecondary
                    )
                    .frame(maxWidth: .infinity)
                    .frame(height: 58)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selectedTab == tab ? .isSelected : [])
            }
        }
        .padding(.horizontal, 5)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.78))
        .overlay(alignment: .top) {
            Rectangle()
                .fill(VelvetColor.borderSubtle)
                .frame(height: 1)
        }
    }

    private func openPendingMenuRoute() {
        guard let route = pendingMenuRoute else { return }
        pendingMenuRoute = nil
        DispatchQueue.main.async {
            if let selection = route.placesSelection {
                placesSelection = selection
                showsPlacesEvents = true
            } else {
                showsNotifications = true
            }
        }
    }

    private func openNotificationRoute(_ route: String) {
        switch route {
        case "messages", "message", "conversations":
            selectedTab = .messages
        case "events", "event":
            placesSelection = 0
            showsPlacesEvents = true
        case "maps", "location":
            selectedTab = .maps
        case "profile", "likes", "recommendations":
            selectedTab = .profile
        default:
            showsNotifications = true
        }
    }
}

private struct VelvetMenuView: View {
    @Environment(\.dismiss) private var dismiss
    let openPlaces: () -> Void
    let openNotifications: () -> Void
    let openAgenda: () -> Void

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    VelvetPageHeader(
                        "Navigation",
                        title: "Plus de Velvet",
                        subtitle: "Retrouve les sorties, les établissements et l’activité de ton compte."
                    )
                    .padding(.bottom, 12)

                    menuButton("Sorties & établissements", icon: "sparkles", action: openPlaces)
                    menuButton("Notifications", icon: "bell", action: openNotifications)

                    Button(action: openAgenda) {
                        menuLabel("Agenda complet", icon: "calendar")
                    }
                    .buttonStyle(.plain)
                }
                .padding(20)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Fermer", action: dismiss.callAsFunction)
                    .foregroundStyle(VelvetColor.champagneGold)
            }
        }
    }

    private func menuButton(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            menuLabel(title, icon: icon)
        }
        .buttonStyle(.plain)
    }

    private func menuLabel(_ title: String, icon: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .foregroundStyle(VelvetColor.champagneGold)
                .frame(width: 38, height: 38)
                .background(VelvetColor.champagneGold.opacity(0.08))
                .clipShape(Circle())
            Text(title)
                .font(VelvetTypography.body(size: 15, weight: .semibold))
                .foregroundStyle(VelvetColor.ivory)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(VelvetColor.textSecondary)
        }
        .padding(16)
        .background(VelvetColor.ivory.opacity(0.035))
        .clipShape(RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: VelvetRadius.medium, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 1)
        }
    }
}
