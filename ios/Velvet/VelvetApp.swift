import SwiftUI

@main
struct ZwitApp: App {
    @UIApplicationDelegateAdaptor(VelvetAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var appState = AppState()
    @StateObject private var biometrics = BiometricLockService()
    @StateObject private var screenshotProtection = ScreenshotProtectionService()
    @StateObject private var location = LocationService()
    @State private var locationConfiguredForSession = false
    @State private var showsLaunchExperience = true

    var body: some Scene {
        WindowGroup {
            ZStack {
                ZwitRootContainer()
                    .environmentObject(appState)
                    .environmentObject(biometrics)
                    .environmentObject(screenshotProtection)
                    .environmentObject(location)

                if showsLaunchExperience {
                    ZwitNativeLaunchExperience {
                        withAnimation(.easeOut(duration: 0.22)) {
                            showsLaunchExperience = false
                        }
                    }
                    .transition(.opacity)
                    .zIndex(10_000)
                }
            }
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
                Task { await biometrics.unlockIfNeeded() }
            case .inactive, .background:
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
