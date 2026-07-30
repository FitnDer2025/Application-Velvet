import SwiftUI

@main
struct VelvetApp: App {
    @UIApplicationDelegateAdaptor(VelvetAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var appState = AppState()
    @StateObject private var biometrics = BiometricLockService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(biometrics)
                .preferredColorScheme(.dark)
                .task {
                    await appState.restoreSession()
                    await biometrics.unlockIfNeeded()
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
}
