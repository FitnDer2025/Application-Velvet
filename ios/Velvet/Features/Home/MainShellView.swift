import SwiftUI

struct MainShellView: View {
    let profile: MemberProfile

    var body: some View {
        TabView {
            NavigationStack {
                HomeView(profile: profile)
            }
            .tabItem {
                Label("Accueil", systemImage: "house")
            }

            PlaceholderDestination(
                title: "Découvrir",
                message: "Les recommandations et la recherche rejoindront ici le prochain lot natif.",
                icon: "sparkles"
            )
            .tabItem {
                Label("Découvrir", systemImage: "safari")
            }

            PlaceholderDestination(
                title: "Événements",
                message: "Les sorties, clubs et inscriptions seront connectés au backend existant.",
                icon: "calendar"
            )
            .tabItem {
                Label("Événements", systemImage: "calendar")
            }

            PlaceholderDestination(
                title: "Messages",
                message: "Les Salons Velvet seront intégrés avec leurs règles de consentement.",
                icon: "bubble.left.and.bubble.right"
            )
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
    }
}

private struct PlaceholderDestination: View {
    let title: String
    let message: String
    let icon: String

    var body: some View {
        NavigationStack {
            ZStack {
                VelvetBackground()
                VStack(spacing: VelvetSpacing.lg) {
                    Image(systemName: icon)
                        .font(.system(size: 38, weight: .ultraLight))
                        .foregroundStyle(VelvetColor.champagneGold)
                    Text(title)
                        .font(VelvetTypography.title())
                        .foregroundStyle(VelvetColor.ivory)
                    Text(message)
                        .font(VelvetTypography.body(size: 14))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, VelvetSpacing.xl)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
