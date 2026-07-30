import SwiftUI

struct MainShellView: View {
    let profile: MemberProfile
    @StateObject private var store = VelvetStore()

    var body: some View {
        TabView {
            NavigationStack {
                HomeView(profile: profile)
            }
            .tabItem {
                Label("Accueil", systemImage: "house")
            }

            NavigationStack {
                DiscoveryView(currentProfile: profile)
            }
            .tabItem {
                Label("Découvrir", systemImage: "safari")
            }

            NavigationStack {
                PlacesEventsView()
            }
            .tabItem {
                Label("Événements", systemImage: "calendar")
            }

            NavigationStack {
                ConversationsView()
            }
            .tabItem {
                Label("Messages", systemImage: "bubble.left.and.bubble.right")
            }

            NavigationStack {
                ProfileSummaryView(profile: profile)
            }
            .tabItem {
                Label("Profil", systemImage: "person.crop.circle")
            }
        }
        .tint(VelvetColor.champagneGold)
        .toolbarBackground(.ultraThinMaterial, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .environmentObject(store)
        .task { await store.load() }
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
    }
}
