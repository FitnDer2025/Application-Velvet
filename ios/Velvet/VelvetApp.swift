import SwiftUI

@main
struct VelvetApp: App {
    @UIApplicationDelegateAdaptor(VelvetAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var appState = AppState()
    @StateObject private var biometrics = BiometricLockService()
    @StateObject private var screenshotProtection = ScreenshotProtectionService()
    @StateObject private var location = LocationService()
    @State private var locationConfiguredForSession = false

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(biometrics)
                .environmentObject(screenshotProtection)
                .environmentObject(location)
                .preferredColorScheme(.dark)
                .task {
                    await appState.restoreSession()
                    await biometrics.unlockIfNeeded()
                    configureLocationIfNeeded()
                }
                .onChange(of: appState.phase.id) { _, phaseID in
                    if phaseID == "home" {
                        configureLocationIfNeeded()
                    } else if phaseID == "signedOut" {
                        locationConfiguredForSession = false
                        location.onLocation = nil
                    }
                }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                Task {
                    // Laisse la scène et LocalAuthentication redevenir interactifs
                    // avant de présenter Face ID après une sortie de veille.
                    try? await Task.sleep(for: .milliseconds(220))
                    guard !Task.isCancelled else { return }
                    await biometrics.unlockIfNeeded()
                }
            case .inactive:
                // Face ID, le centre de contrôle et plusieurs feuilles système
                // utilisent cet état. Le verrouillage ici créait une boucle.
                break
            case .background:
                biometrics.lock()
            @unknown default:
                break
            }
        }
    }

    @MainActor
    private func configureLocationIfNeeded() {
        guard !locationConfiguredForSession else { return }
        guard case .home = appState.phase else { return }

        locationConfiguredForSession = true
        location.onLocation = { coordinate in
            location.onLocation = nil
            Task {
                _ = try? await appState.session.saveLocation(
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude
                )
            }
        }
        location.requestOneShotLocation()
    }
}
