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
            case .discover: "magnifyingglass"
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
        case studio
        case editProfile
        case privacy

        var placesSelection: Int? {
            switch self {
            case .directory: 1
            case .agenda: 3
            default: nil
            }
        }
    }

    let profile: MemberProfile

    @EnvironmentObject private var appState: AppState
    @StateObject private var store = VelvetStore()
    @StateObject private var chrome = ShellChromeState()
    @Environment(\.scenePhase) private var scenePhase

    @State private var selectedTab: Tab = .home
    @State private var showsNotifications = false
    @State private var showsMenu = false
    @State private var showsPlacesEvents = false
    @State private var showsStudio = false
    @State private var showsProfileEditor = false
    @State private var showsPrivacy = false
    @State private var pendingMenuRoute: MenuRoute?
    @State private var pendingNotificationDestination: VelvetNotificationDestination?
    @State private var routedConversation: Conversation?
    @State private var routedProfile: MemberProfile?
    @State private var placesSelection = 0

    var body: some View {
        ZStack {
            VelvetBackground()

            VStack(spacing: 0) {
                if !chrome.isImmersive {
                    CompactVelvetTopBar(
                        unreadCount: store.notificationFeed.unreadCount,
                        notifications: { showsNotifications = true },
                        menu: { showsMenu = true }
                    )
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                selectedContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                if !chrome.isImmersive {
                    bottomNavigation
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.easeOut(duration: VelvetMotion.fast), value: chrome.isImmersive)
        }
        .environmentObject(store)
        .environmentObject(chrome)
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
        .sheet(isPresented: $showsNotifications, onDismiss: openPendingNotificationDestination) {
            NotificationsView { destination in
                pendingNotificationDestination = destination
                showsNotifications = false
            }
            .environmentObject(store)
            .environmentObject(chrome)
        }
        .sheet(isPresented: $showsMenu, onDismiss: openPendingMenuRoute) {
            NavigationStack {
                VelvetMenuView(
                    openPlaces: { queue(.directory) },
                    openNotifications: { queue(.notifications) },
                    openAgenda: { queue(.agenda) },
                    openStudio: { queue(.studio) },
                    editProfile: { queue(.editProfile) },
                    openPrivacy: { queue(.privacy) }
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
        .sheet(isPresented: $showsStudio) {
            NavigationStack {
                MemberToolsView()
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Fermer") { showsStudio = false }
                                .foregroundStyle(VelvetColor.champagneGold)
                        }
                    }
            }
        }
        .sheet(isPresented: $showsProfileEditor) {
            ProfileEditorView(profile: profile)
        }
        .sheet(isPresented: $showsPrivacy) {
            PrivacySettingsView()
        }
        .sheet(item: $routedProfile) { member in
            NavigationStack {
                MemberDetailView(profile: member)
                    .environmentObject(store)
                    .environmentObject(chrome)
            }
        }
        .fullScreenCover(item: $routedConversation) { conversation in
            NavigationStack {
                AppleConversationView(conversation: conversation)
                    .environmentObject(store)
                    .environmentObject(chrome)
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
        .onReceive(NotificationCenter.default.publisher(for: .velvetNotificationRoute)) { notification in
            guard let route = notification.object as? VelvetNotificationRoute else { return }
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
            NavigationStack { PremiumDiscoveryGridView(currentProfile: profile) }
        case .maps:
            NavigationStack { MemberMapView() }
        case .messages:
            NavigationStack { AppleConversationsView() }
        case .profile:
            NavigationStack { PremiumOwnProfileView(profile: profile) }
        }
    }

    private var bottomNavigation: some View {
        HStack(spacing: 4) {
            ForEach(Tab.allCases, id: \.rawValue) { tab in
                Button {
                    withAnimation(.easeOut(duration: VelvetMotion.fast)) {
                        selectedTab = tab
                    }
                } label: {
                    VStack(spacing: 4) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: selectedTab == tab ? tab.selectedIcon : tab.icon)
                                .font(.system(size: 17, weight: .medium))
                                .frame(width: 36, height: 30)
                                .background {
                                    if selectedTab == tab {
                                        Circle()
                                            .fill(.ultraThinMaterial)
                                            .background(VelvetColor.champagneGold.opacity(0.08))
                                            .clipShape(Circle())
                                            .overlay {
                                                Circle().stroke(
                                                    VelvetColor.champagneGold.opacity(0.24),
                                                    lineWidth: 0.8
                                                )
                                            }
                                    }
                                }

                            if tab == .messages, store.unreadMessageCount > 0 {
                                Text(store.unreadMessageCount > 99 ? "99+" : "\(store.unreadMessageCount)")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, store.unreadMessageCount > 9 ? 4 : 0)
                                    .frame(minWidth: 17, minHeight: 17)
                                    .background(VelvetColor.danger)
                                    .clipShape(Capsule())
                                    .offset(x: 7, y: -5)
                            }
                        }

                        Text(tab.label)
                            .font(.system(size: 9, weight: selectedTab == tab ? .semibold : .medium))
                            .lineLimit(1)
                    }
                    .foregroundStyle(
                        selectedTab == tab ? VelvetColor.champagneGold : VelvetColor.textSecondary
                    )
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selectedTab == tab ? .isSelected : [])
            }
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(.ultraThinMaterial)
        .background(VelvetColor.velvetBlack.opacity(0.58))
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(VelvetColor.borderSubtle, lineWidth: 0.7)
        }
        .shadow(color: .black.opacity(0.26), radius: 20, y: 8)
        .padding(.horizontal, 12)
        .padding(.top, 4)
        .padding(.bottom, 6)
    }

    private func queue(_ route: MenuRoute) {
        pendingMenuRoute = route
        showsMenu = false
    }

    private func openPendingMenuRoute() {
        guard let route = pendingMenuRoute else { return }
        pendingMenuRoute = nil
        DispatchQueue.main.async {
            if let selection = route.placesSelection {
                placesSelection = selection
                showsPlacesEvents = true
                return
            }
            switch route {
            case .notifications: showsNotifications = true
            case .studio: showsStudio = true
            case .editProfile: showsProfileEditor = true
            case .privacy: showsPrivacy = true
            default: break
            }
        }
    }

    private func openPendingNotificationDestination() {
        guard let destination = pendingNotificationDestination else { return }
        pendingNotificationDestination = nil
        DispatchQueue.main.async {
            switch destination {
            case let .conversation(conversation):
                routedConversation = conversation
            case let .profile(member):
                routedProfile = member
            case .events:
                placesSelection = 0
                showsPlacesEvents = true
            }
        }
    }

    private func openNotificationRoute(_ route: VelvetNotificationRoute) {
        switch route.destination {
        case .notifications:
            showsNotifications = true

        case .messages:
            Task { @MainActor in
                await store.refreshMessaging()
                if let id = route.conversationID,
                   let conversation = store.directory?.conversations.first(where: { $0.id == id }) {
                    routedConversation = conversation
                } else {
                    selectedTab = .messages
                }
            }

        case .events:
            placesSelection = 0
            showsPlacesEvents = true

        case .maps:
            selectedTab = .maps

        case .profile:
            if let id = route.profileID,
               let member = store.directory?.profiles.first(where: { $0.id == id }) {
                routedProfile = member
            } else {
                selectedTab = .profile
            }
        }
    }
}

private struct VelvetMenuView: View {
    @Environment(\.dismiss) private var dismiss
    let openPlaces: () -> Void
    let openNotifications: () -> Void
    let openAgenda: () -> Void
    let openStudio: () -> Void
    let editProfile: () -> Void
    let openPrivacy: () -> Void

    var body: some View {
        ZStack {
            VelvetBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    VelvetPageHeader(
                        "Navigation",
                        title: "Plus de Velvet",
                        subtitle: "Toutes les fonctions secondaires et les outils de ton profil."
                    )
                    .padding(.bottom, 8)

                    menuButton("Sorties & établissements", detail: "Agenda, clubs et professionnels", icon: "sparkles", action: openPlaces)
                    menuButton("Notifications", detail: "Messages, réactions et activité", icon: "bell", action: openNotifications)
                    menuButton("Agenda complet", detail: "Sorties, visites et voyages", icon: "calendar", action: openAgenda)

                    Text("MON PROFIL")
                        .font(VelvetTypography.caption(size: 9, weight: .semibold))
                        .tracking(1.6)
                        .foregroundStyle(VelvetColor.champagneGold)
                        .padding(.top, 8)

                    menuButton("Studio du profil & Velvet IA", detail: "Plume, organisateur et outils avancés", icon: "wand.and.stars", action: openStudio)
                    menuButton("Modifier mon profil", detail: "Textes, identité, pratiques et préférences", icon: "square.and.pencil", action: editProfile)
                    menuButton("Paramètres & confidentialité", detail: "Face ID, visibilité, notifications et compte", icon: "slider.horizontal.3", action: openPrivacy)
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

    private func menuButton(
        _ title: String,
        detail: String,
        icon: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 13) {
                Image(systemName: icon)
                    .foregroundStyle(VelvetColor.champagneGold)
                    .frame(width: 38, height: 38)
                    .background(.ultraThinMaterial)
                    .background(VelvetColor.champagneGold.opacity(0.05))
                    .clipShape(Circle())
                    .overlay(Circle().stroke(VelvetColor.champagneGold.opacity(0.17), lineWidth: 0.7))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(VelvetTypography.body(size: 14, weight: .semibold))
                        .foregroundStyle(VelvetColor.ivory)
                    Text(detail)
                        .font(VelvetTypography.caption(size: 10))
                        .foregroundStyle(VelvetColor.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(VelvetColor.textSecondary)
            }
            .padding(14)
            .background(VelvetColor.ivory.opacity(0.03))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(VelvetColor.borderSubtle, lineWidth: 0.7)
            }
        }
        .buttonStyle(.plain)
    }
}
