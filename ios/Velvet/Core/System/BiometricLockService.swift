import LocalAuthentication
import SwiftUI

@MainActor
final class BiometricLockService: ObservableObject {
    @Published private(set) var isEnabled: Bool
    @Published private(set) var isUnlocked: Bool
    @Published private(set) var isAvailable = false
    @Published private(set) var biometryName = "Face ID"
    @Published var errorMessage: String?

    private let enabledKey = "velvet.biometric-lock.enabled"

    init() {
        let enabled = UserDefaults.standard.bool(forKey: enabledKey)
        isEnabled = enabled
        isUnlocked = !enabled
        refreshAvailability()
    }

    func refreshAvailability() {
        let context = LAContext()
        var error: NSError?
        isAvailable = context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &error
        )
        switch context.biometryType {
        case .faceID:
            biometryName = "Face ID"
        case .touchID:
            biometryName = "Touch ID"
        case .opticID:
            biometryName = "Optic ID"
        default:
            biometryName = "Biométrie"
        }
    }

    func setEnabled(_ enabled: Bool) async -> Bool {
        if enabled {
            refreshAvailability()
            guard isAvailable else {
                errorMessage = "Aucune identification biométrique n’est configurée sur cet appareil."
                return false
            }
            guard await authenticate(
                reason: "Active \(biometryName) pour protéger ton espace privé Zwit."
            ) else {
                return false
            }
            isEnabled = true
            isUnlocked = true
            UserDefaults.standard.set(true, forKey: enabledKey)
            return true
        }

        isEnabled = false
        isUnlocked = true
        UserDefaults.standard.set(false, forKey: enabledKey)
        return true
    }

    func lock() {
        guard isEnabled else { return }
        isUnlocked = false
    }

    func unlockIfNeeded() async {
        guard isEnabled, !isUnlocked else { return }
        _ = await unlock()
    }

    @discardableResult
    func unlock() async -> Bool {
        guard isEnabled else {
            isUnlocked = true
            return true
        }
        let success = await authenticate(
            reason: "Déverrouille ton espace privé Zwit."
        )
        isUnlocked = success
        return success
    }

    private func authenticate(reason: String) async -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Annuler"
        context.localizedFallbackTitle = "Utiliser le code"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            errorMessage = "L’authentification de l’iPhone n’est pas disponible."
            return false
        }

        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
        } catch {
            errorMessage = "Zwit reste verrouillé. Réessaie lorsque tu es prêt."
            return false
        }
    }
}

struct BiometricLockView: View {
    @EnvironmentObject private var biometrics: BiometricLockService

    var body: some View {
        ZStack {
            VelvetBackground()

            VStack(spacing: 24) {
                VelvetMark(size: 82)

                VStack(spacing: 9) {
                    Text("ESPACE PRIVÉ")
                        .font(VelvetTypography.caption(size: 10, weight: .semibold))
                        .tracking(2)
                        .foregroundStyle(VelvetColor.champagneGold)

                    Text("Zwit est verrouillé")
                        .font(VelvetTypography.title(size: 31))
                        .foregroundStyle(VelvetColor.ivory)

                    Text("Ton contenu reste masqué dès que l’application quitte l’écran.")
                        .font(VelvetTypography.body(size: 13))
                        .foregroundStyle(VelvetColor.textSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 290)
                }

                Button {
                    Task { await biometrics.unlock() }
                } label: {
                    Label(
                        "Déverrouiller avec \(biometrics.biometryName)",
                        systemImage: biometrics.biometryName == "Face ID"
                            ? "faceid"
                            : "touchid"
                    )
                    .font(VelvetTypography.body(size: 14, weight: .semibold))
                    .foregroundStyle(VelvetColor.velvetBlack)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(VelvetColor.champagneGold)
                    .clipShape(
                        RoundedRectangle(
                            cornerRadius: VelvetRadius.medium,
                            style: .continuous
                        )
                    )
                }
                .buttonStyle(.plain)
                .frame(maxWidth: 320)
            }
            .padding(24)
        }
        .alert(
            "Zwit",
            isPresented: Binding(
                get: { biometrics.errorMessage != nil },
                set: { if !$0 { biometrics.errorMessage = nil } }
            )
        ) {
            Button("Fermer", role: .cancel) { biometrics.errorMessage = nil }
        } message: {
            Text(biometrics.errorMessage ?? "")
        }
    }
}
